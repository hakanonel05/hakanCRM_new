import { useMemo } from "react";
import { Sparkles, CalendarClock, AlertTriangle, TrendingUp } from "lucide-react";

/* Genel Bakış başlığının yanındaki boş şerit.
 *
 * Buraya salt dekoratif bir görsel koymak, sayfanın en üstündeki en değerli
 * alanı harcamak olurdu. Onun yerine BUGÜNÜ anlatıyor: kaç takip bugün,
 * kaç tanesi gecikmiş, bu ay kaç müşteri eklenmiş.
 *
 * Alttaki kartları (Müşteri / Ziyaret / Takipte / Takip Ziyaret) bilerek
 * TEKRARLAMIYOR — aynı sayıyı iki kez göstermek bilgi değil gürültü.
 *
 * Dar ekranda gizleniyor: 1280px altında başlık ve "Düzenle" düğmesiyle
 * sıkışıyor, o boyutta zaten boş alan yok.
 */

const selamla = () => {
  const s = new Date().getHours();
  if (s < 6) return "İyi geceler";
  if (s < 12) return "Günaydın";
  if (s < 18) return "İyi günler";
  return "İyi akşamlar";
};

const Rozet = ({ icon: Icon, deger, etiket, vurgulu }) => (
  <div className="flex items-center gap-2">
    <span
      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${
        vurgulu
          ? "bg-status-warning-fg/15 text-status-warning-fg"
          : "bg-primary/10 text-primary"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
    <div className="leading-tight">
      <p className="text-sm font-bold tabular-nums text-foreground">{deger}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {etiket}
      </p>
    </div>
  </div>
);

export default function DashboardBanner({ stats, kullaniciAdi }) {
  const ozet = useMemo(() => {
    const takipler = stats?.upcoming_followups || [];
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);

    let bugunku = 0;
    let gecikmis = 0;
    for (const t of takipler) {
      const g = t?.next_followup_date;
      if (!g) continue;
      const d = new Date(String(g).slice(0, 10));
      if (isNaN(d)) continue;
      d.setHours(0, 0, 0, 0);
      if (d.getTime() === bugun.getTime()) bugunku += 1;
      else if (d < bugun) gecikmis += 1;
    }

    // Bu ay eklenen müşteriler — "işler nasıl gidiyor" sorusunun en kısa
    // cevabı ve aşağıdaki kartlarda yok.
    const ayBasi = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
    const buAy = (stats?.recent_customers || []).filter((c) => {
      const d = new Date(String(c?.created_at || "").slice(0, 10));
      return !isNaN(d) && d >= ayBasi;
    }).length;

    return { bugunku, gecikmis, buAy };
  }, [stats]);

  const ilkAd = (kullaniciAdi || "").trim().split(/\s+/)[0] || "";

  return (
    <div
      className="hidden xl:flex min-w-0 flex-1 items-center gap-4 overflow-hidden rounded-xl border border-border px-4 py-2"
      style={{
        // Marka turuncusundan kağıda inen çok hafif bir geçiş. Koyu temada
        // da çalışsın diye token üzerinden; sabit renk yazılmıyor.
        background:
          "linear-gradient(90deg, hsl(var(--chart-2) / 0.10) 0%, hsl(var(--chart-2) / 0.03) 38%, transparent 70%)",
      }}
      data-testid="dashboard-banner"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Sparkles className="h-4 w-4 flex-shrink-0 text-primary" />
        <p className="truncate text-sm font-semibold text-foreground">
          {selamla()}
          {ilkAd ? `, ${ilkAd}` : ""}
        </p>
      </div>

      <div className="h-7 w-px flex-shrink-0 bg-border" />

      <div className="flex items-center gap-5 overflow-hidden">
        <Rozet icon={CalendarClock} deger={ozet.bugunku} etiket="bugün takip" />
        <Rozet
          icon={AlertTriangle}
          deger={ozet.gecikmis}
          etiket="gecikmiş"
          vurgulu={ozet.gecikmis > 0}
        />
        <Rozet icon={TrendingUp} deger={ozet.buAy} etiket="bu ay eklenen" />
      </div>

      {/* Sağa yaslanan kısa ileti: sayılar bir şey söylüyorsa onu yaz. */}
      <p className="ml-auto hidden truncate text-[11px] text-muted-foreground 2xl:block">
        {ozet.gecikmis > 0
          ? `${ozet.gecikmis} takip gecikmiş — Follow-up sayfasından bakabilirsin.`
          : ozet.bugunku > 0
          ? "Bugünkü takipler aşağıdaki listede."
          : "Gecikmiş takip yok."}
      </p>
    </div>
  );
}
