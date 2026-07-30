"""
customers tablosundaki her firmanin metnini vektore cevirip
'embedding' sutununa yazar. GitHub Actions'ta calisir.

Supabase tek istekte en fazla 1000 satir dondurdugu icin
1000'erlik gruplar halinde, hepsi bitene kadar doner.

Gerekli Secrets:
  SUPABASE_URL          -> https://xxxx.supabase.co  (fazladan yol OLMADAN)
  SUPABASE_SERVICE_KEY  -> service_role anahtari
  FORCE_ALL (opsiyonel) -> "true" ise embedding dolu olsa bile hepsini yeniden hesaplar
"""
import os
import numpy as np
from sentence_transformers import SentenceTransformer
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"].strip().rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"].strip()
FORCE_ALL = os.environ.get("FORCE_ALL", "").strip().lower() in ("1", "true", "yes")

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
COLS = "id,company_name,market,application,description,products"
BATCH = 1000

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def build_text(c: dict) -> str:
    parts = [c.get("company_name"), c.get("market"),
             c.get("application"), c.get("description")]
    prods = c.get("products")
    if prods:
        parts.append(" ".join(prods) if isinstance(prods, list) else str(prods))
    return " | ".join(p for p in parts if p) or (c.get("company_name") or "")


def process(rows, model):
    """Bir grup firmayi vektore cevirip Supabase'e yaz."""
    texts = [build_text(r) for r in rows]
    embeddings = model.encode(texts, normalize_embeddings=True)
    for r, emb in zip(rows, np.asarray(embeddings)):
        vec = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
        sb.table("customers").update({"embedding": vec}).eq("id", r["id"]).execute()


def main():
    print(f"Model yukleniyor: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)

    total = 0

    if FORCE_ALL:
        # Tum firmalar: created_at'e gore sayfa sayfa ilerle
        start = 0
        while True:
            rows = (sb.table("customers").select(COLS)
                    .order("created_at").range(start, start + BATCH - 1)
                    .execute().data or [])
            if not rows:
                break
            process(rows, model)
            total += len(rows)
            print(f"  ... {total} firma islendi")
            start += BATCH
    else:
        # Sadece embedding'i bos olanlar: her turda ilk 1000 bosu al,
        # islenince artik bos olmazlar, bir sonraki tur yeni 1000'i alir
        while True:
            rows = (sb.table("customers").select(COLS)
                    .is_("embedding", "null").limit(BATCH)
                    .execute().data or [])
            if not rows:
                break
            process(rows, model)
            total += len(rows)
            print(f"  ... {total} firma islendi")

    print(f"Bitti. Toplam {total} firma guncellendi.")


if __name__ == "__main__":
    main()
