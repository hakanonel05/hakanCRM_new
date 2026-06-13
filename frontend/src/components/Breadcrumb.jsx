import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

// Route → label mapping. Add new routes here as the app grows.
const LABELS = {
  "/": "Anasayfa",
  "/customers": "Müşteriler",
  "/filters": "Filtreler",
  "/kanban": "Kanban",
  "/calendar": "Takvim",
  "/visits": "Ziyaretler",
  "/followups": "Follow-up",
  "/reports": "Raporlama",
  "/duplicates": "Yinelenenler",
  "/users": "Kullanıcılar",
  "/settings": "Ayarlar",
  "/notifications": "Bildirimler",
};

/**
 * Breadcrumb — auto-derives crumbs from the current pathname.
 *
 * Props:
 *  - extra: optional list of `{ label, to? }` segments appended after the
 *           route-derived crumbs (e.g. customer detail name).
 *  - className: extra wrapper classes
 */
export default function Breadcrumb({ extra = [], className = "" }) {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Build up the route trail. Always start with "Anasayfa".
  const trail = [{ to: "/", label: LABELS["/"], icon: Home }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    const label = LABELS[acc] || decodeURIComponent(seg);
    trail.push({ to: acc, label });
  }
  // Append extras.
  for (const e of extra) {
    trail.push(e);
  }

  return (
    <nav
      aria-label="Sayfa konumu"
      className={`flex items-center gap-1 text-[12px] font-medium ${className}`}
      data-testid="breadcrumb"
    >
      {trail.map((c, i) => {
        const isLast = i === trail.length - 1;
        const Icon = c.icon;
        return (
          <div key={`${c.to || c.label}-${i}`} className="flex items-center gap-1 min-w-0">
            {i > 0 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" strokeWidth={2.5} />
            )}
            {isLast || !c.to ? (
              <span className="text-foreground truncate" aria-current="page">
                {Icon ? <Icon className="w-3.5 h-3.5 inline-block mr-0.5 -mt-0.5" /> : null}
                {c.label}
              </span>
            ) : (
              <Link
                to={c.to}
                className="text-muted-foreground hover:text-primary transition-colors truncate"
              >
                {Icon ? <Icon className="w-3.5 h-3.5 inline-block mr-0.5 -mt-0.5" /> : null}
                {c.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
