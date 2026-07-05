import { useState, useEffect, useCallback } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import { 
  Building2, 
  GripVertical,
  Phone,
  Mail,
  Globe,
  Bell,
  User,
  Plus,
  LayoutGrid,
  Trash2,
  X,
  Save,
  ChevronDown
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import CustomerDetailCard from "../components/CustomerDetailCard";
import ProcessBoard from "./ProcessBoard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Dynamic column colors
const COLUMN_COLORS = {
  // Status colors — glass style
  "Beklemede": { bg: "bg-white/20", border: "border-white/40", header: "bg-amber-100/60", text: "text-amber-800", badge: "bg-amber-500" },
  "İletişimde": { bg: "bg-white/20", border: "border-white/40", header: "bg-primary-fixed/50", text: "text-primary", badge: "bg-primary" },
  "Teklif Verildi": { bg: "bg-white/20", border: "border-white/40", header: "bg-tertiary-fixed/50", text: "text-tertiary-md", badge: "bg-tertiary-md" },
  "Çalışılıyor": { bg: "bg-white/20", border: "border-white/40", header: "bg-emerald-100/60", text: "text-emerald-800", badge: "bg-emerald-500" },
  "Kazanıldı": { bg: "bg-white/20", border: "border-white/40", header: "bg-secondary-container/60", text: "text-secondary-md", badge: "bg-secondary-md" },
  "Kaybedildi": { bg: "bg-white/20", border: "border-white/40", header: "bg-red-100/60", text: "text-red-800", badge: "bg-red-500" },
  // Potential level colors
  "Yüksek": { bg: "bg-white/20", border: "border-white/40", header: "bg-emerald-100/60", text: "text-emerald-800", badge: "bg-emerald-500" },
  "Orta": { bg: "bg-white/20", border: "border-white/40", header: "bg-amber-100/60", text: "text-amber-800", badge: "bg-amber-500" },
  "Düşük": { bg: "bg-white/20", border: "border-white/40", header: "bg-surface-container/60", text: "text-on-surface-variant", badge: "bg-outline-md" },
  // Default/fallback
  "Atanmamış": { bg: "bg-white/20", border: "border-white/40", header: "bg-surface-container/60", text: "text-on-surface-variant", badge: "bg-outline-md" },
};

// Dynamic color palette for unknown columns — glass style
const DYNAMIC_COLOR_PALETTE = [
  { bg: "bg-white/20", border: "border-white/40", header: "bg-primary-fixed/50", text: "text-primary", badge: "bg-primary" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-emerald-100/60", text: "text-emerald-800", badge: "bg-emerald-500" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-tertiary-fixed/50", text: "text-tertiary-md", badge: "bg-tertiary-md" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-amber-100/60", text: "text-amber-800", badge: "bg-amber-500" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-red-100/60", text: "text-red-800", badge: "bg-red-500" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-secondary-container/60", text: "text-secondary-md", badge: "bg-secondary-md" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-primary-container/20", text: "text-primary", badge: "bg-primary-container" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-orange-100/60", text: "text-orange-800", badge: "bg-orange-500" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-teal-100/60", text: "text-teal-800", badge: "bg-teal-600" },
  { bg: "bg-white/20", border: "border-white/40", header: "bg-pink-100/60", text: "text-pink-800", badge: "bg-pink-500" },
];

const getColumnColors = (columnName, index) => {
  if (COLUMN_COLORS[columnName]) {
    return COLUMN_COLORS[columnName];
  }
  return DYNAMIC_COLOR_PALETTE[index % DYNAMIC_COLOR_PALETTE.length];
};

const Kanban = () => {
  const { openCustomerModal } = useCustomerModal();
  // "status" = mevcut otomatik durum panosu, "process" = manuel süreç panoları
  const [boardMode, setBoardMode] = useState("status");
  const [columns, setColumns] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailCardOpen, setDetailCardOpen] = useState(false);
  
  // Kanban views state
  const [savedViews, setSavedViews] = useState([]);
  const [activeView, setActiveView] = useState(null);
  const [groupFields, setGroupFields] = useState([]);
  const [currentGroupBy, setCurrentGroupBy] = useState("status");
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewGroupBy, setNewViewGroupBy] = useState("status");
  const [newViewDescription, setNewViewDescription] = useState("");

  // Per-column "show more" pagination (massive perf boost for large columns)
  const PAGE_SIZE = 50;
  const [visibleCounts, setVisibleCounts] = useState({});

  const getVisibleCount = (columnId) => visibleCounts[columnId] ?? PAGE_SIZE;
  const loadMore = (columnId) => {
    setVisibleCounts(prev => ({ ...prev, [columnId]: (prev[columnId] ?? PAGE_SIZE) + PAGE_SIZE }));
  };

  // Fetch group fields
  const fetchGroupFields = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/kanban/group-fields`);
      setGroupFields(response.data);
    } catch (error) {
      console.error("Gruplama alanları yüklenemedi:", error);
    }
  }, []);

  // Fetch saved views
  const fetchSavedViews = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/kanban/views`);
      setSavedViews(response.data);
    } catch (error) {
      console.error("Kanban görünümleri yüklenemedi:", error);
    }
  }, []);

  // Fetch kanban data
  const fetchKanbanData = useCallback(async (groupBy = currentGroupBy) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/kanban/customers?group_by=${groupBy}`);
      setColumns(response.data);
    } catch (error) {
      console.error("Kanban verileri yüklenirken hata:", error);
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [currentGroupBy]);

  useEffect(() => {
    fetchGroupFields();
    fetchSavedViews();
    fetchKanbanData("status");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle view selection
  const handleViewSelect = (view) => {
    setActiveView(view);
    setCurrentGroupBy(view.group_by);
    fetchKanbanData(view.group_by);
  };

  // Handle quick group by change
  const handleQuickGroupBy = (groupBy) => {
    setActiveView(null);
    setCurrentGroupBy(groupBy);
    fetchKanbanData(groupBy);
  };

  // Create new view
  const handleCreateView = async () => {
    if (!newViewName.trim()) {
      toast.error("Görünüm adı gerekli");
      return;
    }

    try {
      const response = await axios.post(`${API}/kanban/views`, {
        name: newViewName,
        group_by: newViewGroupBy,
        description: newViewDescription
      });
      
      setSavedViews([...savedViews, response.data]);
      setShowCreateModal(false);
      setNewViewName("");
      setNewViewGroupBy("status");
      setNewViewDescription("");
      
      // Activate the new view
      handleViewSelect(response.data);
      toast.success("Görünüm oluşturuldu");
    } catch (error) {
      console.error("Görünüm oluşturulamadı:", error);
      toast.error("Görünüm oluşturulamadı");
    }
  };

  // Delete view
  const handleDeleteView = async (viewId, e) => {
    e.stopPropagation();
    
    if (!window.confirm("Bu görünümü silmek istediğinizden emin misiniz?")) {
      return;
    }

    try {
      await axios.delete(`${API}/kanban/views/${viewId}`);
      setSavedViews(savedViews.filter(v => v.id !== viewId));
      
      if (activeView?.id === viewId) {
        setActiveView(null);
        setCurrentGroupBy("status");
        fetchKanbanData("status");
      }
      
      toast.success("Görünüm silindi");
    } catch (error) {
      console.error("Görünüm silinemedi:", error);
      toast.error("Görünüm silinemedi");
    }
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    // Dropped outside
    if (!destination) return;

    // Same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const sourceColumn = source.droppableId;
    const destColumn = destination.droppableId;

    // Find the dragged customer
    const draggedCustomer = columns[sourceColumn]?.find(c => c.id === draggableId);
    if (!draggedCustomer) return;

    // Optimistic update
    const newColumns = { ...columns };
    
    // Remove from source
    newColumns[sourceColumn] = newColumns[sourceColumn].filter(c => c.id !== draggableId);
    
    // Add to destination
    const updatedCustomer = { ...draggedCustomer, [currentGroupBy]: destColumn };
    newColumns[destColumn] = [
      ...newColumns[destColumn].slice(0, destination.index),
      updatedCustomer,
      ...newColumns[destColumn].slice(destination.index)
    ];

    setColumns(newColumns);

    // API call - use appropriate endpoint based on group_by
    try {
      if (currentGroupBy === "status") {
        await axios.patch(`${API}/kanban/customers/${draggableId}/status?new_status=${encodeURIComponent(destColumn)}`);
      } else {
        await axios.patch(`${API}/kanban/customers/${draggableId}/field?field=${currentGroupBy}&value=${encodeURIComponent(destColumn)}`);
      }
      toast.success(`${draggedCustomer.company_name} → ${destColumn}`);
    } catch (error) {
      console.error("Değer güncellenirken hata:", error);
      toast.error("Güncelleme başarısız");
      // Revert on error
      fetchKanbanData(currentGroupBy);
    }
  };

  const handleCustomerClick = (customer) => {
    if (customer?.id) {
      openCustomerModal(customer.id);
    }
  };

  // Get current group label
  const currentGroupLabel = groupFields.find(f => f.value === currentGroupBy)?.label || "Durum";

  if (boardMode === "status" && loading && Object.keys(columns).length === 0) {
    return (
      <div className="h-full flex flex-col" data-testid="kanban-page">
        <div className="page-header">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-emerald-600" />
              Kanban Panosu
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Müşteriler yükleniyor...</p>
          </div>
        </div>
        <div className="flex-1 overflow-x-auto px-4 pb-4">
          <div className="flex gap-3 h-full">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex-shrink-0 w-64 rounded-xl bg-muted/30 border-2 border-border p-3 animate-pulse">
                <div className="h-6 bg-slate-200 rounded mb-3"></div>
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="bg-card rounded-lg p-3 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalCustomers = Object.values(columns).reduce((sum, col) => sum + col.length, 0);
  const columnOrder = Object.keys(columns);

  return (
    <div className="h-full flex flex-col" data-testid="kanban-page">
      {/* Header */}
      <div className="page-header">
        <div className="flex-1">
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Kanban Panosu</h1>
          <p className="page-subtitle">
            {boardMode === "status"
              ? `${totalCustomers} müşteri · ${currentGroupLabel}'a göre gruplandı`
              : "Manuel süreç panoları"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Durum / Süreç sekme geçişi */}
          <div className="flex items-center rounded-lg bg-muted p-0.5">
            <button
              onClick={() => setBoardMode("status")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                boardMode === "status" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
              data-testid="board-mode-status"
            >
              Durum Panosu
            </button>
            <button
              onClick={() => setBoardMode("process")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                boardMode === "process" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
              data-testid="board-mode-process"
            >
              Süreç Panoları
            </button>
          </div>

          {boardMode === "status" && (
          <>
          {/* Quick Group By Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" data-testid="group-by-dropdown">
                <LayoutGrid className="w-4 h-4" />
                {currentGroupLabel}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {groupFields.map(field => (
                <DropdownMenuItem 
                  key={field.value}
                  onClick={() => handleQuickGroupBy(field.value)}
                  className={currentGroupBy === field.value ? "bg-muted" : ""}
                  data-testid={`group-by-${field.value}`}
                >
                  {field.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Create View Button */}
          <Button 
            size="sm" 
            onClick={() => setShowCreateModal(true)}
            className="gap-2"
            data-testid="create-view-btn"
          >
            <Plus className="w-4 h-4" />
            Görünüm Kaydet
          </Button>
          </>
          )}
        </div>
      </div>

      {/* Saved Views Tabs */}
      {boardMode === "status" && savedViews.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <span className="text-sm text-muted-foreground flex-shrink-0">Kayıtlı Görünümler:</span>
            {savedViews.map(view => (
              <div
                key={view.id}
                onClick={() => handleViewSelect(view)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer
                  transition-all flex-shrink-0 group
                  ${activeView?.id === view.id 
                    ? "bg-blue-100 text-blue-800 border-2 border-blue-300" 
                    : "bg-muted text-foreground hover:bg-slate-200 border-2 border-transparent"
                  }
                `}
                data-testid={`view-tab-${view.id}`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>{view.name}</span>
                <button
                  onClick={(e) => handleDeleteView(view.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                  data-testid={`delete-view-${view.id}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Süreç Panoları modu */}
      {boardMode === "process" && <ProcessBoard />}

      {/* Kanban Board (Durum modu) */}
      {boardMode === "status" && (
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 h-full px-4" style={{ minWidth: 'max-content' }}>
            {columnOrder.map((columnId, colIndex) => {
              const customers = columns[columnId] || [];
              const colors = getColumnColors(columnId, colIndex);

              return (
                <div 
                  key={columnId} 
                  className={`flex-shrink-0 w-64 rounded-2xl ${colors.bg} ${colors.border} border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col max-h-[calc(100vh-220px)]`}
                  data-testid={`kanban-column-${columnId}`}
                >
                  {/* Column Header */}
                  <div className={`px-3 py-2 ${colors.header} rounded-t-lg border-b ${colors.border}`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold text-sm ${colors.text} truncate`}>{columnId}</h3>
                      <span className={`${colors.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                        {customers.length}
                      </span>
                    </div>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={columnId}>
                    {(provided, snapshot) => {
                      const visibleCount = getVisibleCount(columnId);
                      const visibleCustomers = customers.slice(0, visibleCount);
                      const hasMore = customers.length > visibleCount;
                      return (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 p-2 space-y-2 overflow-y-auto transition-colors ${
                          snapshot.isDraggingOver ? "bg-muted/50" : ""
                        }`}
                        style={{ minHeight: "150px" }}
                      >
                        {visibleCustomers.map((customer, index) => (
                          <Draggable key={customer.id} draggableId={customer.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`glass-card p-2 cursor-pointer hover:shadow-glass hover:-translate-y-0.5 transition-all group
                                  ${snapshot.isDragging ? "shadow-glass ring-2 ring-primary/30" : ""}`}
                                onClick={() => handleCustomerClick(customer)}
                                data-testid={`kanban-card-${customer.id}`}
                              >
                                {/* Drag Handle + Company Info */}
                                <div className="flex items-start gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="mt-1 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <GripVertical className="w-3 h-3" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                        {customer.company_name?.charAt(0) || "?"}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-foreground text-sm truncate flex items-center gap-1">
                                          {customer.company_name}
                                          {customer.is_followup && (
                                            <Bell className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                          )}
                                        </h4>
                                        {customer.market && (
                                          <p className="text-xs text-muted-foreground truncate">{customer.market}</p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Contact Info */}
                                    <div className="mt-2 space-y-1">
                                      {customer.contact_info?.contact_person && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <User className="w-3 h-3 text-muted-foreground/70" />
                                          <span className="truncate">{customer.contact_info.contact_person}</span>
                                        </div>
                                      )}
                                      {customer.contact_info?.phone && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Phone className="w-3 h-3 text-muted-foreground/70" />
                                          <span className="truncate">{customer.contact_info.phone}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Tags */}
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {customer.potential_level && (
                                        <Badge className={`text-[10px] px-1.5 py-0 ${
                                          customer.potential_level === "Yüksek" ? "bg-emerald-100 text-emerald-700" :
                                          customer.potential_level === "Orta" ? "bg-amber-100 text-amber-700" :
                                          "bg-muted text-muted-foreground"
                                        }`}>
                                          {customer.potential_level}
                                        </Badge>
                                      )}
                                      {customer.application && (
                                        <Badge className="text-[10px] px-1.5 py-0 bg-primary-fixed/60 text-primary">
                                          {customer.application}
                                        </Badge>
                                      )}
                                      {currentGroupBy !== "status" && customer.status && (
                                        <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700">
                                          {customer.status}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {/* Show More button - performance optimization */}
                        {hasMore && (
                          <button
                            onClick={() => loadMore(columnId)}
                            className="w-full py-2 text-xs font-medium text-on-surface-variant bg-white/30 border border-dashed border-outline-variant/40 rounded-xl hover:bg-white/50 transition-colors"
                          >
                            Daha fazla göster (+{Math.min(PAGE_SIZE, customers.length - visibleCount)})
                          </button>
                        )}
                        
                        {/* Empty state */}
                        {customers.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground/70">
                            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Bu sütunda müşteri yok</p>
                          </div>
                        )}
                      </div>
                      );
                    }}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
      )}

      {/* Customer Detail Card */}
      <CustomerDetailCard
        open={detailCardOpen}
        onClose={() => {
          setDetailCardOpen(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
        onUpdate={() => {
          fetchKanbanData(currentGroupBy);
          if (selectedCustomer) {
            axios.get(`${API}/customers/${selectedCustomer.id}`).then(res => {
              setSelectedCustomer(res.data);
            }).catch(() => {});
          }
        }}
      />

      {/* Create View Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md" data-testid="create-view-modal">
          <DialogHeader>
            <DialogTitle>Yeni Kanban Görünümü Oluştur</DialogTitle>
            <DialogDescription>
              Müşterilerinizi farklı alanlara göre gruplandırmak için özel bir görünüm oluşturun.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Görünüm Adı
              </label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="Örn: Takip Edene Göre"
                data-testid="view-name-input"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Gruplama Alanı
              </label>
              <Select value={newViewGroupBy} onValueChange={setNewViewGroupBy}>
                <SelectTrigger data-testid="view-group-select">
                  <SelectValue placeholder="Alan seçin" />
                </SelectTrigger>
                <SelectContent>
                  {groupFields.map(field => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Açıklama (İsteğe bağlı)
              </label>
              <Input
                value={newViewDescription}
                onChange={(e) => setNewViewDescription(e.target.value)}
                placeholder="Bu görünümün amacı..."
                data-testid="view-description-input"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateView} className="gap-2" data-testid="save-view-btn">
              <Save className="w-4 h-4" />
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Kanban;
