import { useState, useEffect } from "react";
import { ADMIN_EMAIL } from "../lib/config";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import { 
  Settings, 
  Download, 
  Bell,
  Database,
  FileJson,
  Loader2,
  List,
  Trash2,
  X,
  Plus,
  Pencil,
  Mail,
  Users
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "../App";
import AutomatedBackupSettings from "../components/AutomatedBackupSettings";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Field labels in Turkish
const FIELD_LABELS = {
  market: "Market",
  application: "Uygulama",
  city: "Şehir",
  competitor: "Rakip",
  partner: "Partner",
  products: "Ürünler",
  assigned_to: "Takip Eden",
  status: "Durum",
  potential_level: "Potansiyel"
};

const SettingsPage = () => {
  const { user, isAdmin } = useAuth();
  const [notificationDays, setNotificationDays] = useState(user?.notification_days || 3);
  const [downloading, setDownloading] = useState(false);
  
  // Options management state
  const [options, setOptions] = useState({});
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [selectedField, setSelectedField] = useState(null);
  const [editingOption, setEditingOption] = useState(null);
  const [newOptionValue, setNewOptionValue] = useState("");
  
  // Email notification state
  const [emailSettings, setEmailSettings] = useState({
    recipients: [],
    days_before: 1,
    enabled: true
  });
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);

  // Whitelist (allowed users) state
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [newAllowedEmail, setNewAllowedEmail] = useState("");
  const [newAllowedName, setNewAllowedName] = useState("");

  // --- Field value merge (e.g. fix "f&b" / "F&B" / "çikolata" → "F&B") ---
  const [mergeField, setMergeField] = useState("market");
  const [mergeValues, setMergeValues] = useState([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeSelected, setMergeSelected] = useState([]);
  const [mergeTarget, setMergeTarget] = useState("");
  const [merging, setMerging] = useState(false);

  const MERGE_FIELDS = {
    market: "Market",
    application: "Uygulama",
    city: "Şehir",
    district: "İlçe",
    competitor: "Rakip",
    partner: "Partner",
    assigned_to: "Takip Eden",
  };

  const fetchMergeValues = async (field) => {
    setMergeLoading(true);
    setMergeSelected([]);
    setMergeTarget("");
    try {
      const res = await axios.get(`${API}/field-values/${field}`);
      setMergeValues(res.data?.values || []);
    } catch (e) {
      toast.error("Değerler yüklenemedi");
      setMergeValues([]);
    } finally {
      setMergeLoading(false);
    }
  };

  const toggleMergeValue = (value) => {
    setMergeSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleMerge = async () => {
    const target = mergeTarget.trim();
    const sources = mergeSelected.filter((v) => v !== target);
    if (!target) {
      toast.error("Hedef değer girin (örn: F&B)");
      return;
    }
    if (sources.length === 0) {
      toast.error("Birleştirilecek en az bir değer seçin");
      return;
    }
    const totalCount = mergeValues
      .filter((v) => sources.includes(v.value))
      .reduce((a, v) => a + v.count, 0);
    const ok = window.confirm(
      `${sources.join(", ")} → "${target}"\n\n` +
      `Bu işlem ${totalCount} müşteri kaydını kalıcı olarak güncelleyecek. Devam edilsin mi?`
    );
    if (!ok) return;

    setMerging(true);
    try {
      const res = await axios.post(`${API}/field-values/merge`, {
        field: mergeField,
        from_values: sources,
        to_value: target,
      });
      toast.success(res.data?.message || "Değerler birleştirildi");
      fetchMergeValues(mergeField);
      fetchOptions();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Birleştirme başarısız oldu");
    } finally {
      setMerging(false);
    }
  };

  // Fetch options, email settings, and allowed users on mount
  useEffect(() => {
    fetchOptions();
    fetchEmailSettings();
    fetchAllowedUsers();
  }, []);

  // Load distinct values whenever the merge field changes
  useEffect(() => {
    fetchMergeValues(mergeField);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeField]);
  
  const fetchAllowedUsers = async () => {
    try {
      const response = await axios.get(`${API}/allowed-users`);
      setAllowedUsers(response.data);
    } catch (error) {
      console.error("İzinli kullanıcılar yüklenemedi:", error);
    }
  };

  const addAllowedUser = async () => {
    if (!newAllowedEmail.trim()) {
      toast.error("E-posta adresi gerekli");
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(newAllowedEmail)) {
      toast.error("Geçerli bir e-posta adresi girin");
      return;
    }
    
    try {
      await axios.post(`${API}/allowed-users`, {
        email: newAllowedEmail.trim(),
        name: newAllowedName.trim()
      });
      toast.success("Kullanıcı eklendi");
      setNewAllowedEmail("");
      setNewAllowedName("");
      fetchAllowedUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kullanıcı eklenemedi");
    }
  };

  const removeAllowedUser = async (userId) => {
    if (!window.confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) {
      return;
    }
    
    try {
      await axios.delete(`${API}/allowed-users/${userId}`);
      toast.success("Kullanıcı silindi");
      fetchAllowedUsers();
    } catch (error) {
      toast.error("Kullanıcı silinemedi");
    }
  };
  const fetchEmailSettings = async () => {
    try {
      const response = await axios.get(`${API}/notification-settings`);
      setEmailSettings(response.data);
    } catch (error) {
      console.error("E-posta ayarları yüklenemedi:", error);
    }
  };
  
  const addEmailRecipient = async () => {
    if (!newRecipientEmail.trim()) {
      toast.error("E-posta adresi gerekli");
      return;
    }
    
    // Simple email validation
    if (!/\S+@\S+\.\S+/.test(newRecipientEmail)) {
      toast.error("Geçerli bir e-posta adresi girin");
      return;
    }
    
    try {
      await axios.post(`${API}/notification-settings/add-recipient`, {
        email: newRecipientEmail.trim(),
        name: newRecipientName.trim()
      });
      toast.success("Alıcı eklendi");
      setNewRecipientEmail("");
      setNewRecipientName("");
      fetchEmailSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Alıcı eklenemedi");
    }
  };
  
  const removeEmailRecipient = async (recipientId) => {
    if (!window.confirm("Bu alıcıyı silmek istediğinizden emin misiniz?")) {
      return;
    }
    
    try {
      await axios.delete(`${API}/notification-settings/recipient/${recipientId}`);
      toast.success("Alıcı silindi");
      fetchEmailSettings();
    } catch (error) {
      toast.error("Alıcı silinemedi");
    }
  };
  
  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      await axios.post(`${API}/test-email`);
      toast.success(`Test e-postası ${ADMIN_EMAIL} adresine gönderildi`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Test e-postası gönderilemedi");
    } finally {
      setSendingTestEmail(false);
    }
  };
  
  const triggerManualReminders = async () => {
    
    setSendingReminders(true);
    try {
      const response = await axios.post(`${API}/send-followup-reminders`);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Hatırlatma gönderilemedi");
    } finally {
      setSendingReminders(false);
    }
  };


  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/options/grouped`);
      setOptions(response.data);
    } catch (error) {
      console.error("Options yüklenemedi:", error);
    } finally {
      setOptionsLoading(false);
    }
  };

  const handleDeleteOption = async (optionId, fieldName) => {
    if (!window.confirm("Bu seçeneği silmek istediğinizden emin misiniz?")) {
      return;
    }
    
    try {
      await axios.delete(`${API}/options/${optionId}`);
      toast.success("Seçenek silindi");
      fetchOptions();
    } catch (error) {
      toast.error("Seçenek silinemedi");
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOption || !newOptionValue.trim()) {
      toast.error("Değer boş olamaz");
      return;
    }
    
    try {
      await axios.put(`${API}/options/${editingOption.id}`, {
        ...editingOption,
        value: newOptionValue.trim()
      });
      toast.success("Seçenek güncellendi");
      setEditingOption(null);
      setNewOptionValue("");
      fetchOptions();
    } catch (error) {
      toast.error("Seçenek güncellenemedi");
    }
  };

  const handleAddOption = async () => {
    if (!selectedField || !newOptionValue.trim()) {
      toast.error("Değer boş olamaz");
      return;
    }
    
    // Check if already exists
    const existingOptions = options[selectedField] || [];
    if (existingOptions.some(o => o.value.toLowerCase() === newOptionValue.trim().toLowerCase())) {
      toast.error("Bu seçenek zaten mevcut");
      return;
    }
    
    try {
      await axios.post(`${API}/options`, {
        field_name: selectedField,
        value: newOptionValue.trim()
      });
      toast.success("Seçenek eklendi");
      setNewOptionValue("");
      fetchOptions();
    } catch (error) {
      toast.error("Seçenek eklenemedi");
    }
  };

  const handleUpdateNotificationDays = async (days) => {
    try {
      await axios.patch(`${API}/users/me/notifications?days=${days}`, {}, { withCredentials: true });
      setNotificationDays(days);
      toast.success(`Bildirim süresi ${days} gün olarak ayarlandı`);
    } catch (error) {
      toast.error("Ayar güncellenemedi");
    }
  };

  const handleFullBackup = async () => {
    setDownloading(true);
    try {
      const response = await axios.get(`${API}/export/full-backup`, {
        responseType: "blob"
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `crmmaster_full_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Tam yedek indirildi!");
    } catch (error) {
      toast.error("Yedekleme başarısız");
    } finally {
      setDownloading(false);
    }
  };

  const handleExportCustomers = async () => {
    try {
      const response = await axios.get(`${API}/export/customers/xlsx`, {
        responseType: "blob"
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `musteriler_${new Date().toISOString().split("T")[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Müşteri listesi indirildi!");
    } catch (error) {
      toast.error("Dışa aktarma başarısız");
    }
  };

  const handleExportVisits = async () => {
    try {
      const response = await axios.get(`${API}/export/visits`, {
        responseType: "blob"
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `ziyaretler_${new Date().toISOString().split("T")[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Ziyaret listesi indirildi!");
    } catch (error) {
      toast.error("Dışa aktarma başarısız");
    }
  };

  // Admin only check
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Erişim Engellendi</h2>
          <p className="text-muted-foreground mt-2">Bu sayfayı görüntülemek için admin yetkisi gerekli</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="settings-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Ayarlar</h1>
          <p className="page-subtitle">Uygulama ayarları ve yedekleme</p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Email Notification Settings */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">E-posta Bildirimleri</h3>
              <p className="text-sm text-muted-foreground">Takip hatırlatmaları {ADMIN_EMAIL} adresine gönderilir</p>
            </div>
          </div>
          
          {/* Info box */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-primary">
              📧 Tüm hatırlatma e-postaları <strong>{ADMIN_EMAIL}</strong> adresine gönderilecek.
            </p>
          </div>
          
          {/* Test & Manual trigger buttons */}
          <div className="flex gap-2">
            <Button
              onClick={sendTestEmail}
              disabled={sendingTestEmail}
              variant="outline"
              className="flex-1"
            >
              {sendingTestEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Test E-postası Gönder
            </Button>
            <Button
              onClick={triggerManualReminders}
              disabled={sendingReminders}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {sendingReminders ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bell className="w-4 h-4 mr-2" />
              )}
              Hatırlatma Gönder
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-2 text-center">
            Not: Otomatik hatırlatmalar için sunucuda cron job kurulması gerekir
          </p>
        </div>

        {/* Allowed Users (Whitelist) - Admin Only */}
        {isAdmin && (
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">İzinli Kullanıcılar</h3>
                <p className="text-sm text-muted-foreground">Google ile giriş yapabilecek e-posta adresleri</p>
              </div>
            </div>
            
            {/* Info box */}
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-700">
                🔒 Sadece bu listedeki ve <strong>{ADMIN_EMAIL}</strong> giriş yapabilir.
              </p>
            </div>
            
            {/* Allowed users list */}
            {allowedUsers.length > 0 && (
              <div className="mb-4 space-y-2">
                {allowedUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium text-foreground">{user.email}</p>
                      {user.name && <p className="text-sm text-muted-foreground">{user.name}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAllowedUser(user.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new allowed user */}
            <div className="flex gap-2">
              <Input
                placeholder="E-posta adresi"
                value={newAllowedEmail}
                onChange={(e) => setNewAllowedEmail(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="İsim (opsiyonel)"
                value={newAllowedName}
                onChange={(e) => setNewAllowedName(e.target.value)}
                className="w-40"
              />
              <Button onClick={addAllowedUser} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* In-app Notification Settings */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Uygulama İçi Bildirimler</h3>
              <p className="text-sm text-muted-foreground">Takip uyarılarını ne kadar önceden görmek istediğinizi seçin</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Label>Uyarı süresi:</Label>
            <Select 
              value={notificationDays.toString()} 
              onValueChange={(v) => handleUpdateNotificationDays(parseInt(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 gün önce</SelectItem>
                <SelectItem value="3">3 gün önce</SelectItem>
                <SelectItem value="5">5 gün önce</SelectItem>
                <SelectItem value="7">7 gün önce</SelectItem>
                <SelectItem value="14">14 gün önce</SelectItem>
                <SelectItem value="30">30 gün önce</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Backup & Export - Admin Only */}
        {isAdmin && (
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Yedekleme & Dışa Aktarma</h3>
                <p className="text-sm text-muted-foreground">Verilerinizi yedekleyin veya dışa aktarın</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Full Backup */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileJson className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-medium text-emerald-800">Tam Yedek (JSON)</p>
                      <p className="text-sm text-emerald-600">Tüm müşteriler, ziyaretler ve ayarlar</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleFullBackup} 
                    disabled={downloading}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    İndir
                  </Button>
                </div>
                <p className="text-xs text-emerald-600 mt-2">
                  💡 Bu dosyayı Google Drive veya OneDrive&apos;a yükleyerek yedek alabilirsiniz
                </p>
              </div>

              {/* Export Customers */}
              <div className="p-4 bg-muted/30 border border-border rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Müşteri Listesi (XLSX)</p>
                  <p className="text-sm text-muted-foreground">Excel formatında müşteri verileri</p>
                </div>
                <Button variant="outline" onClick={handleExportCustomers}>
                  <Download className="w-4 h-4 mr-2" />
                  İndir
                </Button>
              </div>

              {/* Export Visits */}
              <div className="p-4 bg-muted/30 border border-border rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Ziyaret Listesi (XLSX)</p>
                  <p className="text-sm text-muted-foreground">Excel formatında ziyaret verileri</p>
                </div>
                <Button variant="outline" onClick={handleExportVisits}>
                  <Download className="w-4 h-4 mr-2" />
                  İndir
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Info - Admin Only */}
        {isAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-primary">
              <strong>Manuel Yedekleme İpucu:</strong> İndirdiğiniz JSON dosyasını Google Drive, 
              OneDrive veya Dropbox&apos;a yükleyerek verilerinizi güvende tutabilirsiniz. 
              Bu dosya tüm müşteri ve ziyaret bilgilerinizi içerir.
            </p>
          </div>
        )}

        {/* Automated Backup - Admin Only */}
        {isAdmin && <AutomatedBackupSettings />}

        {/* Field Value Merge - Admin Only */}
        {isAdmin && (
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Veri Birleştirme ve Düzeltme</h3>
                <p className="text-sm text-muted-foreground">
                  Aynı anlama gelen farklı yazımları tek değerde birleştirin — tüm müşteri kayıtları güncellenir
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4 ml-[52px]">
              Örnek: &quot;f&amp;b&quot;, &quot;food &amp; beverage&quot; ve &quot;çikolata&quot; değerlerini seçip hedefe &quot;F&amp;B&quot; yazın.
            </p>

            <div className="flex items-center gap-3 mb-3">
              <Label className="text-sm shrink-0">Alan:</Label>
              <Select value={mergeField} onValueChange={setMergeField}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MERGE_FIELDS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mergeSelected.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {mergeSelected.length} değer seçildi
                </Badge>
              )}
            </div>

            {mergeLoading ? (
              <div className="text-center py-6">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground/70" />
              </div>
            ) : (
              <>
                <div className="max-h-[260px] overflow-y-auto border border-border rounded-lg divide-y divide-border mb-3">
                  {mergeValues.length === 0 && (
                    <p className="text-sm text-muted-foreground p-3">Bu alanda kayıtlı değer yok.</p>
                  )}
                  {mergeValues.map((item) => (
                    <label
                      key={item.value}
                      className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm hover:bg-muted/50 ${
                        mergeSelected.includes(item.value) ? "bg-amber-50" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          className="accent-amber-600 shrink-0"
                          checked={mergeSelected.includes(item.value)}
                          onChange={() => toggleMergeValue(item.value)}
                        />
                        <span className="truncate">{item.value}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs">{item.count} müşteri</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.preventDefault(); setMergeTarget(item.value); }}
                          title="Bu değeri hedef yap"
                        >
                          Hedef yap
                        </Button>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-sm shrink-0">Yeni değer:</Label>
                    <Input
                      placeholder="Örn: F&B"
                      value={mergeTarget}
                      onChange={(e) => setMergeTarget(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <Button
                    onClick={handleMerge}
                    disabled={merging || mergeSelected.length === 0 || !mergeTarget.trim()}
                    className="h-9"
                  >
                    {merging ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Pencil className="w-4 h-4 mr-2" />
                    )}
                    Seçilenleri Birleştir
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Options Management - Admin Only */}
        {isAdmin && (
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <List className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Açılır Liste Seçenekleri</h3>
                <p className="text-sm text-muted-foreground">Dropdown menülerdeki seçenekleri yönetin</p>
              </div>
            </div>
            
            {optionsLoading ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground/70" />
              </div>
            ) : (
              <div className="space-y-3">
                {Object.keys(FIELD_LABELS).map(fieldName => {
                  const fieldOptions = options[fieldName] || [];
                  return (
                    <div key={fieldName} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-foreground">
                          {FIELD_LABELS[fieldName]}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {fieldOptions.length} seçenek
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-2">
                        {fieldOptions.slice(0, 10).map(opt => (
                          <Badge 
                            key={opt.id} 
                            className="bg-card border border-border text-muted-foreground text-xs cursor-pointer hover:bg-muted group"
                            onClick={() => setSelectedField(fieldName)}
                          >
                            {opt.value}
                          </Badge>
                        ))}
                        {fieldOptions.length > 10 && (
                          <Badge className="bg-slate-200 text-muted-foreground text-xs">
                            +{fieldOptions.length - 10} daha
                          </Badge>
                        )}
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => setSelectedField(fieldName)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Yönet
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Options Management Modal */}
      <Dialog open={!!selectedField} onOpenChange={() => { setSelectedField(null); setNewOptionValue(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              {selectedField && FIELD_LABELS[selectedField]} Seçenekleri
            </DialogTitle>
          </DialogHeader>
          
          {selectedField && (
            <div className="space-y-4">
              {/* Add new option */}
              <div className="flex gap-2">
                <Input
                  placeholder="Yeni seçenek ekle..."
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
                />
                <Button onClick={handleAddOption} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Existing options */}
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {(options[selectedField] || []).map(opt => (
                  <div 
                    key={opt.id} 
                    className="flex items-center justify-between p-2 bg-muted/30 rounded-lg group hover:bg-muted"
                  >
                    {editingOption?.id === opt.id ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          value={newOptionValue}
                          onChange={(e) => setNewOptionValue(e.target.value)}
                          className="h-8"
                          autoFocus
                        />
                        <Button size="sm" className="h-8" onClick={handleUpdateOption}>
                          Kaydet
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8"
                          onClick={() => { setEditingOption(null); setNewOptionValue(""); }}
                        >
                          İptal
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm">{opt.value}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => { setEditingOption(opt); setNewOptionValue(opt.value); }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteOption(opt.id, selectedField)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                
                {(options[selectedField] || []).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground/70 py-4">
                    Henüz seçenek yok
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
