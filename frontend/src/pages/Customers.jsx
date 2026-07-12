import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import axios from "axios";
import { 
  Plus, 
  Search, 
  Eye,
  MoreHorizontal,
  Bell,
  Trash2,
  X,
  Download,
  Cloud,
  Upload,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  User,
  Calendar,
  FileText,
  Filter,
  Save,
  SlidersHorizontal,
  Sparkles,
  Pencil,
  Loader2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { ScrollArea } from "../components/ui/scroll-area";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import CustomerEditModal from "../components/CustomerEditModal";
import ImportModal from "../components/ImportModal";
import CloudBackupModal from "../components/CloudBackupModal";
import InlineCreatableSelect from "../components/InlineCreatableSelect";
import SearchInput from "../components/SearchInput";
import Breadcrumb from "../components/Breadcrumb";
import { normalize, computeMatchInfo, highlightMatch, FIELD_LABELS } from "../utils/searchHelpers";
import { swrCache } from "../utils/swrCache";
import InlineTextEdit from "../components/InlineTextEdit";
import MobileCustomerList from "../components/MobileCustomerList";
import { toast } from "sonner";
import { useAuth } from "../App";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ProductsCell Component for editing products inline
const ProductsCell = memo(function ProductsCell({ customer, onUpdate, options, onOptionAdded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const products = customer.products || [];
  const productOptions = options?.products || [];

  const addProduct = async (product) => {
    if (!product.trim()) return;
    if (products.includes(product.trim())) {
      toast.error("Bu ürün zaten ekli");
      return;
    }
    
    const updatedProducts = [...products, product.trim()];
    try {
      await axios.put(`${API}/customers/${customer.id}`, {
        ...customer,
        products: updatedProducts
      });
      if (onUpdate) onUpdate();
      setNewProduct("");
      
      // Also add to options if not exists
      const existingOpt = productOptions.find(o => o.value === product.trim());
      if (!existingOpt) {
        await axios.post(`${API}/options`, {
          field_name: "products",
          value: product.trim()
        });
        if (onOptionAdded) onOptionAdded();
      }
      toast.success("Ürün eklendi");
    } catch (error) {
      toast.error("Ürün eklenemedi");
    }
  };

  const removeProduct = async (productToRemove) => {
    const updatedProducts = products.filter(p => p !== productToRemove);
    try {
      await axios.put(`${API}/customers/${customer.id}`, {
        ...customer,
        products: updatedProducts
      });
      if (onUpdate) onUpdate();
      toast.success("Ürün kaldırıldı");
    } catch (error) {
      toast.error("Ürün kaldırılamadı");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="cursor-pointer hover:bg-muted px-1 py-0.5 rounded min-h-[28px] flex items-center gap-1 flex-wrap">
          {products.length > 0 ? (
            products.slice(0, 2).map((p, idx) => (
              <Badge key={idx} variant="secondary" className="text-[10px] h-5">
                {p}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground/70 text-xs">+ Ekle</span>
          )}
          {products.length > 2 && (
            <Badge variant="outline" className="text-[10px] h-5">
              +{products.length - 2}
            </Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2" align="start">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Ürünler</Label>
          
          {/* Current products */}
          {products.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded">
              {products.map((p, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs pr-1">
                  {p}
                  <button
                    className="ml-1 hover:text-red-500"
                    onClick={() => removeProduct(p)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Add from existing options */}
          {productOptions.length > 0 && (
            <Select onValueChange={(v) => { if (v && !products.includes(v)) addProduct(v); }}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Listeden seç..." />
              </SelectTrigger>
              <SelectContent>
                {productOptions
                  .filter(opt => !products.includes(opt.value))
                  .map((opt) => (
                    <SelectItem key={opt.id || opt.value} value={opt.value}>
                      {opt.value}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}

          {/* Create new product */}
          <div className="flex gap-1">
            <Input
              value={newProduct}
              onChange={(e) => setNewProduct(e.target.value)}
              placeholder="Yeni ürün yaz..."
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addProduct(newProduct); }
              }}
            />
            <Button
              size="sm"
              className="h-8 px-2"
              onClick={() => addProduct(newProduct)}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

// Airtable-style colors for tags
const TAG_COLORS = {
  emerald: "bg-emerald-100 text-emerald-800",
  blue: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-800",
  cyan: "bg-cyan-100 text-cyan-800",
};

// Call outcome colors — pastel pill (rounded-md, no border)
const CALL_OUTCOME_COLORS = {
  "Olumlu": "bg-emerald-100 text-emerald-700",
  "Olumsuz": "bg-red-100 text-red-700",
  "Aranacak": "bg-amber-100 text-amber-700",
  "Beklemede": "bg-blue-100 text-primary",
  "Görüşüldü": "bg-purple-100 text-purple-700",
  "İlgileniyor": "bg-cyan-100 text-cyan-700",
  "Teklif Verildi": "bg-primary-fixed/60 text-primary",
};

// Fixed status options - synced with Kanban columns
const STATUS_OPTIONS = [
  { value: "Beklemede", label: "Beklemede", bg: "bg-amber-100", text: "text-amber-700", border: "border-transparent" },
  { value: "İletişimde", label: "İletişimde", bg: "bg-blue-100", text: "text-primary", border: "border-transparent" },
  { value: "Teklif Verildi", label: "Teklif Verildi", bg: "bg-purple-100", text: "text-purple-700", border: "border-transparent" },
  { value: "Çalışılıyor", label: "Çalışılıyor", bg: "bg-emerald-100", text: "text-emerald-700", border: "border-transparent" },
  { value: "Kazanıldı", label: "Kazanıldı", bg: "bg-green-100", text: "text-green-700", border: "border-transparent" },
  { value: "Kaybedildi", label: "Kaybedildi", bg: "bg-red-100", text: "text-red-700", border: "border-transparent" },
];

const STATUS_COLOR_MAP = Object.fromEntries(
  STATUS_OPTIONS.map(s => [s.value, `${s.bg} ${s.text} ${s.border}`])
);

// Avatar palette — flat pastel circles, deterministic by company name
const AVATAR_GRADIENTS = [
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-blue-100 text-blue-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700",
];

// Tamamen büyük harfle girilmiş firma isimlerini (ör. "ZORLU DEĞİRMEN") okunaklı
// hale getirir ("Zorlu Değirmen"). Türkçe İ/ı kurallarına duyarlıdır. Sadece
// TAMAMEN büyük harfli değerlere dokunur — zaten düzgün yazılmış (ör. "Zirvemak
// Kalıp") ya da elle düzeltilmiş isimler asla değiştirilmez. Kısaltma içeren
// parçalar (nokta geçenler, ör. "A.Ş.", "LTD.") olduğu gibi bırakılır.
const TR_LOWER_MAP = { "İ": "i", "I": "ı" };
const TR_UPPER_MAP = { "i": "İ", "ı": "I" };
const toLowerTR = (s) => s.replace(/[İI]/g, (c) => TR_LOWER_MAP[c]).toLocaleLowerCase("tr-TR");
const toUpperTR = (s) => s.replace(/[iı]/g, (c) => TR_UPPER_MAP[c]).toLocaleUpperCase("tr-TR");
const isAllCapsTR = (s) => {
  const letters = (s || "").replace(/[^A-Za-zÇĞİIÖŞÜçğıiöşü]/g, "");
  return letters.length > 0 && letters === toUpperTR(letters);
};
const TITLE_CASE_LOWER_WORDS = new Set(["ve", "ile"]);
const toTitleCaseTR = (name) => {
  if (!name || !isAllCapsTR(name)) return name;
  return name
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (word.includes(".")) return word; // kısaltma (A.Ş., Ltd. vb.) — dokunma
      const lower = toLowerTR(word);
      if (TITLE_CASE_LOWER_WORDS.has(lower)) return lower;
      return lower
        .split("-")
        .map((seg) => (seg ? toUpperTR(seg[0]) + seg.slice(1) : seg))
        .join("-");
    })
    .join(" ");
};

const getAvatarGradient = (name) => {
  if (!name) return AVATAR_GRADIENTS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
};

// Row background: kept neutral (white/hover-gray only) — status is already
// communicated by the colored Durum pill, so tinting the whole row is
// redundant visual noise in the minimalist layout.
const getRowBackgroundColor = (customer, callOutcome) => {
  return "bg-card hover:bg-muted/40";
};

// Filter fields configuration
const FILTER_FIELDS = [
  { value: "company_name", label: "Firma Adı", type: "text" },
  { value: "market", label: "Market", type: "select" },
  { value: "application", label: "Uygulama", type: "select" },
  { value: "city", label: "Şehir", type: "select" },
  { value: "district", label: "İlçe", type: "text" },
  { value: "status", label: "Durum", type: "select" },
  { value: "potential_level", label: "Potansiyel Seviye", type: "select" },
  { value: "potential_value", label: "Potansiyel (k€)", type: "number" },
  { value: "competitor", label: "Rakip", type: "select" },
  { value: "partner", label: "Partner", type: "select" },
  { value: "assigned_to", label: "Takip Eden", type: "text" },
  { value: "is_followup", label: "Takipte", type: "boolean" }
];

// Operators
const OPERATORS = [
  { value: "equals", label: "Eşittir" },
  { value: "contains", label: "İçerir" },
  { value: "not_equals", label: "Eşit Değil" },
  { value: "greater_than", label: "Büyüktür" },
  { value: "less_than", label: "Küçüktür" },
  { value: "is_empty", label: "Boş" },
  { value: "is_not_empty", label: "Boş Değil" }
];

const getMarketColor = (market) => {
  const colors = Object.values(TAG_COLORS);
  const index = market ? market.charCodeAt(0) % colors.length : 0;
  return colors[index];
};

// Options cache helpers
const OPTIONS_CACHE_KEY = "crmaster_options_cache";
const OPTIONS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getOptionsFromCache = () => {
  try {
    const cached = localStorage.getItem(OPTIONS_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < OPTIONS_CACHE_TTL) {
        return data;
      }
    }
  } catch (e) {
    console.error("Options cache read error:", e);
  }
  return null;
};

const setOptionsToCache = (data) => {
  try {
    localStorage.setItem(OPTIONS_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error("Options cache write error:", e);
  }
};

const Customers = () => {
  const navigate = useNavigate();
  const { openCustomerModal } = useCustomerModal();
  const { isAdmin, canDelete } = useAuth();
  // Mobile detection: <768px renders card list instead of table
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const [customers, setCustomers] = useState([]);
  const [customerCalls, setCustomerCalls] = useState({}); // {customer_id: last_call_outcome}
  const [loading, setLoading] = useState(true);
  const [cloudBackupOpen, setCloudBackupOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  
  // Options for dropdowns
  const [options, setOptions] = useState(() => getOptionsFromCache() || {});
  
  // Pagination - now server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Inline editing
  const [editingCell, setEditingCell] = useState(null); // {rowId, field}
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef(null);
  
  // Column widths - resizable (compact to fit all columns on screen)
  const defaultColumnWidths = {
    checkbox: 36,
    index: 32,
    company_name: 200,
    market: 95,
    application: 115,
    city: 90,
    district: 100,
    web: 115,
    competitor: 100,
    partner: 105,
    products: 100,
    potential: 85,
    potential_value: 110,
    status: 130,
    call: 115,
    assigned: 120,
    followup: 50,
    actions: 35
  };
  
  const [columnWidths, setColumnWidths] = useState(defaultColumnWidths);
  
  const resizingRef = useRef(null);
  const columnWidthsRef = useRef(columnWidths);
  const rafRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    columnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  // Save to localStorage when widths change (debounced via useEffect is fine)
  useEffect(() => {
    localStorage.setItem('crmaster_column_widths_v3', JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current) return;
      // Throttle state updates to one per animation frame
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!resizingRef.current) return;
        const { columnKey, startX, startWidth } = resizingRef.current;
        const newWidth = Math.max(50, startWidth + (e.clientX - startX));
        setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }));
      });
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    resizingRef.current = {
      columnKey,
      startX: e.clientX,
      startWidth: columnWidthsRef.current[columnKey]
    };
  };
  
  // Filters
  const [search, setSearch] = useState("");
  // (debouncedSearch now derived inline below, no separate state)
  // Filtreler sayfa açılışında URL'deki ?market=&city=&status=... gibi
  // parametrelerden okunur — böylece başka bir sayfadan (ör. Türkiye
  // haritasındaki "Müşterilerde Aç" butonu) gelen bağlantılar, ilgili
  // filtreleri otomatik uygulamış olarak açılır.
  const [marketFilter, setMarketFilter] = useState(() => new URLSearchParams(window.location.search).get("market") || "");
  const [statusFilter, setStatusFilter] = useState(() => new URLSearchParams(window.location.search).get("status") || "");
  const [cityFilter, setCityFilter] = useState(() => new URLSearchParams(window.location.search).get("city") || "");
  const [applicationFilter, setApplicationFilter] = useState(() => new URLSearchParams(window.location.search).get("application") || "");
  const [competitorFilter, setCompetitorFilter] = useState(() => new URLSearchParams(window.location.search).get("competitor") || "");
  const [partnerFilter, setPartnerFilter] = useState(() => new URLSearchParams(window.location.search).get("partner") || "");
  const [callFilter, setCallFilter] = useState("");
  
  // Debounce handled inside SearchInput component now. `search` is already debounced.
  // Keep `debouncedSearch` name for backward compat (read-only mirror of search).
  const debouncedSearch = search;
  
  // All unique filter values (from all data, not just current page)
  const [allFilterOptions, setAllFilterOptions] = useState({
    markets: [],
    statuses: [],
    cities: [],
    applications: [],
    competitors: [],
    partners: [],
    assigned_to: []
  });
  
  // Advanced filter panel
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterConditions, setFilterConditions] = useState([
    { field: "company_name", operator: "contains", value: "" }
  ]);
  const [filterLogic, setFilterLogic] = useState("AND");
  const [activeFilters, setActiveFilters] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  
  // Sorting
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  
  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState("status");
  const [bulkUpdateValue, setBulkUpdateValue] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const fetchCustomersAbortRef = useRef(null);
  const fetchCustomers = useCallback(async () => {
    // Cancel any in-flight previous fetch so an older slower response can't
    // overwrite a newer one (race condition on search-as-you-type).
    if (fetchCustomersAbortRef.current) {
      fetchCustomersAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchCustomersAbortRef.current = controller;

    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (marketFilter && marketFilter !== "all") params.append("market", marketFilter);
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (cityFilter && cityFilter !== "all") params.append("city", cityFilter);
    if (applicationFilter && applicationFilter !== "all") params.append("application", applicationFilter);
    if (competitorFilter && competitorFilter !== "all") params.append("competitor", competitorFilter);
    if (partnerFilter && partnerFilter !== "all") params.append("partner", partnerFilter);
    params.append("page", currentPage.toString());
    params.append("limit", itemsPerPage.toString());
    params.append("sort_by", sortBy);
    params.append("sort_order", sortOrder);
    const qs = params.toString();
    const cacheKey = `customers:${qs}`;

    // === Stale-while-revalidate: paint cached data instantly, then refresh. ===
    const cached = swrCache.get(cacheKey);
    if (cached && cached.data) {
      setCustomers(cached.data);
      setTotalItems(cached.total);
      setTotalPages(cached.total_pages);
      setLoading(false); // We have something to show; revalidate quietly.
    } else {
      setLoading(true);
    }

    try {
      const response = await axios.get(`${API}/customers?${qs}`, {
        signal: controller.signal,
      });

      let payload = null;
      if (response.data && response.data.data) {
        payload = {
          data: response.data.data,
          total: response.data.total,
          total_pages: response.data.total_pages,
        };
      } else if (Array.isArray(response.data)) {
        payload = {
          data: response.data,
          total: response.data.length,
          total_pages: Math.ceil(response.data.length / itemsPerPage),
        };
      }
      if (payload) {
        setCustomers(payload.data);
        setTotalItems(payload.total);
        setTotalPages(payload.total_pages);
        swrCache.set(cacheKey, payload);
      }

      setSelectedIds(new Set());
      setSelectAll(false);
    } catch (error) {
      if (axios.isCancel?.(error) || error?.name === "CanceledError" || error?.code === "ERR_CANCELED") {
        return;
      }
      console.error("Müşteriler yüklenirken hata:", error);
      if (!cached) toast.error("Müşteriler yüklenemedi");
    } finally {
      if (fetchCustomersAbortRef.current === controller) {
        fetchCustomersAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [search, marketFilter, statusFilter, cityFilter, applicationFilter, competitorFilter, partnerFilter, currentPage, itemsPerPage, sortBy, sortOrder]);

  // Fetch latest call outcomes per customer (lightweight endpoint)
  const fetchCalls = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/calls/latest-per-customer`);
      setCustomerCalls(response.data || {});
    } catch (error) {
      console.error("Aramalar yüklenirken hata:", error);
    }
  }, []);

  // Wrapper: invalidate SWR cache so post-mutation fetches don't show stale data.
  const refreshCustomers = useCallback(() => {
    swrCache.invalidate("customers:");
    return fetchCustomers();
  }, [fetchCustomers]);

  // Fetch customers when debounced search or filters change
  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, marketFilter, statusFilter, cityFilter, applicationFilter, competitorFilter, partnerFilter, currentPage, sortBy, sortOrder]);

  // Fetch calls once on mount
  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const fetchOptions = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
      const cached = getOptionsFromCache();
      if (cached) {
        setOptions(cached);
        return;
      }
    }
    
    try {
      const response = await axios.get(`${API}/options/grouped`);
      let optionsData = {};
      
      // Response is already grouped by field_name as object
      if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        optionsData = response.data;
      } else if (Array.isArray(response.data)) {
        // Fallback: if it's an array, group it
        response.data.forEach(opt => {
          const field = opt.field_name || "other";
          if (!optionsData[field]) optionsData[field] = [];
          optionsData[field].push(opt);
        });
      }
      
      setOptions(optionsData);
      setOptionsToCache(optionsData);
    } catch (error) {
      console.error("Options yüklenirken hata:", error);
    }
  }, []);
  
  // Refresh options cache when a new option is added
  const refreshOptionsCache = useCallback(() => {
    fetchOptions(true);
  }, [fetchOptions]);

  const fetchSavedFilters = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/filters`);
      setSavedFilters(response.data);
    } catch (error) {
      console.error("Saved filters yüklenirken hata:", error);
    }
  }, []);

  // Fetch all unique values for filters (lightweight endpoint)
  const fetchAllFilterOptions = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/customers/filter-options`);
      const data = response.data;
      
      setAllFilterOptions({
        markets: data.market || [],
        statuses: STATUS_OPTIONS.map(s => s.value),
        cities: data.city || [],
        applications: data.application || [],
        competitors: data.competitor || [],
        partners: data.partner || [],
        assigned_to: data.assigned_to || []
      });
    } catch (error) {
      console.error("Filter options yüklenirken hata:", error);
    }
  }, []);

  // Mount-only: load options, saved filters, filter options once.
  // fetchCustomers is handled by the dedicated effect above (search/filter deps).
  useEffect(() => {
    fetchOptions();
    fetchSavedFilters();
    fetchAllFilterOptions();
    // Listen for "open new customer" event from Command Palette
    const onNewCustomer = () => setAddModalOpen(true);
    window.addEventListener("crm:open-new-customer", onNewCustomer);
    return () => window.removeEventListener("crm:open-new-customer", onNewCustomer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get unique values for select fields (uses allFilterOptions + options from backend)
  const getUniqueValues = (field) => {
    const values = new Set();
    
    // Add from allFilterOptions based on field mapping
    const fieldMapping = {
      market: 'markets',
      status: 'statuses', 
      city: 'cities',
      application: 'applications',
      competitor: 'competitors',
      partner: 'partners',
      assigned_to: 'assigned_to'
    };
    
    const optionsKey = fieldMapping[field];
    if (optionsKey && allFilterOptions[optionsKey]) {
      allFilterOptions[optionsKey].forEach(v => values.add(v));
    }
    
    // Also add from options if available
    if (options[field]) {
      options[field].forEach(opt => {
        if (opt.value) values.add(opt.value);
      });
    }
    
    return Array.from(values).sort();
  };

  // Filter condition handlers
  const addFilterCondition = () => {
    setFilterConditions([...filterConditions, { field: "company_name", operator: "contains", value: "" }]);
  };

  const removeFilterCondition = (index) => {
    if (filterConditions.length > 1) {
      setFilterConditions(filterConditions.filter((_, i) => i !== index));
    }
  };

  const updateFilterCondition = (index, key, value) => {
    const updated = [...filterConditions];
    updated[index] = { ...updated[index], [key]: value };
    // Clear value when field changes to prevent invalid values
    if (key === "field") {
      updated[index].value = "";
    }
    setFilterConditions(updated);
  };

  // Apply filter
  const applyFilter = () => {
    // Filter out empty conditions
    const validConditions = filterConditions.filter(c => 
      c.operator === "is_empty" || c.operator === "is_not_empty" || c.value
    );
    
    if (validConditions.length === 0) {
      toast.error("En az bir filtre koşulu ekleyin");
      return;
    }
    
    setActiveFilters(validConditions);
    setFilterPanelOpen(false);
    toast.success("Filtre uygulandı");
  };

  // Clear filter
  const clearFilter = () => {
    setFilterConditions([{ field: "company_name", operator: "contains", value: "" }]);
    setActiveFilters([]);
    setFilterLogic("AND");
  };

  // Save filter
  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      toast.error("Filtre adı gerekli");
      return;
    }

    const validConditions = filterConditions.filter(c => 
      c.operator === "is_empty" || c.operator === "is_not_empty" || c.value
    );

    if (validConditions.length === 0) {
      toast.error("En az bir filtre koşulu ekleyin");
      return;
    }

    try {
      await axios.post(`${API}/filters`, {
        name: filterName,
        conditions: validConditions,
        logic: filterLogic
      });
      toast.success("Filtre kaydedildi");
      setSaveFilterModalOpen(false);
      setFilterName("");
      fetchSavedFilters();
    } catch (error) {
      toast.error("Filtre kaydedilemedi");
    }
  };

  // Load saved filter
  const loadSavedFilter = (filter) => {
    setFilterConditions(filter.conditions || [{ field: "company_name", operator: "contains", value: "" }]);
    setFilterLogic(filter.logic || "AND");
    setActiveFilters(filter.conditions || []);
    setFilterPanelOpen(false);
    toast.success(`"${filter.name}" filtresi yüklendi`);
  };

  // Apply active filters to customers
  const filteredCustomers = activeFilters.length > 0 
    ? customers.filter(customer => {
        const results = activeFilters.map(condition => {
          const { field, operator, value } = condition;
          const customerValue = customer[field] || "";
          
          switch (operator) {
            case "equals":
              return customerValue.toLowerCase() === value.toLowerCase();
            case "contains":
              return customerValue.toLowerCase().includes(value.toLowerCase());
            case "not_equals":
              return customerValue.toLowerCase() !== value.toLowerCase();
            case "is_empty":
              return !customerValue || customerValue === "";
            case "is_not_empty":
              return customerValue && customerValue !== "";
            default:
              return true;
          }
        });
        
        if (filterLogic === "OR") {
          return results.some(r => r);
        }
        return results.every(r => r);
      })
    : customers;

  // Apply quick filters (frontend-side for instant filtering)
  const quickFilteredCustomers = filteredCustomers.filter(customer => {
    if (applicationFilter && applicationFilter !== "all" && customer.application !== applicationFilter) return false;
    if (competitorFilter && competitorFilter !== "all" && customer.competitor !== competitorFilter) return false;
    if (partnerFilter && partnerFilter !== "all" && customer.partner !== partnerFilter) return false;
    if (callFilter && callFilter !== "all" && customerCalls[customer.id] !== callFilter) return false;
    return true;
  });

  // === Search match annotation + relevance sort (client-side, runs only when there's a search term) ===
  const normalizedNeedle = useMemo(() => normalize(search.trim()), [search]);
  const customersWithMatch = useMemo(() => {
    if (!normalizedNeedle) {
      return quickFilteredCustomers.map((c) => ({ ...c, _matchInfo: null }));
    }
    return quickFilteredCustomers.map((c) => ({
      ...c,
      _matchInfo: computeMatchInfo(c, normalizedNeedle),
    }));
  }, [quickFilteredCustomers, normalizedNeedle]);

  // When user is actively searching, sort by relevance (best-match field priority).
  // Otherwise preserve server-side ordering.
  const sortedCustomers = useMemo(() => {
    if (!normalizedNeedle) return customersWithMatch;
    return [...customersWithMatch].sort((a, b) => {
      const pa = a._matchInfo?.bestPriority ?? 999;
      const pb = b._matchInfo?.bestPriority ?? 999;
      return pa - pb;
    });
  }, [customersWithMatch, normalizedNeedle]);

  const displayCustomers = sortedCustomers;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, marketFilter, statusFilter, cityFilter, applicationFilter, competitorFilter, partnerFilter, callFilter, activeFilters]);

  // Inline editing handlers
  const startEditing = (rowId, field, currentValue) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue || "");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const saveEdit = async (customerId) => {
    if (!editingCell) return;
    
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    try {
      // Only send the changed field
      const updateData = { [editingCell.field]: editValue };
      await axios.put(`${API}/customers/${customerId}`, updateData);
      swrCache.invalidate("customers:");
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, [editingCell.field]: editValue } : c
      ));
      
      setEditingCell(null);
      setEditValue("");
    } catch (error) {
      toast.error("Güncelleme başarısız");
    }
  };

  const saveSelectEdit = async (customerId, field, value) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    try {
      // Only send the changed field
      const updateData = { [field]: value };
      await axios.put(`${API}/customers/${customerId}`, updateData);
      swrCache.invalidate("customers:");
      
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, [field]: value } : c
      ));
      
      toast.success("Güncellendi");
    } catch (error) {
      toast.error("Güncelleme başarısız");
    }
  };

  // Update call outcome for a customer
  const saveCallOutcome = async (customerId, outcome) => {
    try {
      // Get existing calls for this customer
      const callsResponse = await axios.get(`${API}/calls?customer_id=${customerId}`);
      
      if (callsResponse.data && callsResponse.data.length > 0) {
        // Update the most recent call
        const sortedCalls = callsResponse.data.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        const lastCall = sortedCalls[0];
        
        await axios.put(`${API}/calls/${lastCall.id}`, {
          ...lastCall,
          outcome: outcome
        });
      } else {
        // Create a new call record if none exists
        const customer = customers.find(c => c.id === customerId);
        await axios.post(`${API}/calls`, {
          customer_id: customerId,
          caller_name: "",
          call_type: "Giden",
          outcome: outcome,
          notes: ""
        });
      }
      
      // Update local state
      setCustomerCalls(prev => ({
        ...prev,
        [customerId]: outcome
      }));
      
      toast.success("Arama durumu güncellendi");
    } catch (error) {
      console.error("Call update error:", error);
      toast.error("Arama durumu güncellenemedi");
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e, customerId) => {
    if (e.key === "Enter") {
      saveEdit(customerId);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayCustomers.map(c => c.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
    setSelectAll(newSet.size === displayCustomers.length);
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (!isAdmin) {
      toast.error("Silme yetkisi sadece admin kullanıcılara aittir");
      return;
    }
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size} müşteriyi silmek istediğinizden emin misiniz?`)) return;

    try {
      const { data } = await axios.post(`${API}/customers-bulk-delete`, {
        ids: Array.from(selectedIds),
      });
      toast.success(`${data.deleted} müşteri silindi`);
      setSelectedIds(new Set());
      refreshCustomers();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Toplu silme başarısız");
      refreshCustomers();
    }
  };

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) return;
    setBulkExporting(true);
    try {
      const resp = await axios.post(
        `${API}/customers-bulk-export`,
        { ids: Array.from(selectedIds) },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `musteriler_secili_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${selectedIds.size} müşteri Excel'e aktarıldı`);
    } catch (e) {
      toast.error("Excel'e aktarma başarısız");
    } finally {
      setBulkExporting(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0 || !bulkUpdateField) return;
    setBulkUpdating(true);
    try {
      const { data } = await axios.post(`${API}/customers-bulk-update`, {
        ids: Array.from(selectedIds),
        updates: { [bulkUpdateField]: bulkUpdateValue },
      });
      toast.success(`${data.updated} müşterinin "${bulkUpdateField}" alanı güncellendi`);
      setBulkUpdateOpen(false);
      setBulkUpdateValue("");
      setSelectedIds(new Set());
      refreshCustomers();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Toplu güncelleme başarısız");
    } finally {
      setBulkUpdating(false);
    }
  };

  // Filter helpers - use allFilterOptions for dropdowns (all data, not just current page)
  const uniqueMarkets = allFilterOptions.markets;
  const uniqueStatuses = allFilterOptions.statuses;
  const uniqueCities = allFilterOptions.cities;
  const uniqueApplications = allFilterOptions.applications;
  const uniqueCompetitors = allFilterOptions.competitors;
  const uniquePartners = allFilterOptions.partners;
  const uniqueCallOutcomes = ["Olumlu", "Olumsuz", "Aranacak", "Beklemede", "Görüşüldü", "İlgileniyor", "Teklif Verildi"];
  
  const hasActiveFilters = search || marketFilter || statusFilter || cityFilter || applicationFilter || competitorFilter || partnerFilter || callFilter;

  const clearFilters = () => {
    setSearch("");
    setMarketFilter("");
    setStatusFilter("");
    setCityFilter("");
    setApplicationFilter("");
    setCompetitorFilter("");
    setPartnerFilter("");
    setCallFilter("");
  };

  // Render editable cell
  const renderEditableCell = (customer, field, displayValue) => {
    const isEditing = editingCell?.rowId === customer.id && editingCell?.field === field;
    
    if (isEditing) {
      return (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, customer.id)}
          onBlur={() => saveEdit(customer.id)}
          className="h-8 text-sm"
        />
      );
    }
    
    return (
      <div 
        className="cursor-text hover:bg-muted px-2 py-1 rounded min-h-[28px] flex items-center"
        onClick={() => startEditing(customer.id, field, customer[field])}
      >
        {displayValue || <span className="text-muted-foreground/70">-</span>}
      </div>
    );
  };

  // Render select cell (for dropdowns)
  const renderSelectCell = (customer, field, currentValue) => {
    const fieldOptions = options[field] || [];
    
    return (
      <InlineCreatableSelect
        value={currentValue || ""}
        options={fieldOptions}
        fieldName={field}
        onChange={(value) => saveSelectEdit(customer.id, field, value)}
        onOptionAdded={refreshOptionsCache}
      />
    );
  };

  // Render status cell with fixed options synced with Kanban
  const renderStatusCell = (customer) => {
    const currentStatus = customer.status || "";
    const colorClass = STATUS_COLOR_MAP[currentStatus] || "bg-muted text-muted-foreground";
    
    return (
      <Select
        value={currentStatus}
        onValueChange={(value) => saveSelectEdit(customer.id, "status", value)}
      >
        <SelectTrigger className={`h-7 text-xs rounded-full font-medium border-0 ${colorClass} min-w-[110px]`} data-testid={`status-select-${customer.id}`}>
          <SelectValue placeholder="Durum seç" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${opt.bg} ${opt.text}`}>
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  // Render call status cell with dropdown
  const renderCallStatusCell = (customer) => {
    const currentOutcome = customerCalls[customer.id] || "";
    const outcomeOptions = ["Olumlu", "Olumsuz", "Aranacak", "Beklemede", "Görüşüldü", "İlgileniyor", "Teklif Verildi"];
    const colorClass = CALL_OUTCOME_COLORS[currentOutcome] || "bg-muted text-muted-foreground border-slate-200";
    
    return (
      <Select
        value={currentOutcome}
        onValueChange={(value) => saveCallOutcome(customer.id, value)}
      >
        <SelectTrigger className={`h-7 text-xs rounded-full font-medium border-0 ${colorClass} min-w-[80px]`}>
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          {outcomeOptions.map(outcome => (
            <SelectItem key={outcome} value={outcome}>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CALL_OUTCOME_COLORS[outcome]}`}>
                {outcome}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  // Render clickable website link
  const renderWebsiteCell = (customer) => {
    const website = customer.website;
    
    return (
      <InlineTextEdit
        value={website}
        customerId={customer.id}
        field="website"
        placeholder="—"
        displayClass="text-xs truncate block"
        inputClass="h-7 text-xs"
        renderDisplay={(val) => {
          if (!val) return <span className="text-slate-300">—</span>;
          const url = val.startsWith("http") ? val : `https://${val}`;
          const displayText = val.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
          return (
            <a 
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:opacity-70 hover:underline truncate block"
              title={val}
              onClick={(e) => e.stopPropagation()}
            >
              {displayText}
            </a>
          );
        }}
        onSaved={(newVal) => {
          setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, website: newVal } : c));
        }}
      />
    );
  };

  // Initial loading skeleton (replaces the blocking spinner for modern UX)
  const renderTableSkeleton = () => (
    <div className="p-6 space-y-2">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2.5 px-3 rounded-lg bg-muted/30 animate-pulse">
          <div className="w-4 h-4 bg-slate-200 rounded" />
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-1/6" />
          <div className="h-4 bg-muted rounded w-1/6" />
          <div className="h-4 bg-muted rounded w-1/5" />
          <div className="h-6 bg-slate-200 rounded-full w-20" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden bg-slate-50" data-testid="customers-page">
      {/* Subtle loading bar at the top (no blocking overlay) */}
      {loading && customers.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500 animate-pulse z-50" />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
        {/* Header - compact single-line */}
        <div className="px-4 sm:px-6 pt-2 pb-1.5 bg-card border-b border-border">
          <Breadcrumb className="mb-0.5" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="font-heading text-lg sm:text-xl font-bold text-foreground tracking-tight leading-none">
                Müşteriler
              </h1>
              <span className="text-[12px] text-muted-foreground font-medium whitespace-nowrap">
                <span className="tabular-nums">{totalItems.toLocaleString("tr-TR")}</span> kayıt
                {hasActiveFilters && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-primary">
                    <span className="w-1 h-1 rounded-full bg-primary" />
                    filtrelendi
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted px-2 sm:px-3 h-8 rounded-lg"
                onClick={() => setCloudBackupOpen(true)}
                title="Yedekle"
              >
                <Cloud className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Yedekle</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground hover:bg-muted px-2 sm:px-3 h-8 rounded-lg"
                onClick={() => setImportModalOpen(true)}
                title="İçe Aktar"
              >
                <Upload className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">İçe Aktar</span>
              </Button>
              <Button
                className="bg-primary hover:opacity-90 text-white transition-all px-3 sm:px-4 h-8 rounded-lg font-medium shadow-none"
                size="sm"
                onClick={() => setAddModalOpen(true)}
                title="Yeni Müşteri"
                data-testid="new-customer-btn"
              >
                <Plus className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Yeni Müşteri</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Bar - modern minimal */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-card border-b border-border overflow-x-auto sm:flex-wrap [&>*]:flex-shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <SearchInput
              value={search}
              onDebouncedChange={(val) => setSearch(val)}
              delay={300}
              placeholder="Firma, şehir, market, notlar… ara"
              testid="customer-search-input"
            />
          </div>
          
          {/* Advanced Filter Button */}
          <Popover open={filterPanelOpen} onOpenChange={setFilterPanelOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant={activeFilters.length > 0 ? "default" : "outline"} 
                size="sm"
                className={`rounded-full ${activeFilters.length > 0 ? "bg-primary hover:bg-primary/90" : "border-slate-200"}`}
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filtre
                {activeFilters.length > 0 && (
                  <Badge className="ml-2 bg-card text-primary">{activeFilters.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-foreground">Gelişmiş Filtre</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={filterLogic === "AND" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilterLogic("AND")}
                    >
                      VE
                    </Button>
                    <Button
                      variant={filterLogic === "OR" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFilterLogic("OR")}
                    >
                      VEYA
                    </Button>
                  </div>
                </div>

                {/* Filter Conditions */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {filterConditions.map((condition, index) => {
                    const fieldConfig = FILTER_FIELDS.find(f => f.value === condition.field);
                    const isSelectField = fieldConfig?.type === "select";
                    const fieldValues = isSelectField ? getUniqueValues(condition.field) : [];
                    
                    return (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                        {/* Field Select */}
                        <Select
                          value={condition.field}
                          onValueChange={(v) => updateFilterCondition(index, "field", v)}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FILTER_FIELDS.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Operator Select */}
                        <Select
                          value={condition.operator}
                          onValueChange={(v) => updateFilterCondition(index, "operator", v)}
                        >
                          <SelectTrigger className="w-[110px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Value - Select or Input based on field type */}
                        {!["is_empty", "is_not_empty"].includes(condition.operator) && (
                          isSelectField && fieldValues.length > 0 ? (
                            <Select
                              value={condition.value}
                              onValueChange={(v) => updateFilterCondition(index, "value", v)}
                            >
                              <SelectTrigger className="flex-1 h-8 text-sm">
                                <SelectValue placeholder="Seç..." />
                              </SelectTrigger>
                              <SelectContent>
                                {fieldValues.map((val) => (
                                  <SelectItem key={val} value={val}>
                                    {val}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={condition.value}
                              onChange={(e) => updateFilterCondition(index, "value", e.target.value)}
                              placeholder={fieldConfig?.type === "number" ? "Örn: 100" : "Değer..."}
                              type={fieldConfig?.type === "number" ? "number" : "text"}
                              className="flex-1 h-8 text-sm"
                            />
                          )
                        )}

                        {/* Remove Condition */}
                        {filterConditions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0"
                            onClick={() => removeFilterCondition(index)}
                          >
                            <X className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Condition Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={addFilterCondition}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Koşul Ekle
                </Button>
              </div>

              {/* Actions */}
              <div className="p-3 flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={clearFilter}>
                  Temizle
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveFilterModalOpen(true)}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Kaydet
                  </Button>
                  <Button size="sm" onClick={applyFilter}>
                    <Filter className="w-4 h-4 mr-1" />
                    Uygula
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Quick Filters */}
          <Select value={marketFilter} onValueChange={setMarketFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs rounded-full border-slate-200">
              <SelectValue placeholder="Market" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Market</SelectItem>
              {uniqueMarkets.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs rounded-full border-slate-200">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durum</SelectItem>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${s.bg} ${s.text}`}>{s.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs rounded-full border-slate-200">
              <SelectValue placeholder="Şehir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Şehir</SelectItem>
              {uniqueCities.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={applicationFilter} onValueChange={setApplicationFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs rounded-full border-slate-200">
              <SelectValue placeholder="Uygulama" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Uygulama</SelectItem>
              {uniqueApplications.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={competitorFilter} onValueChange={setCompetitorFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs rounded-full border-slate-200">
              <SelectValue placeholder="Rakip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Rakip</SelectItem>
              {uniqueCompetitors.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs rounded-full border-slate-200">
              <SelectValue placeholder="Partner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Partner</SelectItem>
              {uniquePartners.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={callFilter} onValueChange={setCallFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs rounded-full border-slate-200">
              <SelectValue placeholder="Arama" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Arama</SelectItem>
              {uniqueCallOutcomes.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { clearFilters(); clearFilter(); }}>
              <X className="w-3 h-3 mr-1" />
              Temizle
            </Button>
          )}

          {/* Sort - minimal */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground/70 hidden md:inline">Sırala:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[130px] h-8 text-xs rounded-full border-slate-200 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company_name">Firma Adı</SelectItem>
                <SelectItem value="created_at">Eklenme Tarihi</SelectItem>
                <SelectItem value="updated_at">Güncelleme Tarihi</SelectItem>
                <SelectItem value="data_score">Bilgi Doluluğu</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-full border-slate-200 bg-card hover:bg-muted/30"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              title={sortOrder === "asc" ? "Artan" : "Azalan"}
            >
              {sortOrder === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFilters.length > 0 && (
          <div className="mb-4 p-2 bg-blue-50 rounded-lg flex items-center gap-2 flex-wrap">
            <span className="text-xs text-primary font-medium">Aktif Filtre:</span>
            {activeFilters.map((f, idx) => (
              <Badge key={idx} variant="secondary" className="bg-card text-xs">
                {FILTER_FIELDS.find(field => field.value === f.field)?.label} {OPERATORS.find(op => op.value === f.operator)?.label}
                {f.value && ` "${f.value}"`}
              </Badge>
            ))}
            <span className="text-[10px] text-primary">({filterLogic})</span>
            <span className="text-xs text-primary ml-auto">{filteredCustomers.length} sonuç</span>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={clearFilter}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedIds.size > 0 && isAdmin && (
          <div className="flex items-center gap-2 mx-2 sm:mx-6 my-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex-wrap" data-testid="bulk-actions-bar">
            <span className="text-sm font-medium text-blue-900">
              <span className="tabular-nums">{selectedIds.size}</span> seçili
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-7 text-xs ml-1"
              data-testid="bulk-clear-btn"
            >
              Seçimi Temizle
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkUpdateOpen(true)}
              className="h-7 text-xs"
              data-testid="bulk-update-btn"
            >
              <Pencil className="w-3.5 h-3.5 mr-1" />
              Toplu Düzenle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkExport}
              disabled={bulkExporting}
              className="h-7 text-xs"
              data-testid="bulk-export-btn"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {bulkExporting ? "İndiriliyor..." : "Excel'e Aktar"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className={`h-7 text-xs ${canDelete ? "" : "hidden"}`}
              data-testid="bulk-delete-btn"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Toplu Sil
            </Button>
          </div>
        )}

        {/* Modern minimal table card */}
        <div 
          className="bg-card rounded-xl border border-border shadow-sm flex flex-col w-full mx-2 sm:mx-6 my-2 sm:my-3"
          style={{ height: 'calc(100vh - 220px)' }}
        >
          {/* Initial loading skeleton */}
          {loading && customers.length === 0 ? (
            renderTableSkeleton()
          ) : displayCustomers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/70 p-8">
              <Building2 className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm font-medium text-muted-foreground">Müşteri bulunamadı</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {hasActiveFilters ? "Filtreleri temizleyip tekrar deneyin" : "Yeni müşteri eklemek için yukarıdaki butonu kullanın"}
              </p>
            </div>
          ) : isMobile ? (
            <MobileCustomerList
              customers={displayCustomers.map((c) => ({
                ...c,
                last_call_outcome: customerCalls[c.id],
              }))}
              selectedIds={[...selectedIds]}
              toggleSelect={toggleSelectOne}
              onOpen={(id) => openCustomerModal(id)}
              isAdmin={isAdmin}
            />
          ) : (
          <div 
            className="flex-1 w-full overflow-auto" 
            id="customer-table-scroll"
          >
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-md">
                <tr className="border-b border-border">
                  {isAdmin && (
                    <th style={{ width: columnWidths.checkbox }} className="px-2 py-3 relative">
                      <Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} />
                    </th>
                  )}
                  <th style={{ width: columnWidths.company_name }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Firma Adı
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'company_name')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.market }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Market
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'market')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.application }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Uygulama
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'application')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.city }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Şehir
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'city')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.district }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    İlçe
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'district')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.web }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Web
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'web')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.competitor }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Rakip
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'competitor')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.partner }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Partner
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'partner')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.products }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Ürünler
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'products')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.potential }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Potansiyel Seviye
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'potential')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.potential_value }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Potansiyel (k€)
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'potential_value')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.status }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Durum
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'status')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.call }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Arama
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'call')} 
                    />
                  </th>
                  <th style={{ width: columnWidths.assigned }} className="px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 relative group">
                    Takip Eden
                    <div 
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100 hover:bg-primary/40 active:bg-primary z-10 transition-opacity" 
                      style={{ transform: 'translateX(50%)' }}
                      onMouseDown={(e) => handleResizeStart(e, 'assigned')} 
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayCustomers.map((customer, index) => (
                  <tr 
                    key={customer.id}
                    className={`border-b border-border/60 transition-colors ${
                      selectedIds.has(customer.id) 
                        ? "bg-primary/5"
                        : getRowBackgroundColor(customer, customerCalls[customer.id])
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(customer.id)}
                          onCheckedChange={() => toggleSelectOne(customer.id)}
                        />
                      </td>
                    )}
                    <td style={{ width: columnWidths.company_name }} className="px-2 py-2.5">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div 
                          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-[13px] cursor-pointer transition-transform hover:scale-105 ${getAvatarGradient(customer.company_name)}`}
                          onClick={() => openCustomerModal(customer.id)}
                          title="Detay göster"
                        >
                          {customer.company_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <InlineTextEdit
                            value={customer.company_name}
                            customerId={customer.id}
                            field="company_name"
                            placeholder="-"
                            displayClass="font-heading text-[14px] font-semibold tracking-tight text-foreground truncate block hover:text-primary transition-colors"
                            onSingleClick={() => openCustomerModal(customer.id)}
                            renderDisplay={(val) => {
                              const display = toTitleCaseTR(val) || "-";
                              return (
                                <span title={val || "Tıkla: detay · Çift tıkla: düzenle"}>
                                  {normalizedNeedle ? highlightMatch(display, normalizedNeedle) : display}
                                </span>
                              );
                            }}
                            onSaved={(newVal) => {
                              setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, company_name: newVal } : c));
                            }}
                          />
                          {/* Match badge — show which field matched the search */}
                          {normalizedNeedle && customer._matchInfo && customer._matchInfo.fields.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {customer._matchInfo.fields.slice(0, 2).map((f) => (
                                <span
                                  key={f}
                                  className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-primary bg-primary-fixed/40 border border-primary/10 rounded px-1.5 py-0.5"
                                  title={`Bu kayıt "${FIELD_LABELS[f] || f}" alanında eşleşti`}
                                >
                                  ↳ {FIELD_LABELS[f] || f}
                                </span>
                              ))}
                              {customer._matchInfo.fields.length > 2 && (
                                <span className="text-[9.5px] text-muted-foreground/70 font-medium">
                                  +{customer._matchInfo.fields.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {customer.is_followup && <Bell className="w-3.5 h-3.5 text-amber-500" title="Takipte" />}
                        </div>
                      </div>
                    </td>
                    <td style={{ width: columnWidths.market }} className="px-2 py-2.5 overflow-hidden">
                      {renderSelectCell(customer, "market", customer.market)}
                    </td>
                    <td style={{ width: columnWidths.application }} className="px-2 py-2.5 overflow-hidden">
                      {renderSelectCell(customer, "application", customer.application)}
                    </td>
                    <td style={{ width: columnWidths.city }} className="px-2 py-2.5 overflow-hidden">
                      {renderSelectCell(customer, "city", customer.city)}
                    </td>
                    <td style={{ width: columnWidths.district }} className="px-2 py-2.5 overflow-hidden">
                      {renderSelectCell(customer, "district", customer.district)}
                    </td>
                    <td style={{ width: columnWidths.web }} className="px-2 py-2.5 overflow-hidden">
                      {renderWebsiteCell(customer)}
                    </td>
                    <td style={{ width: columnWidths.competitor }} className="px-2 py-2.5 overflow-hidden">
                      {renderSelectCell(customer, "competitor", customer.competitor)}
                    </td>
                    <td style={{ width: columnWidths.partner }} className="px-2 py-2.5 overflow-hidden">
                      {renderSelectCell(customer, "partner", customer.partner)}
                    </td>
                    <td style={{ width: columnWidths.products }} className="px-2 py-2.5 overflow-hidden">
                      <ProductsCell 
                        customer={customer} 
                        onUpdate={fetchCustomers}
                        options={options}
                        onOptionAdded={refreshOptionsCache}
                      />
                    </td>
                    <td style={{ width: columnWidths.potential }} className="px-2 py-2.5 overflow-hidden">
                      {renderSelectCell(customer, "potential_level", customer.potential_level)}
                    </td>
                    <td
                      style={{ width: columnWidths.potential_value }}
                      className="px-2 py-2.5 overflow-hidden text-sm tabular-nums"
                      data-testid={`potential-value-cell-${customer.id}`}
                    >
                      {customer.potential_value
                        ? `${Number(customer.potential_value).toLocaleString("tr-TR")} k€`
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td style={{ width: columnWidths.status }} className="px-2 py-2.5 overflow-hidden">
                      {renderStatusCell(customer)}
                    </td>
                    <td style={{ width: columnWidths.call }} className="px-2 py-2.5 overflow-hidden">
                      {renderCallStatusCell(customer)}
                    </td>
                    <td style={{ width: columnWidths.assigned }} className="px-2 py-2.5 overflow-hidden">
                      {renderSelectCell(customer, "assigned_to", customer.assigned_to)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          
          {/* Pagination - Bottom bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-slate-50">
              <span className="text-xs text-slate-500">
                Sayfa <span className="font-medium text-foreground">{currentPage}</span> / {totalPages} • {totalItems.toLocaleString("tr-TR")} kayıt
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CustomerEditModal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          refreshCustomers();
        }}
        customer={null}
      />
      
      <ImportModal
        open={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          refreshCustomers();
        }}
      />
      
      <CloudBackupModal
        open={cloudBackupOpen}
        onClose={() => setCloudBackupOpen(false)}
      />

      {/* Save Filter Modal */}
      <Dialog open={saveFilterModalOpen} onOpenChange={setSaveFilterModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5" />
              Filtreyi Kaydet
            </DialogTitle>
            <DialogDescription>
              Oluşturduğunuz filtreyi kaydedin ve daha sonra tekrar kullanın.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Filtre Adı</Label>
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Örn: İstanbul Yüksek Potansiyel"
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-2">
              {filterConditions.filter(c => c.operator === "is_empty" || c.operator === "is_not_empty" || c.value).length} koşul kaydedilecek
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaveFilterModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSaveFilter}>
              <Save className="w-4 h-4 mr-1" />
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Dialog */}
      <Dialog open={bulkUpdateOpen} onOpenChange={setBulkUpdateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu Düzenleme</DialogTitle>
            <DialogDescription>
              Seçili <strong>{selectedIds.size}</strong> müşterinin aynı alanını tek
              tıkla güncelle. Boş bırakarak alanı temizleyebilirsin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Alan</Label>
              <Select value={bulkUpdateField} onValueChange={setBulkUpdateField}>
                <SelectTrigger className="h-9" data-testid="bulk-field-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Durum</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                  <SelectItem value="application">Uygulama</SelectItem>
                  <SelectItem value="city">Şehir</SelectItem>
                  <SelectItem value="district">İlçe</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="competitor">Rakip</SelectItem>
                  <SelectItem value="assigned_to">Takip Eden</SelectItem>
                  <SelectItem value="potential_level">Potansiyel Seviyesi</SelectItem>
                  <SelectItem value="notes">Notlar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">
                Yeni Değer
              </Label>
              {bulkUpdateField === "status" ? (
                <Select value={bulkUpdateValue} onValueChange={setBulkUpdateValue}>
                  <SelectTrigger className="h-9" data-testid="bulk-value-select">
                    <SelectValue placeholder="Durum seç..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["Beklemede", "İletişimde", "Teklif Verildi", "Çalışılıyor", "Kazanıldı", "Kaybedildi"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={bulkUpdateValue}
                  onChange={(e) => setBulkUpdateValue(e.target.value)}
                  placeholder="Değer gir veya boş bırak..."
                  className="h-9"
                  data-testid="bulk-value-input"
                />
              )}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-900">
              <strong>Dikkat:</strong> Bu değer seçili tüm müşterilerin "{bulkUpdateField}" alanının üzerine yazılır. Geri alınamaz.
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkUpdateOpen(false)} disabled={bulkUpdating}>
              Vazgeç
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={bulkUpdating || !bulkUpdateField}
              data-testid="bulk-update-confirm"
            >
              {bulkUpdating ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Güncelleniyor...</>
              ) : (
                <>{selectedIds.size} Müşteriyi Güncelle</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
