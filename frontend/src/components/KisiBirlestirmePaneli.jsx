import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Merge, Loader2, AlertTriangle, Check } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* Aynı kişinin farklı yazımlarını tek ada toplama paneli.
 *
 * "Furkan Çelik", "Furkan ÇELİK", "furkan çelik", bazen sadece "Furkan"
 * ayrı kişi gibi kaydolmuş. Ekip listesi artık bunları görüntülerken
 * birleştiriyor ama VERİ hâlâ dağınık: filtre açılırları, Excel çıktısı
 * ve müşteri kartları eski yazımı gösteriyor. Bu panel veriyi düzeltiyor.
 *
 * ÖNİZLEME ÖNCE, tek tuşla uygulama YOK. Birleştirme geri alınamıyor ve
 * yanlış birleştirilmiş iki kişiyi otomatik ayırmanın yolu yok — bu yüzden
 * ne olacağı önce yazılı olarak gösteriliyor.
 *
 * Yapacak iş yoksa panel hiç çıkmıyor; temiz bir sistemde kalıcı bir
 * "her şey yolunda" kutusu göstermenin anlamı yok.
 */
export default function KisiBirlestirmePaneli({ onBirlestirildi }) {
  const [rapor, setRapor] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [uygulaniyor, setUygulaniyor] = useState(false);
  const [acik, setAcik] = useState(false);

  const onizlemeAl = async () => {
    try {
      const { data } = await axios.get(`${API}/admin/kisi-birlestir`);
      setRapor(data);
    } catch (e) {
      // 403 = admin değil. Panel zaten yalnız adminlere gösteriliyor ama
      // rol sunucuda değişmiş olabilir; sessizce gizle.
      setRapor(null);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => { onizlemeAl(); }, []);

  const uygula = async () => {
    setUygulaniyor(true);
    try {
      const { data } = await axios.post(`${API}/admin/kisi-birlestir`);
      const n = data.guncellenen_satir || 0;
      toast.success(`${n} kayıt güncellendi`);
      if (data.hatalar?.length) {
        toast.error(`${data.hatalar.length} değişiklik yazılamadı`);
      }
      setRapor(null);
      onBirlestirildi?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Birleştirme başarısız");
    } finally {
      setUygulaniyor(false);
    }
  };

  if (yukleniyor) return null;

  const kisiler = rapor?.birlesecek_kisiler || [];
  if (!kisiler.length) return null;

  const satir = rapor.etkilenen_satir || 0;

  return (
    <div className="rounded-xl border border-status-warning-line bg-status-warning-bg/50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning-fg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {kisiler.length} kişi birden fazla yazımla kayıtlı
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Liste burada birleştirilmiş görünüyor, ama {satir} kayıtta eski
            yazım duruyor — filtrelerde ve Excel çıktısında hâlâ ayrı çıkar.
          </p>

          <button
            type="button"
            onClick={() => setAcik((a) => !a)}
            className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {acik ? "Listeyi gizle" : "Ne değişecek, göster"}
          </button>

          {acik && (
            <ul className="mt-3 space-y-2">
              {kisiler.map((k) => (
                <li key={k.ad} className="text-sm">
                  <span className="font-medium text-foreground">{k.ad}</span>
                  <span className="text-muted-foreground"> ← </span>
                  <span className="text-muted-foreground">
                    {k.yazimlar
                      .filter((y) => y.yazim !== k.ad)
                      .map((y) => `"${y.yazim}" (${y.satir})`)
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={uygula}
              disabled={uygulaniyor}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              data-testid="kisi-birlestir-uygula"
            >
              {uygulaniyor
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Merge className="h-4 w-4" />}
              {uygulaniyor ? "Birleştiriliyor…" : "Birleştir"}
            </button>
            <span className="text-xs text-muted-foreground">
              Geri alınamaz. Müşteri silinmez, yalnızca isim yazımı düzelir.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
