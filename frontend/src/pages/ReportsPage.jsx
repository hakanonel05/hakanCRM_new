import { useState, useEffect } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import {
  FileSpreadsheet,
  Download,
  Filter,
  Check,
  X,
  Building2,
  Calendar,
  Users,
  Phone,
  FileText,
  Settings2,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "../App";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Available columns for reports
const CUSTOMER_COLUMNS = [
  { key: "company_name", label: "Firma Adı", default: true },
  { key: "market", label: "Market", default: true },
  { key: "application", label: "Uygulama", default: true },
  { key: "city", label: "Şehir", default: true },
  { key: "district", label: "İlçe", default: false },
  { key: "web", label: "Web Sitesi", default: false },
  { key: "status", label: "Durum", default: true },
  { key: "potential_level", label: "Potansiyel", default: true },
  { key: "assigned_to", label: "Takip Eden", default: true },
  { key: "competitor", label: "Rakip", default: false },
  { key: "partner", label: "Partner", default: false },
  { key: "products", label: "Ürünler", default: false },
  { key: "is_followup", label: "Takipte Mi?", default: false },
  { key: "next_followup_date", label: "Sonraki Takip", default: false },
  { key: "created_at", label: "Kayıt Tarihi", default: false },
];

const CONTACT_COLUMNS = [
  { key: "contact_name", label: "Kişi Adı", default: true },
  { key: "contact_title", label: "Unvan", default: false },
  { key: "contact_phone", label: "Telefon", default: true },
  { key: "contact_email", label: "E-posta", default: true },
];

const VISIT_COLUMNS = [
  { key: "visit_date", label: "Ziyaret Tarihi", default: true },
  { key: "visit_type", label: "Ziyaret Tipi", default: true },
  { key: "visited_by", label: "Ziyaret Eden", default: true },
  { key: "visit_outcome", label: "Sonuç", default: true },
  { key: "visit_notes", label: "Ziyaret Notları", default: false },
];

const CALL_COLUMNS = [
  { key: "call_date", label: "Arama Tarihi", default: true },
  { key: "call_status", label: "Arama Durumu", default: true },
  { key: "call_notes", label: "Arama Notları", default: false },
];

const NOTE_COLUMNS = [
  { key: "notes", label: "Notlar", default: false },
];

const ReportsPage = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Report type
  const [reportType, setReportType] = useState("customers");
  
  // Selected columns
  const [selectedCustomerCols, setSelectedCustomerCols] = useState(
    CUSTOMER_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [selectedContactCols, setSelectedContactCols] = useState(
    CONTACT_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [selectedVisitCols, setSelectedVisitCols] = useState(
    VISIT_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [selectedCallCols, setSelectedCallCols] = useState(
    CALL_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [selectedNoteCols, setSelectedNoteCols] = useState([]);
  
  // Include sections
  const [includeContacts, setIncludeContacts] = useState(false);
  const [includeVisits, setIncludeVisits] = useState(false);
  const [includeCalls, setIncludeCalls] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFollowup, setFilterFollowup] = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerLimit, setCustomerLimit] = useState("all");
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    columns: true,
    contacts: false,
    visits: false,
    calls: false,
    notes: false,
    filters: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleColumn = (columnKey, selectedCols, setSelectedCols) => {
    if (selectedCols.includes(columnKey)) {
      setSelectedCols(selectedCols.filter(k => k !== columnKey));
    } else {
      setSelectedCols([...selectedCols, columnKey]);
    }
  };

  const selectAllColumns = (columns, setSelectedCols) => {
    setSelectedCols(columns.map(c => c.key));
  };

  const deselectAllColumns = (setSelectedCols) => {
    setSelectedCols([]);
  };

  const generateReport = async () => {
    if (selectedCustomerCols.length === 0) {
      toast.error("En az bir müşteri sütunu seçmelisiniz");
      return;
    }

    setGenerating(true);
    
    try {
      const response = await axios.post(`${API}/reports/generate`, {
        report_type: reportType,
        customer_columns: selectedCustomerCols,
        contact_columns: includeContacts ? selectedContactCols : [],
        visit_columns: includeVisits ? selectedVisitCols : [],
        call_columns: includeCalls ? selectedCallCols : [],
        include_notes: includeNotes,
        customer_limit: customerLimit !== "all" ? parseInt(customerLimit) : null,
        filters: {
          status: filterStatus !== "all" ? filterStatus : null,
          is_followup: filterFollowup !== "all" ? filterFollowup === "yes" : null,
          assigned_to: filterAssigned !== "all" ? filterAssigned : null,
          date_from: dateFrom || null,
          date_to: dateTo || null
        }
      }, {
        responseType: 'blob',
        withCredentials: true
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `rapor_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Rapor başarıyla indirildi!");
    } catch (error) {
      console.error("Report generation error:", error);
      // When responseType is blob, error response body is also a blob - parse it
      let errorMsg = "Rapor oluşturulamadı";
      try {
        if (error.response?.data instanceof Blob) {
          const text = await error.response.data.text();
          try {
            const parsed = JSON.parse(text);
            errorMsg = parsed.detail || parsed.message || errorMsg;
          } catch {
            errorMsg = text || errorMsg;
          }
        } else if (error.response?.data?.detail) {
          errorMsg = error.response.data.detail;
        } else if (error.message) {
          errorMsg = `${errorMsg}: ${error.message}`;
        }
        // Add HTTP status hint for common cases
        if (error.response?.status === 401) {
          errorMsg = "Oturum süreniz dolmuş. Lütfen çıkış yapıp tekrar giriş yapın.";
        } else if (error.response?.status === 403) {
          errorMsg = errorMsg || "Bu işlem için admin yetkisi gerekli";
        } else if (error.response?.status === 504 || error.code === 'ECONNABORTED') {
          errorMsg = "Rapor oluşturma zaman aşımına uğradı. Daha küçük müşteri limiti deneyin.";
        }
      } catch (parseErr) {
        console.error("Error parsing error response:", parseErr);
      }
      toast.error(errorMsg, { duration: 8000 });
    } finally {
      setGenerating(false);
    }
  };

  const ColumnSelector = ({ title, columns, selectedCols, setSelectedCols }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <div className="flex gap-2">
          <button 
            onClick={() => selectAllColumns(columns, setSelectedCols)}
            className="text-xs text-primary hover:text-blue-800"
          >
            Tümünü Seç
          </button>
          <span className="text-slate-300">|</span>
          <button 
            onClick={() => deselectAllColumns(setSelectedCols)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Temizle
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {columns.map(col => (
          <label 
            key={col.key}
            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
              selectedCols.includes(col.key) 
                ? "bg-emerald-50 border-emerald-300" 
                : "bg-card border-border hover:border-border"
            }`}
          >
            <Checkbox 
              checked={selectedCols.includes(col.key)}
              onCheckedChange={() => toggleColumn(col.key, selectedCols, setSelectedCols)}
            />
            <span className="text-sm">{col.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const SectionHeader = ({ title, icon: Icon, expanded, onToggle, badge }) => (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <span className="font-medium text-foreground">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
            {badge}
          </span>
        )}
      </div>
      {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground/70" /> : <ChevronDown className="w-5 h-5 text-muted-foreground/70" />}
    </button>
  );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Erişim Engellendi</h2>
          <p className="text-muted-foreground mt-2">Bu sayfayı görüntülemek için admin yetkisi gerekli</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Raporlama</h1>
          <p className="page-subtitle">Özelleştirilmiş Excel raporları oluşturun</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Report Builder */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer Columns Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <SectionHeader 
              title="Müşteri Bilgileri" 
              icon={Building2} 
              expanded={expandedSections.columns}
              onToggle={() => toggleSection('columns')}
              badge={`${selectedCustomerCols.length} sütun`}
            />
            {expandedSections.columns && (
              <div className="p-4 border-t border-border">
                <ColumnSelector 
                  title="Müşteri Sütunları"
                  columns={CUSTOMER_COLUMNS}
                  selectedCols={selectedCustomerCols}
                  setSelectedCols={setSelectedCustomerCols}
                />
              </div>
            )}
          </div>

          {/* Contacts Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-foreground">İletişim Kişileri</span>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={includeContacts}
                  onCheckedChange={setIncludeContacts}
                  id="include-contacts"
                />
                <Label htmlFor="include-contacts" className="text-sm cursor-pointer">Rapora Ekle</Label>
              </div>
            </div>
            {includeContacts && (
              <div className="p-4 border-t border-border">
                <ColumnSelector 
                  title="Kişi Sütunları"
                  columns={CONTACT_COLUMNS}
                  selectedCols={selectedContactCols}
                  setSelectedCols={setSelectedContactCols}
                />
              </div>
            )}
          </div>

          {/* Visits Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-foreground">Ziyaretler</span>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={includeVisits}
                  onCheckedChange={setIncludeVisits}
                  id="include-visits"
                />
                <Label htmlFor="include-visits" className="text-sm cursor-pointer">Rapora Ekle</Label>
              </div>
            </div>
            {includeVisits && (
              <div className="p-4 border-t border-border">
                <ColumnSelector 
                  title="Ziyaret Sütunları"
                  columns={VISIT_COLUMNS}
                  selectedCols={selectedVisitCols}
                  setSelectedCols={setSelectedVisitCols}
                />
              </div>
            )}
          </div>

          {/* Calls Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-foreground">Aramalar</span>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={includeCalls}
                  onCheckedChange={setIncludeCalls}
                  id="include-calls"
                />
                <Label htmlFor="include-calls" className="text-sm cursor-pointer">Rapora Ekle</Label>
              </div>
            </div>
            {includeCalls && (
              <div className="p-4 border-t border-border">
                <ColumnSelector 
                  title="Arama Sütunları"
                  columns={CALL_COLUMNS}
                  selectedCols={selectedCallCols}
                  setSelectedCols={setSelectedCallCols}
                />
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-foreground">Notlar</span>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={includeNotes}
                  onCheckedChange={setIncludeNotes}
                  id="include-notes"
                />
                <Label htmlFor="include-notes" className="text-sm cursor-pointer">Rapora Ekle</Label>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <SectionHeader 
              title="Filtreler (Opsiyonel)" 
              icon={Filter} 
              expanded={expandedSections.filters}
              onToggle={() => toggleSection('filters')}
            />
            {expandedSections.filters && (
              <div className="p-4 border-t border-border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Müşteri Limiti</Label>
                    <Select value={customerLimit} onValueChange={setCustomerLimit}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="100">100 Müşteri</SelectItem>
                        <SelectItem value="250">250 Müşteri</SelectItem>
                        <SelectItem value="500">500 Müşteri</SelectItem>
                        <SelectItem value="1000">1000 Müşteri</SelectItem>
                        <SelectItem value="2000">2000 Müşteri</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Durum</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="Aktif">Aktif</SelectItem>
                        <SelectItem value="Pasif">Pasif</SelectItem>
                        <SelectItem value="Potansiyel">Potansiyel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">Takipte</Label>
                    <Select value={filterFollowup} onValueChange={setFilterFollowup}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="yes">Takipte</SelectItem>
                        <SelectItem value="no">Takipte Değil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Takip Eden</Label>
                    <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="Hakan ÖNEL">Hakan ÖNEL</SelectItem>
                        <SelectItem value="Furkan Çelik">Furkan Çelik</SelectItem>
                        <SelectItem value="Melih Karaman">Melih Karaman</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tarih (Başlangıç)</Label>
                    <Input 
                      type="date" 
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tarih (Bitiş)</Label>
                    <Input 
                      type="date" 
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Preview & Download */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6 sticky top-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-foreground">Rapor Özeti</h3>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Müşteri Limiti</span>
                <span className="font-medium text-foreground">
                  {customerLimit === "all" ? "Tümü" : `${customerLimit} müşteri`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Müşteri Sütunları</span>
                <span className="font-medium text-foreground">{selectedCustomerCols.length}</span>
              </div>
              {includeContacts && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kişi Sütunları</span>
                  <span className="font-medium text-foreground">{selectedContactCols.length}</span>
                </div>
              )}
              {includeVisits && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ziyaret Sütunları</span>
                  <span className="font-medium text-foreground">{selectedVisitCols.length}</span>
                </div>
              )}
              {includeCalls && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Arama Sütunları</span>
                  <span className="font-medium text-foreground">{selectedCallCols.length}</span>
                </div>
              )}
              {includeNotes && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Notlar</span>
                  <span className="font-medium text-emerald-600">Dahil</span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Toplam Sütun</span>
                <span className="font-bold text-foreground">
                  {selectedCustomerCols.length + 
                   (includeContacts ? selectedContactCols.length : 0) +
                   (includeVisits ? selectedVisitCols.length : 0) +
                   (includeCalls ? selectedCallCols.length : 0) +
                   (includeNotes ? 1 : 0)}
                </span>
              </div>
            </div>

            <Button 
              onClick={generateReport}
              disabled={generating || selectedCustomerCols.length === 0}
              className="w-full bg-emerald-600 hover:bg-primary"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Excel Raporu İndir
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground/70 text-center mt-3">
              Rapor .xlsx formatında indirilecek
            </p>
          </div>

          {/* Quick Reports */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h4 className="font-medium text-foreground mb-3">Hızlı Raporlar</h4>
            <div className="space-y-2">
              <button 
                onClick={() => {
                  setSelectedCustomerCols(CUSTOMER_COLUMNS.map(c => c.key));
                  setIncludeContacts(true);
                  setIncludeVisits(true);
                  setIncludeCalls(true);
                  setIncludeNotes(true);
                }}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-sm"
              >
                📊 Tam Rapor (Tüm Veriler)
              </button>
              <button 
                onClick={() => {
                  setSelectedCustomerCols(['company_name', 'market', 'city', 'status', 'assigned_to']);
                  setIncludeContacts(true);
                  setIncludeVisits(false);
                  setIncludeCalls(false);
                  setIncludeNotes(false);
                }}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm"
              >
                👥 Müşteri + Kişiler
              </button>
              <button 
                onClick={() => {
                  setSelectedCustomerCols(['company_name', 'status', 'is_followup', 'next_followup_date', 'assigned_to']);
                  setIncludeContacts(false);
                  setIncludeVisits(true);
                  setIncludeCalls(false);
                  setIncludeNotes(false);
                }}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-amber-300 hover:bg-amber-50 transition-colors text-sm"
              >
                📅 Takip Raporu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
