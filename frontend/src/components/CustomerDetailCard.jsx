import { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  Building2, 
  Mail, 
  Phone,
  Globe,
  Calendar,
  Eye,
  Plus,
  Users,
  Pencil,
  Bell,
  MapPin,
  User,
  Briefcase,
  Tag,
  Trash2,
  Star,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import CustomerEditModal from "./CustomerEditModal";
import VisitModal from "./VisitModal";
import { useAuth } from "../App";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomerDetailCard = ({ open, onClose, customer, onUpdate }) => {
  const { isAdmin } = useAuth();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  // Benzer firmalar (pgvector / semantic)
  const [similar, setSimilar] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarLoaded, setSimilarLoaded] = useState(false);

  const fetchSimilar = async () => {
    if (!customer) return;
    setLoadingSimilar(true);
    try {
      const response = await axios.get(`${API}/customers/${customer.id}/similar?limit=10`);
      setSimilar(response.data.results || []);
      setSimilarLoaded(true);
      if (response.data.note) toast.info(response.data.note);
    } catch (error) {
      console.error("Benzer firmalar yüklenirken hata:", error);
      toast.error("Benzer firmalar yüklenemedi");
    } finally {
      setLoadingSimilar(false);
    }
  };
  
  // Contact management
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    is_primary: false
  });

  const fetchVisits = async () => {
    if (!customer) return;
    setLoadingVisits(true);
    try {
      const response = await axios.get(`${API}/visits?customer_id=${customer.id}`);
      setVisits(response.data);
    } catch (error) {
      console.error("Ziyaretler yüklenirken hata:", error);
    } finally {
      setLoadingVisits(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "visits") {
      fetchVisits();
    }
    if (tab === "similar" && !similarLoaded) {
      fetchSimilar();
    }
  };

  const handleToggleFollowup = async () => {
    try {
      await axios.patch(`${API}/customers/${customer.id}/followup?is_followup=${!customer.is_followup}`);
      toast.success(customer.is_followup ? "Follow-up kaldırıldı" : "Follow-up eklendi");
      onUpdate();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim()) {
      toast.error("İsim zorunludur");
      return;
    }

    try {
      const contacts = [...(customer.contacts || []), {
        id: crypto.randomUUID(),
        ...newContact
      }];
      
      await axios.put(`${API}/customers/${customer.id}`, {
        ...customer,
        contacts
      });
      
      toast.success("Kişi eklendi");
      setNewContact({ name: "", role: "", email: "", phone: "", is_primary: false });
      setShowAddContact(false);
      onUpdate();
    } catch (error) {
      toast.error("Kişi eklenemedi");
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!isAdmin) {
      toast.error("Silme yetkisi sadece admin kullanıcılara aittir");
      return;
    }
    if (!window.confirm("Bu kişiyi silmek istediğinizden emin misiniz?")) return;

    try {
      const contacts = (customer.contacts || []).filter(c => c.id !== contactId);
      
      await axios.put(`${API}/customers/${customer.id}`, {
        ...customer,
        contacts
      });
      
      toast.success("Kişi silindi");
      onUpdate();
    } catch (error) {
      toast.error("Kişi silinemedi");
    }
  };

  const handleSetPrimary = async (contactId) => {
    try {
      const contacts = (customer.contacts || []).map(c => ({
        ...c,
        is_primary: c.id === contactId
      }));
      
      await axios.put(`${API}/customers/${customer.id}`, {
        ...customer,
        contacts
      });
      
      toast.success("Birincil kişi güncellendi");
      onUpdate();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      "Çalışılıyor": "bg-status-success-bg text-status-success-fg border-status-success-line",
      "Beklemede": "bg-status-warning-bg text-status-warning-fg border-status-warning-line",
      "Takip Ediliyor": "bg-status-info-bg text-status-info-fg border-status-info-line",
      "Olumsuz": "bg-status-danger-bg text-status-danger-fg border-status-danger-line"
    };
    return colors[status] || "bg-muted text-foreground border-border";
  };

  const getPotentialColor = (level) => {
    const colors = {
      "Yüksek": "bg-status-success-bg text-status-success-fg",
      "Orta": "bg-status-warning-bg text-status-warning-fg",
      "Düşük": "bg-muted text-foreground"
    };
    return colors[level] || "bg-muted text-foreground";
  };

  if (!customer) return null;

  const contactsCount = (customer.contacts?.length || 0) + (customer.contact_info?.contact_person ? 1 : 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0" data-testid="customer-detail-card">
          <DialogHeader className="px-6 py-4 border-b border-border bg-background">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl">
                {customer.company_name?.charAt(0) || "?"}
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  {customer.company_name}
                  {customer.is_followup && (
                    <Bell className="w-4 h-4 text-status-warning-fg" />
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{customer.market || "—"}</p>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)]">
            <div className="p-6">
              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                {customer.contact_info?.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${customer.contact_info.email}`} className="text-status-info-fg hover:underline">
                      {customer.contact_info.email}
                    </a>
                  </div>
                )}
                {customer.contact_info?.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${customer.contact_info.phone}`} className="text-foreground">
                      {customer.contact_info.phone}
                    </a>
                  </div>
                )}
                {customer.website && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a 
                      href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-status-info-fg hover:underline"
                    >
                      {customer.website}
                    </a>
                  </div>
                )}
                {(customer.city || customer.district) && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">
                      {[customer.district, customer.city].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {customer.potential_level && (
                  <Badge className={getPotentialColor(customer.potential_level)}>
                    {customer.potential_level}
                  </Badge>
                )}
                <Badge className={`${getStatusColor(customer.status)} border`}>
                  {customer.status}
                </Badge>
                {customer.partner && (
                  <Badge className="bg-muted text-foreground">
                    {customer.partner}
                  </Badge>
                )}
              </div>

              {/* Application */}
              {customer.application && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-foreground mb-2">Applications:</p>
                  <Badge className="bg-status-success-bg text-status-success-fg border border-status-success-line">
                    {customer.application}
                  </Badge>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => { setActiveTab("visits"); handleTabChange("visits"); }}
                  data-testid="btn-view-visits"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Visits ({visits.length})
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setVisitModalOpen(true)}
                  data-testid="btn-add-visit"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Visit
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setActiveTab("contacts")}
                  data-testid="btn-contacts"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Contacts ({contactsCount})
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setEditModalOpen(true)}
                  data-testid="btn-edit"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="flex-1">
                    <Users className="w-4 h-4 mr-2" />
                    Contacts
                  </TabsTrigger>
                  <TabsTrigger value="visits" className="flex-1">
                    <Calendar className="w-4 h-4 mr-2" />
                    Visits
                  </TabsTrigger>
                  <TabsTrigger value="similar" className="flex-1">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Benzer
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="mt-4">
                  <div className="space-y-4">
                    {customer.contact_info?.contact_person && (
                      <div className="flex items-start gap-3">
                        <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">İletişim Kişisi</p>
                          <p className="text-sm font-medium">{customer.contact_info.contact_person}</p>
                        </div>
                      </div>
                    )}

                    {(customer.competitor || customer.partner) && (
                      <div className="grid grid-cols-2 gap-4">
                        {customer.competitor && (
                          <div className="flex items-start gap-3">
                            <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Rakip</p>
                              <p className="text-sm font-medium">{customer.competitor}</p>
                            </div>
                          </div>
                        )}
                        {customer.partner && (
                          <div className="flex items-start gap-3">
                            <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Partner</p>
                              <p className="text-sm font-medium">{customer.partner}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {customer.potential_value > 0 && (
                      <div className="flex items-start gap-3">
                        <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Potansiyel Değer</p>
                          <p className="text-sm font-medium">{customer.potential_value.toLocaleString('tr-TR')} ₺</p>
                        </div>
                      </div>
                    )}

                    {customer.next_followup_date && (
                      <div className="flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Sonraki Takip</p>
                          <p className="text-sm font-medium">
                            {new Date(customer.next_followup_date).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    )}

                    {customer.products?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">ABB Products</p>
                        <div className="flex flex-wrap gap-1">
                          {customer.products.map(p => (
                            <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {customer.tags?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Etiketler</p>
                        <div className="flex flex-wrap gap-1">
                          {customer.tags.map(t => (
                            <Badge key={t} className="bg-status-info-bg text-status-info-fg text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {customer.notes && (
                      <div className="p-3 bg-background rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Notlar</p>
                        <p className="text-sm text-foreground">{customer.notes}</p>
                      </div>
                    )}

                    {customer.description && (
                      <div className="p-3 bg-background rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Açıklama</p>
                        <p className="text-sm text-foreground">{customer.description}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Contacts Tab */}
                <TabsContent value="contacts" className="mt-4">
                  <div className="space-y-3">
                    {/* Legacy contact */}
                    {customer.contact_info?.contact_person && (
                      <div className="p-3 border border-border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-status-info-bg rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-status-info-fg" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{customer.contact_info.contact_person}</p>
                              <p className="text-sm text-muted-foreground">Ana İletişim</p>
                            </div>
                          </div>
                          <Badge className="bg-status-warning-bg text-status-warning-fg">
                            <Star className="w-3 h-3 mr-1" />
                            Birincil
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1">
                          {customer.contact_info.email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5" />
                              {customer.contact_info.email}
                            </p>
                          )}
                          {customer.contact_info.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5" />
                              {customer.contact_info.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Additional contacts */}
                    {customer.contacts?.map((contact) => (
                      <div key={contact.id} className="p-3 border border-border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-status-info-bg rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-status-info-fg" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{contact.name}</p>
                              {contact.role && <p className="text-sm text-muted-foreground">{contact.role}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {contact.is_primary && (
                              <Badge className="bg-status-warning-bg text-status-warning-fg">
                                <Star className="w-3 h-3 mr-1" />
                                Birincil
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSetPrimary(contact.id)}
                              title="Birincil yap"
                            >
                              <Star className={`w-4 h-4 ${contact.is_primary ? 'text-status-warning-fg fill-status-warning-line' : 'text-muted-foreground'}`} />
                            </Button>
                            {isAdmin ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-status-danger-fg hover:text-status-danger-fg"
                                onClick={() => handleDeleteContact(contact.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary-foreground cursor-not-allowed"
                                disabled
                                title="Silme yetkisi yok"
                              >
                                <ShieldAlert className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 space-y-1">
                          {contact.email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5" />
                              {contact.email}
                            </p>
                          )}
                          {contact.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5" />
                              {contact.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add Contact Form */}
                    {showAddContact ? (
                      <div className="p-4 border-2 border-dashed border-input rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="contact-name">İsim *</Label>
                            <Input
                              id="contact-name"
                              value={newContact.name}
                              onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                              placeholder="Ad Soyad"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact-role">Rol</Label>
                            <Input
                              id="contact-role"
                              value={newContact.role}
                              onChange={(e) => setNewContact({...newContact, role: e.target.value})}
                              placeholder="Satın Alma Müdürü"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact-email">E-posta</Label>
                            <Input
                              id="contact-email"
                              type="email"
                              value={newContact.email}
                              onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                              placeholder="email@firma.com"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact-phone">Telefon</Label>
                            <Input
                              id="contact-phone"
                              value={newContact.phone}
                              onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                              placeholder="+90 555 555 55 55"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowAddContact(false)}>
                            İptal
                          </Button>
                          <Button size="sm" onClick={handleAddContact}>
                            Kişi Ekle
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full border-dashed"
                        onClick={() => setShowAddContact(true)}
                        data-testid="btn-add-contact"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Yeni Kişi Ekle
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* Visits Tab */}
                <TabsContent value="visits" className="mt-4">
                  {loadingVisits ? (
                    <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
                  ) : visits.length > 0 ? (
                    <div className="space-y-3">
                      {visits.map((visit) => (
                        <div key={visit.id} className="p-3 border border-border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={
                              visit.visit_type === "Yüz Yüze" ? "bg-status-success-bg text-status-success-fg" :
                              visit.visit_type === "Online" ? "bg-status-info-bg text-status-info-fg" :
                              "bg-status-info-bg text-status-info-fg"
                            }>
                              {visit.visit_type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(visit.visit_date).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                          {visit.outcome && (
                            <p className="text-sm font-medium mb-1">Sonuç: {visit.outcome}</p>
                          )}
                          {visit.notes && (
                            <p className="text-sm text-muted-foreground">{visit.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Henüz ziyaret kaydı yok
                    </div>
                  )}
                </TabsContent>

                {/* Benzer Firmalar Tab */}
                <TabsContent value="similar" className="mt-4">
                  {loadingSimilar ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Benzer firmalar aranıyor...
                    </div>
                  ) : similar.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-3">
                        Bu firmaya sektör ve faaliyet açısından en yakın müşteriler:
                      </p>
                      {similar.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 border border-border rounded-lg flex items-center justify-between hover:bg-background"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {s.company_name}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {[s.market, s.city].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                          <Badge className="bg-status-info-bg text-status-info-fg shrink-0 ml-3">
                            %{s.similarity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : similarLoaded ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Benzer firma bulunamadı
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Button variant="outline" onClick={fetchSimilar}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Benzer Firmaları Bul
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex justify-between">
            <Button 
              variant={customer.is_followup ? "destructive" : "outline"}
              onClick={handleToggleFollowup}
              data-testid="btn-toggle-followup"
            >
              <Bell className="w-4 h-4 mr-2" />
              {customer.is_followup ? "Follow-up Kaldır" : "Follow-up Ekle"}
            </Button>
            <Button onClick={onClose}>Kapat</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <CustomerEditModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          onUpdate();
        }}
        customer={customer}
      />

      {/* Visit Modal */}
      <VisitModal
        open={visitModalOpen}
        onClose={() => {
          setVisitModalOpen(false);
          fetchVisits();
        }}
        visit={null}
        customers={[customer]}
        preselectedCustomerId={customer.id}
      />
    </>
  );
};

export default CustomerDetailCard;
