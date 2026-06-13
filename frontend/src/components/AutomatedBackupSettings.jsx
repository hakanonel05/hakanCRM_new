import { useState, useEffect } from "react";
import axios from "axios";
import {
  Clock,
  Mail,
  Save,
  PlayCircle,
  Trash2,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAY_LABELS = {
  mon: "Pazartesi",
  tue: "Salı",
  wed: "Çarşamba",
  thu: "Perşembe",
  fri: "Cuma",
  sat: "Cumartesi",
  sun: "Pazar",
};

const formatBytes = (b) => {
  if (!b) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR");
  } catch {
    return iso;
  }
};

export default function AutomatedBackupSettings() {
  const [config, setConfig] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const [unavailable, setUnavailable] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([
        axios.get(`${API}/backups/config`),
        axios.get(`${API}/backups/list`),
      ]);
      setConfig(c.data);
      setBackups(l.data.backups || []);
      setUnavailable(false);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404 || status === undefined) {
        // Endpoint not deployed yet (server too old) — degrade silently
        setUnavailable(true);
      } else if (status === 401 || status === 403) {
        // Not authorized — degrade silently, no toast spam
        setUnavailable(true);
      } else {
        toast.error("Yedekleme ayarları yüklenemedi");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const update = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const payload = {
        enabled: !!config.enabled,
        frequency: config.frequency,
        hour: Number(config.hour),
        minute: Number(config.minute),
        day_of_week: config.day_of_week,
        email_enabled: !!config.email_enabled,
        email_recipients: config.email_recipients || [],
        retention_days: Number(config.retention_days),
      };
      const { data } = await axios.put(`${API}/backups/config`, payload);
      setConfig(data);
      toast.success("Ayarlar kaydedildi");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Ayarlar kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const triggerNow = async () => {
    setTriggering(true);
    try {
      const { data } = await axios.post(`${API}/backups/trigger`);
      if (data.ok) {
        toast.success(`Yedek alındı: ${data.filename}`);
        await fetchAll();
      } else {
        toast.error(`Yedekleme hatası: ${data.error || ""}`);
      }
    } catch (e) {
      toast.error("Yedekleme başlatılamadı");
    } finally {
      setTriggering(false);
    }
  };

  const downloadBackup = async (filename) => {
    try {
      const resp = await axios.get(`${API}/backups/${filename}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("İndirme başarısız");
    }
  };

  const deleteBackup = async (filename) => {
    if (!window.confirm(`${filename} silinsin mi?`)) return;
    try {
      await axios.delete(`${API}/backups/${filename}`);
      toast.success("Silindi");
      setBackups((b) => b.filter((x) => x.filename !== filename));
    } catch {
      toast.error("Silinemedi");
    }
  };

  const addRecipient = () => {
    const v = emailInput.trim();
    if (!v) return;
    if (!/^\S+@\S+\.\S+$/.test(v)) {
      toast.error("Geçersiz e-posta");
      return;
    }
    const list = config?.email_recipients || [];
    if (list.includes(v)) {
      toast.error("Bu e-posta zaten ekli");
      return;
    }
    update({ email_recipients: [...list, v] });
    setEmailInput("");
  };

  const removeRecipient = (em) => {
    update({
      email_recipients: (config?.email_recipients || []).filter((x) => x !== em),
    });
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/70" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Otomatik Yedekleme:</strong> Bu özellik için sunucunun
        güncellenmesi gerekiyor. Lütfen yeni sürümü GitHub'a gönderip Render
        deploy edin. Manuel yedekleme yukarıdan kullanılabilir.
      </div>
    );
  }

  if (!config) return null;

  return (
    <div
      className="bg-card rounded-xl border border-border p-6"
      data-testid="auto-backup-settings"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-fixed/60 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Otomatik Yedekleme</h3>
            <p className="text-sm text-muted-foreground">
              Programlı yedekler, e-posta gönderimi ve geçmiş yönetimi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Aktif</span>
          <Switch
            data-testid="backup-enabled-switch"
            checked={!!config.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
        </div>
      </div>

      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-border p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Son Çalışma</p>
          <div className="flex items-center gap-1.5 mt-1">
            {config.last_status === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : config.last_status === "error" ? (
              <XCircle className="w-4 h-4 text-red-600" />
            ) : (
              <Clock className="w-4 h-4 text-muted-foreground/70" />
            )}
            <span className="text-sm font-medium text-foreground">
              {formatDateTime(config.last_run)}
            </span>
          </div>
          {config.last_error && (
            <p className="text-xs text-red-600 mt-1 truncate" title={config.last_error}>
              {config.last_error}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Sonraki Çalışma</p>
          <p className="text-sm font-medium text-foreground mt-1">
            {config.enabled ? formatDateTime(config.next_run) : "Devre dışı"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Toplam Yedek</p>
          <p className="text-sm font-medium text-foreground mt-1">
            {backups.length} dosya
          </p>
        </div>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Sıklık</Label>
          <Select
            value={config.frequency}
            onValueChange={(v) => update({ frequency: v })}
          >
            <SelectTrigger className="h-9" data-testid="backup-frequency-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Günlük</SelectItem>
              <SelectItem value="weekly">Haftalık</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {config.frequency === "weekly" && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Gün</Label>
            <Select
              value={config.day_of_week}
              onValueChange={(v) => update({ day_of_week: v })}
            >
              <SelectTrigger className="h-9" data-testid="backup-dow-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DAY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Saat</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={config.hour}
            onChange={(e) => update({ hour: Number(e.target.value) })}
            className="h-9"
            data-testid="backup-hour-input"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Dakika</Label>
          <Input
            type="number"
            min={0}
            max={59}
            value={config.minute}
            onChange={(e) => update({ minute: Number(e.target.value) })}
            className="h-9"
            data-testid="backup-minute-input"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Saklama (gün)</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={config.retention_days}
            onChange={(e) => update({ retention_days: Number(e.target.value) })}
            className="h-9"
            data-testid="backup-retention-input"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
        <CalendarIcon className="w-3.5 h-3.5" />
        Saatler sunucu zaman dilimine (UTC) göredir.
      </p>

      {/* Email */}
      <div className="rounded-lg border border-border p-4 mb-4 bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              E-posta ile gönder
            </span>
          </div>
          <Switch
            data-testid="backup-email-switch"
            checked={!!config.email_enabled}
            onCheckedChange={(v) => update({ email_enabled: v })}
          />
        </div>
        {config.email_enabled && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Input
                placeholder="email@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                className="h-9"
                data-testid="backup-email-input"
              />
              <Button
                size="sm"
                onClick={addRecipient}
                data-testid="backup-email-add-btn"
              >
                Ekle
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(config.email_recipients || []).length === 0 && (
                <span className="text-xs text-muted-foreground/70">Henüz alıcı eklenmedi</span>
              )}
              {(config.email_recipients || []).map((em) => (
                <Badge
                  key={em}
                  variant="secondary"
                  className="pr-1 flex items-center gap-1"
                >
                  {em}
                  <button
                    className="hover:text-red-600"
                    onClick={() => removeRecipient(em)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button
          onClick={saveConfig}
          disabled={saving}
          data-testid="backup-save-btn"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Ayarları Kaydet
        </Button>
        <Button
          variant="outline"
          onClick={triggerNow}
          disabled={triggering}
          data-testid="backup-trigger-btn"
        >
          {triggering ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <PlayCircle className="w-4 h-4 mr-2" />
          )}
          Şimdi Yedekle
        </Button>
        <Button variant="ghost" onClick={fetchAll} data-testid="backup-refresh-btn">
          <RefreshCw className="w-4 h-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* History */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">
          Yedek Geçmişi
        </h4>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 py-4 text-center">
            Henüz yedek alınmadı
          </p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {backups.map((b) => (
              <div
                key={b.filename}
                className="flex items-center justify-between px-3 py-2 hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {b.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(b.created_at)} • {formatBytes(b.size_bytes)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="İndir"
                    onClick={() => downloadBackup(b.filename)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700"
                    title="Sil"
                    onClick={() => deleteBackup(b.filename)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
