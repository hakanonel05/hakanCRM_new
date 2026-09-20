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


def _tum_satirlar(supabase, tablo: str, sayfa: int = 1000) -> list:
    """Tabloyu SAYFALAYARAK tamamen çeker.

    Düz .execute() Supabase'de 1000 satırda kesiyor ve bunu hata olarak
    bildirmiyor — sessizce az veri dönüyor. Yedekleme tam bu yüzden
    aylarca eksik çalıştı: 3.099 müşterinin yalnızca 1.000'i yedekleniyordu,
    hem Excel'de hem geri yükleme dosyası olan JSON'da. Bir felaket anında
    2.000 müşteri kaybedilecekti ve kimse fark etmeyecekti.
    """
    satirlar = []
    offset = 0
    while True:
        resp = (supabase.table(tablo).select("*")
                .range(offset, offset + sayfa - 1).execute())
        parca = resp.data or []
        satirlar.extend(parca)
        if len(parca) < sayfa:
            break
        offset += sayfa
        if offset > 500_000:  # güvenlik freni
            logger.warning("Yedek: %s tablosu 500k satırı aştı, kesiliyor", tablo)
            break
    return satirlar


def _collect_backup_payload(supabase) -> Dict[str, Any]:
    tables = ["customers", "visits", "calls", "options", "saved_filters",
              "kanban_views", "activity_log"]
    payload: Dict[str, Any] = {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "source": "automated_backup",
    }
    for t in tables:
        try:
            payload[t] = _tum_satirlar(supabase, t)
            logger.info("Yedek: %s -> %d satır", t, len(payload[t]))
        except Exception as e:
            logger.warning("Backup: skipping table %s: %s", t, e)
            payload[t] = []
    return payload


# Excel'in iki sert sınırı var ve ikisi de yedeklemeyi komple çökertebilir:
# hücrede denetim karakteri (openpyxl IllegalCharacterError fırlatıyor) ve
# 32.767 karakterlik hücre sınırı. CRM'deki serbest not alanları ikisini de
# tetikleyebiliyor; bir tek bozuk not yüzünden tüm yedeğin Excel'i
# üretilememesi kabul edilemez.
# Excel sayfa ve sütun adları. Ham alan adı ("potential_value") yerine
# okunabilir karşılığı yazılıyor. Sözlükte olmayan alan HAM ADIYLA kalıyor —
# yani veri tabanına yeni bir sütun eklenirse yedekten düşmüyor, sadece
# başlığı İngilizce görünüyor.
_TABLO_ADLARI = {
    "customers": "Müşteriler",
    "visits": "Ziyaretler",
    "calls": "Aramalar",
    "options": "Seçenekler",
    "saved_filters": "Kayıtlı Filtreler",
    "kanban_views": "Kanban Görünümleri",
    "activity_log": "Aktivite Kaydı",
}

_ALAN_ADLARI = {
    "id": "Kayıt No",
    "customer_id": "Müşteri No",
    "customer_name": "MÜŞTERİ",
    "company_name": "Firma Adı",
    "market": "Market",
    "application": "Uygulama",
    "city": "Şehir",
    "district": "İlçe",
    "website": "Web Sitesi",
    "status": "Durum",
    "potential_level": "Potansiyel Seviye",
    "potential_value": "Potansiyel (k€)",
    "assigned_to": "Takip Eden",
    "competitor": "Rakip",
    "partner": "Partner",
    "is_followup": "Takipte",
    "next_followup_date": "Sonraki Takip",
    "description": "Açıklama",
    "notes": "Notlar",
    "notes_list": "Not Geçmişi",
    "contact_info": "İletişim",
    "contacts": "Kişiler",
    "products": "Ürünler",
    "tags": "Etiketler",
    "documents": "Belgeler",
    "created_at": "Oluşturulma",
    "updated_at": "Güncellenme",
    # ziyaret / arama
    "visit_date": "Ziyaret Tarihi",
    "next_visit_date": "Sonraki Ziyaret",
    "visit_type": "Ziyaret Tipi",
    "visited_by": "Ziyaret Eden",
    "call_date": "Arama Tarihi",
    "caller_name": "Arayan",
    "contact_person": "Görüşülen Kişi",
    "phone_number": "Telefon",
    "duration": "Süre (dk)",
    "call_type": "Arama Tipi",
    "outcome": "Sonuç",
    "next_action": "Sonraki Adım",
    "next_action_date": "Sonraki Adım Tarihi",
    # aktivite kaydı
    "activity_type": "İşlem Tipi",
    "title": "Başlık",
    "subtitle": "Açıklama",
    "user_name": "Yapan Kişi",
    "user_email": "Yapan E-posta",
    "metadata": "Ayrıntı",
    # seçenekler / filtreler
    "field_name": "Alan",
    "value": "Değer",
    "name": "Ad",
    "conditions": "Koşullar",
    "logic": "Mantık",
    "group_by": "Gruplama",
    "created_by": "Oluşturan",
}

_EXCEL_YASAK = re.compile(r"[\000-\010\013\014\016-\037]")
_EXCEL_HUCRE_SINIRI = 32767
# Excel sayfası 1.048.576 satır alıyor; activity_log büyüyünce aşabilir.
_EXCEL_SATIR_SINIRI = 1_000_000

# Tablo başına Excel satır sınırı.
#
# activity_log her değişiklikle büyüyor ve sınırsız. Normal kipte openpyxl
# satırları bellekte tutuyor: ölçüldü, 250.000 aktivite 427 MB demek ve
# Render ücretsiz katmanda 512 MB var. 30.000 satırda tepe bellek ~60 MB.
#
# Bu bir KIRPMA ve sessiz olmaması şart — bugünkü 1000 satır hatası tam da
# sessiz kırpmaydı. Sınır aşılınca sayfaya görünür bir uyarı satırı
# yazılıyor ve Özet sayfasında "Excel'de gösterilen" sütunu gerçeği
# söylüyor. JSON yedeği her zaman TAM.
_EXCEL_SATIR_SINIRLARI = {
    "activity_log": 30_000,
}


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


def _tarih_kisa(v) -> str:
    """ISO tarihi '20.09.2026' yapar. Ayrıştıramazsa olduğu gibi bırakır."""
    if not v:
        return ""
    m = str(v)[:10]
    try:
        y, a, g = m.split("-")
        return f"{g}.{a}.{y}"
    except Exception:
        return str(v)[:19]


def _musteri_dosyasi(ws, payload, musteri_adi):
    """Firma adının altında o firmaya ait HER ŞEYİ toplayan sayfa.

    Kullanıcının istediği bu: "Ales Pres Makina'nın altında tüm sekmeleri
    görmek istiyorum". Excel'in katlanabilir satır özelliği (+/- düğmeleri)
    kullanılıyor, yani firma satırının solundaki + ile açılıp kapanıyor.

    Notlar, kişiler, dosyalar, ürünler ve etiketler müşteri satırında JSON
    sütunu olarak duruyor; ham hâlleri tek hücrede okunamaz bir yığın.
    Burada satır satır açılıyorlar. Ziyaret ve aramalar ayrı tablolardan
    gelip aynı firmanın altında toplanıyor.
    """
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    basliklar = ["Firma", "Tür", "Tarih", "Kim", "Ayrıntı"]
    ws.append(basliklar)
    for h in ws[1]:
        h.font = Font(bold=True, color="FFFFFF")
        h.fill = PatternFill("solid", fgColor="374151")

    # İlişkili kayıtları müşteriye göre grupla (tek geçiş, sözlükle).
    ziyaret_by, arama_by = {}, {}
    for v in payload.get("visits", []):
        ziyaret_by.setdefault(v.get("customer_id"), []).append(v)
    for c in payload.get("calls", []):
        arama_by.setdefault(c.get("customer_id"), []).append(c)

    firma_yazi = Font(bold=True, size=11)
    firma_zemin = PatternFill("solid", fgColor="E5E7EB")
    sat = 1

    musteriler = sorted(
        payload.get("customers", []),
        key=lambda c: (c.get("company_name") or "").lower(),
    )

    for m in musteriler:
        mid = m.get("id")
        ad = (m.get("company_name") or "(isimsiz)").strip()

        ozet = " · ".join(x for x in [
            m.get("market"), m.get("city"), m.get("status"),
            m.get("application"),
        ] if x)
        sat += 1
        ws.append([ad, "FİRMA", "", m.get("assigned_to") or "", ozet])
        for h in ws[sat]:
            h.font = firma_yazi
            h.fill = firma_zemin

        alt = []  # (tür, tarih, kim, ayrıntı)

        for n in (m.get("notes_list") or []):
            if isinstance(n, dict):
                alt.append(("NOT", _tarih_kisa(n.get("created_at") or n.get("date")),
                            n.get("author") or n.get("user_name") or "",
                            n.get("text") or n.get("note") or ""))
            else:
                alt.append(("NOT", "", "", str(n)))

        for c in sorted(arama_by.get(mid, []),
                        key=lambda x: str(x.get("call_date") or ""), reverse=True):
            ayrinti = " · ".join(x for x in [
                c.get("outcome"),
                f"{c.get('duration')} dk" if c.get("duration") else None,
                c.get("notes"),
            ] if x)
            alt.append(("ARAMA", _tarih_kisa(c.get("call_date") or c.get("created_at")),
                        c.get("caller_name") or "", ayrinti))

        for v in sorted(ziyaret_by.get(mid, []),
                        key=lambda x: str(x.get("visit_date") or ""), reverse=True):
            ayrinti = " · ".join(x for x in [
                v.get("visit_type"), v.get("notes"),
            ] if x)
            alt.append(("ZİYARET", _tarih_kisa(v.get("visit_date")),
                        v.get("visited_by") or "", ayrinti))

        for k in (m.get("contacts") or []):
            if isinstance(k, dict):
                ayrinti = " · ".join(x for x in [
                    k.get("role") or k.get("title"), k.get("email"), k.get("phone"),
                ] if x)
                alt.append(("KİŞİ", "", k.get("name") or "", ayrinti))

        for d in (m.get("documents") or []):
            if isinstance(d, dict):
                alt.append(("DOSYA", _tarih_kisa(d.get("uploaded_at")),
                            d.get("uploaded_by") or "",
                            d.get("name") or d.get("filename") or ""))

        urunler = [str(u) for u in (m.get("products") or []) if u]
        if urunler:
            alt.append(("ÜRÜNLER", "", "", ", ".join(urunler)))
        etiketler = [str(t) for t in (m.get("tags") or []) if t]
        if etiketler:
            alt.append(("ETİKETLER", "", "", ", ".join(etiketler)))

        iletisim = m.get("contact_info")
        if isinstance(iletisim, dict):
            ayrinti = " · ".join(f"{k}: {v}" for k, v in iletisim.items() if v)
            if ayrinti:
                alt.append(("İLETİŞİM", "", "", ayrinti))

        for tur, tarih, kim, ayrinti in alt:
            sat += 1
            ws.append(["", tur, tarih, kim, _excel_hucre(ayrinti)])
            # outlineLevel: firma satırının altına katlanır. Varsayılan
            # KAPALI değil — açık bıraktım ki dosyayı açan kişi veriyi
            # görsün; kapatmak isteyen soldaki "1" düğmesine basar.
            ws.row_dimensions[sat].outlineLevel = 1

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:E{sat}"
    # summaryBelow=False: özet (firma) satırı grubun ÜSTÜNDE, altında değil.
    ws.sheet_properties.outlinePr.summaryBelow = False
    for kolon, genislik in zip("ABCDE", (38, 11, 12, 18, 90)):
        ws.column_dimensions[kolon].width = genislik
    for r in ws.iter_rows(min_row=2, min_col=5, max_col=5):
        r[0].alignment = Alignment(wrap_text=False, vertical="top")


def _build_excel_bytes(payload: Dict[str, Any]) -> bytes:
    """Her tabloyu ayrı sayfa yapan, GÖZLE OKUNABİLİR bir çalışma kitabı üretir.

    Bu dosya geri yükleme için değil (o iş JSON'da); insanın açıp bakması,
    süzmesi, birine göndermesi için. Tasarım kararları buradan çıkıyor:

    - Müşteri adı HER sayfada. Ziyaret/arama/aktivite sayfalarında yalnızca
      customer_id vardı; 36 karakterlik bir UUID'ye bakıp hangi firma
      olduğunu anlamak imkânsız. Ad, customer_id'nin hemen yanına ekleniyor.
    - Sütun başlıkları Türkçe. "potential_value" yerine "Potansiyel (k€)".
      Bilinmeyen alanlar ham adıyla kalıyor, yani yeni bir sütun eklenirse
      kaybolmuyor.
    - Başlık satırı donuk ve süzgeçli, sütun genişlikleri içeriğe göre.
    - En başta bir "Özet" sayfası: yedek ne zaman alınmış, hangi tabloda
      kaç kayıt var. Eksik yedeği fark etmenin en hızlı yolu bu.

    write_only kipi: activity_log on binlerce satır olabiliyor ve normal
    kipte openpyxl hepsini bellekte tutuyor — Render ücretsiz katmanda
    512 MB sınırı var.
    """
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill
    from openpyxl.utils import get_column_letter

    tablolar = [(t, s) for t, s in payload.items() if isinstance(s, list)]

    # id -> firma adı. Ziyaret/arama/aktivite sayfalarına ad yazmak için.
    musteri_adi = {
        c.get("id"): (c.get("company_name") or "").strip()
        for c in payload.get("customers", []) if isinstance(c, dict)
    }

    # NORMAL kip (write_only değil): "Müşteri Dosyası" sayfasındaki
    # katlanabilir satırlar (+/- düğmeleri) write_only kipte KAYBOLUYOR —
    # openpyxl row_dimensions'ı akışa yazmıyor. Ölçüldü: 3.099 müşteri +
    # 20.000 aktivite ile tepe bellek 39,5 MB. Ama 250.000 aktivitede
    # 427 MB'a çıkıyor ve Render ücretsiz katmanda 512 MB sınırı var; bu
    # yüzden aşağıda aktivite kaydına GÖRÜNÜR bir Excel sınırı konuyor.
    wb = Workbook()
    wb.remove(wb.active)  # varsayılan boş sayfa
    baslik_yazi = Font(bold=True, color="FFFFFF")
    baslik_zemin = PatternFill("solid", fgColor="374151")
    baslik_hiza = Alignment(vertical="center")

    def _basliklar(ws, adlar):
        """Başlık satırını yazar ve biçimler. Normal kipte hücreler
        yazıldıktan SONRA biçimleniyor."""
        ws.append(list(adlar))
        for h in ws[ws.max_row]:
            h.font = baslik_yazi
            h.fill = baslik_zemin
            h.alignment = baslik_hiza

    # ---- Özet sayfası ----
    ozet = wb.create_sheet(title="Özet")
    ozet.column_dimensions["A"].width = 28
    ozet.column_dimensions["B"].width = 16
    _basliklar(ozet, ["Yedek Bilgisi", "Değer"])
    ozet.append(["Yedek tarihi", str(payload.get("export_date", ""))])
    ozet.append(["Kaynak", str(payload.get("source", ""))])
    ozet.append([])
    _basliklar(ozet, ["Tablo", "Kayıt sayısı", "Excel'de gösterilen"])
    for tablo, satirlar in tablolar:
        sinir = _EXCEL_SATIR_SINIRLARI.get(tablo, _EXCEL_SATIR_SINIRI)
        gosterilen = min(len(satirlar), sinir)
        ozet.append([_TABLO_ADLARI.get(tablo, tablo), len(satirlar),
                     gosterilen if gosterilen != len(satirlar) else "tamamı"])
    ozet.column_dimensions["C"].width = 20
    ozet.freeze_panes = "A2"

    # ---- Müşteri Dosyası: firma altında her şey, katlanabilir ----
    try:
        _musteri_dosyasi(wb.create_sheet(title="Müşteri Dosyası"),
                         payload, musteri_adi)
    except Exception as e:
        # Bu sayfa kolaylık; üretilemezse yedeğin tamamı çöpe gitmemeli.
        logger.warning("Müşteri Dosyası sayfası üretilemedi: %s", e)

    # ---- Tablo sayfaları ----
    for tablo, satirlar in tablolar:
        ws = wb.create_sheet(title=(_TABLO_ADLARI.get(tablo, tablo))[:31])
        if not satirlar:
            ws.append(["(kayıt yok)"])
            continue

        # Sütunlar tüm satırların birleşimi: ilk satıra güvenmek sonradan
        # eklenen bir alanı sessizce düşürür.
        sutunlar, gorulen = [], set()
        for s in satirlar:
            for k in s.keys():
                if k not in gorulen:
                    gorulen.add(k)
                    sutunlar.append(k)

        # Müşteri adını customer_id'nin hemen ardına yerleştir. Zaten bir ad
        # sütunu varsa (activity_log'da customer_name var) tekrar ekleme.
        ad_ekle = ("customer_id" in sutunlar
                   and "customer_name" not in sutunlar
                   and "company_name" not in sutunlar)
        if ad_ekle:
            sutunlar.insert(sutunlar.index("customer_id") + 1, "customer_name")

        _basliklar(ws, [_ALAN_ADLARI.get(k, k) for k in sutunlar])

        genislikler = [len(str(_ALAN_ADLARI.get(k, k))) for k in sutunlar]
        yazilan = 0
        for i, s in enumerate(satirlar):
            if i >= _EXCEL_SATIR_SINIRLARI.get(tablo, _EXCEL_SATIR_SINIRI):
                ws.append([f"[{len(satirlar) - i} satır daha var — Excel'de "
                           f"gösterilmiyor, TAMAMI JSON yedeğinde. Bkz. Özet "
                           f"sayfası.]"])
                logger.warning("Excel: %s tablosu %d satırda kırpıldı", tablo, i)
                break
            degerler = []
            for j, k in enumerate(sutunlar):
                if k == "customer_name" and ad_ekle:
                    v = musteri_adi.get(s.get("customer_id"), "")
                else:
                    v = _excel_hucre(s.get(k))
                degerler.append(v)
                u = len(str(v))
                if u > genislikler[j]:
                    genislikler[j] = u
            ws.append(degerler)
            yazilan += 1

        ws.freeze_panes = "A2"
        if yazilan:
            ws.auto_filter.ref = f"A1:{get_column_letter(len(sutunlar))}{yazilan + 1}"
        for j, g in enumerate(genislikler, start=1):
            # 60 karakterde sınırla: not alanları yüzlerce karakter olabiliyor
            # ve tek sütun ekranı kaplıyor.
            ws.column_dimensions[get_column_letter(j)].width = min(max(g + 2, 10), 60)

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
