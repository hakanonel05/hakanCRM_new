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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const VISIT_TYPES = ["Yüz Yüze", "Online", "Telefon"];

const VisitModal = ({ open, onClose, visit, customers, preselectedCustomerId = null, onSave }) => {
  const [formData, setFormData] = useState({
    customer_id: "",
    contact_person_id: "",
    visited_by: "",
    visit_date: "",
    visit_type: "Yüz Yüze",
    notes: "",
    next_visit_date: "",
    outcome: "",
    is_followup: false
  });
  
  const [saving, setSaving] = useState(false);
  const [selectedCustomerContacts, setSelectedCustomerContacts] = useState([]);

  useEffect(() => {
    if (visit) {
      setFormData({
        customer_id: visit.customer_id || "",
        contact_person_id: visit.contact_person_id || "",
        visited_by: visit.visited_by || "",
        visit_date: visit.visit_date || "",
        visit_type: visit.visit_type || "Yüz Yüze",
        notes: visit.notes || "",
        next_visit_date: visit.next_visit_date || "",
        outcome: visit.outcome || "",
        is_followup: visit.is_followup || false
      });
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit, open, preselectedCustomerId]);

  // Update contacts when customer changes
  useEffect(() => {
    const customerId = formData.customer_id || preselectedCustomerId;
    if (customerId && customers) {
      const selectedCustomer = customers.find(c => c.id === customerId);
      if (selectedCustomer) {
        const contacts = [];
        // Add primary contact from contact_info
        if (selectedCustomer.contact_info?.contact_person) {
          contacts.push({
            id: "primary",
            name: selectedCustomer.contact_info.contact_person,
            phone: selectedCustomer.contact_info.phone || ""
          });
        }
        // Add additional contacts
        if (selectedCustomer.contacts && selectedCustomer.contacts.length > 0) {
          selectedCustomer.contacts.forEach(c => {
            contacts.push({
              id: c.id,
              name: c.name,
              phone: c.phone || ""
            });
          });
        }
        setSelectedCustomerContacts(contacts);
      }
    } else {
      setSelectedCustomerContacts([]);
    }
  }, [formData.customer_id, preselectedCustomerId, customers]);

  const resetForm = () => {
    setFormData({
      customer_id: preselectedCustomerId || "",
      contact_person_id: "",
      visited_by: "",
      visit_date: new Date().toISOString().split('T')[0],
      visit_type: "Yüz Yüze",
      notes: "",
      next_visit_date: "",
      outcome: "",
      is_followup: false
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    // Customer_id can be empty if preselected
    const customerIdToUse = formData.customer_id || preselectedCustomerId;
    
    // Get contact person name for notes
    const selectedContact = selectedCustomerContacts.find(c => c.id === formData.contact_person_id);
    const contactName = selectedContact ? selectedContact.name : "";
    
    const dataToSave = {
      ...formData,
      customer_id: customerIdToUse,
      contact_person_name: contactName
    };

    setSaving(true);
    try {
      if (visit) {
        await axios.put(`${API}/visits/${visit.id}`, dataToSave);
        toast.success("Ziyaret güncellendi");
      } else {
        await axios.post(`${API}/visits`, dataToSave);
        toast.success("Ziyaret eklendi");
      }
      if (onSave) {
        onSave();
      } else {
        onClose();
      }
    } catch (error) {
      toast.error("İşlem başarısız");
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!visit) return;
    if (!window.confirm("Bu ziyareti silmek istediğinizden emin misiniz?")) return;

    try {
      await axios.delete(`${API}/visits/${visit.id}`);
      toast.success("Ziyaret silindi");
      if (onSave) {
        onSave();
      } else {
        onClose();
      }
    } catch (error) {
      toast.error("Silme işlemi başarısız");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="visit-modal">
        <DialogHeader className="pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-700" />
            </div>
            {visit ? "Ziyaret Düzenle" : "Yeni Ziyaret"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div>
            <Label>Müşteri *</Label>
            <Select 
              value={formData.customer_id} 
              onValueChange={(v) => handleInputChange("customer_id", v)}
            >
              <SelectTrigger className="mt-1" data-testid="select-customer">
                <SelectValue placeholder="Müşteri seçin" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Person Selection */}
          {selectedCustomerContacts.length > 0 && (
            <div>
              <Label>Görüşülen Kişi</Label>
              <Select 
                value={formData.contact_person_id} 
                onValueChange={(v) => handleInputChange("contact_person_id", v)}
              >
                <SelectTrigger className="mt-1" data-testid="select-contact-person">
                  <SelectValue placeholder="Kişi seçin (opsiyonel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seçilmedi</SelectItem>
                  {selectedCustomerContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} {contact.phone && `(${contact.phone})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="visit_date">Ziyaret Tarihi *</Label>
              <Input
                id="visit_date"
                type="date"
                value={formData.visit_date}
                onChange={(e) => handleInputChange("visit_date", e.target.value)}
                className="mt-1"
                data-testid="input-visit-date"
              />
            </div>

            <div>
              <Label htmlFor="visited_by">Ziyaret Eden</Label>
              <Input
                id="visited_by"
                value={formData.visited_by}
                onChange={(e) => handleInputChange("visited_by", e.target.value)}
                placeholder="Ziyareti yapan kişi"
                className="mt-1"
                data-testid="input-visited-by"
              />
            </div>
          </div>

          <div>
            <Label>Ziyaret Tipi</Label>
            <Select 
              value={formData.visit_type} 
              onValueChange={(v) => handleInputChange("visit_type", v)}
            >
              <SelectTrigger className="mt-1" data-testid="select-visit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="outcome">Sonuç</Label>
            <Input
              id="outcome"
              value={formData.outcome}
              onChange={(e) => handleInputChange("outcome", e.target.value)}
              placeholder="Ziyaret sonucu"
              className="mt-1"
              data-testid="input-outcome"
            />
          </div>

          <div>
            <Label htmlFor="next_visit_date">Sonraki Ziyaret Tarihi</Label>
            <Input
              id="next_visit_date"
              type="date"
              value={formData.next_visit_date}
              onChange={(e) => handleInputChange("next_visit_date", e.target.value)}
              className="mt-1"
              data-testid="input-next-visit-date"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notlar</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Ziyaret hakkında notlar"
              className="mt-1"
              rows={4}
              data-testid="textarea-notes"
            />
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

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t border-slate-200">
          <div>
            {visit && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                data-testid="btn-delete-visit"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
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
              data-testid="btn-save-visit"
            >
              {saving ? "Kaydediliyor..." : (visit ? "Güncelle" : "Ekle")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VisitModal;
