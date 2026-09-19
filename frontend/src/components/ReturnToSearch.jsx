import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/* "← Müşteri aramasına dön" bağlantısı.
 *
 * Müşteriler sayfasındaki "nerelerde var" rozetleri hedefe giderken adrese
 * ?from=<dönüş yolu> ekliyor. Burası onu okuyup görünür bir dönüş yolu
 * sunuyor.
 *
 * Tarayıcının geri tuşu da çalışıyor (arama artık adreste), ama kullanıcı
 * kanban'da birkaç sütun gezdikten sonra kaç adım geri gideceğini bilemez.
 */

/* ?from= adres çubuğundan geliyor, yani kullanıcının (ya da birinin
 * gönderdiği bağlantının) denetiminde. Yalnızca bu uygulamanın içindeki
 * yollara izin veriliyor:
 *   "/customers?search=x"  → tamam
 *   "//kotu.site"          → tarayıcı bunu başka siteye yönlendirme sayar
 *   "https://kotu.site"    → başka site
 * Aksi halde rozetler açık yönlendirme aracına dönerdi. */
export function guvenliDonusYolu(ham) {
  if (!ham) return null;
  let yol;
  try {
    yol = decodeURIComponent(ham);
  } catch {
    return null; // bozuk kodlama
  }
  if (!yol.startsWith("/")) return null;
  if (yol.startsWith("//")) return null;
  if (yol.includes("\\")) return null; // bazı tarayıcılar \\ ile // eşdeğer
  return yol;
}

export default function ReturnToSearch() {
  const navigate = useNavigate();
  const yol = guvenliDonusYolu(
    new URLSearchParams(window.location.search).get("from")
  );
  if (!yol) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(yol)}
      data-testid="return-to-search"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
    >
      <ArrowLeft className="h-3 w-3" />
      Müşteri aramasına dön
    </button>
  );
}
