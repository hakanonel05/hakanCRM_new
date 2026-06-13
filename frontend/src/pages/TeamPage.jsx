import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Users,
  Search,
  TrendingUp,
  TrendingDown,
  Bell,
  Calendar,
  Activity,
  ArrowRight,
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
  // deterministic pastel-ish color
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

export default function TeamPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("customers"); // customers | activity | name
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API}/api/team-members`);
        if (!cancelled) setMembers(res.data?.members || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = members;
    if (q) arr = arr.filter((m) => m.name.toLowerCase().includes(q));
    arr = [...arr];
    if (sortBy === "customers") arr.sort((a, b) => b.customers_count - a.customers_count);
    else if (sortBy === "activity")
      arr.sort((a, b) => (b.last_activity || "").localeCompare(a.last_activity || ""));
    else arr.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    return arr;
  }, [members, search, sortBy]);

  const totals = useMemo(() => {
    return members.reduce(
      (acc, m) => {
        acc.customers += m.customers_count || 0;
        acc.followups += m.followup_count || 0;
        acc.won += m.won_count || 0;
        acc.visits += m.visits_count || 0;
        return acc;
      },
      { customers: 0, followups: 0, won: 0, visits: 0 }
    );
  }, [members]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Anasayfa · Ekip
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mt-1">
            Ekip
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tüm ekip üyelerinin müşteri portföyü ve aktivite özetleri
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim ara..."
              className="pl-9 pr-3 py-2 text-sm border rounded-lg bg-card border-border w-56 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg bg-card border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="customers">Müşteri sayısı</option>
            <option value="activity">Son aktivite</option>
            <option value="name">İsim</option>
          </select>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Toplam Ekip</div>
          <div className="font-heading text-2xl font-bold mt-1">{members.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Atanmış Müşteri</div>
          <div className="font-heading text-2xl font-bold mt-1">{totals.customers}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Takipte</div>
          <div className="font-heading text-2xl font-bold mt-1 text-amber-600">
            {totals.followups}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Kazanıldı</div>
          <div className="font-heading text-2xl font-bold mt-1 text-emerald-600">
            {totals.won}
          </div>
        </div>
      </div>

      {/* Members grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Eşleşen ekip üyesi bulunamadı</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const winRate =
              m.customers_count > 0
                ? Math.round((m.won_count / m.customers_count) * 100)
                : 0;
            return (
              <button
                key={m.name}
                onClick={() => navigate(`/team/${encodeURIComponent(m.name)}`)}
                className="text-left rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/40 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                    style={{ background: colorFromName(m.name) }}
                  >
                    {initialsOf(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate group-hover:text-primary transition-colors">
                      {m.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Son aktivite: {formatRelative(m.last_activity)}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="rounded-lg bg-muted/50 py-2">
                    <div className="text-base font-bold">{m.customers_count}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Müşteri
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 py-2">
                    <div className="text-base font-bold text-amber-600">
                      {m.followup_count}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Takipte
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 py-2">
                    <div className="text-base font-bold text-blue-600">
                      {m.visits_count}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Ziyaret
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <TrendingUp className="w-3 h-3" />
                      {m.won_count}
                    </span>
                    <span className="inline-flex items-center gap-1 text-rose-600">
                      <TrendingDown className="w-3 h-3" />
                      {m.lost_count}
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Activity className="w-3 h-3" />
                      {m.activities_count}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    %{winRate} kazanma
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
