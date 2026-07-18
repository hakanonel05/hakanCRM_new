import { useState, useEffect, useCallback } from "react";
import Breadcrumb from "../components/Breadcrumb";
import { useNavigate } from "react-router-dom";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import axios from "axios";
import {
  Filter,
  Plus,
  Trash2,
  Save,
  X,
  Eye,
  Bell,
  Settings2,
  ChevronRight
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
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
  DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Available fields for filtering
const FILTER_FIELDS = [
  { value: "company_name", label: "Firma Adı", type: "text" },
  { value: "market", label: "Market", type: "select" },
  { value: "application", label: "Uygulama", type: "select" },
  { value: "city", label: "Şehir", type: "select" },
  { value: "district", label: "İlçe", type: "text" },
  { value: "status", label: "Durum", type: "select" },
  { value: "potential_level", label: "Potansiyel", type: "select" },
  { value: "competitor", label: "Rakip", type: "select" },
  { value: "partner", label: "Partner", type: "select" },
  { value: "assigned_to", label: "Takip Eden", type: "text" },
  { value: "is_followup", label: "Takipte", type: "boolean" }
];

// Available operators
const OPERATORS = [
  { value: "equals", label: "Eşittir" },
  { value: "contains", label: "İçerir" },
  { value: "not_equals", label: "Eşit Değil" },
  { value: "is_empty", label: "Boş" },
  { value: "is_not_empty", label: "Boş Değil" }
];

// Row colors for table
const ROW_COLORS = [
  "bg-blue-50 hover:bg-blue-100",
  "bg-emerald-50 hover:bg-emerald-100",
  "bg-amber-50 hover:bg-amber-100",
  "bg-purple-50 hover:bg-purple-100",
  "bg-rose-50 hover:bg-rose-100",
  "bg-cyan-50 hover:bg-cyan-100",
];

const FiltersPage = () => {
  const { openCustomerModal } = useCustomerModal();
  const [savedFilters, setSavedFilters] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Active filter
  const [activeFilter, setActiveFilter] = useState(null);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  
  // Create filter dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterConditions, setFilterConditions] = useState([
    { field: "company_name", operator: "contains", value: "" }
  ]);
  const [filterLogic, setFilterLogic] = useState("AND");
  const [editingFilter, setEditingFilter] = useState(null);

  const fetchFilters = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/filters`);
      setSavedFilters(response.data);
    } catch (error) {
      console.error("Filtreler yüklenirken hata:", error);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      // FiltersPage needs ALL customers for filtering, so fetch with high limit
      const response = await axios.get(`${API}/customers?limit=5000`);
      // Handle paginated response format
      if (response.data && response.data.data) {
        setCustomers(response.data.data);
      } else if (Array.isArray(response.data)) {
        setCustomers(response.data);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error("Müşteriler yüklenirken hata:", error);
      setCustomers([]);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/options/grouped`);
      const grouped = {};
      if (Array.isArray(response.data)) {
        response.data.forEach(opt => {
          const field = opt.field_name || "other";
          if (!grouped[field]) grouped[field] = [];
          grouped[field].push(opt);
        });
      }
      setOptions(grouped);
    } catch (error) {
      console.error("Options yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
    fetchCustomers();
    fetchOptions();
  }, [fetchFilters, fetchCustomers, fetchOptions]);

  // Get unique values for select fields
  const getUniqueValues = (field) => {
    const values = new Set();
    customers.forEach(c => {
      if (c[field]) values.add(c[field]);
    });
    if (options[field]) {
      options[field].forEach(opt => {
        if (opt.value) values.add(opt.value);
      });
    }
    return Array.from(values).sort();
  };

  // Apply filter to customers (optionally use provided data)
  const applyFilterToCustomers = (conditions, logic, customersData = null) => {
    const dataToFilter = customersData || customers;
    
    if (!conditions || conditions.length === 0) {
      return dataToFilter;
    }

    return dataToFilter.filter(customer => {
      const results = conditions.map(condition => {
        const { field, operator, value } = condition;
        const customerValue = customer[field] || "";
        
        switch (operator) {
          case "equals":
            return String(customerValue).toLowerCase() === String(value).toLowerCase();
          case "contains":
            return String(customerValue).toLowerCase().includes(String(value).toLowerCase());
          case "not_equals":
            return String(customerValue).toLowerCase() !== String(value).toLowerCase();
          case "is_empty":
            return !customerValue || customerValue === "";
          case "is_not_empty":
            return customerValue && customerValue !== "";
          default:
            return true;
        }
      });
      
      if (logic === "OR") {
        return results.some(r => r);
      }
      return results.every(r => r);
    });
  };

  // Select filter - fetch from API with filters
  const selectFilter = async (filter) => {
    setActiveFilter(filter);
    setLoading(true);
    
    try {
      // Build API query from filter conditions
      const params = new URLSearchParams();
      params.append("limit", "5000");
      
      // Apply first condition as API filter if it's a simple equality filter
      for (const condition of filter.conditions) {
        if (condition.field === "assigned_to" && (condition.operator === "equals" || condition.operator === "contains")) {
          params.append("assigned_to", condition.value);
          break;
        }
        if (condition.field === "status" && condition.operator === "equals") {
          params.append("status", condition.value);
          break;
        }
        if (condition.field === "market" && condition.operator === "equals") {
          params.append("market", condition.value);
          break;
        }
        if (condition.field === "city" && condition.operator === "equals") {
          params.append("city", condition.value);
          break;
        }
      }
      
      const response = await axios.get(`${API}/customers?${params.toString()}`);
      let apiCustomers = [];
      
      if (response.data && response.data.data) {
        apiCustomers = response.data.data;
      } else if (Array.isArray(response.data)) {
        apiCustomers = response.data;
      }
      
      // Apply additional frontend filtering for complex conditions
      const results = applyFilterToCustomers(filter.conditions, filter.logic, apiCustomers);
      setFilteredCustomers(results);
    } catch (error) {
      console.error("Filtre uygulanırken hata:", error);
      // Fallback to frontend filtering
      const results = applyFilterToCustomers(filter.conditions, filter.logic);
      setFilteredCustomers(results);
    } finally {
      setLoading(false);
    }
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
    if (key === "field") {
      updated[index].value = "";
    }
    setFilterConditions(updated);
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
      if (editingFilter) {
        await axios.put(`${API}/filters/${editingFilter.id}`, {
          name: filterName,
          conditions: validConditions,
          logic: filterLogic
        });
        toast.success("Filtre güncellendi");
      } else {
        await axios.post(`${API}/filters`, {
          name: filterName,
          conditions: validConditions,
          logic: filterLogic
        });
        toast.success("Filtre kaydedildi");
      }
      setCreateDialogOpen(false);
      resetForm();
      fetchFilters();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  // Delete filter
  const handleDeleteFilter = async (filterId, e) => {
    e.stopPropagation();
    if (!window.confirm("Bu filtreyi silmek istediğinizden emin misiniz?")) return;
    
    try {
      await axios.delete(`${API}/filters/${filterId}`);
      toast.success("Filtre silindi");
      fetchFilters();
      if (activeFilter?.id === filterId) {
        setActiveFilter(null);
        setFilteredCustomers([]);
      }
    } catch (error) {
      toast.error("Silme başarısız");
    }
  };

  // Edit filter
  const handleEditFilter = (filter, e) => {
    e.stopPropagation();
    setEditingFilter(filter);
    setFilterName(filter.name);
    setFilterConditions(filter.conditions || [{ field: "company_name", operator: "contains", value: "" }]);
    setFilterLogic(filter.logic || "AND");
    setCreateDialogOpen(true);
  };

  const resetForm = () => {
    setFilterName("");
    setFilterConditions([{ field: "company_name", operator: "contains", value: "" }]);
    setFilterLogic("AND");
    setEditingFilter(null);
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div data-testid="filters-page" className="h-full flex flex-col p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Filter className="w-6 h-6 text-primary" />
            Filtreler
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">Özel filtreler oluşturun ve müşterilerinizi hızlıca filtreleyin</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Filtre
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 border-b">
        {savedFilters.map((filter, index) => {
          const isActive = activeFilter?.id === filter.id;
          const colorClass = ROW_COLORS[index % ROW_COLORS.length].split(" ")[0];
          
          return (
            <div
              key={filter.id}
              role="button"
              tabIndex={0}
              onClick={() => selectFilter(filter)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectFilter(filter);
                }
              }}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm flex items-center gap-2 transition-all border-b-2 cursor-pointer select-none ${
                isActive 
                  ? `${colorClass} border-primary text-primary` 
                  : "bg-muted hover:bg-slate-200 border-transparent text-muted-foreground"
              }`}
            >
              <span className="whitespace-nowrap">{filter.name}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {filter.conditions?.length || 0}
              </Badge>
              <div className="flex items-center gap-1 ml-1 opacity-60 hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => handleEditFilter(filter, e)}
                  className="p-1 hover:bg-card/50 rounded"
                >
                  <Settings2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteFilter(filter.id, e)}
                  className="p-1 hover:bg-card/50 rounded text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
        {savedFilters.length === 0 && (
          <p className="text-muted-foreground/70 text-sm py-2">Henüz filtre yok. Yeni bir filtre oluşturun.</p>
        )}
      </div>

      {/* Results Table */}
      {activeFilter ? (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{activeFilter.name}</h3>
              <Badge className="bg-blue-100 text-primary">
                {filteredCustomers.length} sonuç
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {activeFilter.conditions?.map((c, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px]">
                  {FILTER_FIELDS.find(f => f.value === c.field)?.label} {OPERATORS.find(o => o.value === c.operator)?.label}
                  {c.value && ` "${c.value}"`}
                </Badge>
              ))}
              <span className="ml-1">({activeFilter.logic})</span>
            </div>
          </div>

          {/* Colored Results Table — flex-1 so it fills remaining viewport height */}
          <div className="bg-card rounded-xl border border-border overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted border-b border-border">
                    <th className="w-10 px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[180px]">Firma Adı</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[100px]">Market</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[100px]">Uygulama</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[80px]">Şehir</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[80px]">İlçe</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[100px]">Web</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[80px]">Rakip</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[80px]">Partner</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[100px]">Ürünler</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[80px]">Potansiyel</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[80px]">Durum</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[100px]">Takip Eden</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, index) => {
                    const rowColor = ROW_COLORS[index % ROW_COLORS.length];
                    
                    return (
                      <tr 
                        key={customer.id}
                        data-testid={`filter-row-${customer.id}`}
                        className={`border-b border-border cursor-pointer transition-colors ${rowColor}`}
                        onClick={() => openCustomerModal(customer.id)}
                      >
                        <td className="px-3 py-2 text-xs text-muted-foreground/70">{index + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center text-white font-semibold text-xs">
                              {customer.company_name?.charAt(0) || "?"}
                            </div>
                            <span className="font-medium text-sm">{customer.company_name || "-"}</span>
                            {customer.is_followup && (
                              <Bell className="w-3.5 h-3.5 text-amber-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {customer.market ? (
                            <Badge className="bg-purple-100 text-purple-700 text-xs">{customer.market}</Badge>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {customer.application ? (
                            <Badge className="bg-blue-100 text-primary text-xs">{customer.application}</Badge>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2 text-sm">{customer.city || "-"}</td>
                        <td className="px-3 py-2 text-sm">{customer.district || "-"}</td>
                        <td className="px-3 py-2">
                          {customer.website ? (
                            <a 
                              href={customer.website.startsWith("http") ? customer.website : `https://${customer.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {customer.website}
                            </a>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {customer.competitor ? (
                            <Badge className="bg-rose-100 text-rose-700 text-xs">{customer.competitor}</Badge>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {customer.partner ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">{customer.partner}</Badge>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {customer.products?.slice(0, 2).map((p, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px]">{p}</Badge>
                            )) || "-"}
                            {customer.products?.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{customer.products.length - 2}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {customer.potential_level ? (
                            <Badge className={
                              customer.potential_level === "Yüksek" ? "bg-emerald-100 text-emerald-700 text-xs" :
                              customer.potential_level === "Orta" ? "bg-amber-100 text-amber-700 text-xs" :
                              "bg-muted text-foreground text-xs"
                            }>{customer.potential_level}</Badge>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {customer.status ? (
                            <Badge className="bg-cyan-100 text-cyan-700 text-xs">{customer.status}</Badge>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2 text-sm">{customer.assigned_to || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCustomers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground/70">
                  <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Filtre koşullarına uyan müşteri bulunamadı</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground/70">
            <Filter className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">Bir Filtre Seçin</h3>
            <p className="max-w-md">
              Yukarıdaki sekmelerden bir filtre seçin veya yeni bir filtre oluşturun.
            </p>
            <Button className="mt-4" onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Filtre Oluştur
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Filter Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              {editingFilter ? "Filtre Düzenle" : "Yeni Filtre Oluştur"}
            </DialogTitle>
            <DialogDescription>
              Müşterilerinizi filtrelemek için koşullar belirleyin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Filter Name */}
            <div>
              <Label>Filtre Adı</Label>
              <Input
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Örn: İstanbul Yüksek Potansiyel"
                className="mt-1"
              />
            </div>

            {/* Logic */}
            <div>
              <Label className="text-xs text-muted-foreground">Koşul Mantığı</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={filterLogic === "AND" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterLogic("AND")}
                >
                  VE (Tümü)
                </Button>
                <Button
                  variant={filterLogic === "OR" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterLogic("OR")}
                >
                  VEYA (Herhangi)
                </Button>
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <Label>Koşullar</Label>
              {filterConditions.map((condition, index) => {
                const fieldConfig = FILTER_FIELDS.find(f => f.value === condition.field);
                const isSelectField = fieldConfig?.type === "select";
                const fieldValues = isSelectField ? getUniqueValues(condition.field) : [];
                
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    <Select
                      value={condition.field}
                      onValueChange={(v) => updateFilterCondition(index, "field", v)}
                    >
                      <SelectTrigger className="w-[120px] h-8 text-sm">
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

                    <Select
                      value={condition.operator}
                      onValueChange={(v) => updateFilterCondition(index, "operator", v)}
                    >
                      <SelectTrigger className="w-[100px] h-8 text-sm">
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
                          placeholder="Değer..."
                          className="flex-1 h-8 text-sm"
                        />
                      )
                    )}

                    {filterConditions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeFilterCondition(index)}
                      >
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                );
              })}

              <Button variant="outline" size="sm" className="w-full" onClick={addFilterCondition}>
                <Plus className="w-4 h-4 mr-1" />
                Koşul Ekle
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
              İptal
            </Button>
            <Button onClick={handleSaveFilter}>
              <Save className="w-4 h-4 mr-1" />
              {editingFilter ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FiltersPage;
