import { useState, useEffect, useMemo } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Trash2,
  Crown,
  Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useCustomerModal } from "../contexts/CustomerModalContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FIELD_LABELS = {
  company_name: "Firma Adı",
  market: "Market",
  application: "Uygulama",
  city: "Şehir",
  district: "İlçe",
  status: "Durum",
  partner: "Partner",
  competitor: "Rakip",
  phone: "Telefon",
  email: "E-posta",
  website: "Web Sitesi",
};
const FIELDS = Object.keys(FIELD_LABELS);

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const fillCount = (m) => FIELDS.filter((f) => !!m[f] && String(m[f]).trim()).length;

// Color for the score badge
const scoreColor = (s) => {
  if (s >= 98) return "bg-red-100 text-red-700 border-red-200";
  if (s >= 95) return "bg-orange-100 text-orange-700 border-orange-200";
  if (s >= 90) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-muted text-foreground border-border";
};

export default function DuplicatesPage() {
  const { openCustomerModal } = useCustomerModal();
  const [threshold, setThreshold] = useState(90);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [mergeFor, setMergeFor] = useState(null); // group being merged
  const [keepId, setKeepId] = useState(null);
  const [merging, setMerging] = useState(false);
  const [resolvedGroupIds, setResolvedGroupIds] = useState(new Set()); // hide locally after merge
  // Auto-merge dialog state
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoMinScore, setAutoMinScore] = useState(98);
  const [autoPreview, setAutoPreview] = useState(null);
  const [autoPreviewing, setAutoPreviewing] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);

  const fetch = async (newThreshold = threshold) => {
    setLoading(true);
    try {
      const resp = await axios.get(
        `${API}/customers-duplicates?threshold=${newThreshold}`,
        { timeout: 120000 } // 2 dakika — büyük veri taraması yavaş olabilir
      );
      setData(resp.data);
      setResolvedGroupIds(new Set());
    } catch (e) {
      // Surface the actual reason so the user/devs can see what failed.
      console.error("[Duplicates] fetch failed:", e);
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      let msg = "Yinelenenler taranamadı";
      if (status === 401 || status === 403) {
        msg = "Yetki hatası — lütfen tekrar giriş yapın";
      } else if (e?.code === "ECONNABORTED") {
        msg = "Tarama zaman aşımına uğradı — tekrar deneyin";
      } else if (e?.message === "Network Error") {
        msg = "Bağlantı hatası — internetinizi kontrol edin";
      } else if (detail) {
        msg = `Tarama hatası: ${detail}`;
      } else if (status) {
        msg = `Tarama hatası (HTTP ${status})`;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(threshold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredGroups = useMemo(() => {
    if (!data?.groups) return [];
    const q = search.trim().toLowerCase();
    return data.groups
      .filter((g) => !resolvedGroupIds.has(g.id))
      .filter((g) =>
        !q
          ? true
          : g.members.some((m) =>
              [m.company_name, m.city, m.market, m.phone, m.email]
                .filter(Boolean)
                .some((s) => String(s).toLowerCase().includes(q))
            )
      );
  }, [data, search, resolvedGroupIds]);

  const openMerge = (group) => {
    // Auto-suggest: keep the most-filled member
    const sorted = [...group.members].sort((a, b) => fillCount(b) - fillCount(a));
    setMergeFor({ ...group, members: sorted });
    setKeepId(sorted[0].id);
  };

  const submitMerge = async () => {
    if (!mergeFor || !keepId) return;
    const delete_ids = mergeFor.members
      .filter((m) => m.id !== keepId)
      .map((m) => m.id);
    setMerging(true);
    try {
      const { data: r } = await axios.post(`${API}/customers-merge`, {
        keep_id: keepId,
        delete_ids,
      });
      const moved =
        (r.reassigned?.visits || 0) +
        (r.reassigned?.calls || 0) +
        (r.reassigned?.activity_log || 0);
      toast.success(
        `Birleştirildi: ${delete_ids.length} kayıt silindi, ${moved} ilişki taşındı`
      );
      setResolvedGroupIds((prev) => new Set([...prev, mergeFor.id]));
      setMergeFor(null);
      setKeepId(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Birleştirme başarısız");
    } finally {
      setMerging(false);
    }
  };

  // ----- Auto merge -----
  const openAutoMerge = async () => {
    setAutoOpen(true);
    await runAutoPreview(autoMinScore);
  };

  const runAutoPreview = async (score) => {
    setAutoPreviewing(true);
    setAutoPreview(null);
    try {
      const { data } = await axios.post(`${API}/customers-auto-merge`, {
        min_score: score,
        dry_run: true,
        max_groups: 500,
      });
      setAutoPreview(data);
    } catch (e) {
      toast.error("Önizleme alınamadı");
      setAutoOpen(false);
    } finally {
      setAutoPreviewing(false);
    }
  };

  const runAutoMerge = async () => {
    setAutoRunning(true);
    try {
      const { data } = await axios.post(`${API}/customers-auto-merge`, {
        min_score: autoMinScore,
        dry_run: false,
        max_groups: 500,
      });
      toast.success(
        `${data.groups_merged} grup birleştirildi, ${data.customers_deleted} kayıt silindi`
      );
      if (data.errors?.length) {
        toast.error(`${data.errors.length} grupta hata`);
      }
      setAutoOpen(false);
      setAutoPreview(null);
      // Refresh the full list
      await fetch(threshold);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Otomatik birleştirme başarısız");
    } finally {
      setAutoRunning(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-muted/30/50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Breadcrumb className="mb-1" />
          <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
            Yinelenenler
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            {loading
              ? "Taranıyor..."
              : data
              ? `${filteredGroups.length} olası tekrar grubu · ${data.total_customers_affected} müşteri kaydı etkilenebilir`
              : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span>Eşik:</span>
            <input
              type="range"
              min={70}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-24"
              data-testid="threshold-slider"
            />
            <span className="font-medium tabular-nums w-8">%{threshold}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetch(threshold)}
            disabled={loading}
            className="h-8"
            data-testid="rescan-btn"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 sm:mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Yeniden Tara</span>
          </Button>
          <Button
            size="sm"
            onClick={openAutoMerge}
            disabled={loading || !data?.total_groups}
            className="h-8 bg-amber-500 hover:bg-amber-600 text-white"
            data-testid="auto-merge-btn"
          >
            <Zap className="w-3.5 h-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Otomatik Birleştir</span>
          </Button>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-3 sm:py-4 max-w-5xl mx-auto">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
          <Input
            placeholder="Grup içinde firma adı / şehir ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-card"
          />
        </div>

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground/70">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Müşteri kayıtları benzerlik için taranıyor...
          </div>
        )}

        {!loading && filteredGroups.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
            <p className="text-sm font-medium text-foreground">
              {data?.groups?.length === 0
                ? "Yinelenen müşteri bulunamadı"
                : "Filtreye uyan grup yok"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.groups?.length === 0
                ? "Veri tabanın bu eşikte temiz görünüyor."
                : "Aramayı temizleyip tekrar dene."}
            </p>
          </div>
        )}

        {/* Groups */}
        <div className="space-y-3">
          {filteredGroups.map((g) => (
            <DuplicateCard
              key={g.id}
              group={g}
              onOpenCustomer={openCustomerModal}
              onMerge={openMerge}
            />
          ))}
        </div>
      </div>

      {/* Merge dialog */}
      <Dialog open={!!mergeFor} onOpenChange={(o) => !o && setMergeFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Birleştirmeyi Onayla</DialogTitle>
            <DialogDescription>
              Korunacak ana müşteriyi seç. Diğer kayıtların ziyaretleri,
              aramaları ve aktivite kayıtları ana müşteriye taşınacak ve diğer
              kayıtlar <strong>kalıcı olarak silinecek</strong>. Boş alanlar
              otomatik olarak diğerlerinden doldurulacak.
            </DialogDescription>
          </DialogHeader>

          {mergeFor && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {mergeFor.members.map((m, idx) => {
                const isKeep = m.id === keepId;
                const fc = fillCount(m);
                return (
                  <label
                    key={m.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isKeep
                        ? "border-emerald-400 bg-emerald-50/50"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="keep_id"
                      value={m.id}
                      checked={isKeep}
                      onChange={() => setKeepId(m.id)}
                      className="mt-1"
                      data-testid={`merge-keep-${m.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm truncate">
                          {m.company_name || "—"}
                        </span>
                        {idx === 0 && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            Önerilen
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {fc}/{FIELDS.length} dolu
                        </Badge>
                        {isKeep ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                            <Crown className="w-2.5 h-2.5 mr-0.5" />
                            Korunacak
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">
                            <Trash2 className="w-2.5 h-2.5 mr-0.5" />
                            Silinecek
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0.5">
                        {FIELDS.map(
                          (f) =>
                            m[f] && (
                              <span key={f} className="truncate">
                                <span className="text-muted-foreground/70">
                                  {FIELD_LABELS[f]}:
                                </span>{" "}
                                {m[f]}
                              </span>
                            )
                        )}
                      </div>
                      {m.created_at && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          Eklendi: {formatDate(m.created_at)}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setMergeFor(null)}
              disabled={merging}
            >
              Vazgeç
            </Button>
            <Button
              onClick={submitMerge}
              disabled={merging || !keepId}
              className="bg-primary hover:bg-primary/90"
              data-testid="confirm-merge-btn"
            >
              {merging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Birleştiriliyor...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Birleştir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-merge dialog */}
      <Dialog open={autoOpen} onOpenChange={(o) => !autoRunning && setAutoOpen(o)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Otomatik Birleştir
            </DialogTitle>
            <DialogDescription>
              Yüksek güvenli grupları (aynı isim/şehir/telefon/website) tek
              tıkla birleştir. Her grupta <strong>en dolu kayıt korunur</strong>,
              diğerleri silinir. İlişkili ziyaret/arama/aktivite kayıtları
              taşınır. <strong className="text-red-600">Bu işlem geri alınamaz.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Min. güven:
              </span>
              <input
                type="range"
                min={95}
                max={100}
                value={autoMinScore}
                onChange={(e) => setAutoMinScore(Number(e.target.value))}
                onMouseUp={() => runAutoPreview(autoMinScore)}
                onTouchEnd={() => runAutoPreview(autoMinScore)}
                className="flex-1"
                data-testid="auto-min-score"
              />
              <span className="font-semibold tabular-nums w-12 text-right">
                %{autoMinScore}
              </span>
            </div>

            {autoPreviewing && (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground/70">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Önizleme hazırlanıyor...
              </div>
            )}

            {!autoPreviewing && autoPreview && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-900">
                    Bu eşikte <strong>{autoPreview.groups_eligible}</strong>{" "}
                    grup birleştirilecek ve{" "}
                    <strong>{autoPreview.customers_to_delete}</strong> kayıt
                    silinecek.
                  </div>
                </div>

                {autoPreview.preview?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      İlk {autoPreview.preview.length} grup örneği:
                    </p>
                    <div className="border border-border rounded-lg max-h-44 overflow-y-auto divide-y divide-slate-100">
                      {autoPreview.preview.map((p, i) => (
                        <div
                          key={i}
                          className="px-3 py-1.5 text-[12px] flex items-center gap-2"
                        >
                          <Badge
                            className={`text-[10px] font-medium px-1.5 py-0 border ${scoreColor(
                              p.score
                            )}`}
                          >
                            %{p.score}
                          </Badge>
                          <span className="font-medium text-foreground truncate">
                            {p.keep}
                          </span>
                          <span className="text-muted-foreground/70">
                            ← {p.delete.length} kayıt
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {autoPreview.groups_eligible === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Bu eşikte birleştirilecek grup yok. Eşiği biraz düşür.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAutoOpen(false)}
              disabled={autoRunning}
            >
              Vazgeç
            </Button>
            <Button
              onClick={runAutoMerge}
              disabled={
                autoRunning ||
                autoPreviewing ||
                !autoPreview?.groups_eligible
              }
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="auto-merge-confirm"
            >
              {autoRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Birleştiriliyor...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  {autoPreview?.groups_eligible || 0} Grubu Birleştir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- per-group card ----------
const DuplicateCard = ({ group, onOpenCustomer, onMerge }) => {
  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden"
      data-testid={`dup-group-${group.id}`}
    >
      <div className="px-3 sm:px-4 py-2.5 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-foreground">
            {group.size} olası tekrar
          </span>
          <Badge className={`text-[10px] font-medium px-1.5 py-0 border ${scoreColor(group.max_score)}`}>
            %{group.max_score}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => onMerge(group)}
          className="bg-slate-900 hover:bg-slate-800 text-white h-7 px-3 text-xs"
          data-testid={`merge-open-${group.id}`}
        >
          Birleştir
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      <div className="divide-y divide-slate-100">
        {group.members.map((m) => {
          const fc = fillCount(m);
          return (
            <div
              key={m.id}
              className="px-3 sm:px-4 py-2.5 flex items-start gap-3 hover:bg-muted/30/70 cursor-pointer"
              onClick={() => onOpenCustomer(m.id)}
              data-testid={`dup-row-${m.id}`}
            >
              <span className="w-8 h-8 bg-muted text-foreground rounded-md flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {m.company_name?.charAt(0)?.toUpperCase() || "?"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">
                  {m.company_name || "—"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {[m.market, m.city, m.partner]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                {(m.phone || m.email || m.website) && (
                  <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    {[m.phone, m.email, m.website]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {fc}/{FIELDS.length} dolu
                </Badge>
                {m.best_match_type && (
                  <span className="text-[10px] text-muted-foreground/70">
                    {m.best_match_type} %{m.best_score}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
