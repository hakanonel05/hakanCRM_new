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
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import CreatableSelect from "./CreatableSelect";
import { 
  AlertTriangle, 
  Building2, 
  X,
  Trash2
} from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = ["Beklemede", "İletişimde", "Teklif Verildi", "Çalışılıyor", "Kazanıldı", "Kaybedildi"];
const POTENTIAL_LEVELS = ["Düşük", "Orta", "Yüksek"];
const ABB_PRODUCTS = [
  "ACS180", "ACS380", "ACS380-E", "ACS480", "ACH480", 
  "ACS580", "ACH580", "ACQ580", "ACS880", "PLC", "Servo", "Others"
];

const CustomerEditModal = ({ open, onClose, customer }) => {
  const [formData, setFormData] = useState({
    company_name: "",
    market: "",
    application: "",
    city: "",
    district: "",
    website: "",
    status: "Beklemede",
    contact_info: {
      contact_person: "",
      email: "",
      phone: ""
    },
    potential_value: 0,
    next_followup_date: "",
    assigned_to: "",
    competitor: "",
    partner: "",
    potential_level: "Düşük",
    products: [],
    description: "",
    notes: "",
    tags: [],
    is_followup: false
  });
  
  const [newTag, setNewTag] = useState("");
  const [similarCustomers, setSimilarCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState({});

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (customer) {
      setFormData({
        ...customer,
        contact_info: customer.contact_info || {
          contact_person: "",
          email: "",
          phone: ""
        },
        products: customer.products || [],
        tags: customer.tags || []
      });
      setSimilarCustomers([]);
    } else {
      resetForm();
    }
  }, [customer, open]);

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/options/grouped`);
      // Response is already grouped by field_name
      if (response.data && typeof response.data === 'object') {
        const grouped = {};
        Object.keys(response.data).forEach(key => {
          grouped[key] = response.data[key].map(o => ({
            value: o.value,
            color: o.color,
            id: o.id
          }));
        });
        setOptions(grouped);
      }
    } catch (error) {
      console.error("Options yüklenirken hata:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: "",
      market: "",
      application: "",
      city: "",
      district: "",
      website: "",
      status: "Beklemede",
      contact_info: {
        contact_person: "",
        email: "",
        phone: ""
      },
      potential_value: 0,
      next_followup_date: "",
      assigned_to: "",
      competitor: "",
      partner: "",
      potential_level: "Düşük",
      products: [],
      description: "",
      notes: "",
      tags: [],
      is_followup: false
    });
    setSimilarCustomers([]);
    setNewTag("");
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContactChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      contact_info: {
        ...prev.contact_info,
        [field]: value
      }
    }));
  };

  const handleProductToggle = (product) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.includes(product)
        ? prev.products.filter(p => p !== product)
        : [...prev.products, product]
    }));
  };

  const handleAddTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag]
      }));
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const handleOptionAdded = () => {
    // Refetch all options when a new one is added
    fetchOptions();
  };

  // Check similarity
  const checkSimilarity = async () => {
    if (!formData.company_name && !formData.contact_info?.phone && !formData.website) {
      setSimilarCustomers([]);
      return;
    }

    try {
      const response = await axios.post(
        `${API}/customers/check-similar${customer ? `?exclude_id=${customer.id}` : ""}`,
        formData
      );
      setSimilarCustomers(response.data);
    } catch (error) {
      console.error("Benzerlik kontrolü hatası:", error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) {
        checkSimilarity();
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.company_name, formData.contact_info?.phone, formData.website, open]);

  const handleSave = async () => {
    if (!formData.company_name.trim()) {
      toast.error("Firma adı zorunludur");
      return;
    }

    setSaving(true);
    try {
      if (customer) {
        await axios.put(`${API}/customers/${customer.id}`, formData);
        toast.success("Müşteri güncellendi");
      } else {
        await axios.post(`${API}/customers`, formData);
        toast.success("Müşteri eklendi");
      }
      onClose();
    } catch (error) {
      toast.error("İşlem başarısız");
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    if (!window.confirm("Bu müşteriyi silmek istediğinizden emin misiniz?")) return;

    try {
      await axios.delete(`${API}/customers/${customer.id}`);
      toast.success("Müşteri silindi");
      onClose();
    } catch (error) {
      toast.error("Silme işlemi başarısız");
    }
  };

  const getSimilarityColor = (score) => {
    if (score >= 90) return "text-red-600 font-bold";
    if (score >= 80) return "text-amber-600 font-semibold";
    return "text-emerald-600";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0" data-testid="customer-edit-modal">
        <DialogHeader className="px-6 py-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Building2 className="w-5 h-5 text-emerald-700" />
            </div>
            {customer ? "Müşteri Düzenle" : "Yeni Müşteri"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Similarity Warning */}
            {similarCustomers.length > 0 && (
              <div className="similarity-warning" data-testid="similarity-warning">
                <div className="flex items-center gap-2 text-amber-800 font-medium">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Benzer müşteriler bulundu!</span>
                </div>
                <div className="mt-2 space-y-2">
                  {similarCustomers.map((similar) => (
                    <div key={similar.customer_id} className="similarity-item">
                      <span className="font-medium">{similar.company_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">({similar.match_type})</span>
                        <span className={getSimilarityColor(similar.similarity_score)}>
                          %{similar.similarity_score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="form-section">
              <h3 className="form-section-title">Temel Bilgiler</h3>
              <div className="form-grid">
                <div className="col-span-2">
                  <Label htmlFor="company_name">Firma Adı *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleInputChange("company_name", e.target.value)}
                    placeholder="Firma adını girin"
                    className="mt-1"
                    data-testid="input-company-name"
                  />
                </div>

                <div>
                  <Label>Market</Label>
                  <div className="mt-1">
                    <CreatableSelect
                      value={formData.market}
                      onChange={(v) => handleInputChange("market", v)}
                      fieldName="market"
                      placeholder="Seçin veya yazın"
                      options={options.market || []}
                      onOptionAdded={handleOptionAdded}
                    />
                  </div>
                </div>

                <div>
                  <Label>Uygulama</Label>
                  <div className="mt-1">
                    <CreatableSelect
                      value={formData.application}
                      onChange={(v) => handleInputChange("application", v)}
                      fieldName="application"
                      placeholder="Seçin veya yazın"
                      options={options.application || []}
                      onOptionAdded={handleOptionAdded}
                    />
                  </div>
                </div>

                <div>
                  <Label>Şehir</Label>
                  <div className="mt-1">
                    <CreatableSelect
                      value={formData.city}
                      onChange={(v) => handleInputChange("city", v)}
                      fieldName="city"
                      placeholder="Seçin veya yazın"
                      options={options.city || []}
                      onOptionAdded={handleOptionAdded}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="district">İlçe</Label>
                  <Input
                    id="district"
                    value={formData.district}
                    onChange={(e) => handleInputChange("district", e.target.value)}
                    placeholder="İlçe"
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="website">Web Sitesi</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleInputChange("website", e.target.value)}
                    placeholder="https://example.com"
                    className="mt-1"
                    data-testid="input-website"
                  />
                </div>

                <div>
                  <Label>Durum</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => handleInputChange("status", v)}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="form-section">
              <h3 className="form-section-title">İletişim Bilgileri</h3>
              <div className="form-grid">
                <div>
                  <Label htmlFor="contact_person">İletişim Kişisi</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_info?.contact_person || ""}
                    onChange={(e) => handleContactChange("contact_person", e.target.value)}
                    placeholder="Ad Soyad"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.contact_info?.email || ""}
                    onChange={(e) => handleContactChange("email", e.target.value)}
                    placeholder="email@example.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.contact_info?.phone || ""}
                    onChange={(e) => handleContactChange("phone", e.target.value)}
                    placeholder="+90 555 555 55 55"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="potential_value">Potansiyel (Rakam)</Label>
                  <Input
                    id="potential_value"
                    type="number"
                    value={formData.potential_value}
                    onChange={(e) => handleInputChange("potential_value", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="next_followup_date">Sonraki Takip Tarihi</Label>
                  <Input
                    id="next_followup_date"
                    type="date"
                    value={formData.next_followup_date}
                    onChange={(e) => handleInputChange("next_followup_date", e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="assigned_to">Takip Eden Kişi</Label>
                  <Input
                    id="assigned_to"
                    value={formData.assigned_to}
                    onChange={(e) => handleInputChange("assigned_to", e.target.value)}
                    placeholder="Kişi adı"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div className="form-section">
              <h3 className="form-section-title">İş Bilgileri</h3>
              <div className="form-grid">
                <div>
                  <Label>Rakip</Label>
                  <div className="mt-1">
                    <CreatableSelect
                      value={formData.competitor}
                      onChange={(v) => handleInputChange("competitor", v)}
                      fieldName="competitor"
                      placeholder="Seçin veya yazın"
                      options={options.competitor || []}
                      onOptionAdded={handleOptionAdded}
                    />
                  </div>
                </div>

                <div>
                  <Label>Partner</Label>
                  <div className="mt-1">
                    <CreatableSelect
                      value={formData.partner}
                      onChange={(v) => handleInputChange("partner", v)}
                      fieldName="partner"
                      placeholder="Seçin veya yazın"
                      options={options.partner || []}
                      onOptionAdded={handleOptionAdded}
                    />
                  </div>
                </div>

                <div>
                  <Label>Potansiyel Seviyesi</Label>
                  <Select 
                    value={formData.potential_level} 
                    onValueChange={(v) => handleInputChange("potential_level", v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POTENTIAL_LEVELS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ABB Products */}
            <div className="form-section">
              <h3 className="form-section-title">ABB Products</h3>
              <div className="checkbox-group">
                {ABB_PRODUCTS.map((product) => (
                  <div key={product} className="flex items-center space-x-2">
                    <Checkbox
                      id={`product-${product}`}
                      checked={formData.products.includes(product)}
                      onCheckedChange={() => handleProductToggle(product)}
                    />
                    <Label 
                      htmlFor={`product-${product}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {product}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Information */}
            <div className="form-section">
              <h3 className="form-section-title">Ek Bilgiler</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Açıklama</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Şirket hakkında kısa açıklama"
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notlar</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Şirket hakkında dahili notlar"
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Etiketler</Label>
                  <div className="flex flex-wrap gap-2 mt-2 mb-2">
                    {formData.tags.map((tag) => (
                      <Badge 
                        key={tag} 
                        className="bg-slate-100 text-slate-800 pr-1 flex items-center gap-1"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:bg-slate-200 rounded p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Yeni etiket ekle"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    />
                    <Button variant="outline" onClick={handleAddTag}>
                      Ekle
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_followup"
                    checked={formData.is_followup}
                    onCheckedChange={(checked) => handleInputChange("is_followup", checked)}
                  />
                  <Label htmlFor="is_followup" className="cursor-pointer">
                    Follow-up olarak işaretle
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="modal-footer">
          <div>
            {customer && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Müşteriyi Sil
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {saving ? "Kaydediliyor..." : (customer ? "Güncelle" : "Ekle")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerEditModal;
