"""
customers tablosundaki her firmanin metnini vektore cevirip
'embedding' sutununa yazar. GitHub Actions'ta calisir.

Gerekli ortam degiskenleri (GitHub Secrets):
  SUPABASE_URL          -> Supabase proje URL'i
  SUPABASE_SERVICE_KEY  -> service_role anahtari (RLS'i bypass eder, guvenli sekilde Secrets'ta tut)
  FORCE_ALL (opsiyonel) -> "true" ise embedding dolu olsa bile hepsini yeniden hesaplar
"""
import os
import numpy as np
from sentence_transformers import SentenceTransformer
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
FORCE_ALL = os.environ.get("FORCE_ALL", "").strip().lower() in ("1", "true", "yes")

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def build_text(c: dict) -> str:
    """Firma icin anlamsal parmak izi metni olustur."""
    parts = [c.get("company_name"), c.get("market"),
             c.get("application"), c.get("description")]
    prods = c.get("products")
    if prods:
        parts.append(" ".join(prods) if isinstance(prods, list) else str(prods))
    return " | ".join(p for p in parts if p) or (c.get("company_name") or "")


def fetch_rows():
    """Islenecek firmalari sayfa sayfa cek."""
    rows, start, step = [], 0, 1000
    while True:
        q = sb.table("customers").select(
            "id,company_name,market,application,description,products"
        )
        if not FORCE_ALL:
            q = q.is_("embedding", "null")   # sadece embedding'i bos olanlar
        res = q.range(start, start + step - 1).execute()
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < step:
            break
        start += step
    return rows


def main():
    rows = fetch_rows()
    print(f"{len(rows)} firma islenecek.")
    if not rows:
        print("Yapilacak bir sey yok.")
        return

    print(f"Model yukleniyor: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)

    texts = [build_text(r) for r in rows]
    embeddings = model.encode(
        texts, normalize_embeddings=True, show_progress_bar=True
    )

    ok = 0
    for r, emb in zip(rows, np.asarray(embeddings)):
        vec = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
        sb.table("customers").update({"embedding": vec}).eq("id", r["id"]).execute()
        ok += 1

    print(f"Bitti. {ok} firma guncellendi.")


if __name__ == "__main__":
    main()

