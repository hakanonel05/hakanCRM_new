import { useEffect, useMemo, useState, useCallback, memo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import { useAuth } from "../App";
import axios from "axios";
import { swrCache } from "../utils/swrCache";
import Breadcrumb from "../components/Breadcrumb";
import TurkeyMap from "../components/TurkeyMap";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Users,
  Calendar,
  Bell,
  Building2,
  Clock,
  Phone,
  Activity,
  User,
  Pencil,
  Check,
  Plus,
  RotateCcw,
  X,
  GripVertical,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import RGL, {
  Responsive as ResponsiveGrid,
  WidthProvider as RGLWidthProvider,
} from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const GridLayout = RGLWidthProvider(ResponsiveGrid);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "crm_dashboard_v8";

// Lumina MD3 palette — navy/teal design system
const palette = [
  "#002a43", // navy (primary)
  "#50625c", // teal-green (secondary)
  "#3f627e", // steel blue
  "#0e9488", // teal
  "#1b405b", // dark navy (primary-container)
  "#a7caeb", // light blue (primary-fixed-dim)
  "#72777e", // outline gray
];

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  if (m < 60) return `${m}dk`;
  if (h < 24) return `${h}sa`;
  if (d < 7) return `${d}g`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
};

const getActivityIcon = (type) => {
  switch (type) {
    case "customer_created":
    case "customer_updated":
    case "customer_deleted":
      return <Building2 className="w-3 h-3" />;
    case "status_changed":
      return <Activity className="w-3 h-3" />;
    case "followup_changed":
      return <Bell className="w-3 h-3" />;
    case "visit_created":
      return <Calendar className="w-3 h-3" />;
    case "call_created":
      return <Phone className="w-3 h-3" />;
    case "contact_added":
    case "contact_deleted":
      return <User className="w-3 h-3" />;
    default:
      return <Activity className="w-3 h-3" />;
  }
};

const getActivityColor = (type) => {
  switch (type) {
    case "customer_created":
      return "text-emerald-700 bg-emerald-50";
    case "customer_updated":
    case "visit_created":
      return "text-primary bg-primary-fixed/60";
    case "customer_deleted":
    case "contact_deleted":
      return "text-red-700 bg-red-50";
    case "status_changed":
    case "call_created":
      return "text-secondary-md bg-secondary-container/60";
    case "followup_changed":
    case "contact_added":
      return "text-amber-700 bg-amber-50";
    default:
      return "text-on-surface-variant bg-surface-container";
  }
};

const STATUS_COLOR = {
  Beklemede: "bg-amber-100 text-amber-700",
  İletişimde: "bg-blue-100 text-primary",
  "Teklif Verildi": "bg-violet-100 text-violet-700",
  Çalışılıyor: "bg-emerald-100 text-emerald-700",
  Kazanıldı: "bg-green-100 text-green-700",
  Kaybedildi: "bg-red-100 text-red-700",
};

// ---------- widget registry ----------
// Layouts are 12-column grid. h is in rowHeight units (60px each).
const WIDGET_DEFS = {
  kpi_customers: {
    title: "Müşteri",
    description: "Toplam müşteri sayısı",
    default: { w: 3, h: 2, minW: 2, minH: 2 },
  },
  kpi_visits: {
    title: "Ziyaret",
    description: "Toplam ziyaret sayısı",
    default: { w: 3, h: 2, minW: 2, minH: 2 },
  },
  kpi_followups: {
    title: "Takipte",
    description: "Takipteki müşteri sayısı",
    default: { w: 3, h: 2, minW: 2, minH: 2 },
  },
  kpi_followup_visits: {
    title: "Takip Ziyaret",
    description: "Yaklaşan takip ziyaretleri",
    default: { w: 3, h: 2, minW: 2, minH: 2 },
  },
  chart_1: {
    title: "Grafik 1",
    description: "Düzenlenebilir donut grafik (varsayılan: Market)",
    default: { w: 4, h: 5, minW: 3, minH: 4 },
    isChart: true,
  },
  chart_2: {
    title: "Grafik 2",
    description: "Düzenlenebilir donut grafik (varsayılan: Durum)",
    default: { w: 4, h: 5, minW: 3, minH: 4 },
    isChart: true,
  },
  chart_3: {
    title: "Grafik 3",
    description: "Düzenlenebilir donut grafik (varsayılan: Takip Eden)",
    default: { w: 4, h: 5, minW: 3, minH: 4 },
    isChart: true,
  },
  chart_4: {
    title: "Grafik 4",
    description: "Düzenlenebilir donut grafik (varsayılan: Takipteki Partner)",
    default: { w: 4, h: 5, minW: 3, minH: 4 },
    isChart: true,
  },
  list_activity: {
    title: "Son Aktiviteler",
    description: "Sistemdeki son hareketler",
    default: { w: 4, h: 8, minW: 3, minH: 4 },
  },
  list_followups: {
    title: "Yaklaşan Takipler",
    description: "Önümüzdeki günler için takipler",
    default: { w: 4, h: 5, minW: 3, minH: 4 },
  },
  list_recent: {
    title: "Son Müşteriler",
    description: "En son eklenen müşteriler",
    default: { w: 6, h: 5, minW: 3, minH: 4 },
  },
  top_markets: {
    title: "En Çok Müşteri Olan Marketler",
    description: "İlk 5 market sıralaması",
    default: { w: 4, h: 5, minW: 3, minH: 3 },
  },
};

// Field metadata for chart config dialog
const CHART_FIELDS = [
  { value: "market", label: "Market" },
  { value: "status", label: "Durum" },
  { value: "city", label: "Şehir" },
  { value: "assigned_to", label: "Takip Eden" },
  { value: "partner", label: "Partner" },
  { value: "competitor", label: "Rakip" },
  { value: "application", label: "Uygulama" },
];

const FIELD_LABEL = Object.fromEntries(CHART_FIELDS.map((f) => [f.value, f.label]));

// Default config for each chart widget
const DEFAULT_CHART_CONFIGS = {
  chart_1: { field: "market", followup_only: false, title: "Market Dağılımı", chart_type: "donut" },
  chart_2: { field: "status", followup_only: false, title: "Durum Dağılımı", chart_type: "donut" },
  chart_3: { field: "assigned_to", followup_only: false, title: "Takip Eden Dağılımı", chart_type: "bar" },
  chart_4: { field: "partner", followup_only: true, title: "Takipteki Partner Dağılımı", chart_type: "bar" },
};

const DEFAULT_VISIBLE = [
  "kpi_customers",
  "kpi_visits",
  "kpi_followups",
  "kpi_followup_visits",
  "list_activity",
  "chart_1",
  "chart_2",
  "chart_3",
  "chart_4",
  "list_followups",
];

const DEFAULT_LAYOUT_LG = [
  { i: "kpi_customers", x: 0, y: 0, w: 3, h: 2 },
  { i: "kpi_visits", x: 3, y: 0, w: 3, h: 2 },
  { i: "kpi_followups", x: 6, y: 0, w: 3, h: 2 },
  { i: "kpi_followup_visits", x: 9, y: 0, w: 3, h: 2 },
  { i: "list_activity", x: 0, y: 2, w: 4, h: 10 },
  { i: "chart_1", x: 4, y: 2, w: 4, h: 5 },
  { i: "chart_2", x: 8, y: 2, w: 4, h: 5 },
  { i: "chart_3", x: 4, y: 7, w: 4, h: 5 },
  { i: "chart_4", x: 8, y: 7, w: 4, h: 5 },
  { i: "list_followups", x: 4, y: 12, w: 8, h: 4 },
];

// Mobile layout: stack everything into 4 cols. KPIs 2x2, charts/lists full width.
const DEFAULT_LAYOUT_XS = [
  { i: "kpi_customers", x: 0, y: 0, w: 2, h: 2 },
  { i: "kpi_visits", x: 2, y: 0, w: 2, h: 2 },
  { i: "kpi_followups", x: 0, y: 2, w: 2, h: 2 },
  { i: "kpi_followup_visits", x: 2, y: 2, w: 2, h: 2 },
  { i: "chart_1", x: 0, y: 4, w: 4, h: 5 },
  { i: "chart_2", x: 0, y: 9, w: 4, h: 5 },
  { i: "chart_3", x: 0, y: 14, w: 4, h: 5 },
  { i: "chart_4", x: 0, y: 19, w: 4, h: 5 },
  { i: "list_activity", x: 0, y: 24, w: 4, h: 8 },
  { i: "list_followups", x: 0, y: 32, w: 4, h: 5 },
];

// Small tablet: 6 cols. KPIs 2x2 (3-wide each), charts side-by-side, lists full.
const DEFAULT_LAYOUT_SM = [
  { i: "kpi_customers", x: 0, y: 0, w: 3, h: 2 },
  { i: "kpi_visits", x: 3, y: 0, w: 3, h: 2 },
  { i: "kpi_followups", x: 0, y: 2, w: 3, h: 2 },
  { i: "kpi_followup_visits", x: 3, y: 2, w: 3, h: 2 },
  { i: "chart_1", x: 0, y: 4, w: 3, h: 5 },
  { i: "chart_2", x: 3, y: 4, w: 3, h: 5 },
  { i: "chart_3", x: 0, y: 9, w: 3, h: 5 },
  { i: "chart_4", x: 3, y: 9, w: 3, h: 5 },
  { i: "list_activity", x: 0, y: 14, w: 6, h: 8 },
  { i: "list_followups", x: 0, y: 22, w: 6, h: 5 },
];

// ---------- KPI Card (minimal) ----------
const KpiCard = memo(function KpiCard({ label, value, accent, icon: Icon, onClick, trend, variant = "default" }) {
  const isHero = variant === "hero";
  return (
    <button
      onClick={onClick}
      type="button"
      className={`group relative h-full w-full text-left rounded-2xl px-4 py-3.5 transition-all overflow-hidden
        ${isHero
          ? "bg-primary text-white shadow-[0_4px_20px_-6px_rgba(0,42,67,0.5)] hover:shadow-[0_8px_24px_-4px_rgba(0,42,67,0.55)] hover:-translate-y-0.5"
          : "glass-card hover:shadow-glass hover:-translate-y-0.5"
        }`}
      data-testid={`kpi-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      {isHero && (
        <div className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 blur-xl" />
      )}

      <div className="relative flex items-center justify-between gap-3 h-full">
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] uppercase tracking-[0.1em] font-semibold leading-none ${
            isHero ? "text-white/75" : "text-muted-foreground/75"
          }`}>
            {label}
          </p>
          <p className={`text-[20px] font-bold mt-2 tabular-nums leading-none tracking-tight ${
            isHero ? "text-white" : "text-foreground"
          }`}>
            {value?.toLocaleString("tr-TR") ?? 0}
          </p>
          {trend !== undefined && trend !== null && (
            <div className={`mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold ${
              isHero ? "text-white/90" : trend >= 0 ? "text-emerald-600" : "text-red-600"
            }`}>
              {trend >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isHero ? "bg-white/15 backdrop-blur-sm ring-1 ring-white/20" : accent
        }`}>
          <Icon className={`w-4 h-4 ${isHero ? "text-white" : ""}`} strokeWidth={2} />
        </div>
      </div>
    </button>
  );
});

// ---------- WidgetShell ----------
const WidgetShell = memo(function WidgetShell({
  title,
  action,
  children,
  editing,
  onRemove,
  onConfigure,
  icon: Icon,
}) {
  return (
    <div className="h-full w-full glass-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.5)" }}>
        <div className="flex items-center gap-2 min-w-0">
          {editing && (
            <GripVertical className="w-3.5 h-3.5 text-on-surface-variant/60 drag-handle cursor-grab active:cursor-grabbing" />
          )}
          {Icon && <Icon className="w-3.5 h-3.5 text-on-surface-variant/60" />}
          <h3 className="text-[13px] font-semibold text-primary truncate">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {!editing && action}
          {editing && onConfigure && (
            <button
              onClick={onConfigure}
              className="text-on-surface-variant/60 hover:text-primary transition-colors"
              title="Düzenle"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
          {editing && onRemove && (
            <button
              onClick={onRemove}
              className="text-on-surface-variant/60 hover:text-red-500 transition-colors"
              title="Kaldır"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
});

// ---------- Donut chart helper ----------
const buildDonutData = (entries) => ({
  labels: entries.map((e) => e._id || "—"),
  datasets: [
    {
      data: entries.map((e) => e.count),
      backgroundColor: palette,
      borderWidth: 3,
      borderColor: "#ffffff",
      borderRadius: 8,
      hoverOffset: 8,
      spacing: 2,
    },
  ],
});

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "72%",
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        padding: 10,
        usePointStyle: true,
        pointStyle: "circle",
        boxWidth: 8,
        font: { size: 11, family: "Urbanist", weight: "500" },
        color: "#42474d",
      },
    },
    tooltip: {
      backgroundColor: "rgba(0, 42, 67, 0.92)",
      titleColor: "#fff",
      bodyColor: "#fff",
      padding: 10,
      cornerRadius: 8,
      boxPadding: 4,
      titleFont: { weight: "600", family: "Urbanist" },
    },
  },
};

// Shorten long partner/competitor names for chart x-axis readability.
// Strips common company-type suffixes (Elektronik, Mühendislik, Makina, ...) so
// "Halıcı Elektronik" → "Halıcı", "ADS Mühendislik" → "ADS", "KT Elektrik" → "KT".
// The full name is preserved in the tooltip via a chart.js callback.
const SHORTEN_STOP_WORDS = new Set([
  "elektrik",
  "elektronik",
  "mühendislik",
  "muhendislik",
  "makina",
  "makine",
  "otomasyon",
  "endüstri",
  "endustri",
  "endüstriyel",
  "endustriyel",
  "san",
  "san.",
  "tic",
  "tic.",
  "ltd",
  "ltd.",
  "şti",
  "sti",
  "şti.",
  "sti.",
  "a.ş.",
  "as",
  "a.ş",
  "ve",
  "&",
]);

const shortenLabel = (label) => {
  if (!label || typeof label !== "string") return label || "—";
  const trimmed = label.trim();
  if (trimmed.length <= 10) return trimmed;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 1) {
    return trimmed.length > 12 ? `${trimmed.slice(0, 10)}…` : trimmed;
  }
  const kept = [];
  for (const t of tokens) {
    if (SHORTEN_STOP_WORDS.has(t.toLowerCase())) break;
    kept.push(t);
  }
  const out = (kept.length ? kept : [tokens[0]]).join(" ");
  return out.length > 14 ? `${out.slice(0, 12)}…` : out;
};

// Bar chart options — rounded bars, clean axes (reference: DealDeck)
const buildBarData = (entries) => ({
  labels: entries.map((e) => shortenLabel(e._id || "—")),
  datasets: [
    {
      data: entries.map((e) => e.count),
      backgroundColor: entries.map((_, i) => palette[i % palette.length]),
      borderRadius: 8,
      borderSkipped: false,
      barThickness: 22,
      maxBarThickness: 28,
    },
  ],
});

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(0, 42, 67, 0.92)",
      titleColor: "#fff",
      bodyColor: "#fff",
      padding: 10,
      cornerRadius: 8,
      boxPadding: 4,
      titleFont: { weight: "600", family: "Urbanist" },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 10, family: "Urbanist" },
        color: "#72777e",
        maxRotation: 0,
        autoSkip: true,
      },
      border: { display: false },
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(194, 199, 206, 0.25)", drawBorder: false },
      ticks: {
        font: { size: 10, family: "Urbanist" },
        color: "#72777e",
        padding: 8,
      },
      border: { display: false },
    },
  },
};

// ---------- Donut with center total + click handler ----------
const CenteredDonut = memo(function CenteredDonut({ entries, onSliceClick }) {
  const top = entries.slice(0, 6);
  const total = top.reduce((s, e) => s + (e.count || 0), 0);
  const options = useMemo(
    () => ({
      ...donutOptions,
      onClick: (_evt, elements) => {
        if (!elements?.length || !onSliceClick) return;
        const idx = elements[0].index;
        const entry = top[idx];
        if (entry) onSliceClick(entry);
      },
      onHover: (event, elements) => {
        const target = event?.native?.target;
        if (target?.style) {
          target.style.cursor = elements?.length && onSliceClick ? "pointer" : "default";
        }
      },
    }),
    [top, onSliceClick]
  );
  if (top.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground/70">
        Veri yok
      </div>
    );
  }
  return (
    <div className="relative h-full w-full p-3">
      <Doughnut data={buildDonutData(top)} options={options} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -mt-8">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground leading-none tabular-nums">
            {total.toLocaleString("tr-TR")}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-1 font-semibold">
            Toplam
          </p>
        </div>
      </div>
    </div>
  );
});

// ---------- Rounded Bar chart (DealDeck style) ----------
const RoundedBar = memo(function RoundedBar({ entries, onBarClick }) {
  const top = entries.slice(0, 8);
  const options = useMemo(
    () => ({
      ...barOptions,
      plugins: {
        ...barOptions.plugins,
        tooltip: {
          ...barOptions.plugins.tooltip,
          callbacks: {
            // Show the FULL original label in the tooltip, even when x-axis is abbreviated
            title: (items) => {
              const i = items?.[0]?.dataIndex;
              return (i != null && top[i]?._id) || items?.[0]?.label || "";
            },
          },
        },
      },
      onClick: (_evt, elements) => {
        if (!elements?.length || !onBarClick) return;
        const idx = elements[0].index;
        const entry = top[idx];
        if (entry) onBarClick(entry);
      },
      onHover: (event, elements) => {
        const target = event?.native?.target;
        if (target?.style) {
          target.style.cursor = elements?.length && onBarClick ? "pointer" : "default";
        }
      },
    }),
    [top, onBarClick]
  );
  if (top.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground/70">
        Veri yok
      </div>
    );
  }
  return (
    <div className="relative h-full w-full px-3 pt-2 pb-1">
      <Bar data={buildBarData(top)} options={options} />
    </div>
  );
});

// ---------- main Dashboard ----------
const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.layouts || !parsed.visible) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveState = (visible, layouts, chartConfigs) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ visible, layouts, chartConfigs, ts: Date.now() })
    );
  } catch (e) {
    // ignore quota errors
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { openCustomerModal } = useCustomerModal();
  const { canEditDashboard } = useAuth();
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Segment popup state
  const [segment, setSegment] = useState(null); // {title, field, value, followup_only}
  const [segmentData, setSegmentData] = useState(null);
  const [segmentLoading, setSegmentLoading] = useState(false);

  const initial = loadState();
  const [visible, setVisible] = useState(initial?.visible || DEFAULT_VISIBLE);
  // Chart configs per widget id: { chart_1: {field, followup_only, title}, ... }
  const [chartConfigs, setChartConfigs] = useState(
    initial?.chartConfigs || DEFAULT_CHART_CONFIGS
  );
  // Cached distribution data keyed by `${field}::${followup_only}`
  const [distributions, setDistributions] = useState({});
  // Chart config editor state
  const [editingChart, setEditingChart] = useState(null); // chart widget id
  const [layouts, setLayouts] = useState(
    initial?.layouts || {
      lg: DEFAULT_LAYOUT_LG,
      md: DEFAULT_LAYOUT_LG,
      sm: DEFAULT_LAYOUT_SM,
      xs: DEFAULT_LAYOUT_XS,
      xxs: DEFAULT_LAYOUT_XS,
    }
  );

  useEffect(() => {
    // === Stale-while-revalidate: paint cached stats instantly, then refresh. ===
    const cachedStats = swrCache.get("dash:stats");
    const cachedActivities = swrCache.get("dash:activities");
    if (cachedStats) setStats(cachedStats);
    if (cachedActivities) setActivities(cachedActivities);
    if (cachedStats || cachedActivities) setLoading(false);

    const fetchData = async () => {
      try {
        const [statsRes, actRes] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/activity-feed?limit=40`),
        ]);
        setStats(statsRes.data);
        setActivities(actRes.data || []);
        swrCache.set("dash:stats", statsRes.data);
        swrCache.set("dash:activities", actRes.data || []);
      } catch (e) {
        // console.error left intentionally suppressed
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Persist layout/visible/chartConfigs
  useEffect(() => {
    saveState(visible, layouts, chartConfigs);
  }, [visible, layouts, chartConfigs]);

  const onLayoutChange = useCallback((_layout, allLayouts) => {
    setLayouts(allLayouts);
  }, []);

  const removeWidget = useCallback((id) => {
    setVisible((v) => v.filter((x) => x !== id));
  }, []);

  const addWidget = useCallback((id) => {
    setVisible((v) => {
      if (v.includes(id)) return v;
      return [...v, id];
    });
    setLayouts((prev) => {
      const lg = prev.lg || [];
      const maxY = lg.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      const def = WIDGET_DEFS[id].default;
      return {
        ...prev,
        lg: [...lg, { i: id, x: 0, y: maxY, w: def.w, h: def.h, minW: def.minW, minH: def.minH }],
      };
    });
    setAddOpen(false);
  }, []);

  // Track which distribution keys have been fetched (or are in-flight) via a ref
  // so we don't include `distributions` in the dependency array (which would re-fire
  // the effect each time a fetch completes, causing a waterfall).
  const fetchedKeysRef = useRef(new Set());

  // Fetch distribution data for any chart configs that don't have cached data yet
  useEffect(() => {
    const visibleCharts = visible.filter((id) => WIDGET_DEFS[id]?.isChart);
    const need = [];
    for (const id of visibleCharts) {
      const cfg = chartConfigs[id] || DEFAULT_CHART_CONFIGS[id];
      if (!cfg) continue;
      const key = `${cfg.field}::${cfg.followup_only ? 1 : 0}`;
      if (!fetchedKeysRef.current.has(key)) {
        fetchedKeysRef.current.add(key);
        need.push({ id, cfg, key });
      }
    }
    if (need.length === 0) return;
    (async () => {
      const fetchOne = async (item) => {
        try {
          const params = new URLSearchParams({
            field: item.cfg.field,
            followup_only: item.cfg.followup_only ? "true" : "false",
            limit: "10",
          });
          const { data } = await axios.get(
            `${API}/stats/distribution?${params}`
          );
          return { key: item.key, entries: data.entries || [] };
        } catch {
          fetchedKeysRef.current.delete(item.key); // allow retry on error
          return { key: item.key, entries: [] };
        }
      };
      const results = await Promise.all(need.map(fetchOne));
      // NOTE: intentionally not using a `cancelled` flag here — under React
      // StrictMode the effect cleanup runs immediately after the first mount,
      // which would discard the in-flight responses and leave charts stuck on
      // "Yükleniyor...". The fetchedKeysRef guards against duplicate fetches.
      setDistributions((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.key] = r.entries;
        return next;
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, chartConfigs]);

  const resetLayout = () => {
    setVisible(DEFAULT_VISIBLE);
    setLayouts({
      lg: DEFAULT_LAYOUT_LG,
      md: DEFAULT_LAYOUT_LG,
      sm: DEFAULT_LAYOUT_SM,
      xs: DEFAULT_LAYOUT_XS,
      xxs: DEFAULT_LAYOUT_XS,
    });
    setChartConfigs(DEFAULT_CHART_CONFIGS);
  };

  // Segment popup: load customers for a clicked slice
  const openSegment = useCallback(
    async (title, field, value, followup_only = false) => {
      setSegment({ title, field, value, followup_only });
      setSegmentData(null);
      setSegmentLoading(true);
      try {
        const params = new URLSearchParams({
          field,
          value,
          followup_only: followup_only ? "true" : "false",
          limit: "200",
        });
        const { data } = await axios.get(`${API}/stats/segment?${params}`);
        setSegmentData(data);
      } catch (e) {
        setSegmentData({ count: 0, customers: [], error: true });
      } finally {
        setSegmentLoading(false);
      }
    },
    []
  );

  const closeSegment = () => {
    setSegment(null);
    setSegmentData(null);
  };

  const hiddenWidgets = useMemo(
    () => Object.keys(WIDGET_DEFS).filter((k) => !visible.includes(k)),
    [visible]
  );

  // ---------- render content per widget ----------
  const renderWidget = useCallback((id) => {
    switch (id) {
      case "kpi_customers":
        return (
          <KpiCard
            label="Müşteri"
            value={stats?.total_customers}
            icon={Users}
            variant="hero"
            onClick={() => !editing && navigate("/customers")}
          />
        );
      case "kpi_visits":
        return (
          <KpiCard
            label="Ziyaret"
            value={stats?.total_visits}
            icon={Calendar}
            accent="bg-primary-fixed text-primary"
            onClick={() => !editing && navigate("/visits")}
          />
        );
      case "kpi_followups":
        return (
          <KpiCard
            label="Takipte"
            value={stats?.followup_customers}
            icon={Bell}
            accent="bg-secondary-container text-secondary-md"
            onClick={() => !editing && navigate("/followups")}
          />
        );
      case "kpi_followup_visits":
        return (
          <KpiCard
            label="Takip Ziyaret"
            value={stats?.followup_visits}
            icon={Clock}
            accent="bg-tertiary-fixed text-primary"
            onClick={() => !editing && navigate("/followups")}
          />
        );
      case "chart_1":
      case "chart_2":
      case "chart_3":
      case "chart_4": {
        const cfg = chartConfigs[id] || DEFAULT_CHART_CONFIGS[id];
        const key = `${cfg.field}::${cfg.followup_only ? 1 : 0}`;
        const entries = distributions[key];
        return (
          <WidgetShell
            title={cfg.title}
            icon={Activity}
            editing={editing}
            onRemove={() => removeWidget(id)}
            onConfigure={() => setEditingChart(id)}
          >
            {entries === undefined ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground/70">
                Yükleniyor...
              </div>
            ) : (
              (cfg.chart_type === "bar") ? (
                <RoundedBar
                  entries={entries}
                  onBarClick={
                    editing
                      ? null
                      : (e) =>
                          openSegment(
                            `${cfg.title}: ${e._id}`,
                            cfg.field,
                            e._id,
                            cfg.followup_only
                          )
                  }
                />
              ) : (
                <CenteredDonut
                  entries={entries}
                  onSliceClick={
                    editing
                      ? null
                      : (e) =>
                          openSegment(
                            `${cfg.title}: ${e._id}`,
                            cfg.field,
                            e._id,
                            cfg.followup_only
                          )
                  }
                />
              )
            )}
          </WidgetShell>
        );
      }
      case "list_activity":
        return (
          <WidgetShell
            title="Son Aktiviteler"
            icon={Activity}
            editing={editing}
            onRemove={() => removeWidget(id)}
          >
            <div className="h-full overflow-y-auto">
              {activities.length === 0 ? (
                <p className="text-muted-foreground/70 text-center py-8 text-xs">
                  Henüz aktivite yok
                </p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {activities.map((a) => (
                    <li
                      key={a.id}
                      onClick={() => !editing && a.customer_id && openCustomerModal(a.customer_id)}
                      className="flex items-start gap-2.5 px-4 py-2 hover:bg-muted/40 cursor-pointer"
                    >
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${getActivityColor(
                          a.type
                        )}`}
                      >
                        {getActivityIcon(a.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-foreground truncate leading-tight">
                          {a.title}
                        </p>
                        {a.subtitle && (
                          <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                            {a.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 flex-shrink-0 mt-0.5 tabular-nums">
                        {formatTimeAgo(a.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </WidgetShell>
        );
      case "list_followups":
        return (
          <WidgetShell
            title="Yaklaşan Takipler"
            icon={Clock}
            editing={editing}
            onRemove={() => removeWidget(id)}
            action={
              <button
                onClick={() => navigate("/followups")}
                className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
              >
                Tümü →
              </button>
            }
          >
            <div className="h-full overflow-y-auto">
              {stats?.upcoming_followups?.length ? (
                <ul className="divide-y divide-slate-50">
                  {stats.upcoming_followups.slice(0, 8).map((c) => (
                    <li
                      key={c.id}
                      onClick={() => !editing && openCustomerModal(c.id)}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-amber-50/40 cursor-pointer"
                    >
                      <span className="w-7 h-7 bg-amber-50 text-amber-700 rounded-md flex items-center justify-center font-semibold text-xs flex-shrink-0">
                        {c.company_name?.charAt(0) || "?"}
                      </span>
                      <p className="flex-1 min-w-0 text-[12.5px] font-medium text-foreground truncate">
                        {c.company_name}
                      </p>
                      <span className="text-[11px] text-amber-700 tabular-nums flex-shrink-0">
                        {c.next_followup_date
                          ? new Date(c.next_followup_date).toLocaleDateString(
                              "tr-TR",
                              { day: "numeric", month: "short" }
                            )
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground/70 text-center py-6 text-xs">
                  Yaklaşan takip yok
                </p>
              )}
            </div>
          </WidgetShell>
        );
      case "list_recent":
        return (
          <WidgetShell
            title="Son Müşteriler"
            icon={Building2}
            editing={editing}
            onRemove={() => removeWidget(id)}
            action={
              <button
                onClick={() => navigate("/customers")}
                className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
              >
                Tümü →
              </button>
            }
          >
            <div className="h-full overflow-y-auto">
              {stats?.recent_customers?.length ? (
                <ul className="divide-y divide-slate-50">
                  {stats.recent_customers.slice(0, 8).map((c) => (
                    <li
                      key={c.id}
                      onClick={() => !editing && openCustomerModal(c.id)}
                      className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted/40 cursor-pointer"
                    >
                      <span className="w-7 h-7 bg-emerald-50 text-emerald-700 rounded-md flex items-center justify-center font-semibold text-xs flex-shrink-0">
                        {c.company_name?.charAt(0) || "?"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-foreground truncate leading-tight">
                          {c.company_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 truncate">
                          {c.market || "—"}
                        </p>
                      </div>
                      <Badge
                        className={`text-[10px] font-medium px-1.5 py-0 ${
                          STATUS_COLOR[c.status] ||
                          "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground/70 text-center py-6 text-xs">
                  Henüz müşteri yok
                </p>
              )}
            </div>
          </WidgetShell>
        );
      case "top_markets": {
        const top = (stats?.market_distribution || []).slice(0, 5);
        const max = top.reduce((m, e) => Math.max(m, e.count), 0) || 1;
        return (
          <WidgetShell
            title="En Çok Müşteri Olan Marketler"
            icon={Building2}
            editing={editing}
            onRemove={() => removeWidget(id)}
          >
            <div className="h-full overflow-y-auto p-3 space-y-2">
              {top.length === 0 && (
                <p className="text-muted-foreground/70 text-center text-xs py-4">
                  Veri yok
                </p>
              )}
              {top.map((row, idx) => (
                <div key={row._id} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-foreground truncate">
                      {row._id || "—"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.count}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.count / max) * 100}%`,
                        backgroundColor: palette[idx % palette.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </WidgetShell>
        );
      }
      default:
        return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, editing, distributions, chartConfigs, activities, openCustomerModal, navigate, openSegment]);

  // KPI widgets handle their own border via KpiCard.
  // For editing mode of KPI cards we still want remove/grip overlay,
  // so wrap KPIs in WidgetShell-less but with edit overlay:
  const renderItem = useCallback((id) => {
    const isKpi = id.startsWith("kpi_");
    if (isKpi) {
      return (
        <div className="relative h-full">
          {editing && (
            <div className="absolute top-1 left-1 right-1 z-10 flex justify-between pointer-events-none">
              <span className="pointer-events-auto bg-card/80 backdrop-blur rounded-md p-1 drag-handle cursor-grab active:cursor-grabbing">
                <GripVertical className="w-3 h-3 text-muted-foreground" />
              </span>
              <button
                onClick={() => removeWidget(id)}
                className="pointer-events-auto bg-card/80 backdrop-blur rounded-md p-1 hover:bg-red-50 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {renderWidget(id)}
        </div>
      );
    }
    return renderWidget(id);
  }, [editing, renderWidget, removeWidget]);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-12 gap-3" data-testid="dashboard-page">
        {[...Array(4)].map((_, i) => (
          <div
            key={`s-${i}`}
            className="col-span-3 h-24 glass-card animate-pulse"
          />
        ))}
        <div className="col-span-6 h-96 glass-card animate-pulse" />
        <div className="col-span-3 h-96 glass-card animate-pulse" />
        <div className="col-span-3 h-96 glass-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="dashboard-page">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between gap-2" style={{ background: "rgba(246,250,253,0.80)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.45)" }}>
        <div className="min-w-0 flex-1">
          <Breadcrumb className="mb-1" />
          <h1 className="text-lg sm:text-xl font-bold text-primary tracking-tight">
            Genel Bakış
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
            {editing
              ? "Düzenleme modu — sürükle, boyutlandır veya kaldır"
              : new Date().toLocaleDateString("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {editing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={resetLayout}
                data-testid="dashboard-reset-btn"
                className="h-8 px-2 sm:px-3"
                title="Sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Sıfırla</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                data-testid="dashboard-add-widget-btn"
                disabled={hiddenWidgets.length === 0}
                className="h-8 px-2 sm:px-3"
                title="Widget Ekle"
              >
                <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Widget Ekle</span>
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            onClick={() => setEditing((e) => !e)}
            data-testid="dashboard-edit-toggle"
            className={`h-8 px-2 sm:px-3 ${canEditDashboard ? "" : "hidden"}`}
            title={editing ? "Düzenlemeyi Bitir" : "Düzenle"}
          >
            {editing ? (
              <>
                <Check className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Bitti</span>
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Düzenle</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Türkiye Müşteri Yoğunluğu Haritası */}
      <div className="px-3 pt-2">
        <TurkeyMap />
      </div>

      {/* Grid */}
      <div className={`px-3 pt-2 pb-12 ${editing ? "dashboard-editing" : ""}`}>
        <GridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 4 }}
          rowHeight={40}
          margin={[12, 12]}
          containerPadding={[8, 8]}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle=".drag-handle"
          onLayoutChange={onLayoutChange}
        >
          {visible.map((id) => (
            <div key={id} data-testid={`widget-${id}`}>
              {renderItem(id)}
            </div>
          ))}
        </GridLayout>
      </div>

      {/* Add widget dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Widget Ekle</DialogTitle>
            <DialogDescription>
              Dashboard'a eklemek istediğin widget'ı seç.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {hiddenWidgets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Tüm widget'lar zaten ekli
              </p>
            ) : (
              hiddenWidgets.map((id) => {
                const w = WIDGET_DEFS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => addWidget(id)}
                    data-testid={`add-widget-${id}`}
                    className="w-full text-left p-3 rounded-lg border border-border hover:border-slate-400 hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {w.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {w.description}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Segment details dialog (chart slice click) */}
      <Dialog open={!!segment} onOpenChange={(o) => !o && closeSegment()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: palette[0] }}
              />
              {segment?.title || "Detay"}
            </DialogTitle>
            <DialogDescription>
              {segmentLoading
                ? "Yükleniyor..."
                : segmentData
                ? `${segmentData.count} müşteri bulundu${
                    segment?.followup_only ? " (yalnızca takipteki)" : ""
                  }`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto -mx-2">
            {segmentLoading && (
              <div className="py-10 text-center text-sm text-muted-foreground/70">
                Yükleniyor...
              </div>
            )}
            {!segmentLoading && segmentData?.customers?.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground/70">
                Bu segmentte müşteri bulunamadı.
              </div>
            )}
            {!segmentLoading && segmentData?.customers?.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {segmentData.customers.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => {
                      closeSegment();
                      openCustomerModal(c.id);
                    }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer rounded-md"
                    data-testid={`segment-customer-${c.id}`}
                  >
                    <span className="w-7 h-7 bg-muted text-foreground rounded-md flex items-center justify-center font-semibold text-xs flex-shrink-0">
                      {c.company_name?.charAt(0) || "?"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.company_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[c.market, c.city, c.partner, c.assigned_to]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {c.status && (
                      <Badge
                        className={`text-[10px] font-medium px-1.5 py-0 ${
                          STATUS_COLOR[c.status] ||
                          "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.status}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {segmentData && segmentData.count > segmentData.customers.length && (
            <p className="text-[11px] text-muted-foreground/70 text-center pt-2">
              İlk {segmentData.customers.length} kayıt gösteriliyor. Tümünü
              görmek için Müşteriler sayfasında filtre uygulayın.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Chart config dialog (gear icon in edit mode) */}
      <Dialog open={!!editingChart} onOpenChange={(o) => !o && setEditingChart(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Grafiği Düzenle</DialogTitle>
            <DialogDescription>
              Bu grafiğin hangi veriyi göstereceğini seç. Sadece müşteriler tablosundaki alanlar listelenir.
            </DialogDescription>
          </DialogHeader>
          {editingChart && (() => {
            const cur = chartConfigs[editingChart] || DEFAULT_CHART_CONFIGS[editingChart];
            const update = (patch) => {
              setChartConfigs((prev) => ({
                ...prev,
                [editingChart]: { ...cur, ...patch },
              }));
            };
            return (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">
                    Grafik Başlığı
                  </label>
                  <input
                    type="text"
                    value={cur.title}
                    onChange={(e) => update({ title: e.target.value })}
                    className="w-full h-9 px-3 text-sm rounded-md border border-border focus:border-slate-400 focus:outline-none"
                    data-testid="chart-title-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">
                    Veri Alanı
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CHART_FIELDS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() =>
                          update({
                            field: f.value,
                            title: f.label + " Dağılımı",
                          })
                        }
                        className={`px-3 py-2 text-sm rounded-md border text-left transition-colors ${
                          cur.field === f.value
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-muted/30"
                        }`}
                        data-testid={`chart-field-${f.value}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">
                    Grafik Türü
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => update({ chart_type: "donut" })}
                      className={`px-3 py-2 text-sm rounded-md border text-left transition-colors ${
                        (cur.chart_type || "donut") === "donut"
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-border text-muted-foreground hover:bg-muted/30"
                      }`}
                      data-testid="chart-type-donut"
                    >
                      🍩 Halka
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ chart_type: "bar" })}
                      className={`px-3 py-2 text-sm rounded-md border text-left transition-colors ${
                        cur.chart_type === "bar"
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-border text-muted-foreground hover:bg-muted/30"
                      }`}
                      data-testid="chart-type-bar"
                    >
                      📊 Bar
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={!!cur.followup_only}
                    onChange={(e) =>
                      update({ followup_only: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300"
                    data-testid="chart-followup-only"
                  />
                  <span>Sadece takipteki müşterileri göster</span>
                </label>
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setChartConfigs((prev) => ({
                        ...prev,
                        [editingChart]: DEFAULT_CHART_CONFIGS[editingChart],
                      }));
                    }}
                  >
                    Sıfırla
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setEditingChart(null)}
                    data-testid="chart-done-btn"
                  >
                    Tamam
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Lightweight inline styles for grid */}
      <style>{`
        .react-grid-item.react-grid-placeholder {
          background: #cbd5e1 !important;
          border-radius: 12px !important;
          opacity: 0.4 !important;
        }
        .dashboard-editing .react-grid-item {
          outline: 1px dashed rgba(100,116,139,0.4);
          outline-offset: 2px;
          border-radius: 12px;
        }
        .react-resizable-handle {
          z-index: 5;
        }
        .react-grid-item > .react-resizable-handle::after {
          border-color: #94a3b8 !important;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
