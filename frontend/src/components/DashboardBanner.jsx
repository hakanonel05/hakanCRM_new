/* Genel Bakış başlığının yanındaki boş şerit.
 *
 * NEDEN FOTOĞRAF DEĞİL: şerit ~1050x68px, yani yaklaşık 16:1. Bir fotoğraf
 * bu orana kırpıldığında tanınmaz hâle geliyor ve sayfanın en üstüne
 * yüzlerce kilobayt ekliyor. Vektör çizim keskin kalıyor, tema
 * değişkenlerini kullandığı için koyu temada kendiliğinden uyuyor ve
 * dosyaya kilobayt bile eklemiyor.
 *
 * NEDEN BU SAHNE: makine imalatı / OEM üretim hattı — dişliler, servo
 * motor ve redüktör, konveyör, robot kol, sürücü panosu, portal tezgâh.
 * Panodan sahaya giden kesik çizgiler kumanda bağlantısı.
 *
 * HAREKET YOK: index.css'teki kurala uyuyor — animasyon yalnızca durum
 * değişimini açıklamak için var, süs için değil.
 *
 * Dar ekranda gizleniyor: 1280px altında başlık ve "Düzenle" düğmesiyle
 * sıkışıyor, o boyutta zaten boş alan yok.
 */

const ZEMIN = 60;

/* Dişli: gövde + göbek + çevreye dağılmış dişler. Diş sayısı sabit;
   yarıçap değişince dişler de oranlı büyüyor. */
const Disli = ({ cx, cy, r, dis = 8 }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} />
    <circle cx={cx} cy={cy} r={r * 0.34} />
    <g strokeWidth={r * 0.3}>
      {Array.from({ length: dis }, (_, i) => {
        const a = (Math.PI * 2 * i) / dis;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * (r - 1)}
            y1={cy + Math.sin(a) * (r - 1)}
            x2={cx + Math.cos(a) * (r + r * 0.28)}
            y2={cy + Math.sin(a) * (r + r * 0.28)}
          />
        );
      })}
    </g>
  </g>
);

/* Konveyör üstünde taşınan koli. Biri vurgulu olsun diye renk dışarıdan. */
const Koli = ({ x, y, vurgulu }) => (
  <g>
    <rect
      x={x}
      y={y}
      width="30"
      height="20"
      rx="1.5"
      fill={vurgulu ? "hsl(var(--chart-2) / 0.3)" : "none"}
    />
    <line x1={x + 15} y1={y} x2={x + 15} y2={y + 20} strokeWidth="1.4" />
  </g>
);

export default function DashboardBanner() {
  return (
    <div
      className="hidden xl:block min-w-0 flex-1 self-stretch overflow-hidden rounded-xl border border-border"
      style={{
        background:
          "linear-gradient(90deg, hsl(var(--chart-2) / 0.08) 0%, hsl(var(--chart-2) / 0.03) 45%, transparent 85%)",
      }}
      data-testid="dashboard-banner"
    >
      <svg
        viewBox="0 0 1120 66"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label="Makine imalatı ve OEM üretim hattı çizimi"
        style={{
          // Uçlar sönümleniyor ki çizim kenarlarda kesilmiş gibi durmasın.
          maskImage:
            "linear-gradient(90deg, #000 0, #000 86%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, #000 0, #000 86%, transparent 100%)",
        }}
      >
        <g
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.5)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          {/* Zemin — tüm makineler bunun üstünde duruyor */}
          <line x1="0" y1={ZEMIN} x2="1120" y2={ZEMIN} strokeWidth="1.5" />

          {/* Kavrayan dişli çifti */}
          <Disli cx={62} cy={34} r={16} />
          <Disli cx={92} cy={53} r={10} dis={7} />

          {/* Servo motor + redüktör */}
          <rect x="134" y="28" width="30" height="26" rx="4" />
          <g strokeWidth="1.4">
            <line x1="142" y1="30" x2="142" y2="52" />
            <line x1="150" y1="30" x2="150" y2="52" />
            <line x1="158" y1="30" x2="158" y2="52" />
          </g>
          <rect x="142" y="21" width="14" height="7" rx="1" />
          <rect x="164" y="24" width="42" height="34" rx="3" />
          {/* Cikis mili konveyorun tahrik tamburunu doner - hat birbirine bagli */}
          <line x1="206" y1="44" x2="244" y2="44" strokeWidth="3.5" />

          {/* Konveyör — tahrik tamburları, taşıma makaraları, ayaklar */}
          <circle cx="256" cy="44" r="12" />
          <circle cx="472" cy="44" r="12" />
          <line x1="256" y1="32" x2="472" y2="32" />
          <line x1="256" y1="56" x2="472" y2="56" />
          <g strokeWidth="1.5">
            <circle cx="300" cy="44" r="4" />
            <circle cx="344" cy="44" r="4" />
            <circle cx="388" cy="44" r="4" />
            <circle cx="432" cy="44" r="4" />
          </g>
          <line x1="280" y1="56" x2="280" y2={ZEMIN} />
          <line x1="448" y1="56" x2="448" y2={ZEMIN} />
          <Koli x={290} y={12} />
          <Koli x={340} y={12} vurgulu />
          <Koli x={400} y={12} />

          {/* Robot kol — koliyi konveyörden alıp bırakıyor */}
          <path d="M498 60 L508 44 L546 44 L556 60 Z" />
          <rect x="514" y="37" width="26" height="7" rx="2" />
          <line x1="527" y1="38" x2="556" y2="14" strokeWidth="5" />
          <line x1="556" y1="14" x2="604" y2="28" strokeWidth="5" />
          <circle cx="527" cy="38" r="5" />
          <circle cx="556" cy="14" r="4.5" />
          <circle cx="604" cy="28" r="4" />
          <g strokeWidth="2.5">
            <line x1="604" y1="28" x2="617" y2="19" />
            <line x1="604" y1="28" x2="617" y2="37" />
          </g>
          <rect
            x="617"
            y="19"
            width="20"
            height="16"
            rx="1.5"
            fill="hsl(var(--chart-2) / 0.3)"
          />

          {/* Sürücü panosu — ekran, gösterge lambaları, havalandırma */}
          <rect x="660" y="10" width="70" height="50" rx="5" />
          <rect x="669" y="18" width="52" height="17" rx="2" />
          <g strokeWidth="1.5">
            <line x1="675" y1="24" x2="705" y2="24" />
            <line x1="675" y1="30" x2="695" y2="30" />
            <line x1="712" y1="43" x2="724" y2="43" />
            <line x1="712" y1="48" x2="724" y2="48" />
            <line x1="712" y1="53" x2="724" y2="53" />
          </g>
          <circle cx="676" cy="48" r="4" fill="hsl(var(--chart-2))" stroke="none" />
          <circle cx="690" cy="48" r="4" fill="hsl(var(--muted-foreground) / 0.3)" stroke="none" />
          <circle cx="704" cy="48" r="4" fill="hsl(var(--muted-foreground) / 0.3)" stroke="none" />

          {/* Portal tezgâh — OEM'in ürettiği makinenin kendisi */}
          <rect x="782" y="8" width="126" height="10" rx="2" />
          <line x1="790" y1={ZEMIN} x2="790" y2="18" strokeWidth="4" />
          <line x1="900" y1={ZEMIN} x2="900" y2="18" strokeWidth="4" />
          <rect x="830" y="18" width="30" height="18" rx="2" />
          <line x1="845" y1="36" x2="845" y2="46" strokeWidth="3" />
          <path d="M841 46 L849 46 L845 53 Z" fill="hsl(var(--chart-2) / 0.55)" stroke="none" />
          <rect x="816" y="53" width="58" height="7" rx="1" />

          {/* Hattın devamı — sağa doğru sönümlenerek çıkıyor */}
          <Disli cx={962} cy={36} r={17} />
          <Disli cx={995} cy={55} r={10} dis={7} />
          <circle cx="1052" cy="44" r="12" />
          <line x1="1052" y1="32" x2="1120" y2="32" />
          <line x1="1052" y1="56" x2="1120" y2="56" />
          <Koli x={1074} y={12} />
        </g>

        {/* Kumanda hattı: panodan motora, robota ve tezgâha.
            Mekanikten ayrışsın diye daha ince, kesik ve marka renginde. */}
        <g
          fill="none"
          stroke="hsl(var(--chart-2) / 0.45)"
          strokeWidth="1.3"
          strokeDasharray="4 4"
          strokeLinecap="round"
        >
          <path d="M695 10 V4 H149 V21" />
          <path d="M695 4 H527 V33" />
          <path d="M695 4 H845 V8" />
        </g>
      </svg>
    </div>
  );
}
