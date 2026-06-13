import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { swrCache } from "../utils/swrCache";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  Bell,
  Users,
  Pencil,
  Trash2,
  ArrowLeft,
  Plus,
  FileText,
  Paperclip,
  Star,
  Save,
  X,
  Clock,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Activity,
  Briefcase,
  Target,
  Package,
  UserPlus,
  CalendarDays
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
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
  DialogFooter,
} from "../components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
import { toast } from "sonner";
import { useAuth } from "../App";
import CustomerEditModal from "../components/CustomerEditModal";
import VisitModal from "../components/VisitModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Call status options from image
const CALL_STATUSES = [
  { value: "Yapıldı", color: "bg-blue-500 text-white" },
  { value: "Olumlu", color: "bg-emerald-100 text-emerald-700" },
  { value: "Olumsuz", color: "bg-red-100 text-red-700" },
  { value: "Aranacak", color: "bg-amber-100 text-amber-700" },
  { value: "Ulaşılamadı", color: "bg-muted text-foreground" }
];

const CustomerDetailPage = ({ customerId: propCustomerId, isModal = false, onClose, onNavigateToFull }) => {
  const params = useParams();
  const id = propCustomerId || params.id;
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [customer, setCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [activeTab, setActiveTab] = useState("activity");
  
  // Notes state
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState("");
  
  // Documents state
  const [documents, setDocuments] = useState([]);
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [addingDoc, setAddingDoc] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Calls state
  const [addingCall, setAddingCall] = useState(false);
  const [editingCallId, setEditingCallId] = useState(null);
  
  // Followup date picker state
  const [followupDateOpen, setFollowupDateOpen] = useState(false);
  const [selectedFollowupDate, setSelectedFollowupDate] = useState(null);
  
  const [newCall, setNewCall] = useState({
    call_date: new Date().toISOString().split("T")[0],
    caller_name: "",
    contact_person: "",
    phone_number: "",
    duration_minutes: 0,
    call_type: "Giden",
    outcome: "Yapıldı",
    notes: "",
    next_action: "",
    next_action_date: ""
  });

  // Contact modal state
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [newContact, setNewContact] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
    is_primary: false
  });

  const fetchCustomer = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/customers/${id}`);
      setCustomer(response.data);
      setNotes(response.data.notes_list || []);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error("Müşteri yüklenirken hata:", error);
      toast.error("Müşteri bulunamadı");
      navigate("/customers");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchVisits = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/visits?customer_id=${id}`);
      setVisits(response.data);
    } catch (error) {
      console.error("Ziyaretler yüklenirken hata:", error);
    }
  }, [id]);

  const fetchCalls = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/calls?customer_id=${id}`);
      setCalls(response.data);
    } catch (error) {
      console.error("Aramalar yüklenirken hata:", error);
    }
  }, [id]);

  useEffect(() => {
    const cacheKey = `customer-detail:${id}`;

    // Paint cached data instantly so modal opens with content visible.
    const cached = swrCache.get(cacheKey);
    if (cached) {
      setCustomer(cached.customer);
      setNotes(cached.customer?.notes_list || []);
      setDocuments(cached.customer?.documents || []);
      setVisits(cached.visits || []);
      setCalls(cached.calls || []);
      setLoading(false);
    }

    const loadData = async () => {
      if (!cached) setLoading(true);
      try {
        // Paralel olarak tüm verileri çek
        const [customerRes, visitsRes, callsRes] = await Promise.all([
          axios.get(`${API}/customers/${id}`),
          axios.get(`${API}/visits?customer_id=${id}`),
          axios.get(`${API}/calls?customer_id=${id}`)
        ]);
        
        setCustomer(customerRes.data);
        setNotes(customerRes.data.notes_list || []);
        setDocuments(customerRes.data.documents || []);
        setVisits(visitsRes.data);
        setCalls(callsRes.data);
        swrCache.set(cacheKey, {
          customer: customerRes.data,
          visits: visitsRes.data,
          calls: callsRes.data,
        });
      } catch (error) {
        console.error("Veriler yüklenirken hata:", error);
        if (!cached) {
          toast.error("Müşteri bulunamadı");
          navigate("/customers");
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!isAdmin) {
      toast.error("Silme yetkisi sadece admin kullanıcılara aittir");
      return;
    }
    if (!window.confirm("Bu müşteriyi silmek istediğinizden emin misiniz?")) return;
    
    try {
      await axios.delete(`${API}/customers/${id}`, { withCredentials: true });
      toast.success("Müşteri silindi");
      navigate("/customers");
    } catch (error) {
      toast.error("Müşteri silinemedi");
    }
  };

  const handleToggleFollowup = async () => {
    if (customer.is_followup) {
      // Takipten çıkar
      try {
        await axios.put(`${API}/customers/${id}`, {
          ...customer,
          is_followup: false,
          next_followup_date: null
        });
        fetchCustomer();
        toast.success("Takipten çıkarıldı");
      } catch (error) {
        toast.error("İşlem başarısız");
      }
    } else {
      // Takibe al - tarih seçici aç
      setSelectedFollowupDate(new Date());
      setFollowupDateOpen(true);
    }
  };

  const handleSetFollowupDate = async () => {
    if (!selectedFollowupDate) {
      toast.error("Lütfen bir tarih seçin");
      return;
    }
    
    try {
      await axios.put(`${API}/customers/${id}`, {
        ...customer,
        is_followup: true,
        next_followup_date: selectedFollowupDate.toISOString().split("T")[0]
      });
      fetchCustomer();
      setFollowupDateOpen(false);
      toast.success(`Takibe alındı - ${selectedFollowupDate.toLocaleDateString("tr-TR")}`);
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    const noteObj = {
      id: crypto.randomUUID(),
      text: newNote,
      created_at: new Date().toISOString(),
      created_by: "user"
    };
    
    const updatedNotes = [...notes, noteObj];
    
    try {
      await axios.put(`${API}/customers/${id}`, {
        ...customer,
        notes_list: updatedNotes
      });
      setNotes(updatedNotes);
      setNewNote("");
      setAddingNote(false);
      toast.success("Not eklendi");
    } catch (error) {
      toast.error("Not eklenemedi");
    }
  };

  // Edit note
  const handleEditNote = async (noteId) => {
    if (!editNoteText.trim()) return;
    
    const updatedNotes = notes.map(n => 
      n.id === noteId ? { ...n, text: editNoteText, updated_at: new Date().toISOString() } : n
    );
    
    try {
      await axios.put(`${API}/customers/${id}`, {
        ...customer,
        notes_list: updatedNotes
      });
      setNotes(updatedNotes);
      setEditingNoteId(null);
      setEditNoteText("");
      toast.success("Not güncellendi");
    } catch (error) {
      toast.error("Not güncellenemedi");
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId) => {
    const updatedNotes = notes.filter(n => n.id !== noteId);
    
    try {
      await axios.put(`${API}/customers/${id}`, {
        ...customer,
        notes_list: updatedNotes
      });
      setNotes(updatedNotes);
      toast.success("Not silindi");
    } catch (error) {
      toast.error("Not silinemedi");
    }
  };

  // Add document (manual link)
  const handleAddDocument = async () => {
    if (!newDocName.trim()) return;
    
    const docObj = {
      id: crypto.randomUUID(),
      name: newDocName,
      url: newDocUrl,
      created_at: new Date().toISOString()
    };
    
    const updatedDocs = [...documents, docObj];
    
    try {
      await axios.put(`${API}/customers/${id}`, {
        ...customer,
        documents: updatedDocs
      });
      setDocuments(updatedDocs);
      setNewDocName("");
      setNewDocUrl("");
      setAddingDoc(false);
      toast.success("Döküman eklendi");
    } catch (error) {
      toast.error("Döküman eklenemedi");
    }
  };

  // Upload file
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await axios.post(`${API}/upload?customer_id=${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      // Refresh customer to get updated documents
      fetchCustomer();
      toast.success("Dosya yüklendi");
    } catch (error) {
      toast.error("Dosya yüklenemedi");
    } finally {
      setUploading(false);
      event.target.value = ""; // Reset input
    }
  };

  // Delete document
  const handleDeleteDocument = async (doc) => {
    if (!window.confirm("Bu dosyayı silmek istediğinizden emin misiniz?")) {
      return;
    }
    
    // If file has stored_name, delete from server
    if (doc.stored_name) {
      try {
        await axios.delete(`${API}/files/${doc.stored_name}?customer_id=${id}`);
        fetchCustomer();
        toast.success("Dosya silindi");
      } catch (error) {
        toast.error("Dosya silinemedi");
      }
    } else {
      // Just remove from documents array
      const updatedDocs = documents.filter(d => d.id !== doc.id);
      
      try {
        await axios.put(`${API}/customers/${id}`, {
          documents: updatedDocs
        });
        setDocuments(updatedDocs);
        toast.success("Döküman silindi");
      } catch (error) {
        toast.error("Döküman silinemedi");
      }
    }
  };

  // Add call
  const handleAddCall = async () => {
    if (!newCall.call_date) {
      toast.error("Tarih zorunludur");
      return;
    }
    
    try {
      if (editingCallId) {
        await axios.put(`${API}/calls/${editingCallId}`, {
          customer_id: id,
          ...newCall
        });
        toast.success("Arama güncellendi");
        setEditingCallId(null);
      } else {
        await axios.post(`${API}/calls`, {
          customer_id: id,
          ...newCall
        });
        toast.success("Arama kaydedildi");
      }
      fetchCalls();
      setNewCall({
        call_date: new Date().toISOString().split("T")[0],
        caller_name: "",
        contact_person: "",
        phone_number: "",
        duration_minutes: 0,
        call_type: "Giden",
        outcome: "Yapıldı",
        notes: "",
        next_action: "",
        next_action_date: ""
      });
      setAddingCall(false);
    } catch (error) {
      toast.error("Arama kaydedilemedi");
    }
  };

  // Edit call
  const startEditCall = (call) => {
    setEditingCallId(call.id);
    setNewCall({
      call_date: call.call_date || new Date().toISOString().split("T")[0],
      caller_name: call.caller_name || "",
      contact_person: call.contact_person || "",
      phone_number: call.phone_number || "",
      duration_minutes: call.duration_minutes || 0,
      call_type: call.call_type || "Giden",
      outcome: call.outcome || "Yapıldı",
      notes: call.notes || "",
      next_action: call.next_action || "",
      next_action_date: call.next_action_date || ""
    });
    setAddingCall(true);
  };

  // Delete call
  const handleDeleteCall = async (callId) => {
    if (!isAdmin) {
      toast.error("Silme yetkisi sadece admin kullanıcılara aittir");
      return;
    }
    
    if (!window.confirm("Bu arama kaydını silmek istediğinizden emin misiniz?")) {
      return;
    }
    
    try {
      await axios.delete(`${API}/calls/${callId}`, { withCredentials: true });
      fetchCalls();
      toast.success("Arama silindi");
    } catch (error) {
      toast.error("Arama silinemedi");
    }
  };

  // Add contact
  const handleAddContact = async () => {
    if (!newContact.name.trim()) {
      toast.error("Kişi adı zorunludur");
      return;
    }
    
    const contactObj = {
      id: crypto.randomUUID(),
      name: newContact.name,
      title: newContact.title,
      email: newContact.email,
      phone: newContact.phone,
      is_primary: newContact.is_primary
    };
    
    const updatedContacts = [...(customer.contacts || []), contactObj];
    
    try {
      await axios.put(`${API}/customers/${id}`, {
        ...customer,
        contacts: updatedContacts
      });
      fetchCustomer();
      setNewContact({ name: "", title: "", email: "", phone: "", is_primary: false });
      setAddContactOpen(false);
      toast.success("Kişi eklendi");
    } catch (error) {
      toast.error("Kişi eklenemedi");
    }
  };

  // Edit contact
  const handleEditContact = async () => {
    if (!editingContact || !editingContact.name.trim()) {
      toast.error("Kişi adı zorunludur");
      return;
    }
    
    const updatedContacts = (customer.contacts || []).map(c => 
      c.id === editingContact.id ? editingContact : c
    );
    
    try {
      await axios.put(`${API}/customers/${id}`, {
        ...customer,
        contacts: updatedContacts
      });
      fetchCustomer();
      setEditingContact(null);
      setSelectedContact(null);
      toast.success("Kişi güncellendi");
    } catch (error) {
      toast.error("Kişi güncellenemedi");
    }
  };

  // Delete contact
  const handleDeleteContact = async (contactId) => {
    if (!window.confirm("Bu kişiyi silmek istediğinizden emin misiniz?")) {
      return;
    }
    
    const updatedContacts = (customer.contacts || []).filter(c => c.id !== contactId);
    
    try {
      await axios.put(`${API}/customers/${id}`, {
        ...customer,
        contacts: updatedContacts
      });
      fetchCustomer();
      setSelectedContact(null);
      setEditingContact(null);
      toast.success("Kişi silindi");
    } catch (error) {
      toast.error("Kişi silinemedi");
    }
  };

  // Build activity timeline
  const getActivityTimeline = () => {
    const activities = [];
    
    visits.forEach(visit => {
      activities.push({
        type: "visit",
        date: visit.visit_date || visit.created_at,
        data: visit
      });
    });
    
    calls.forEach(call => {
      activities.push({
        type: "call",
        date: call.call_date || call.created_at,
        data: call
      });
    });
    
    notes.forEach(note => {
      activities.push({
        type: "note",
        date: note.created_at,
        data: note
      });
    });
    
    return activities.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-medium">Müşteri bilgileri yükleniyor...</p>
          <p className="text-sm text-muted-foreground/70">Lütfen bekleyin</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Müşteri bulunamadı</p>
      </div>
    );
  }

  const timeline = getActivityTimeline();
  const hasContacts = (customer.contact_info?.contact_person) || (customer.contacts && customer.contacts.length > 0);

  return (
    <div data-testid="customer-detail-page" className="h-full">
      {/* Header - Full Width */}
      <div className="bg-card border-b border-border px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isModal && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {customer.company_name?.charAt(0) || "?"}
              </div>
              <div>
                <h1 
                  className={`text-xl font-bold text-foreground flex items-center gap-2 ${isModal ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
                  onClick={isModal ? onNavigateToFull : undefined}
                  title={isModal ? "Tam sayfada aç" : undefined}
                >
                  {customer.company_name || "İsimsiz Firma"}
                  {customer.is_followup && (
                    <Bell className="w-5 h-5 text-amber-500 fill-amber-200" />
                  )}
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {customer.market && <Badge variant="secondary">{customer.market}</Badge>}
                  {customer.city && <span>{customer.city}</span>}
                  {customer.status && (() => {
                    const statusColorMap = {
                      "Beklemede": "bg-amber-100 text-amber-700",
                      "İletişimde": "bg-blue-100 text-primary",
                      "Teklif Verildi": "bg-purple-100 text-purple-700",
                      "Çalışılıyor": "bg-emerald-100 text-emerald-700",
                      "Kazanıldı": "bg-green-100 text-green-700",
                      "Kaybedildi": "bg-red-100 text-red-700",
                    };
                    return <Badge className={statusColorMap[customer.status] || "bg-muted text-foreground"}>{customer.status}</Badge>;
                  })()}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToggleFollowup}>
              <Bell className={`w-4 h-4 mr-1 ${customer.is_followup ? "text-amber-500 fill-amber-500" : ""}`} />
              {customer.is_followup ? "Takipten Çıkar" : "Takibe Al"}
            </Button>
            <Button size="sm" onClick={() => setEditModalOpen(true)}>
              <Pencil className="w-4 h-4 mr-1" />
              Düzenle
            </Button>
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1" />
                Sil
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3 Column Layout - Hubspot Style */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)] overflow-hidden">
        
        {/* LEFT COLUMN - All Customer Info */}
        <div className="col-span-12 lg:col-span-3 overflow-hidden">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-4">
              {/* Company Info */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground/70" />
                  Firma Bilgileri
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Market</Label>
                      <p className="text-sm font-medium">{customer.market || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Uygulama</Label>
                      <p className="text-sm font-medium">{customer.application || "-"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Şehir</Label>
                      <p className="text-sm font-medium">{customer.city || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">İlçe</Label>
                      <p className="text-sm font-medium">{customer.district || "-"}</p>
                    </div>
                  </div>
                  {customer.website && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Web</Label>
                      <a 
                        href={customer.website.startsWith("http") ? customer.website : `https://${customer.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Globe className="w-3 h-3" />
                        {customer.website}
                      </a>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Rakip</Label>
                      <p className="text-sm font-medium">{customer.competitor || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Partner</Label>
                      <p className="text-sm font-medium">{customer.partner || "-"}</p>
                    </div>
                  </div>
                  {customer.products && customer.products.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Ürünler</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {customer.products.map((product, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{product}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground block mb-1">Potansiyel</Label>
                      <Badge className={`block w-fit ${
                        customer.potential_level === "Yüksek" ? "bg-emerald-100 text-emerald-700" :
                        customer.potential_level === "Orta" ? "bg-amber-100 text-amber-700" :
                        "bg-muted text-foreground"
                      }`}>{customer.potential_level || "Düşük"}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground block mb-1">Durum</Label>
                      <Badge className={`block w-fit ${
                        customer.status === "Beklemede" ? "bg-amber-100 text-amber-700" :
                        customer.status === "İletişimde" ? "bg-blue-100 text-primary" :
                        customer.status === "Teklif Verildi" ? "bg-purple-100 text-purple-700" :
                        customer.status === "Çalışılıyor" ? "bg-emerald-100 text-emerald-700" :
                        customer.status === "Kazanıldı" ? "bg-green-100 text-green-700" :
                        customer.status === "Kaybedildi" ? "bg-red-100 text-red-700" :
                        "bg-muted text-foreground"
                      }`}>{customer.status || "Beklemede"}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Takip Eden</Label>
                    <p className="text-sm font-medium">{customer.assigned_to || "-"}</p>
                  </div>
                  {customer.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Açıklama</Label>
                      <p className="text-sm text-foreground">{customer.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Potential Value */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground/70" />
                  Potansiyel Değer
                </h3>
                <p className="text-lg font-bold text-emerald-600">
                  {customer.potential_value ? `₺${customer.potential_value.toLocaleString("tr-TR")}` : "-"}
                </p>
              </div>

              {/* Tags */}
              {customer.tags && customer.tags.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Etiketler</h3>
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.map((tag, idx) => (
                      <Badge key={idx} className="bg-emerald-100 text-emerald-700 text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground/70" />
                  Zaman Çizelgesi
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Oluşturulma</span>
                    <span>{customer.created_at ? new Date(customer.created_at).toLocaleDateString("tr-TR") : "-"}</span>
                  </div>
                  {customer.updated_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Güncelleme</span>
                      <span>{new Date(customer.updated_at).toLocaleDateString("tr-TR")}</span>
                    </div>
                  )}
                  {customer.next_followup_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sonraki Takip</span>
                      <span className="text-amber-600">{new Date(customer.next_followup_date).toLocaleDateString("tr-TR")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground/70" />
                  Özet İstatistikler
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold text-primary">{visits.length}</p>
                    <p className="text-xs text-muted-foreground">Ziyaret</p>
                  </div>
                  <div className="text-center p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold text-emerald-600">{calls.length}</p>
                    <p className="text-xs text-muted-foreground">Arama</p>
                  </div>
                  <div className="text-center p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold text-amber-600">{notes.length}</p>
                    <p className="text-xs text-muted-foreground">Not</p>
                  </div>
                  <div className="text-center p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold text-purple-600">{documents.length}</p>
                    <p className="text-xs text-muted-foreground">Dosya</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* MIDDLE COLUMN - Activity & Tabs */}
        <div className="col-span-12 lg:col-span-6 overflow-hidden">
          <div className="bg-card rounded-xl border border-border h-full flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start border-b rounded-none bg-muted/30 px-4 h-12 flex-shrink-0">
                <TabsTrigger value="activity" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <Activity className="w-4 h-4 mr-2" />
                  Akış
                </TabsTrigger>
                <TabsTrigger value="notes" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <FileText className="w-4 h-4 mr-2" />
                  Notlar ({notes.length})
                </TabsTrigger>
                <TabsTrigger value="calls" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Aramalar ({calls.length})
                </TabsTrigger>
                <TabsTrigger value="visits" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <Calendar className="w-4 h-4 mr-2" />
                  Ziyaretler ({visits.length})
                </TabsTrigger>
                <TabsTrigger value="documents" className="rounded-none data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary">
                  <Paperclip className="w-4 h-4 mr-2" />
                  Dosyalar ({documents.length})
                </TabsTrigger>
              </TabsList>

              {/* Activity Tab */}
              <TabsContent value="activity" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {timeline.length > 0 ? timeline.map((item, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item.type === "visit" ? "bg-blue-100 text-primary" :
                          item.type === "call" ? "bg-emerald-100 text-emerald-600" :
                          "bg-amber-100 text-amber-600"
                        }`}>
                          {item.type === "visit" && <Calendar className="w-4 h-4" />}
                          {item.type === "call" && <PhoneCall className="w-4 h-4" />}
                          {item.type === "note" && <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 bg-muted/30 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {item.type === "visit" && "Ziyaret"}
                              {item.type === "call" && "Arama"}
                              {item.type === "note" && "Not"}
                            </span>
                            <span className="text-xs text-muted-foreground/70">
                              {new Date(item.date).toLocaleDateString("tr-TR")}
                            </span>
                          </div>
                          {item.type === "visit" && (
                            <div>
                              <p className="text-sm font-medium">{item.data.visit_type || "Yüz Yüze"}</p>
                              {item.data.notes && <p className="text-sm text-muted-foreground mt-1">{item.data.notes}</p>}
                              {item.data.outcome && <p className="text-xs text-emerald-600 mt-1">Sonuç: {item.data.outcome}</p>}
                            </div>
                          )}
                          {item.type === "call" && (
                            <div>
                              <div className="flex items-center gap-2">
                                {item.data.call_type === "Gelen" ? <PhoneIncoming className="w-3 h-3 text-blue-500" /> : <PhoneOutgoing className="w-3 h-3 text-emerald-500" />}
                                <span className="text-sm font-medium">{item.data.call_type}</span>
                                {item.data.outcome && (
                                  <Badge className={CALL_STATUSES.find(s => s.value === item.data.outcome)?.color || "bg-muted"}>
                                    {item.data.outcome}
                                  </Badge>
                                )}
                              </div>
                              {item.data.notes && <p className="text-sm text-muted-foreground mt-1">{item.data.notes}</p>}
                            </div>
                          )}
                          {item.type === "note" && <p className="text-sm text-foreground">{item.data.text}</p>}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-12 text-muted-foreground/70">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Henüz aktivite yok</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-foreground">Müşteri Notları</h4>
                      <Button size="sm" onClick={() => setAddingNote(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Not Ekle
                      </Button>
                    </div>
                    
                    {addingNote && (
                      <div className="mb-4 p-4 bg-muted/30 rounded-lg">
                        <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Not yazın..." className="mb-2" rows={3} />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setAddingNote(false)}>İptal</Button>
                          <Button size="sm" onClick={handleAddNote}><Save className="w-4 h-4 mr-1" />Kaydet</Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {notes.length > 0 ? notes.map((note) => (
                        <div key={note.id} className="p-3 bg-muted/30 rounded-lg group">
                          {editingNoteId === note.id ? (
                            <div>
                              <Textarea value={editNoteText} onChange={(e) => setEditNoteText(e.target.value)} className="mb-2" rows={3} />
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => { setEditingNoteId(null); setEditNoteText(""); }}>İptal</Button>
                                <Button size="sm" onClick={() => handleEditNote(note.id)}><Save className="w-4 h-4 mr-1" />Güncelle</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between items-start">
                                <p className="text-foreground whitespace-pre-wrap text-sm flex-1">{note.text}</p>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.text); }}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteNote(note.id)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground/70 mt-2">{new Date(note.created_at).toLocaleString("tr-TR")}</p>
                            </>
                          )}
                        </div>
                      )) : <p className="text-muted-foreground text-center py-8">Henüz not yok</p>}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Calls Tab */}
              <TabsContent value="calls" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-foreground">Arama Kayıtları</h4>
                      <Button size="sm" onClick={() => { setEditingCallId(null); setAddingCall(true); }}>
                        <Plus className="w-4 h-4 mr-1" />
                        Arama Ekle
                      </Button>
                    </div>

                    {addingCall && (
                      <div className="mb-4 p-4 bg-muted/30 rounded-lg space-y-3">
                        {/* Call Status Selection - Like in the image */}
                        <div>
                          <Label className="text-xs mb-2 block">Arama Durumu</Label>
                          <div className="flex flex-wrap gap-2">
                            {CALL_STATUSES.map((status) => (
                              <button
                                key={status.value}
                                onClick={() => setNewCall({ ...newCall, outcome: status.value })}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                  newCall.outcome === status.value ? status.color : "bg-slate-200 text-muted-foreground hover:bg-slate-300"
                                }`}
                              >
                                {status.value}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Call Details Input */}
                        <div className="flex items-center gap-2 bg-card rounded-lg border p-3">
                          <PhoneCall className="w-5 h-5 text-muted-foreground/70" />
                          <Input
                            value={newCall.notes}
                            onChange={(e) => setNewCall({ ...newCall, notes: e.target.value })}
                            placeholder="Arama detaylarını girin..."
                            className="border-0 p-0 focus-visible:ring-0"
                          />
                          <Button onClick={handleAddCall} className="bg-blue-500 hover:bg-primary">
                            <Save className="w-4 h-4 mr-1" />
                            KAYDET
                          </Button>
                        </div>

                        {/* Additional Fields */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Tarih</Label>
                            <Input type="date" value={newCall.call_date} onChange={(e) => setNewCall({ ...newCall, call_date: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-xs">Arama Tipi</Label>
                            <Select value={newCall.call_type} onValueChange={(v) => setNewCall({ ...newCall, call_type: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Giden">Giden Arama</SelectItem>
                                <SelectItem value="Gelen">Gelen Arama</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Arayan</Label>
                            <Input value={newCall.caller_name} onChange={(e) => setNewCall({ ...newCall, caller_name: e.target.value })} placeholder="Adınız" />
                          </div>
                          <div>
                            <Label className="text-xs">Süre (dk)</Label>
                            <Input type="number" value={newCall.duration_minutes} onChange={(e) => setNewCall({ ...newCall, duration_minutes: parseInt(e.target.value) || 0 })} />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => { setAddingCall(false); setEditingCallId(null); }}>İptal</Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {calls.length > 0 ? calls.map((call) => (
                        <div key={call.id} className="p-4 bg-muted/30 rounded-lg group">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${call.call_type === "Gelen" ? "bg-blue-100 text-primary" : "bg-emerald-100 text-emerald-600"}`}>
                                {call.call_type === "Gelen" ? <PhoneIncoming className="w-5 h-5" /> : <PhoneOutgoing className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{call.call_type} Arama</span>
                                  {call.outcome && (
                                    <Badge className={CALL_STATUSES.find(s => s.value === call.outcome)?.color || "bg-muted"}>
                                      {call.outcome}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {call.call_date ? new Date(call.call_date).toLocaleDateString("tr-TR") : "-"}
                                  {call.caller_name && ` • ${call.caller_name}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditCall(call)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteCall(call.id)}>
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {call.notes && <p className="text-sm text-muted-foreground mt-2 ml-13">{call.notes}</p>}
                        </div>
                      )) : (
                        <div className="text-center py-8 text-muted-foreground/70">
                          <PhoneCall className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Henüz arama kaydı yok</p>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Visits Tab */}
              <TabsContent value="visits" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-foreground">Ziyaret Geçmişi</h4>
                      <Button size="sm" onClick={() => { setEditingVisit(null); setVisitModalOpen(true); }}>
                        <Plus className="w-4 h-4 mr-1" />
                        Ziyaret Ekle
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {visits.length > 0 ? visits.map((visit) => (
                        <div key={visit.id} className="p-4 bg-muted/30 rounded-lg group">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground/70" />
                              <span className="font-medium text-sm">
                                {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString("tr-TR") : "-"}
                              </span>
                              <Badge className="text-xs">{visit.visit_type || "Yüz Yüze"}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              {visit.is_followup && <Bell className="w-4 h-4 text-amber-500" />}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingVisit(visit); setVisitModalOpen(true); }}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          {visit.notes && <p className="text-muted-foreground text-sm">{visit.notes}</p>}
                          {visit.outcome && <p className="text-sm text-emerald-600 mt-1">Sonuç: {visit.outcome}</p>}
                        </div>
                      )) : (
                        <div className="text-center py-8 text-muted-foreground/70">
                          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Henüz ziyaret yok</p>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-foreground">Dökümanlar & Dosyalar</h4>
                      <div className="flex gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploading}
                          />
                          <Button size="sm" variant="outline" asChild disabled={uploading}>
                            <span>
                              {uploading ? (
                                <>Yükleniyor...</>
                              ) : (
                                <>
                                  <Paperclip className="w-4 h-4 mr-1" />
                                  Dosya Yükle
                                </>
                              )}
                            </span>
                          </Button>
                        </label>
                        <Button size="sm" onClick={() => setAddingDoc(true)}>
                          <Plus className="w-4 h-4 mr-1" />
                          Link Ekle
                        </Button>
                      </div>
                    </div>

                    {addingDoc && (
                      <div className="mb-4 p-4 bg-muted/30 rounded-lg space-y-3">
                        <Input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="Döküman adı" />
                        <Input value={newDocUrl} onChange={(e) => setNewDocUrl(e.target.value)} placeholder="Link (opsiyonel)" />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setAddingDoc(false)}>İptal</Button>
                          <Button size="sm" onClick={handleAddDocument}><Save className="w-4 h-4 mr-1" />Kaydet</Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {documents.length > 0 ? documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group">
                          <div className="flex items-center gap-3">
                            <Paperclip className="w-4 h-4 text-muted-foreground/70" />
                            <div>
                              {doc.url ? (
                                <a 
                                  href={doc.url.startsWith("/api") ? `${process.env.REACT_APP_BACKEND_URL}${doc.url}` : doc.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-primary hover:underline font-medium text-sm"
                                >
                                  {doc.name}
                                </a>
                              ) : (
                                <span className="font-medium text-foreground text-sm">{doc.name}</span>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                                <span>{new Date(doc.created_at).toLocaleDateString("tr-TR")}</span>
                                {doc.size && <span>• {(doc.size / 1024).toFixed(1)} KB</span>}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteDocument(doc)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )) : (
                        <div className="text-center py-8 text-muted-foreground/70">
                          <Paperclip className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Henüz döküman yok</p>
                          <p className="text-xs mt-1">Dosya yükleyin veya link ekleyin</p>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* RIGHT COLUMN - Contacts */}
        <div className="col-span-12 lg:col-span-3 overflow-hidden">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-4">
              {/* Primary Contact */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground/70" />
                  Ana İletişim
                </h3>
                
                {customer.contact_info && (customer.contact_info.contact_person || customer.contact_info.phone || customer.contact_info.email) ? (
                  <div className="space-y-2">
                    {customer.contact_info.contact_person && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-3 h-3 text-muted-foreground/70" />
                        <span className="font-medium">{customer.contact_info.contact_person}</span>
                      </div>
                    )}
                    {customer.contact_info.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-3 h-3 text-muted-foreground/70" />
                        <a href={`tel:${customer.contact_info.phone}`} className="text-primary hover:underline">{customer.contact_info.phone}</a>
                      </div>
                    )}
                    {customer.contact_info.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-3 h-3 text-muted-foreground/70" />
                        <a href={`mailto:${customer.contact_info.email}`} className="text-primary hover:underline">{customer.contact_info.email}</a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/70">İletişim bilgisi yok</p>
                )}
              </div>

              {/* Additional Contacts */}
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Kişiler ({customer.contacts?.length || 0})
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => setAddContactOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Kişi Ekle
                  </Button>
                </div>
                
                {customer.contacts && customer.contacts.length > 0 ? (
                  <div className="space-y-3">
                    {customer.contacts.map((contact, idx) => (
                      <div 
                        key={contact.id || idx} 
                        className="p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => setSelectedContact(contact)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{contact.name}</span>
                          {contact.is_primary && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                        </div>
                        {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}
                        {contact.phone && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
                        {contact.email && <p className="text-xs text-muted-foreground truncate">{contact.email}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground/70">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Henüz kişi eklenmemiş</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Edit Modal */}
      <CustomerEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        customer={customer}
        onSave={() => {
          fetchCustomer();
          setEditModalOpen(false);
        }}
      />

      {/* Visit Modal */}
      <VisitModal
        open={visitModalOpen}
        onClose={() => { setVisitModalOpen(false); setEditingVisit(null); }}
        visit={editingVisit}
        customers={[customer]}
        preselectedCustomerId={id}
        onSave={() => {
          fetchVisits();
          setVisitModalOpen(false);
          setEditingVisit(null);
        }}
      />

      {/* Add Contact Modal */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Yeni Kişi Ekle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>İsim *</Label>
              <Input
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Kişi adı"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Unvan</Label>
              <Input
                value={newContact.title}
                onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                placeholder="Pozisyon/Unvan"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="+90 5XX XXX XX XX"
                className="mt-1"
              />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddContactOpen(false)}>İptal</Button>
            <Button onClick={handleAddContact}>
              <Save className="w-4 h-4 mr-1" />
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Modal */}
      <Dialog open={!!selectedContact && !editingContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Kişi Detayı
            </DialogTitle>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {selectedContact.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    {selectedContact.name}
                    {selectedContact.is_primary && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                  </h3>
                  {selectedContact.title && (
                    <p className="text-muted-foreground">{selectedContact.title}</p>
                  )}
                </div>
              </div>
              
              <div className="border-t pt-4 space-y-3">
                {selectedContact.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Phone className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Telefon</p>
                      <a href={`tel:${selectedContact.phone}`} className="text-primary hover:underline">
                        {selectedContact.phone}
                      </a>
                    </div>
                  </div>
                )}
                
                {selectedContact.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">E-posta</p>
                      <a href={`mailto:${selectedContact.email}`} className="text-primary hover:underline">
                        {selectedContact.email}
                      </a>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingContact({...selectedContact})}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Düzenle
                </Button>
                <Button 
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleDeleteContact(selectedContact.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sil
                </Button>
              </div>
              
              <div className="flex gap-2 pt-2">
                {selectedContact.phone && (
                  <Button 
                    className="flex-1" 
                    onClick={() => window.open(`tel:${selectedContact.phone}`, '_self')}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Ara
                  </Button>
                )}
                {selectedContact.email && (
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => window.open(`mailto:${selectedContact.email}`, '_blank')}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    E-posta Gönder
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Contact Modal */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Kişi Düzenle
            </DialogTitle>
          </DialogHeader>
          {editingContact && (
            <div className="space-y-4 py-4">
              <div>
                <Label>İsim *</Label>
                <Input
                  value={editingContact.name}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  placeholder="Kişi adı"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Unvan</Label>
                <Input
                  value={editingContact.title || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, title: e.target.value })}
                  placeholder="Pozisyon/Unvan"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input
                  value={editingContact.phone || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                  placeholder="+90 5XX XXX XX XX"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>E-posta</Label>
                <Input
                  value={editingContact.email || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  placeholder="email@example.com"
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingContact(null)}>İptal</Button>
                <Button onClick={handleEditContact}>
                  <Save className="w-4 h-4 mr-1" />
                  Kaydet
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Followup Date Picker Dialog */}
      <Dialog open={followupDateOpen} onOpenChange={setFollowupDateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-500" />
              Takip Tarihi Belirle
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              <strong>{customer?.company_name}</strong> için sonraki takip tarihini seçin:
            </p>
            <div className="flex justify-center">
              <CalendarComponent
                mode="single"
                selected={selectedFollowupDate}
                onSelect={setSelectedFollowupDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md border"
              />
            </div>
            {selectedFollowupDate && (
              <p className="text-center mt-4 text-sm text-muted-foreground">
                Seçilen tarih: <strong className="text-amber-600">{selectedFollowupDate.toLocaleDateString("tr-TR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowupDateOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSetFollowupDate} className="bg-amber-500 hover:bg-amber-600">
              <Bell className="w-4 h-4 mr-2" />
              Takibe Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDetailPage;
