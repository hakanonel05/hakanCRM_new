import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Check,
  X,
  Sparkles,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FIELD_LABELS = {
  city: "Şehir",
  website: "Web Sitesi",
  market: "Market",
  application: "Uygulama",
};

const confColor = (c) => {
  if (c >= 60) return "bg-amber-100 text-amber-800";
  if (c >= 40) return "bg-orange-100 text-orange-800";
  return "bg-rose-100 text-rose-800";
};

const SuggestionsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/enrichment/suggestions?status=pending&limit=1000`);
      setItems(res.data.suggestions || []);
    } catch (e) {
      console.error(e);
      toast.error("Öneriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  // Firma bazinda grupla
  const groups = useMemo(() => {
    const map = new Map();
    for (const s of items) {
      const key = s.customer_id;
      if (!map.has(key)) {
        map.set(key, {
          customer_id: s.customer_id,
          company_name: s.company_name || "—",
          rows: [],
        });
      }
      map.get(key).rows.push(s);
    }
    return Array.from(map.values());
  }, [items]);

  const removeIds = (ids) => {
    const set = new Set(ids);
    setItems((prev) => prev.filter((s) => !set.has(s.id)));
  };

  const approveOne = async (s) => {
    try {
      await axios.post(`${API}/enrichment/suggestions/${s.id}/approve`);
      removeIds([s.id]);
      toast.success(`${FIELD_LABELS[s.field] || s.field} yazıldı`);
    } catch {
      toast.error("Onaylanamadı");
    }
  };

  const rejectOne = async (s) => {
    try {
      await axios.post(`${API}/enrichment/suggestions/${s.id}/reject`);
      removeIds([s.id]);
    } catch {
      toast.error("Reddedilemedi");
    }
  };

  const approveGroup = async (group) => {
    const ids = group.rows.map((r) => r.id);
    setBusy(true);
    try {
      const res = await axios.post(`${API}/enrichment/suggestions/bulk-approve`, { ids });
      removeIds(ids);
      toast.success(`${res.data.approved || ids.length} alan yazıldı`);
    } catch {
      toast.error("Toplu onay başarısız");
    } finally {
      setBusy(false);
    }
  };

  const approveAll = async () => {
    const ids = items.map((s) => s.id);
    if (!ids.length) return;
    if (!window.confirm(`${ids.length} önerinin tamamını onaylayıp yazmak istediğinize emin misiniz?`)) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/enrichment/suggestions/bulk-approve`, { ids });
      setItems([]);
      toast.success(`${res.data.approved || ids.length} alan yazıldı`);
    } catch {
      toast.error("Toplu onay başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Breadcrumb items={[{ label: "Öneriler" }]} />

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Doldurma Önerileri
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Arka plan taramasının düşük güvenle bulduğu, onayını bekleyen bilgiler.
            (Yüksek güvenli olanlar zaten otomatik yazıldı.)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSuggestions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
          <Button onClick={approveAll} disabled={busy || items.length === 0}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Tümünü Onayla ({items.length})
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          Yükleniyor...
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground/70">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Onay bekleyen öneri yok.</p>
          <p className="text-sm mt-1">Arka plan taraması çalıştıkça buraya düşük güvenli öneriler düşecek.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.customer_id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
                <button
                  onClick={() => navigate(`/customers/${group.customer_id}`)}
                  className="flex items-center gap-2 font-medium hover:text-primary transition-colors"
                >
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  {group.company_name}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <Button size="sm" variant="outline" onClick={() => approveGroup(group)} disabled={busy}>
                  <Check className="w-4 h-4 mr-1" />
                  Firmayı Onayla
                </Button>
              </div>
              <div className="divide-y">
                {group.rows.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-24 shrink-0 text-xs text-muted-foreground">
                      {FIELD_LABELS[s.field] || s.field}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.suggested_value}</p>
                    </div>
                    <Badge className={`${confColor(s.confidence)} shrink-0`}>
                      %{s.confidence} güven
                    </Badge>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                        onClick={() => approveOne(s)}
                        title="Onayla ve yaz"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-500 hover:text-rose-600"
                        onClick={() => rejectOne(s)}
                        title="Reddet"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestionsPage;

