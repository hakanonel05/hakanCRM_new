"""
Firma bilgisi doldurma - AKILLI SURUM (v2)

Yenilikler:
  1) Model yukseltildi: groq/compound (10 arac cagrisina kadar; bul -> siteyi
     ziyaret et -> dogrula -> tekrar ara). compound-mini yalnizca tek arama
     yapabildigi icin sonuclar sigdi.
  2) Deterministik on-gecis (LLM'siz, neredeyse kesin):
       - contact_info.email alan adindan website (gmail/hotmail vb. haric)
       - contact_info.phone alan kodundan il (81 il haritasi)
  3) Market MUHAKEME ile atanir: firmanin ne urettigini + hangi sanayiye hizmet
     ettigini anlayip IZINLI market listesinden en uygununu secer (asagidaki
     MARKET_GUIDE kurallariyla). Listede olmayan uydurma degeri OTOMATIK YAZMAZ.
  4) Notlara AI ozeti: firmanin faaliyet/uygulama alanlari kisa Turkce ozet
     olarak "Not Gecmisi"ne (notes_list) eklenir; mevcut notlar KORUNUR.
  5) Kanit: her alan icin kaynak URL + kisa gerekce kaydedilir (ai_filled ve
     enrichment_suggestions.source alanina).

Gerekli Secrets:
  SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY
Opsiyonel env:
  GROQ_MODEL (varsayilan groq/compound), CONFIDENCE_THRESHOLD (75),
  BATCH_LIMIT (300), SLEEP_SECONDS (2)
"""
import os
import re
import json
import time
import uuid
import logging
import requests
from datetime import datetime, timezone
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(message)s")

SUPABASE_URL = os.environ["SUPABASE_URL"].strip().rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"].strip()
GROQ_API_KEY = os.environ["GROQ_API_KEY"].strip()
GROQ_MODEL = os.environ.get("GROQ_MODEL") or "groq/compound"
THRESHOLD = int(os.environ.get("CONFIDENCE_THRESHOLD") or "75")
BATCH_LIMIT = int(os.environ.get("BATCH_LIMIT") or "300")
SLEEP_SECONDS = float(os.environ.get("SLEEP_SECONDS") or "2")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

TARGET_FIELDS = ["city", "website", "market", "application"]

# ============================================================================
# MARKET MUHAKEME KILAVUZU  --  buraya serbestce kural EKLEYIP CIKARABILIRSIN.
# Mantik: bir makine/ekipman imalatcisinin "market"i, urunlerinin HIZMET ETTIGI
# ana sanayidir (isledigi malzeme degil, hitap ettigi sektor).
# ============================================================================
MARKET_GUIDE = """\
- Plastik enjeksiyon, ekstruzyon (extruder), kaucuk, kalip (plastik), sisirme, \
termoform, geri donusum granul -> Rubber & Plastic (R&P)
- Sac isleme, kaynak, CNC talasli imalat, tornalama/frezeleme, dokum, haddehane, \
celik konstruksiyon, pres; ya da makine METAL sanayide kullaniliyorsa -> Metal
- Un/tahil degirmeni, yem, sut, et, icecek, sekerleme, firin, URUN dolum/paketleme \
hatti -> Gida & Icecek
- Iplik, dokuma, orme, boya-apre, konfeksiyon makinesi -> Tekstil
- Cimento, klinker, hazir beton, agrega/tas kirma-eleme tesisi, tugla-kiremit, \
yapi kimyasallari -> Cimento & Yapi Malzemeleri
- Pompa/aritma tesisi, terfi merkezi, su/atiksu isleme -> Su & Atiksu
- Vinc, kaldirma, liman/tersane kaldirma ekipmani, asansor -> Vinc & Kaldirma
- Kimya, petrokimya, ilac, kozmetik uretim ekipmani -> Kimya
- Otomotiv yan sanayi, montaj hatti, otomotiv parca uretimi -> Otomotiv
- Karton, kagit, oluklu mukavva, matbaa/ambalaj makinesi -> Ambalaj / Kagit
- Cevher madenciligi, cevher kirma-eleme, zenginlestirme -> Maden
- Enerji, jenerator, trafo, res/ges ekipmani -> Enerji
- Gemi, tersane, marin tahrik -> Marin
- Klima, sogutma, havalandirma, isi pompasi -> Iklimlendirme (HVAC)

DIKKAT - JENERIK EKIPMAN: Konveyor, degirmen, pompa, fan, motor, reduktor, \
paketleme/dolum, elek, kirici gibi ekipmanlar HEMEN HER sektorde bulunur; tek \
baslarina market SINYALI DEGILDIR. Market'i ISLENEN MALZEMEYE / NIHAI URUNE gore \
belirle, makine tipine gore DEGIL:
  * degirmen -> un/tahil ogutuyorsa Gida & Icecek; cimento/klinker ise Cimento; \
cevher ise Maden
  * paketleme/dolum -> genelde URUN paketleme = Gida & Icecek; yalnizca cimento/ \
yapi malzemesi torbalama ise Cimento
  * kirici/elek -> agrega/tas/cimento ise Cimento; cevher ise Maden
  * konveyor/pompa/fan/motor tek basina -> neyi tasidigini/hangi urun icin \
oldugunu bul, ona gore karar ver
Firmanin ne urettigi ya da hangi urunu isledigi belli degilse market'i BOS birak.
KURAL: Yukaridaki eslesmeyi kullanarak, SADECE sana verilen IZINLI market \
listesinden en yakin degeri sec. Emin degilsen ya da hicbiri uymuyorsa market'i \
BOS birak. Uydurma deger URETME."""

# Ucretsiz e-posta saglayicilari (bunlardan website turetilmez)
FREE_EMAIL = {
    "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.tr", "outlook.com",
    "live.com", "yahoo.com", "yahoo.com.tr", "icloud.com", "yandex.com",
    "yandex.com.tr", "mail.ru", "windowslive.com", "msn.com", "aol.com",
    "gmx.com", "protonmail.com", "mynet.com", "superonline.com", "ttmail.com",
}

# Turkiye sabit hat alan kodu -> il (81 il)
AREA_CODE_CITY = {
    "212": "Istanbul", "216": "Istanbul", "224": "Bursa", "232": "Izmir",
    "242": "Antalya", "246": "Isparta", "248": "Burdur", "252": "Mugla",
    "256": "Aydin", "258": "Denizli", "262": "Kocaeli", "264": "Sakarya",
    "266": "Balikesir", "272": "Afyonkarahisar", "274": "Kutahya", "276": "Usak",
    "282": "Tekirdag", "284": "Edirne", "286": "Canakkale", "288": "Kirklareli",
    "312": "Ankara", "318": "Kirikkale", "322": "Adana", "324": "Mersin",
    "326": "Hatay", "328": "Osmaniye", "332": "Konya", "338": "Karaman",
    "342": "Gaziantep", "344": "Kahramanmaras", "346": "Sivas", "348": "Kilis",
    "352": "Kayseri", "354": "Yozgat", "356": "Tokat", "358": "Amasya",
    "362": "Samsun", "364": "Corum", "366": "Kastamonu", "368": "Sinop",
    "370": "Karabuk", "372": "Zonguldak", "374": "Bolu", "376": "Cankiri",
    "378": "Bartin", "380": "Duzce", "382": "Aksaray", "384": "Nevsehir",
    "386": "Kirsehir", "388": "Nigde", "412": "Diyarbakir", "414": "Sanliurfa",
    "416": "Adiyaman", "422": "Malatya", "424": "Elazig", "426": "Bingol",
    "428": "Tunceli", "432": "Van", "434": "Bitlis", "436": "Mus",
    "438": "Hakkari", "442": "Erzurum", "446": "Erzincan", "452": "Ordu",
    "454": "Giresun", "456": "Gumushane", "458": "Bayburt", "462": "Trabzon",
    "464": "Rize", "466": "Artvin", "472": "Agri", "474": "Kars",
    "476": "Igdir", "478": "Ardahan", "482": "Mardin", "484": "Siirt",
    "486": "Sirnak", "488": "Batman",
}


def is_empty(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def missing_fields(row: dict):
    return [f for f in TARGET_FIELDS if is_empty(row.get(f))]


def load_allowed(field: str):
    """options tablosundan bir alanin izinli degerlerini cek (bir kez)."""
    try:
        res = sb.table("options").select("value").eq("field_name", field).execute()
        vals = [(r.get("value") or "").strip() for r in (res.data or [])]
        return [v for v in vals if v]
    except Exception as e:
        logging.warning(f"options({field}) cekilemedi: {e}")
        return []


def collect_emails_phones(company: dict):
    """contact_info + contacts icinden email ve telefonlari topla."""
    emails, phones = [], []
    ci = company.get("contact_info") or {}
    if isinstance(ci, dict):
        if ci.get("email"):
            emails.append(ci["email"])
        if ci.get("phone"):
            phones.append(ci["phone"])
    for c in (company.get("contacts") or []):
        if isinstance(c, dict):
            if c.get("email"):
                emails.append(c["email"])
            if c.get("phone"):
                phones.append(c["phone"])
    return emails, phones


def website_from_email(emails):
    for e in emails:
        m = re.search(r"@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})", e or "")
        if not m:
            continue
        domain = m.group(1).lower().strip(".")
        if domain in FREE_EMAIL:
            continue
        return domain
    return None


def city_from_phone(phones):
    for p in phones:
        digits = re.sub(r"\D", "", p or "")
        # bastaki 0 / 90 / +90'i at
        if digits.startswith("90"):
            digits = digits[2:]
        if digits.startswith("0"):
            digits = digits[1:]
        if len(digits) < 3:
            continue
        code = digits[:3]
        # cep (5xx) sehir vermez
        if code.startswith("5"):
            continue
        if code in AREA_CODE_CITY:
            return AREA_CODE_CITY[code]
    return None


def ask_groq(company: dict, known: dict, allowed_markets, allowed_apps) -> dict:
    known_str = ", ".join(f"{k}={v}" for k, v in known.items() if v) or "yok"
    markets_str = "\n".join(f"  * {m}" for m in allowed_markets) or "  (liste bos)"
    apps_str = ", ".join(allowed_apps) if allowed_apps else "(serbest metin olabilir)"

    prompt = f"""Sen bir B2B endustriyel firma arastirma uzmanisin. Once firmanin RESMI web sitesini bul ve ZIYARET ET; tum kararlarini o siteye dayandir.

Firma adi: {company.get('company_name')}
Bilinen bilgiler: {known_str}

Gorevin, su alanlari web'de DOGRULAYARAK bulmak:
- website: resmi web sitesi (alan adi, uzantiyi kesme)
- city: firmanin bulundugu il (Turkiye)
- market: firmanin hizmet ettigi ANA SANAYI. Once firmanin ne urettigini/yaptigini anla, sonra asagidaki kilavuzla muhakeme et ve YALNIZCA izinli listeden sec.
- application: firmanin urun/uygulama alani {("(su listeden sec: " + apps_str + ")") if allowed_apps else "(kisa serbest metin)"}
- summary: firmanin ne urettigi ve faaliyet/uygulama alanlari hakkinda 1-3 cumlelik TURKCE ozet (nota yazilacak)

MARKET MUHAKEME KILAVUZU:
{MARKET_GUIDE}

IZINLI MARKET LISTESI (market SADECE bunlardan biri olabilir):
{markets_str}

Kurallar:
- Yalnizca resmi sitede/guvenilir kaynakta dogruladigin bilgiyi ver; emin degilsen value=""
- Adi benzeyen FARKLI firmayla karistirma.
- Her alan icin 0-100 confidence ver. 80+ sadece resmi kaynakta acikca gorduysen.
- source_url: kararlarini dayandirdigin ana kaynak (tercihen resmi site).
- SADECE su JSON'u dondur, baska hicbir sey yazma:
{{"website":{{"value":"","confidence":0}},"city":{{"value":"","confidence":0}},"market":{{"value":"","confidence":0}},"application":{{"value":"","confidence":0}},"summary":"","source_url":""}}"""

    resp = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                 "Content-Type": "application/json"},
        json={"model": GROQ_MODEL,
              "messages": [{"role": "user", "content": prompt}],
              "temperature": 0.1},
        timeout=180,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"JSON bulunamadi: {content[:200]}")
    return json.loads(content[start:end + 1])


def match_allowed(value: str, allowed):
    """Modelin dondurdugu degeri izinli listeye (buyuk/kucuk harf duyarsiz) esle."""
    if not value:
        return None
    v = value.strip().lower()
    for a in allowed:
        if a.strip().lower() == v:
            return a  # listedeki kanonik yazim
    return None


def make_ai_note(text: str):
    return {
        "id": str(uuid.uuid4()),
        "text": f"🤖 [AI] {text}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "ai",
    }


def process_company(company, allowed_markets, allowed_apps) -> str:
    cid = company["id"]
    name = company.get("company_name") or "?"
    empties = missing_fields(company)
    if not empties:
        sb.table("customers").update(
            {"enriched_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", cid).execute()
        return "skip-full"

    now_iso = datetime.now(timezone.utc).isoformat()
    update_data = {}
    ai_filled_new = {}
    suggestions = []

    # ---- 1) Deterministik on-gecis (LLM'siz) ----
    emails, phones = collect_emails_phones(company)
    det = {}
    if "website" in empties:
        w = website_from_email(emails)
        if w:
            det["website"] = (w, 92, "E-posta alan adindan (deterministik)")
    if "city" in empties:
        c = city_from_phone(phones)
        if c:
            det["city"] = (c, 85, "Telefon alan kodundan (deterministik)")

    for field, (val, conf, src) in det.items():
        update_data[field] = val
        ai_filled_new[field] = {"value": val, "confidence": conf,
                                "source": src, "at": now_iso}

    # Groq'a dogru siteyi verebilmek icin bilinenleri hazirla
    known = {k: company.get(k) for k in ("market", "application", "city", "website")
             if not is_empty(company.get(k))}
    if "website" in det:
        known["website"] = det["website"][0]
    if "city" in det:
        known.setdefault("city", det["city"][0])

    # ---- 2) Groq (compound) ile muhakemeli doldurma ----
    # Deterministik cozulmeyen hedef alanlar icin (ya da market/app icin her zaman)
    remaining = [f for f in empties if f not in det]
    ai_summary = ""
    if remaining:
        try:
            r = ask_groq(company, known, allowed_markets, allowed_apps)
        except Exception as e:
            logging.warning(f"  ! {name}: Groq hatasi -> {e}")
            r = None

        if r:
            src_url = (r.get("source_url") or "").strip()
            ai_summary = (r.get("summary") or "").strip()
            for field in remaining:
                item = r.get(field) or {}
                value = (item.get("value") or "").strip() if isinstance(item, dict) else ""
                conf = int(item.get("confidence", 0)) if isinstance(item, dict) else 0
                if not value:
                    continue

                # market/application izinli listeye sabitle
                if field == "market" and allowed_markets:
                    canon = match_allowed(value, allowed_markets)
                    if not canon:
                        # listede yok -> otomatik yazma, oneriye dusur
                        suggestions.append({
                            "customer_id": cid, "company_name": name, "field": field,
                            "suggested_value": value, "confidence": min(conf, 60),
                            "source": f"Groq {GROQ_MODEL} (liste disi) {src_url}".strip(),
                            "status": "pending",
                        })
                        continue
                    value = canon
                if field == "application" and allowed_apps:
                    canon = match_allowed(value, allowed_apps)
                    if canon:
                        value = canon

                src = f"Groq {GROQ_MODEL}" + (f" · {src_url}" if src_url else "")
                if conf >= THRESHOLD:
                    update_data[field] = value
                    ai_filled_new[field] = {"value": value, "confidence": conf,
                                            "source": src, "at": now_iso}
                else:
                    suggestions.append({
                        "customer_id": cid, "company_name": name, "field": field,
                        "suggested_value": value, "confidence": conf,
                        "source": src, "status": "pending",
                    })

    # ---- 3) Notlara AI ozeti ekle (mevcut notlari koruyarak) ----
    if ai_summary:
        existing_notes = company.get("notes_list")
        if not isinstance(existing_notes, list):
            existing_notes = []
        already = any(isinstance(n, dict) and (n.get("text") or "").startswith("🤖 [AI]")
                      for n in existing_notes)
        if not already:
            update_data["notes_list"] = existing_notes + [make_ai_note(ai_summary)]

    # ---- 4) ai_filled birlestir + damgala + yaz ----
    if ai_filled_new:
        existing = company.get("ai_filled")
        if not isinstance(existing, dict):
            existing = {}
        update_data["ai_filled"] = {**existing, **ai_filled_new}

    update_data["enriched_at"] = now_iso
    update_data["updated_at"] = now_iso
    sb.table("customers").update(update_data).eq("id", cid).execute()

    for s in suggestions:
        try:
            sb.table("enrichment_suggestions").insert(s).execute()
        except Exception:
            pass

    wrote = list(ai_filled_new.keys())
    logging.info(f"  + {name}: yazildi={wrote or '-'}  oneri={len(suggestions)}"
                 f"  not={'evet' if ai_summary else 'hayir'}")
    return "done"


def fetch_candidates(need: int):
    rows, start, step = [], 0, 1000
    cols = ("id,company_name,market,application,city,website,ai_filled,"
            "contact_info,contacts,notes_list")
    while len(rows) < need * 5:
        res = (sb.table("customers").select(cols)
               .is_("enriched_at", "null").order("created_at")
               .range(start, start + step - 1).execute())
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < step:
            break
        start += step
    return rows


def main():
    allowed_markets = load_allowed("market")
    allowed_apps = load_allowed("application")
    logging.info(f"Model: {GROQ_MODEL} | esik: {THRESHOLD} | limit: {BATCH_LIMIT} | "
                 f"izinli market: {len(allowed_markets)}, application: {len(allowed_apps)}")

    candidates = fetch_candidates(BATCH_LIMIT)
    logging.info(f"{len(candidates)} aday firma (enriched_at bos).")

    processed = written = errors = 0
    for company in candidates:
        if processed >= BATCH_LIMIT:
            break
        if not missing_fields(company):
            process_company(company, allowed_markets, allowed_apps)
            continue
        outcome = process_company(company, allowed_markets, allowed_apps)
        processed += 1
        if outcome == "done":
            written += 1
        elif outcome == "error":
            errors += 1
        time.sleep(SLEEP_SECONDS)

    try:
        pend = sb.table("enrichment_suggestions").select(
            "id", count="exact").eq("status", "pending").execute()
        queued = pend.count or 0
    except Exception:
        queued = 0

    logging.info(f"\nBitti. Islenen: {processed}, yazilan: {written}, "
                 f"hata: {errors}. Toplam bekleyen oneri: {queued}")


if __name__ == "__main__":
    main()
