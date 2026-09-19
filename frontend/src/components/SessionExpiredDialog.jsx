import { useState, useEffect } from "react";
import { LogIn, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { onSessionExpired } from "../lib/session";

/* Oturum düştüğünde çıkan uyarı.
 *
 * Neden otomatik yönlendirme değil de pencere: kullanıcı o sırada bir
 * müşteri kartı doldurmuş olabilir; habersiz giriş ekranına atmak yazdığını
 * çöpe atar. Pencere ne olduğunu söylüyor, gitme kararını kullanıcı veriyor.
 *
 * Neden shadcn Dialog değil: Dialog dışarı tıklayınca ve Esc ile kapanıyor.
 * Kapatılabilir bir uyarı burada işe yaramaz — arkadaki ekran yine boş veri
 * gösterir ve kullanıcı aynı yere geri döner. Bu yüzden kapatılamayan
 * sade bir katman.
 */
export default function SessionExpiredDialog() {
  const [acik, setAcik] = useState(false);

  useEffect(() => onSessionExpired(() => setAcik(true)), []);

  if (!acik) return null;

  const tekrarGir = () => {
    // Oturum zaten sunucuda yok; yalnızca yerel izleri temizleyip giriş
    // ekranına gidiyoruz. Tam yeniden yükleme, ekranda kalan bayat
    // durumun (boş listeler, eski sayaçlar) taşınmamasını garantiliyor.
    try {
      localStorage.removeItem("crmaster_user");
      localStorage.removeItem("crmaster_session_token");
    } catch {
      /* gizli sekme / kota: yine de giriş ekranına git */
    }
    window.location.replace("/login");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="oturum-baslik"
      data-testid="session-expired-dialog"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-status-warning-bg">
            <AlertTriangle className="h-5 w-5 text-status-warning-fg" />
          </span>
          <div className="min-w-0">
            <h2 id="oturum-baslik" className="text-base font-semibold text-foreground">
              Oturumunuz sona erdi
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Bu yüzden ekranda veri görünmüyor — müşterileriniz yerinde
              duruyor, hiçbir şey silinmedi.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Devam etmek için <strong className="text-foreground">hesabınıza
              tekrar giriş yapın</strong>.
            </p>
          </div>
        </div>
        <Button
          onClick={tekrarGir}
          className="mt-5 w-full"
          data-testid="session-expired-login-btn"
        >
          <LogIn className="mr-1.5 h-4 w-4" />
          Tekrar giriş yap
        </Button>
      </div>
    </div>
  );
}
