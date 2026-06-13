import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Users,
  Bell,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  MapPin,
  Briefcase,
  ChevronRight,
  Building2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL || "";

const initialsOf = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

const colorFromName = (name) => {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 45%)`;
};

const formatRelative = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins}dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g önce`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}ay önce`;
  return d.toLocaleDateString("tr-TR");
};

const formatDate = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
};

const STATUS_COLORS = {
  "İletişimde": "bg-blue-100 text-blue-700",
  "Beklemede": "bg-amber-100 text-amber-700",
  "Çalışıyor": "bg-indigo-100 text-indigo-700",
  "Teklif Verildi": "bg-violet-100 text-violet-700",
  "Kazanıldı": "bg-emerald-100 text-emerald-700",
  "Kaybedildi": "bg-rose-100 text-rose-700",
};

const ACTIVITY_TYPE_LABEL = {
  customer_created: "Yeni müşteri",
  customer_updated: "Güncelleme",
  status_changed: "Durum değişti",
  note_added: "Not eklendi",
  visit_added: "Ziyaret",
  followup_set: "Takip ayarlandı",
  customer_deleted: "Müşteri silindi",
};

export default function TeamMemberDetailPage() {
  const { name } = useParams();
  const navigate = useNavigate();
  const decodedName = useMemo(() => decodeURIComponent(name || ""), [name]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("activity"); // activity | customers | visits

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${API}/api/team-members/${encodeURIComponent(decodedName)}/profile?days=30&activity_limit=200`
        );
        if (!cancelled) setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [decodedName]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-32 rounded-xl bg-card border border-border animate-pulse" />
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, status_distribution, market_distribution, city_distribution, activity_trend, activities, visits, customers } = data;
  const winRate = summary.customers_count > 0
    ? Math.round((summary.won_count / summary.customers_count) * 100)
    : 0;

  const maxTrend = Math.max(1, ...(activity_trend || []).map((d) => d.count));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/team");
          }}
          className="inline-flex items-center gap-1 hover:text-primary transition-colors"
          data-testid="team-detail-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Geri
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">{decodedName}</span>
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div
          className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-white font-bold text-xl md:text-2xl shrink-0"
          style={{ background: colorFromName(decodedName) }}
        >
          {initialsOf(decodedName)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl md:text-3xl font-bold truncate">{decodedName}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            Ekip üyesi · Son aktivite: <span className="font-medium text-foreground">{formatRelative(summary.last_activity)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
            %{winRate} kazanma oranı
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Müşteri" value={summary.customers_count} color="text-foreground" />
        <StatCard icon={Bell} label="Takipte" value={summary.followup_count} color="text-amber-600" />
        <StatCard icon={Calendar} label="Ziyaret" value={summary.visits_count} color="text-blue-600" />
        <StatCard icon={Activity} label="Aktivite" value={summary.activities_count} color="text-indigo-600" />
        <StatCard icon={TrendingUp} label="Kazanıldı" value={summary.won_count} color="text-emerald-600" />
        <StatCard icon={TrendingDown} label="Kaybedildi" value={summary.lost_count} color="text-rose-600" />
      </div>

      {/* Activity Trend + Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Son 30 Gün Aktivitesi</h3>
            <span className="text-xs text-muted-foreground">
              Toplam {activity_trend.reduce((a, b) => a + b.count, 0)} aktivite
            </span>
          </div>
          <div className="flex items-end gap-1 h-32">
            {activity_trend.map((d) => {
              const h = d.count > 0 ? Math.max(6, (d.count / maxTrend) * 100) : 2;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className={`w-full rounded-t ${d.count > 0 ? "bg-primary/70 hover:bg-primary" : "bg-muted"} transition-all cursor-pointer`}
                    style={{ height: `${h}%` }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                      {d.date.slice(5)}: {d.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status distribution */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-sm mb-3">Durum Dağılımı</h3>
          <div className="space-y-2">
            {status_distribution.length === 0 ? (
              <div className="text-xs text-muted-foreground">Veri yok</div>
            ) : (
              status_distribution.map((s) => {
                const pct = summary.customers_count > 0
                  ? Math.round((s.count / summary.customers_count) * 100)
                  : 0;
                return (
                  <div key={s._id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded ${STATUS_COLORS[s._id] || "bg-gray-100 text-gray-700"}`}
                      >
                        {s._id}
                      </span>
                      <span className="text-muted-foreground">
                        {s.count} · %{pct}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Market + City distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DistributionCard
          title="Market Dağılımı"
          icon={Briefcase}
          items={market_distribution}
          total={summary.customers_count}
        />
        <DistributionCard
          title="Şehir Dağılımı"
          icon={MapPin}
          items={city_distribution}
          total={summary.customers_count}
        />
      </div>

      {/* Tabs: Activity / Customers / Visits */}
      <div>
        <div className="flex gap-1 border-b border-border">
          <TabBtn active={tab === "activity"} onClick={() => setTab("activity")}>
            Aktivite Akışı ({activities.length})
          </TabBtn>
          <TabBtn active={tab === "customers"} onClick={() => setTab("customers")}>
            Müşterileri ({customers.length})
          </TabBtn>
          <TabBtn active={tab === "visits"} onClick={() => setTab("visits")}>
            Ziyaretleri ({visits.length})
          </TabBtn>
        </div>

        <div className="mt-4">
          {tab === "activity" && <ActivityList activities={activities} />}
          {tab === "customers" && <CustomerList customers={customers} />}
          {tab === "visits" && <VisitList visits={visits} />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`font-heading text-2xl font-bold mt-1 ${color || ""}`}>{value}</div>
    </div>
  );
}

function DistributionCard({ title, icon: Icon, items, total }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">Veri yok</div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
            return (
              <div key={it._id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate font-medium">{it._id}</span>
                  <span className="text-muted-foreground shrink-0">
                    {it.count} · %{pct}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ActivityList({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Henüz aktivite kaydı yok
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {activities.map((a) => {
        const typeLabel = ACTIVITY_TYPE_LABEL[a.activity_type] || a.activity_type || "Aktivite";
        return (
          <div
            key={a.id}
            className="rounded-lg border border-border bg-card p-3 flex items-start gap-3 hover:border-primary/30 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                  {typeLabel}
                </span>
                {a.customer_name && (
                  <Link
                    to={a.customer_id ? `/customers/${a.customer_id}` : "#"}
                    className="text-sm font-semibold truncate hover:text-primary"
                  >
                    {a.customer_name}
                  </Link>
                )}
              </div>
              {a.title && <div className="text-sm mt-1">{a.title}</div>}
              {a.subtitle && (
                <div className="text-xs text-muted-foreground mt-0.5">{a.subtitle}</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
              {formatRelative(a.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomerList({ customers }) {
  if (!customers || customers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Atanmış müşteri yok
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {customers.map((c) => (
        <Link
          key={c.id}
          to={`/customers/${c.id}`}
          className="rounded-lg border border-border bg-card p-3 flex items-start gap-3 hover:border-primary/40 hover:shadow-sm transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate group-hover:text-primary">
              {c.company_name}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              {c.market && <span>{c.market}</span>}
              {c.city && (
                <>
                  <span>·</span>
                  <span>{c.city}</span>
                </>
              )}
              {c.is_followup && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Bell className="w-3 h-3" />
                    Takipte
                  </span>
                </>
              )}
            </div>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
              STATUS_COLORS[c.status] || "bg-gray-100 text-gray-700"
            }`}
          >
            {c.status || "Beklemede"}
          </span>
        </Link>
      ))}
    </div>
  );
}

function VisitList({ visits }) {
  if (!visits || visits.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Henüz ziyaret kaydı yok
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {visits.map((v) => (
        <div
          key={v.id}
          className="rounded-lg border border-border bg-card p-3 flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {v.customer_id ? (
                <Link
                  to={`/customers/${v.customer_id}`}
                  className="text-sm font-semibold hover:text-primary"
                >
                  {v.company_name || "Müşteri"}
                </Link>
              ) : (
                <span className="text-sm font-semibold">
                  {v.company_name || "Müşteri"}
                </span>
              )}
              {v.outcome && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {v.outcome}
                </span>
              )}
            </div>
            {v.notes && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.notes}</div>
            )}
          </div>
          <div className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
            {formatDate(v.visit_date || v.created_at)}
          </div>
        </div>
      ))}
    </div>
  );
}
