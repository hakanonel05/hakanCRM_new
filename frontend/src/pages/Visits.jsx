import { useState, useEffect, useCallback, useMemo } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import { 
  Plus, 
  Search, 
  Calendar,
  Bell,
  MoreHorizontal,
  Pencil,
  Trash2,
  Building2,
  X
} from "lucide-react";
import { Button } from "../components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import VisitModal from "../components/VisitModal";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Visits = () => {
  const { openCustomerModal } = useCustomerModal();
  const [visits, setVisits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  const fetchVisits = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (customerFilter && customerFilter !== "all") {
        params.append("customer_id", customerFilter);
      }
      
      const response = await axios.get(`${API}/visits?${params.toString()}`);
      setVisits(response.data);
    } catch (error) {
      console.error("Ziyaretler yüklenirken hata:", error);
      toast.error("Ziyaretler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [customerFilter]);

  const fetchCustomers = async () => {
    try {
      /* Sadece id + company_name. Tam liste 3150 kayıtta 5,4 MB idi; bu
         ekranın ihtiyacı yalnızca firma adı (~150 KB). */
      const response = await axios.get(`${API}/customers/lookup`);
      const customersData = response.data?.data || response.data || [];
      setCustomers(Array.isArray(customersData) ? customersData : []);
    } catch (error) {
      console.error("Müşteriler yüklenirken hata:", error);
      setCustomers([]);
    }
  };

  useEffect(() => {
    fetchVisits();
    fetchCustomers();
  }, [fetchVisits]);

  const handleAddVisit = () => {
    setSelectedVisit(null);
    setModalOpen(true);
  };

  const handleEditVisit = (visit) => {
    setSelectedVisit(visit);
    setModalOpen(true);
  };

  const handleDeleteVisit = async (visitId) => {
    if (!window.confirm("Bu ziyareti silmek istediğinizden emin misiniz?")) return;
    
    try {
      await axios.delete(`${API}/visits/${visitId}`);
      toast.success("Ziyaret silindi");
      fetchVisits();
    } catch (error) {
      toast.error("Ziyaret silinemedi");
    }
  };

  const handleToggleFollowup = async (visitId, currentStatus) => {
    try {
      await axios.patch(`${API}/visits/${visitId}/followup?is_followup=${!currentStatus}`);
      toast.success(currentStatus ? "Follow-up kaldırıldı" : "Follow-up eklendi");
      fetchVisits();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedVisit(null);
    fetchVisits();
  };

  /* id → firma adı sözlüğü. Önceden her çağrı 3150 kayıtlık dizide .find()
     yapıyordu; süzgeç bunu her ziyaret için çağırdığından 1200 ziyarette
     ~3,8 milyon karşılaştırma ediyordu. */
  const musteriAdlari = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(c.id, c.company_name);
    return m;
  }, [customers]);

  const getCustomerName = useCallback(
    (customerId) => musteriAdlari.get(customerId) || "Bilinmiyor",
    [musteriAdlari]
  );

  const getVisitTypeColor = (type) => {
    const colors = {
      "Yüz Yüze": "bg-status-success-bg text-status-success-fg",
      "Online": "bg-status-info-bg text-status-info-fg",
      "Telefon": "bg-status-info-bg text-status-info-fg"
    };
    return colors[type] || "bg-muted text-foreground";
  };

  const clearFilters = () => {
    setSearch("");
    setCustomerFilter("");
  };

  const hasActiveFilters = search || customerFilter;

  // Filter visits by search
  /* Tablo sayfalama. Bütün ziyaretler tek seferde çiziliyordu; 1200
     kayıtta bu 6.8 saniye ve 324 MB demekti. */
  const SAYFA_BOYU = 100;
  const [sayfa, setSayfa] = useState(1);

  /* Müşteri süzgecinde yazılan metin. 3150 öğeyi birden çizmemek için
     liste bununla daraltılıyor. */
  const [musteriAra, setMusteriAra] = useState("");

  /* Süzgeç listesi en fazla 50 satır çizer. Daha fazlası hem yavaş hem
     kullanışsız: kimse 3150 satırlık bir açılır listede kaydırarak firma
     aramaz, yazarak arar. */
  const SUZGEC_LIMIT = 50;
  const suzulenMusteriler = useMemo(() => {
    const q = musteriAra.trim().toLocaleLowerCase("tr");
    const kaynak = q
      ? customers.filter((c) => (c.company_name || "").toLocaleLowerCase("tr").includes(q))
      : customers;
    return kaynak.slice(0, SUZGEC_LIMIT);
  }, [customers, musteriAra]);

  const filteredVisits = visits.filter(visit => {
    if (!search) return true;
    const customerName = getCustomerName(visit.customer_id).toLowerCase();
    const notes = (visit.notes || "").toLowerCase();
    const outcome = (visit.outcome || "").toLowerCase();
    const searchLower = search.toLowerCase();
    return customerName.includes(searchLower) || 
           notes.includes(searchLower) || 
           outcome.includes(searchLower);
  });

  const toplamSayfa = Math.max(1, Math.ceil(filteredVisits.length / SAYFA_BOYU));

  /* Süzgeç ya da arama değişince ilk sayfaya dön: yoksa 40 kayda düşen
     bir sonuçta 7. sayfada kalıp boş ekran görülüyor. */
  useEffect(() => {
    setSayfa(1);
  }, [search, customerFilter, visits.length]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div data-testid="visits-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Ziyaretler</h1>
          <p className="page-subtitle">{filteredVisits.length} ziyaret kayıtlı</p>
        </div>
        <Button 
          onClick={handleAddVisit}
          className="bg-primary hover:bg-primary/90 text-white"
          data-testid="add-visit-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Ziyaret
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Müşteri adı, notlar veya sonuç ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="search-input"
          />
        </div>

        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-[200px]" data-testid="customer-filter">
            <SelectValue placeholder="Müşteri" />
          </SelectTrigger>
          <SelectContent>
            {/* Arama kutusu listenin içinde: yazdıkça daraltıyor. */}
            <div className="p-2">
              <Input
                value={musteriAra}
                onChange={(e) => setMusteriAra(e.target.value)}
                placeholder="Firma ara…"
                className="h-8"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <SelectItem value="all">Tümü</SelectItem>
            {suzulenMusteriler.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.company_name}
              </SelectItem>
            ))}
            {customers.length > suzulenMusteriler.length && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">
                {customers.length - suzulenMusteriler.length} firma daha var — aramayı daraltın.
              </p>
            )}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Temizle
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="table-container" data-testid="visits-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30/80">
              <TableHead className="w-8">#</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead>Ziyaret Tarihi</TableHead>
              <TableHead>Ziyaret Eden</TableHead>
              <TableHead>Ziyaret Tipi</TableHead>
              <TableHead>Sonuç</TableHead>
              <TableHead>Sonraki Ziyaret</TableHead>
              <TableHead>Notlar</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisits.length > 0 ? (
              filteredVisits.slice((sayfa - 1) * SAYFA_BOYU, sayfa * SAYFA_BOYU).map((visit, index) => (
                <TableRow 
                  key={visit.id} 
                  className="airtable-row cursor-pointer"
                  onClick={() => handleEditVisit(visit)}
                  data-testid={`visit-row-${index}`}
                >
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-muted rounded">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div 
                        className="font-medium text-foreground flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => visit.customer_id && openCustomerModal(visit.customer_id)}
                        title="Müşteri detayını aç"
                      >
                        {getCustomerName(visit.customer_id)}
                        {visit.is_followup && (
                          <Bell className="w-3.5 h-3.5 text-status-warning-fg" />
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {visit.visit_date 
                          ? new Date(visit.visit_date).toLocaleDateString('tr-TR')
                          : "—"
                        }
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {visit.visited_by || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={getVisitTypeColor(visit.visit_type)}>
                      {visit.visit_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[150px] truncate">
                    {visit.outcome || "—"}
                  </TableCell>
                  <TableCell>
                    {visit.next_visit_date 
                      ? new Date(visit.next_visit_date).toLocaleDateString('tr-TR')
                      : "—"
                    }
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {visit.notes || "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditVisit(visit)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleToggleFollowup(visit.id, visit.is_followup)}
                        >
                          <Bell className="w-4 h-4 mr-2" />
                          {visit.is_followup ? "Follow-up Kaldır" : "Follow-up Ekle"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteVisit(visit.id)}
                          className="text-status-danger-fg"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="empty-state">
                    <Calendar className="empty-state-icon mx-auto" />
                    <p className="text-lg font-medium text-muted-foreground">Ziyaret bulunamadı</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hasActiveFilters 
                        ? "Filtreleri değiştirerek tekrar deneyin" 
                        : "İlk ziyaretinizi ekleyerek başlayın"
                      }
                    </p>
                    {!hasActiveFilters && (
                      <Button 
                        onClick={handleAddVisit}
                        className="mt-4 bg-primary hover:bg-primary/90"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Ziyaret Ekle
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Sayfalama. Tablo artık her seferde 100 kayıt çiziyor; kullanıcının
            geri kalanına ulaşabilmesi için denetim şart. Tek sayfaya sığıyorsa
            hiç gösterilmiyor. */}
        {toplamSayfa > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-[12px]">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground tabular">{(sayfa - 1) * SAYFA_BOYU + 1}</span>
              –
              <span className="font-medium text-foreground tabular">
                {Math.min(sayfa * SAYFA_BOYU, filteredVisits.length)}
              </span>
              {" / "}
              <span className="font-medium text-foreground tabular">{filteredVisits.length}</span> kayıt
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 px-2"
                onClick={() => setSayfa(1)} disabled={sayfa === 1}>İlk</Button>
              <Button variant="ghost" size="sm" className="h-7 px-2"
                onClick={() => setSayfa((p) => Math.max(1, p - 1))} disabled={sayfa === 1}>Önceki</Button>
              <span className="px-2 text-muted-foreground tabular">
                {sayfa} / {toplamSayfa}
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2"
                onClick={() => setSayfa((p) => Math.min(toplamSayfa, p + 1))} disabled={sayfa === toplamSayfa}>Sonraki</Button>
              <Button variant="ghost" size="sm" className="h-7 px-2"
                onClick={() => setSayfa(toplamSayfa)} disabled={sayfa === toplamSayfa}>Son</Button>
            </div>
          </div>
        )}
      </div>

      {/* Visit Modal */}
      <VisitModal
        open={modalOpen}
        onClose={handleModalClose}
        visit={selectedVisit}
        customers={customers}
      />
    </div>
  );
};

export default Visits;
