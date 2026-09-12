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
import re
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

import gdrive_service

logger = logging.getLogger("backup_service")

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

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

# ---------------- Supabase Storage persistence ----------------
# Render's free-tier disk is EPHEMERAL: everything under BACKUP_DIR and the
# local backup_config.json vanish on every restart/redeploy — which made
# "backups" useless as backups. Files and config are now mirrored to Supabase
# Storage buckets (created automatically at startup; no manual setup needed).
# Local disk remains as a fast cache; storage is the source of truth.
BACKUPS_BUCKET = "crm-backups"
STATE_BUCKET = "app-state"
_CONFIG_STATE_KEY = "backup_config.json"

_supabase = None  # injected by server.py at startup via init_storage()


def init_storage(supabase_client) -> None:
    """Called once at app startup. Ensures buckets exist and pulls the last
    saved config from storage so schedule settings survive restarts."""
    global _supabase
    _supabase = supabase_client
    for bucket, public in ((BACKUPS_BUCKET, False), (STATE_BUCKET, False)):
        try:
            _supabase.storage.create_bucket(bucket, options={"public": public})
        except Exception:
            pass  # already exists (or storage unreachable — degrade gracefully)
    # Seed local config cache from storage (storage wins if present)
    try:
        raw = _supabase.storage.from_(STATE_BUCKET).download(_CONFIG_STATE_KEY)
        if raw:
            data = json.loads(raw.decode("utf-8"))
            with _lock:
                CONFIG_FILE.write_text(
                    json.dumps({**DEFAULT_CONFIG, **data}, indent=2, ensure_ascii=False)
                )
            logger.info("Backup config restored from Supabase Storage")
    except Exception as e:
        logger.info("No stored backup config in storage (fresh start ok): %s", e)


def _storage_upload(bucket: str, name: str, data: bytes, content_type: str = "application/json") -> bool:
    if _supabase is None:
        return False
    try:
        _supabase.storage.from_(bucket).upload(
            name, data, file_options={"content-type": content_type, "upsert": "true"}
        )
        return True
    except Exception as e:
        logger.warning("Storage upload failed (%s/%s): %s", bucket, name, e)
        return False


def _storage_download(bucket: str, name: str):
    if _supabase is None:
        return None
    try:
        return _supabase.storage.from_(bucket).download(name)
    except Exception:
        return None


def _storage_list(bucket: str) -> list:
    if _supabase is None:
        return []
    try:
        return _supabase.storage.from_(bucket).list() or []
    except Exception as e:
        logger.warning("Storage list failed (%s): %s", bucket, e)
        return []


def _storage_remove(bucket: str, names: list) -> bool:
    if _supabase is None or not names:
        return False
    try:
        _supabase.storage.from_(bucket).remove(names)
        return True
    except Exception as e:
        logger.warning("Storage remove failed (%s): %s", bucket, e)
        return False

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
    # Excel ve Drive durumu ayrı tutuluyor: ikisi de başarısız olsa bile JSON
    # yedeği geçerli sayılıyor, ama arayüzde sessiz kalmamaları gerekiyor.
    "last_xlsx_filename": None,
    "last_xlsx_error": None,
    "last_gdrive_status": None,
    "last_gdrive_error": None,
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
        serialized = json.dumps(cur, indent=2, ensure_ascii=False)
        CONFIG_FILE.write_text(serialized)
    # Mirror to persistent storage (outside the lock; failure is non-fatal)
    _storage_upload(STATE_BUCKET, _CONFIG_STATE_KEY, serialized.encode("utf-8"))
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


# Excel'in iki sert sınırı var ve ikisi de yedeklemeyi komple çökertebilir:
# hücrede denetim karakteri (openpyxl IllegalCharacterError fırlatıyor) ve
# 32.767 karakterlik hücre sınırı. CRM'deki serbest not alanları ikisini de
# tetikleyebiliyor; bir tek bozuk not yüzünden tüm yedeğin Excel'i
# üretilememesi kabul edilemez.
_EXCEL_YASAK = re.compile(r"[\000-\010\013\014\016-\037]")
_EXCEL_HUCRE_SINIRI = 32767
# Excel sayfası 1.048.576 satır alıyor; activity_log büyüyünce aşabilir.
_EXCEL_SATIR_SINIRI = 1_000_000


def _excel_hucre(v):
    """openpyxl yalnızca ilkel türleri yazabiliyor; gerisi metne çevriliyor.

    dict/list alanlar (contacts, products, tags, notes_list) JSON olarak
    yazılıyor — okunabilirliği düşük ama veri kaybetmemek bu dosyanın
    varlık sebebi. Geri yükleme için zaten JSON yedeği kullanılıyor;
    Excel gözle bakmak ve paylaşmak için.
    """
    if v is None:
        return ""
    if isinstance(v, bool):
        return "Evet" if v else "Hayır"
    if isinstance(v, (int, float)):
        return v
    if not isinstance(v, str):
        try:
            v = json.dumps(v, ensure_ascii=False, default=str)
        except Exception:
            v = str(v)
    v = _EXCEL_YASAK.sub("", v)
    if len(v) > _EXCEL_HUCRE_SINIRI:
        # Kırpıldığını görünür yap — sessizce kısaltmak, Excel'e bakıp
        # "veri tam" sanmaya yol açar.
        v = v[:_EXCEL_HUCRE_SINIRI - 20] + "…[KIRPILDI]"
    return v


def _build_excel_bytes(payload: Dict[str, Any]) -> bytes:
    """Her tabloyu ayrı sayfa yapan bir çalışma kitabı üretir.

    write_only kipi: activity_log on binlerce satır olabiliyor ve normal kipte
    openpyxl hepsini bellekte tutuyor — Render'ın ücretsiz katmanında 512 MB
    sınırı var.
    """
    from openpyxl import Workbook
    from openpyxl.styles import Font
    from openpyxl.cell import WriteOnlyCell

    wb = Workbook(write_only=True)
    for tablo, satirlar in payload.items():
        if not isinstance(satirlar, list):
            continue  # export_date / source gibi üstveri alanları
        # Sayfa adı 31 karakterle sınırlı ve []:*?/\ kabul etmiyor.
        ws = wb.create_sheet(title=tablo[:31])
        if not satirlar:
            ws.append(["(kayıt yok)"])
            continue
        # Sütunlar tüm satırların birleşimi: Supabase satırları aynı şemadan
        # gelse de ilk satıra güvenmek, sonradan eklenen bir alanı sessizce
        # düşürür.
        sutunlar = []
        gorulen = set()
        for s in satirlar:
            for k in s.keys():
                if k not in gorulen:
                    gorulen.add(k)
                    sutunlar.append(k)
        basliklar = []
        for k in sutunlar:
            h = WriteOnlyCell(ws, value=k)
            h.font = Font(bold=True)
            basliklar.append(h)
        ws.append(basliklar)
        for i, s in enumerate(satirlar):
            if i >= _EXCEL_SATIR_SINIRI:
                ws.append([f"[{len(satirlar) - i} satır daha var — Excel sayfa "
                           f"sınırı aşıldı, tamamı JSON yedeğinde]"])
                logger.warning("Excel: %s tablosu %d satırda kırpıldı", tablo, i)
                break
            ws.append([_excel_hucre(s.get(k)) for k in sutunlar])

    from io import BytesIO
    tampon = BytesIO()
    wb.save(tampon)
    return tampon.getvalue()


def _prune_old_backups(retention_days: int) -> int:
    """Delete backups (.json and .xlsx) older than retention_days.

    Returns deleted count.
    """
    if retention_days <= 0:
        return 0
    cutoff = datetime.now() - timedelta(days=retention_days)
    deleted = 0
    for desen in ("crm_backup_*.json", "crm_backup_*.xlsx"):
        for p in BACKUP_DIR.glob(desen):
            try:
                mtime = datetime.fromtimestamp(p.stat().st_mtime)
                if mtime < cutoff:
                    p.unlink()
                    deleted += 1
            except Exception as e:
                logger.warning("Backup prune failed for %s: %s", p, e)

    # Prune the persistent copies too (timestamp is embedded in the filename:
    # crm_backup_YYYYMMDD_HHMMSS.json / .xlsx)
    stale = []
    for obj in _storage_list(BACKUPS_BUCKET):
        name = obj.get("name", "")
        for kalip in ("crm_backup_%Y%m%d_%H%M%S.json",
                      "crm_backup_%Y%m%d_%H%M%S.xlsx"):
            try:
                ts = datetime.strptime(name, kalip)
            except ValueError:
                continue
            if ts < cutoff:
                stale.append(name)
            break
    if stale and _storage_remove(BACKUPS_BUCKET, stale):
        deleted += len(stale)
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
    xlsx_filename = f"crm_backup_{ts}.xlsx"
    config = load_config()
    try:
        payload = _collect_backup_payload(supabase)
        content = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
        filepath.write_text(content, encoding="utf-8")
        size_bytes = filepath.stat().st_size

        # Excel: geri yükleme için değil, gözle bakmak/paylaşmak için.
        # Üretimi başarısız olursa yedeğin tamamı çöpe gitmemeli — JSON asıl
        # kopya, bu yüzden hata yutuluyor ama durum kaydediliyor.
        xlsx_bytes = None
        xlsx_error = None
        try:
            xlsx_bytes = _build_excel_bytes(payload)
            (BACKUP_DIR / xlsx_filename).write_bytes(xlsx_bytes)
            _storage_upload(BACKUPS_BUCKET, xlsx_filename, xlsx_bytes, XLSX_MIME)
        except Exception as xe:
            xlsx_error = str(xe)
            logger.warning("Excel üretilemedi (JSON yedeği alındı): %s", xe)

        # Persist to Supabase Storage — the local copy dies with the dyno,
        # the storage copy is the real backup.
        stored = _storage_upload(BACKUPS_BUCKET, filename, content.encode("utf-8"))
        if not stored:
            logger.warning("Backup saved locally only — storage upload failed: %s", filename)

        # Google Drive: üçüncü kopya. Supabase Storage ile aynı hesabın
        # altında olmadığı için asıl "felaket" senaryosunu karşılayan kopya
        # bu. Başarısızlığı yedeği geçersiz kılmıyor, ayrıca raporlanıyor.
        gdrive_status, gdrive_error, gdrive_link = None, None, None
        if gdrive_service.is_configured():
            try:
                r = gdrive_service.upload(filename, content.encode("utf-8"),
                                          "application/json")
                gdrive_link = r.get("link")
                if xlsx_bytes:
                    gdrive_service.upload(xlsx_filename, xlsx_bytes, XLSX_MIME,
                                          klasor_id=r.get("folder_id"))
                gdrive_service.prune(int(config.get("retention_days", 30)),
                                     klasor_id=r.get("folder_id"))
                gdrive_status = "success"
            except Exception as ge:
                gdrive_status, gdrive_error = "error", str(ge)
                logger.error("Drive yüklemesi başarısız: %s", ge)

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
            "last_xlsx_filename": xlsx_filename if xlsx_bytes else None,
            "last_xlsx_error": xlsx_error,
            "last_gdrive_status": gdrive_status,
            "last_gdrive_error": gdrive_error,
        })
        logger.info("Backup ok: %s (%d bytes, pruned %d, drive=%s)",
                    filename, size_bytes, pruned, gdrive_status or "kapalı")
        return {
            "ok": True,
            "filename": filename,
            "xlsx_filename": xlsx_filename if xlsx_bytes else None,
            "xlsx_error": xlsx_error,
            "size_bytes": size_bytes,
            "pruned": pruned,
            "gdrive_status": gdrive_status,
            "gdrive_error": gdrive_error,
            "gdrive_link": gdrive_link,
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
    """Merge persistent (Supabase Storage) and local backups, newest first.
    Storage is authoritative — local files disappear on every restart."""
    seen = {}
    for obj in _storage_list(BACKUPS_BUCKET):
        name = obj.get("name", "")
        if not name.startswith("crm_backup_"):
            continue
        meta = obj.get("metadata") or {}
        seen[name] = {
            "filename": name,
            "size_bytes": meta.get("size") or obj.get("size") or 0,
            "created_at": obj.get("created_at") or "",
            "location": "cloud",
        }
    yerel = list(BACKUP_DIR.glob("crm_backup_*.json")) + \
        list(BACKUP_DIR.glob("crm_backup_*.xlsx"))
    for p in yerel:
        if p.name in seen:
            continue
        try:
            stat = p.stat()
            seen[p.name] = {
                "filename": p.name,
                "size_bytes": stat.st_size,
                "created_at": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).isoformat(),
                "location": "local",
            }
        except Exception:
            continue
    return sorted(seen.values(), key=lambda x: x["filename"], reverse=True)


def delete_backup(filename: str) -> bool:
    # security: ensure filename only refers to file in BACKUP_DIR
    p = (BACKUP_DIR / filename).resolve()
    if not str(p).startswith(str(BACKUP_DIR.resolve())):
        return False
    removed_cloud = _storage_remove(BACKUPS_BUCKET, [filename])
    removed_local = False
    if p.exists() and p.is_file():
        p.unlink()
        removed_local = True
    return removed_cloud or removed_local


def get_backup_bytes(filename: str):
    """Return backup file content as bytes — local cache first, then storage."""
    p = get_backup_path(filename)
    if p:
        try:
            return p.read_bytes()
        except Exception:
            pass
    if "/" in filename or "\\" in filename or not filename.startswith("crm_backup_"):
        return None
    return _storage_download(BACKUPS_BUCKET, filename)


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
