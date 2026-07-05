import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import {
  Building2,
  GripVertical,
  Plus,
  Trash2,
  X,
  Search,
  Bell,
  User,
  Phone,
  Loader2,
  LayoutGrid,
  Pencil,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Stage başlıkları için cam (glass) renk paleti — mevcut Kanban ile uyumlu.
const STAGE_PALETTE = [
  { header: "bg-primary-fixed/50", text: "text-primary", badge: "bg-primary" },
  { header: "bg-emerald-100/60", text: "text-emerald-800", badge: "bg-emerald-500" },
  { header: "bg-tertiary-fixed/50", text: "text-tertiary-md", badge: "bg-tertiary-md" },
  { header: "bg-amber-100/60", text: "text-amber-800", badge: "bg-amber-500" },
  { header: "bg-red-100/60", text: "text-red-800", badge: "bg-red-500" },
  { header: "bg-secondary-container/60", text: "text-secondary-md", badge: "bg-secondary-md" },
  { header: "bg-teal-100/60", text: "text-teal-800", badge: "bg-teal-600" },
  { header: "bg-pink-100/60", text: "text-pink-800", badge: "bg-pink-500" },
];
const stageColors = (i) => STAGE_PALETTE[i % STAGE_PALETTE.length];

const ProcessBoard = () => {
  const { openCustomerModal } = useCustomerModal();

  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [stages, setStages] = useState([]); // [{id,name,color,position,cards:[...]}]
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);

  // Yeni pano / stage input alanları
  const [newBoardName, setNewBoardName] = useState("");
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [showNewStage, setShowNewStage] = useState(false);

  // Müşteri ekleme modalı
  const [pickerStageId, setPickerStageId] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchTimer = useRef(null);

  // ---- Panoları yükle ----
  const fetchBoards = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/process/boards`);
      setBoards(data);
      if (data.length && !activeBoardId) {
        setActiveBoardId(data[0].id);
      }
    } catch (err) {
      console.error("Panolar yüklenemedi:", err);
      toast.error("Panolar yüklenemedi. Supabase tabloları kurulu mu?");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Aktif panonun stage + kartlarını yükle ----
  const fetchBoardFull = useCallback(async (boardId) => {
    if (!boardId) {
      setStages([]);
      return;
    }
    try {
      setBoardLoading(true);
      const { data } = await axios.get(`${API}/process/boards/${boardId}/full`);
      setStages(data.stages || []);
    } catch (err) {
      console.error("Pano yüklenemedi:", err);
      toast.error("Pano yüklenemedi");
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    fetchBoardFull(activeBoardId);
  }, [activeBoardId, fetchBoardFull]);

  // ---- Pano oluştur ----
  const handleCreateBoard = async () => {
    const name = newBoardName.trim();
    if (!name) return;
    try {
      const { data } = await axios.post(`${API}/process/boards`, { name });
      setBoards((prev) => [...prev, data]);
      setActiveBoardId(data.id);
      setNewBoardName("");
      setShowNewBoard(false);
      toast.success("Pano oluşturuldu");
    } catch {
      toast.error("Pano oluşturulamadı");
    }
  };

  // ---- Pano sil ----
  const handleDeleteBoard = async (boardId) => {
    if (!window.confirm("Bu pano ve içindeki tüm stage/müşteriler silinecek. Emin misiniz?")) return;
    try {
      await axios.delete(`${API}/process/boards/${boardId}`);
      const remaining = boards.filter((b) => b.id !== boardId);
      setBoards(remaining);
      if (activeBoardId === boardId) {
        setActiveBoardId(remaining[0]?.id || null);
      }
      toast.success("Pano silindi");
    } catch {
      toast.error("Pano silinemedi");
    }
  };

  // ---- Pano yeniden adlandır ----
  const handleRenameBoard = async (board) => {
    const name = window.prompt("Yeni pano adı:", board.name);
    if (!name || !name.trim() || name.trim() === board.name) return;
    try {
      await axios.put(`${API}/process/boards/${board.id}`, { name: name.trim() });
      setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, name: name.trim() } : b)));
      toast.success("Pano yeniden adlandırıldı");
    } catch {
      toast.error("İşlem başarısız");
    }
  };

  // ---- Stage oluştur ----
  const handleCreateStage = async () => {
    const name = newStageName.trim();
    if (!name || !activeBoardId) return;
    try {
      const { data } = await axios.post(`${API}/process/boards/${activeBoardId}/stages`, { name });
      setStages((prev) => [...prev, { ...data, cards: data.cards || [] }]);
      setNewStageName("");
      setShowNewStage(false);
      toast.success("Stage eklendi");
    } catch {
      toast.error("Stage eklenemedi");
    }
  };

  // ---- Stage sil ----
  const handleDeleteStage = async (stageId) => {
    if (!window.confirm("Bu stage ve içindeki kartlar silinecek (müşteri kayıtları etkilenmez). Emin misiniz?"))
      return;
    try {
      await axios.delete(`${API}/process/stages/${stageId}`);
      setStages((prev) => prev.filter((s) => s.id !== stageId));
      toast.success("Stage silindi");
    } catch {
      toast.error("Stage silinemedi");
    }
  };

  // ---- Müşteri arama (debounce) ----
  const runSearch = (q) => {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        setSearching(true);
        const { data } = await axios.get(
          `${API}/customers?search=${encodeURIComponent(q.trim())}&limit=20`
        );
        setResults(data.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const openPicker = (stageId) => {
    setPickerStageId(stageId);
    setSearch("");
    setResults([]);
  };

  // Bu panoda zaten ekli müşteri id'leri (çift ekleme engeli)
  const usedCustomerIds = new Set(
    stages.flatMap((s) => (s.cards || []).map((c) => c.customer?.id)).filter(Boolean)
  );

  // ---- Müşteriyi stage'e ekle ----
  const handleAddCustomer = async (customer) => {
    if (!pickerStageId) return;
    try {
      setAdding(true);
      const { data } = await axios.post(`${API}/process/stages/${pickerStageId}/cards`, {
        customer_id: customer.id,
      });
      setStages((prev) =>
        prev.map((s) =>
          s.id === pickerStageId ? { ...s, cards: [...(s.cards || []), data] } : s
        )
      );
      toast.success(`${customer.company_name} eklendi`);
      setPickerStageId(null);
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error("Bu müşteri zaten bu panoda");
      } else {
        toast.error("Müşteri eklenemedi");
      }
    } finally {
      setAdding(false);
    }
  };

  // ---- Kart kaldır ----
  const handleRemoveCard = async (stageId, cardId) => {
    // Optimistik
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, cards: s.cards.filter((c) => c.id !== cardId) } : s))
    );
    try {
      await axios.delete(`${API}/process/cards/${cardId}`);
    } catch {
      toast.error("Kaldırma başarısız");
      fetchBoardFull(activeBoardId);
    }
  };

  // ---- Sürükle-bırak ----
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const srcStageId = source.droppableId;
    const dstStageId = destination.droppableId;

    // Optimistik güncelleme
    const snapshot = stages;
    let moved = null;
    const next = stages.map((s) => ({ ...s, cards: [...(s.cards || [])] }));
    const src = next.find((s) => s.id === srcStageId);
    const dst = next.find((s) => s.id === dstStageId);
    if (!src || !dst) return;
    [moved] = src.cards.splice(source.index, 1);
    if (!moved) return;
    dst.cards.splice(destination.index, 0, moved);
    setStages(next);

    try {
      await axios.patch(`${API}/process/cards/${draggableId}/move`, {
        stage_id: dstStageId,
        position: destination.index,
      });
    } catch {
      toast.error("Taşıma başarısız");
      setStages(snapshot); // geri al
    }
  };

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const totalCards = stages.reduce((sum, s) => sum + (s.cards?.length || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Panolar yükleniyor...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Pano seçici */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {boards.map((b) => (
            <div
              key={b.id}
              onClick={() => setActiveBoardId(b.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all flex-shrink-0 border-2 ${
                activeBoardId === b.id
                  ? "bg-primary-fixed/60 text-primary border-primary/30"
                  : "bg-muted text-foreground hover:bg-slate-200 border-transparent"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="max-w-[160px] truncate">{b.name}</span>
              {activeBoardId === b.id && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameBoard(b);
                    }}
                    className="opacity-60 hover:opacity-100 hover:text-primary"
                    title="Yeniden adlandır"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBoard(b.id);
                    }}
                    className="opacity-60 hover:opacity-100 hover:text-red-600"
                    title="Panoyu sil"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Yeni pano */}
          {showNewBoard ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Input
                autoFocus
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBoard();
                  if (e.key === "Escape") {
                    setShowNewBoard(false);
                    setNewBoardName("");
                  }
                }}
                placeholder="Pano adı"
                className="h-8 w-40"
              />
              <Button size="sm" onClick={handleCreateBoard} className="h-8">
                Ekle
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0 h-8"
              onClick={() => setShowNewBoard(true)}
            >
              <Plus className="w-4 h-4" /> Yeni Pano
            </Button>
          )}
        </div>
      </div>

      {/* Boş durum: hiç pano yok */}
      {boards.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3 px-4">
          <LayoutGrid className="w-12 h-12 opacity-30" />
          <div>
            <p className="font-medium text-foreground">Henüz süreç panosu yok</p>
            <p className="text-sm">Yukarıdan “Yeni Pano” ile ilk panonu oluştur.</p>
          </div>
        </div>
      )}

      {/* Aktif pano başlığı + stage ekle */}
      {activeBoard && (
        <div className="px-4 flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">
            {stages.length} stage · {totalCards} müşteri
          </p>
          {showNewStage ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateStage();
                  if (e.key === "Escape") {
                    setShowNewStage(false);
                    setNewStageName("");
                  }
                }}
                placeholder="Örn: Teklif Çalışması"
                className="h-8 w-52"
              />
              <Button size="sm" onClick={handleCreateStage} className="h-8">
                Ekle
              </Button>
            </div>
          ) : (
            <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowNewStage(true)}>
              <Plus className="w-4 h-4" /> Stage Ekle
            </Button>
          )}
        </div>
      )}

      {/* Board */}
      {activeBoard && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-3 h-full px-4" style={{ minWidth: "max-content" }}>
              {stages.map((stage, idx) => {
                const colors = stageColors(idx);
                const cards = stage.cards || [];
                return (
                  <div
                    key={stage.id}
                    className="flex-shrink-0 w-64 rounded-2xl bg-white/60 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col max-h-[calc(100vh-260px)]"
                  >
                    {/* Stage başlığı */}
                    <div className={`px-3 py-2 ${colors.header} rounded-t-2xl border-b border-white/40`}>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-semibold text-sm ${colors.text} truncate`}>{stage.name}</h3>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`${colors.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                            {cards.length}
                          </span>
                          <button
                            onClick={() => handleDeleteStage(stage.id)}
                            className="text-muted-foreground/60 hover:text-red-600 transition-colors"
                            title="Stage'i sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Kartlar */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-2 space-y-2 overflow-y-auto transition-colors ${
                            snapshot.isDraggingOver ? "bg-muted/50" : ""
                          }`}
                          style={{ minHeight: "120px" }}
                        >
                          {cards.map((card, index) => {
                            const c = card.customer || {};
                            return (
                              <Draggable key={card.id} draggableId={card.id} index={index}>
                                {(prov, snap) => {
                                  const cardEl = (
                                  <div
                                    ref={prov.innerRef}
                                    {...prov.draggableProps}
                                    className={`glass-card p-2 group transition-all hover:-translate-y-0.5 ${
                                      snap.isDragging ? "shadow-glass ring-2 ring-primary/30 bg-white" : ""
                                    }`}
                                  >
                                    <div className="flex items-start gap-2">
                                      <div
                                        {...prov.dragHandleProps}
                                        className="mt-1 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
                                      >
                                        <GripVertical className="w-3 h-3" />
                                      </div>
                                      <div
                                        className="flex-1 min-w-0 cursor-pointer"
                                        onClick={() => c.id && openCustomerModal(c.id)}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                            {c.company_name?.charAt(0) || "?"}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-foreground text-sm truncate flex items-center gap-1">
                                              {c.company_name}
                                              {c.is_followup && (
                                                <Bell className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                              )}
                                            </h4>
                                            {c.market && (
                                              <p className="text-xs text-muted-foreground truncate">{c.market}</p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="mt-2 space-y-1">
                                          {c.contact_info?.contact_person && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                              <User className="w-3 h-3 text-muted-foreground/70" />
                                              <span className="truncate">{c.contact_info.contact_person}</span>
                                            </div>
                                          )}
                                          {c.contact_info?.phone && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                              <Phone className="w-3 h-3 text-muted-foreground/70" />
                                              <span className="truncate">{c.contact_info.phone}</span>
                                            </div>
                                          )}
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-1">
                                          {c.status && (
                                            <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700">
                                              {c.status}
                                            </Badge>
                                          )}
                                          {c.potential_level && (
                                            <Badge
                                              className={`text-[10px] px-1.5 py-0 ${
                                                c.potential_level === "Yüksek"
                                                  ? "bg-emerald-100 text-emerald-700"
                                                  : c.potential_level === "Orta"
                                                  ? "bg-amber-100 text-amber-700"
                                                  : "bg-muted text-muted-foreground"
                                              }`}
                                            >
                                              {c.potential_level}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      {/* Karttan kaldır */}
                                      <button
                                        onClick={() => handleRemoveCard(stage.id, card.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-red-600"
                                        title="Panodan kaldır"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  );
                                  // Sürüklenirken kartı body'ye taşı: blur/transform içeren
                                  // ata kapsayıcıların imleç kaymasına yol açmasını engeller.
                                  return snap.isDragging
                                    ? createPortal(cardEl, document.body)
                                    : cardEl;
                                }}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}

                          {/* Müşteri ekle */}
                          <button
                            onClick={() => openPicker(stage.id)}
                            className="w-full py-2 text-xs font-medium text-primary bg-white/30 border border-dashed border-primary/40 rounded-xl hover:bg-white/50 transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Müşteri Ekle
                          </button>

                          {cards.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground/60">
                              <Building2 className="w-7 h-7 mx-auto mb-1 opacity-40" />
                              <p className="text-xs">Boş stage</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}

              {/* Hiç stage yoksa */}
              {stages.length === 0 && !boardLoading && (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground gap-2 w-full py-16">
                  <Plus className="w-10 h-10 opacity-30" />
                  <p className="text-sm">
                    Bu panoda henüz stage yok. Yukarıdan “Stage Ekle” ile başla.
                  </p>
                </div>
              )}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Müşteri seçme modalı */}
      <Dialog open={!!pickerStageId} onOpenChange={(open) => !open && setPickerStageId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Müşteri Ekle</DialogTitle>
            <DialogDescription>Bir müşteri arayıp bu stage'e ekleyin.</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Firma adı ile ara..."
              className="pl-9"
            />
          </div>

          <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
            {searching && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Aranıyor...
              </div>
            )}
            {!searching && search.trim() && results.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Sonuç bulunamadı</p>
            )}
            {!searching &&
              results.map((cust) => {
                const already = usedCustomerIds.has(cust.id);
                return (
                  <button
                    key={cust.id}
                    disabled={already || adding}
                    onClick={() => handleAddCustomer(cust)}
                    className={`w-full text-left flex items-center gap-2 p-2 rounded-lg transition-colors ${
                      already ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
                    }`}
                  >
                    <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {cust.company_name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cust.company_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[cust.city, cust.market].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {already ? (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">Panoda</span>
                    ) : (
                      <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            {!search.trim() && (
              <p className="text-center text-sm text-muted-foreground py-6">
                Aramak için firma adı yazın
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerStageId(null)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProcessBoard;

