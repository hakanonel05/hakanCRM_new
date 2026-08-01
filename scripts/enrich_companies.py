"""
Arka plan bilgi doldurma (dengeli mod).

Eksik alani olan firmalari gezer; Groq Compound (yerlesik web aramasi) ile
sehir/website/market/application onerir. Guven yuksekse dogrudan customers'a
yazar (yalnizca BOS alani), dusukse enrichment_suggestions'a onay icin koyar.

GitHub Actions'ta calisir. Gerekli Secrets:
  SUPABASE_URL          -> https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY  -> service_role anahtari
  GROQ_API_KEY          -> gsk_... (console.groq.com)

Opsiyonel env:
  GROQ_MODEL            -> varsayilan groq/compound-mini
  CONFIDENCE_THRESHOLD  -> varsayilan 75 (bu ve ustu otomatik yazilir)
  BATCH_LIMIT           -> bir calistirmada islenecek firma sayisi (varsayilan 40)
  SLEEP_SECONDS         -> firmalar arasi bekleme (varsayilan 2)
"""
import os
import json
import time
import logging
import requests
from datetime import datetime, timezone
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(message)s")

SUPABASE_URL = os.environ["SUPABASE_URL"].strip().rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"].strip()
GROQ_API_KEY = os.environ["GROQ_API_KEY"].strip()
GROQ_MODEL = os.environ.get("GROQ_MODEL", "groq/compound-mini").strip()
# not: gece otomatik calismada bu env'ler BOS string gelir; "or" ile
# varsayilana duseriz (int("") hata verir, int("" or "300") = 300).
THRESHOLD = int(os.environ.get("CONFIDENCE_THRESHOLD") or "75")
BATCH_LIMIT = int(os.environ.get("BATCH_LIMIT") or "300")
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS") or "2")

TARGET_FIELDS = ["city", "website", "market", "application"]
FIELD_LABELS = {
    "city": "il (sehir)",
    "website": "resmi web sitesi (alan adi)",
    "market": "sektor / faaliyet alani",
    "application": "urun / uygulama alani",
}

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def is_empty(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def missing_fields(row: dict):
    return [f for f in TARGET_FIELDS if is_empty(row.get(f))]


def ask_groq(company: dict) -> dict:
    """Compound modeli ile web'de arayip 4 alani + guven skoru dondur."""
    known = {k: company.get(k) for k in ("market", "application", "city", "website")
             if not is_empty(company.get(k))}
    known_str = ", ".join(f"{k}={v}" for k, v in known.items()) or "yok"

    prompt = f"""Sen bir B2B firma arastirma asistanisin. Web'de arayarak asagidaki Turk firmasi hakkinda su 4 alani bulmaya calis:
- city: firmanin bulundugu il (Turkiye)
- website: firmanin resmi web sitesi (alan adi, orn. ornekfirma.com)
- market: firmanin sektoru / faaliyet alani
- application: firmanin urun veya uygulama alani

Firma adi: {company.get('company_name')}
Bilinen bilgiler: {known_str}

Kurallar:
- Yalnizca web'de dogruladigin bilgiyi ver. Emin degilsen value'yu bos birak ("").
- Adi benzeyen FARKLI bir firmayla karistirma.\n- website alanini EKSIKSIZ yaz; uzantiyi (.com, .com.tr) kesme.
- Her alan icin 0-100 arasi bir confidence ver (ne kadar eminsin).
- SADECE su JSON'u dondur, baska hicbir sey yazma:
{{"city":{{"value":"","confidence":0}},"website":{{"value":"","confidence":0}},"market":{{"value":"","confidence":0}},"application":{{"value":"","confidence":0}}}}"""

    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                 "Content-Type": "application/json"},
        json={"model": GROQ_MODEL,
              "messages": [{"role": "user", "content": prompt}],
              "temperature": 0.1},
        timeout=90,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]

    # JSON'u guvenli ayikla (bazen model markdown/aciklama ekleyebilir)
    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"JSON bulunamadi: {content[:200]}")
    return json.loads(content[start:end + 1])


def process_company(company: dict) -> str:
    cid = company["id"]
    name = company.get("company_name") or "?"
    empties = missing_fields(company)
    if not empties:
        # Zaten dolu -> tekrar bakmamak icin damgala
        sb.table("customers").update(
            {"enriched_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", cid).execute()
        return "skip-full"

    try:
        result = ask_groq(company)
    except Exception as e:
        logging.warning(f"  ! {name}: Groq hatasi -> {e}")
        return "error"

    update_data = {}
    suggestions = []
    for field in empties:
        item = result.get(field) or {}
        value = (item.get("value") or "").strip() if isinstance(item, dict) else ""
        conf = int(item.get("confidence", 0)) if isinstance(item, dict) else 0
        if not value:
            continue
        if conf >= THRESHOLD:
            update_data[field] = value          # otomatik yaz (yuksek guven)
        else:
            suggestions.append({                 # onaya gonder (dusuk guven)
                "customer_id": cid,
                "company_name": name,
                "field": field,
                "suggested_value": value,
                "confidence": conf,
                "source": f"Groq {GROQ_MODEL}",
                "status": "pending",
            })

    # Otomatik yaz + damgala
    update_data["enriched_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    sb.table("customers").update(update_data).eq("id", cid).execute()

    # Onerileri ekle (ayni firma+alan icin pending varsa unique index engeller)
    for s in suggestions:
        try:
            sb.table("enrichment_suggestions").insert(s).execute()
        except Exception:
            pass  # zaten bekleyen oneri var

    wrote = [k for k in update_data if k in TARGET_FIELDS]
    logging.info(f"  + {name}: yazildi={wrote or '-'}  oneri={len(suggestions)}")
    return "done"


def fetch_candidates(need: int):
    """enriched_at bos olan firmalari sayfa sayfa cek."""
    rows, start, step = [], 0, 1000
    while len(rows) < need * 5:  # eksik alani olmayanlari eleyecegiz, fazla cek
        res = (sb.table("customers")
               .select("id,company_name,market,application,city,website")
               .is_("enriched_at", "null")
               .order("created_at")
               .range(start, start + step - 1)
               .execute())
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < step:
            break
        start += step
    return rows


def main():
    logging.info(f"Model: {GROQ_MODEL} | esik: {THRESHOLD} | limit: {BATCH_LIMIT}")
    candidates = fetch_candidates(BATCH_LIMIT)
    logging.info(f"{len(candidates)} aday firma (enriched_at bos).")

    processed = written = queued = errors = 0
    for company in candidates:
        if processed >= BATCH_LIMIT:
            break
        empties = missing_fields(company)
        if not empties:
            process_company(company)  # damgala, sayaci artirma
            continue
        outcome = process_company(company)
        processed += 1
        if outcome == "done":
            written += 1
        elif outcome == "error":
            errors += 1
        time.sleep(SLEEP_SECONDS)

    # Bu turda kac oneri birikti (bilgi amacli)
    try:
        pend = sb.table("enrichment_suggestions").select(
            "id", count="exact").eq("status", "pending").execute()
        queued = pend.count or 0
    except Exception:
        pass

    logging.info(f"\nBitti. Islenen: {processed}, hatasiz: {written}, "
                 f"hata: {errors}. Toplam bekleyen oneri: {queued}")


if __name__ == "__main__":
    main()
