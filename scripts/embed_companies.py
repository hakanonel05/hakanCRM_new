"""
customers tablosundaki her firmanin metnini vektore cevirip
'embedding' sutununa yazar. GitHub Actions'ta calisir.

Gerekli Secrets:
  SUPABASE_URL          -> https://xxxx.supabase.co  (fazladan yol OLMADAN)
  SUPABASE_SERVICE_KEY  -> service_role anahtari
  FORCE_ALL (opsiyonel) -> "true" ise hepsini yeniden hesaplar
"""
import os
from urllib.parse import urlparse

import numpy as np
from sentence_transformers import SentenceTransformer
import supabase
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"].strip().rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"].strip()
FORCE_ALL = os.environ.get("FORCE_ALL", "").strip().lower() in ("1", "true", "yes")

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# --- TESHIS (secret'i ifsa etmeden URL'nin seklini gosterir) ---
_p = urlparse(SUPABASE_URL)
print("=== TESHIS ===")
print("supabase kutuphane surumu :", getattr(supabase, "__version__", "bilinmiyor"))
print("URL https mi              :", _p.scheme == "https")
print("host .supabase.co ile mi biter:", _p.netloc.endswith(".supabase.co"))
print("URL'de fazladan yol var mi:", _p.path not in ("", "/"), "(bos olmali)")
print("yol parca sayisi          :", len([s for s in _p.path.split('/') if s]), "(0 olmali)")
print("==============")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Filtresiz basit sorgu testi: sorun URL'de mi filtrede mi? ---
try:
    test = sb.table("customers").select("id").limit(1).execute()
    print("Basit sorgu OK. Ornek satir sayisi:", len(test.data or []))
except Exception as e:
    print("Basit sorgu BASARISIZ ->", repr(e))
    print("Bu, sorunun SUPABASE_URL veya baglantida oldugunu gosterir.")
    raise


def build_text(c: dict) -> str:
    parts = [c.get("company_name"), c.get("market"),
             c.get("application"), c.get("description")]
    prods = c.get("products")
    if prods:
        parts.append(" ".join(prods) if isinstance(prods, list) else str(prods))
    return " | ".join(p for p in parts if p) or (c.get("company_name") or "")


def fetch_rows():
    q = sb.table("customers").select(
        "id,company_name,market,application,description,products"
    )
    if not FORCE_ALL:
        q = q.is_("embedding", "null")
    res = q.limit(5000).execute()
    return res.data or []


def main():
    rows = fetch_rows()
    print(f"{len(rows)} firma islenecek.")
    if not rows:
        print("Yapilacak bir sey yok.")
        return

    print(f"Model yukleniyor: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)

    texts = [build_text(r) for r in rows]
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

    ok = 0
    for r, emb in zip(rows, np.asarray(embeddings)):
        vec = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
        sb.table("customers").update({"embedding": vec}).eq("id", r["id"]).execute()
        ok += 1

    print(f"Bitti. {ok} firma guncellendi.")


if __name__ == "__main__":
    main()
