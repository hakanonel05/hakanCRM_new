"""Automated Database Backup Service for CRMaster.

Features:
- Scheduled (daily / weekly) full database backups using APScheduler.
- On-disk storage at /app/backups with retention policy.
- Optional email delivery via Resend with backup attached.
- JSON config file (/app/backend/backup_config.json) is editable via API.
- Manual trigger endpoint.

Config schema (backup_config.json):
{
  "enabled": true,
  "frequency": "daily" | "weekly",
  "hour": 2,            # 0-23 (server local time)
  "minute": 0,          # 0-59
  "day_of_week": "mon", # only used for weekly
  "email_enabled": false,
  "email_recipients": ["admin@example.com"],
  "retention_days": 30,
  "last_run": "ISO timestamp" | null,
  "last_status": "success" | "error" | null,
  "last_error": "..." | null,
  "last_filename": "..." | null,
  "last_size_bytes": 0
}
"""
import os
import json
import base64
import logging
import asyncio
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("backup_service")

BACKEND_DIR = Path(__file__).parent
# Default to a path relative to the backend dir so it works on any host
# (Render uses /opt/render/project/src, not /app). Override via BACKUP_DIR env.
# IMPORTANT: Module import must not crash if the filesystem is read-only.
def _resolve_backup_dir() -> Path:
    candidates = []
    env_val = os.environ.get("BACKUP_DIR")
    if env_val:
        candidates.append(Path(env_val))
    candidates.append(BACKEND_DIR / "backups")
    candidates.append(Path("/tmp/crm_backups"))
    for c in candidates:
        try:
            c.mkdir(parents=True, exist_ok=True)
            return c
        except (PermissionError, OSError):
            continue
    # Last resort: in-memory only, return tmp path (writes will fail later)
    return Path("/tmp")

BACKUP_DIR = _resolve_backup_dir()

CONFIG_FILE = BACKEND_DIR / "backup_config.json"

DEFAULT_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "frequency": "daily",
    "hour": 2,
    "minute": 0,
    "day_of_week": "mon",
    "email_enabled": False,
    "email_recipients": [],
    "retention_days": 30,
    "last_run": None,
    "last_status": None,
    "last_error": None,
    "last_filename": None,
    "last_size_bytes": 0,
}

_lock = threading.Lock()
_scheduler: Optional[BackgroundScheduler] = None
_JOB_ID = "crm_full_backup_job"


def _read_config_unlocked() -> Dict[str, Any]:
    if not CONFIG_FILE.exists():
        CONFIG_FILE.write_text(json.dumps(DEFAULT_CONFIG, indent=2))
        return dict(DEFAULT_CONFIG)
    try:
        data = json.loads(CONFIG_FILE.read_text() or "{}")
    except Exception:
        data = {}
    return {**DEFAULT_CONFIG, **data}


def load_config() -> Dict[str, Any]:
    with _lock:
        return _read_config_unlocked()


def save_config(updates: Dict[str, Any]) -> Dict[str, Any]:
    with _lock:
        cur = _read_config_unlocked()
        cur.update(updates or {})
        CONFIG_FILE.write_text(json.dumps(cur, indent=2, ensure_ascii=False))
        return cur


def _collect_backup_payload(supabase) -> Dict[str, Any]:
    tables = ["customers", "visits", "calls", "options", "saved_filters",
              "kanban_views", "activity_log"]
    payload: Dict[str, Any] = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "source": "automated_backup",
    }
    for t in tables:
        try:
            res = supabase.table(t).select("*").execute()
            payload[t] = res.data or []
        except Exception as e:
            logger.warning("Backup: skipping table %s: %s", t, e)
            payload[t] = []
    return payload


def _prune_old_backups(retention_days: int) -> int:
    """Delete .json backups older than retention_days. Returns deleted count."""
    if retention_days <= 0:
        return 0
    cutoff = datetime.now() - timedelta(days=retention_days)
    deleted = 0
    for p in BACKUP_DIR.glob("crm_backup_*.json"):
        try:
            mtime = datetime.fromtimestamp(p.stat().st_mtime)
            if mtime < cutoff:
                p.unlink()
                deleted += 1
        except Exception as e:
            logger.warning("Backup prune failed for %s: %s", p, e)
    return deleted


def _send_backup_email(filepath: Path, size_bytes: int, recipients: list,
                       resend_module, sender_email: str) -> None:
    """Send backup file as email attachment using Resend."""
    if not recipients:
        return
    try:
        b64 = base64.b64encode(filepath.read_bytes()).decode("ascii")
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        size_mb = size_bytes / (1024 * 1024)
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;border-radius:12px;color:white;">
            <h2 style="margin:0;">CRMaster — Otomatik Yedek</h2>
            <p style="margin:6px 0 0;opacity:.8;">{ts}</p>
          </div>
          <div style="padding:20px;border:1px solid #e2e8f0;border-radius:12px;margin-top:12px;color:#334155;">
            <p>Otomatik yedekleme başarıyla tamamlandı.</p>
            <ul>
              <li><b>Dosya:</b> {filepath.name}</li>
              <li><b>Boyut:</b> {size_mb:.2f} MB</li>
            </ul>
            <p style="font-size:12px;color:#64748b;margin-top:24px;">
              Bu e-posta CRMaster otomatik yedekleme sistemi tarafından gönderildi.
            </p>
          </div>
        </div>
        """
        params = {
            "from": sender_email,
            "to": recipients,
            "subject": f"CRMaster Yedek — {filepath.name}",
            "html": html,
            "attachments": [{
                "filename": filepath.name,
                "content": b64,
            }],
        }
        resend_module.Emails.send(params)
    except Exception as e:
        logger.error("Backup email send failed: %s", e)
        raise


def run_backup_sync(supabase, resend_module=None, sender_email: str = "") -> Dict[str, Any]:
    """Execute a backup synchronously. Returns result dict."""
    started = datetime.now(timezone.utc)
    ts = started.strftime("%Y%m%d_%H%M%S")
    filename = f"crm_backup_{ts}.json"
    filepath = BACKUP_DIR / filename
    config = load_config()
    try:
        payload = _collect_backup_payload(supabase)
        content = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
        filepath.write_text(content, encoding="utf-8")
        size_bytes = filepath.stat().st_size

        # Optional email
        if config.get("email_enabled") and config.get("email_recipients") and resend_module:
            try:
                _send_backup_email(filepath, size_bytes,
                                   config["email_recipients"],
                                   resend_module, sender_email)
            except Exception as ee:
                logger.warning("Backup file saved but email failed: %s", ee)

        # Prune
        pruned = _prune_old_backups(int(config.get("retention_days", 30)))

        save_config({
            "last_run": started.isoformat(),
            "last_status": "success",
            "last_error": None,
            "last_filename": filename,
            "last_size_bytes": size_bytes,
        })
        logger.info("Backup ok: %s (%d bytes, pruned %d)", filename, size_bytes, pruned)
        return {
            "ok": True,
            "filename": filename,
            "size_bytes": size_bytes,
            "pruned": pruned,
        }
    except Exception as e:
        logger.exception("Backup failed: %s", e)
        save_config({
            "last_run": started.isoformat(),
            "last_status": "error",
            "last_error": str(e),
        })
        return {"ok": False, "error": str(e)}


def list_backups() -> list:
    items = []
    for p in sorted(BACKUP_DIR.glob("crm_backup_*.json"), reverse=True):
        try:
            stat = p.stat()
            items.append({
                "filename": p.name,
                "size_bytes": stat.st_size,
                "created_at": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
            })
        except Exception:
            continue
    return items


def delete_backup(filename: str) -> bool:
    # security: ensure filename only refers to file in BACKUP_DIR
    p = (BACKUP_DIR / filename).resolve()
    if not str(p).startswith(str(BACKUP_DIR.resolve())):
        return False
    if not p.exists() or not p.is_file():
        return False
    p.unlink()
    return True


def get_backup_path(filename: str) -> Optional[Path]:
    p = (BACKUP_DIR / filename).resolve()
    if not str(p).startswith(str(BACKUP_DIR.resolve())):
        return None
    if not p.exists() or not p.is_file():
        return None
    return p


# ---------------- Scheduler ----------------

def _build_trigger(config: Dict[str, Any]) -> CronTrigger:
    freq = (config.get("frequency") or "daily").lower()
    hour = int(config.get("hour", 2))
    minute = int(config.get("minute", 0))
    if freq == "weekly":
        dow = (config.get("day_of_week") or "mon").lower()
        return CronTrigger(day_of_week=dow, hour=hour, minute=minute)
    return CronTrigger(hour=hour, minute=minute)


def start_scheduler(run_backup_callable) -> None:
    """Start (or restart) the scheduler with current config.

    `run_backup_callable` should be a no-arg callable that performs the backup
    (it must capture the supabase client, resend module, sender email closure).
    """
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="UTC")
        _scheduler.start()
        logger.info("Backup scheduler started")
    apply_schedule(run_backup_callable)


def apply_schedule(run_backup_callable) -> None:
    global _scheduler
    if _scheduler is None:
        return
    config = load_config()
    # remove existing job if any
    try:
        if _scheduler.get_job(_JOB_ID):
            _scheduler.remove_job(_JOB_ID)
    except Exception:
        pass
    if not config.get("enabled"):
        logger.info("Backup scheduler: disabled")
        return
    trigger = _build_trigger(config)
    _scheduler.add_job(
        run_backup_callable,
        trigger=trigger,
        id=_JOB_ID,
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    next_run = None
    try:
        job = _scheduler.get_job(_JOB_ID)
        next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    except Exception:
        pass
    logger.info("Backup scheduler: scheduled (next=%s)", next_run)
    save_config({"next_run": next_run})


def next_run_time() -> Optional[str]:
    global _scheduler
    if _scheduler is None:
        return None
    try:
        job = _scheduler.get_job(_JOB_ID)
        if job and job.next_run_time:
            return job.next_run_time.isoformat()
    except Exception:
        pass
    return None
