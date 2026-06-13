import { useState, useEffect } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import { 
  Bell, 
  Building2, 
  Calendar,
  ExternalLink,
  MoreHorizontal,
  X,
  Check
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Followups = () => {
  const { openCustomerModal } = useCustomerModal();
  const [followups, setFollowups] = useState({ customers: [], visits: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFollowups();
  }, []);

  const fetchFollowups = async () => {
    try {
      const response = await axios.get(`${API}/followups`);
      setFollowups(response.data);
    } catch (error) {
      console.error("Follow-up'lar yüklenirken hata:", error);
      toast.error("Follow-up'lar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCustomerFollowup = async (customerId) => {
    try {
      await axios.patch(`${API}/customers/${customerId}/followup?is_followup=false`);
      toast.success("Follow-up kaldırıldı");
      fetchFollowups();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const handleRemoveVisitFollowup = async (visitId) => {
    try {
      await axios.patch(`${API}/visits/${visitId}/followup?is_followup=false`);
      toast.success("Follow-up kaldırıldı");
      fetchFollowups();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      "Çalışılıyor": "bg-emerald-100 text-emerald-800 border-emerald-200",
      "Beklemede": "bg-amber-100 text-amber-800 border-amber-200",
      "Takip Ediliyor": "bg-blue-100 text-blue-800 border-blue-200",
      "Olumsuz": "bg-rose-100 text-rose-800 border-rose-200"
    };
    return colors[status] || "bg-muted text-foreground border-border";
  };

  const getVisitTypeColor = (type) => {
    const colors = {
      "Yüz Yüze": "bg-emerald-100 text-emerald-800",
      "Online": "bg-blue-100 text-blue-800",
      "Telefon": "bg-purple-100 text-purple-800"
    };
    return colors[type] || "bg-muted text-foreground";
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  const totalFollowups = followups.customers.length + followups.visits.length;

  return (
    <div data-testid="followups-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Follow-up</h1>
          <p className="page-subtitle">{totalFollowups} takip bekliyor</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Müşteriler
              {followups.customers.length > 0 && (
                <Badge className="ml-1 bg-amber-100 text-amber-800">
                  {followups.customers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="visits" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Ziyaretler
              {followups.visits.length > 0 && (
                <Badge className="ml-1 bg-amber-100 text-amber-800">
                  {followups.visits.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Customer Follow-ups */}
          <TabsContent value="customers">
            {followups.customers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {followups.customers.map((customer) => (
                  <Card 
                    key={customer.id} 
                    className="border-border hover:shadow-md transition-shadow"
                    data-testid={`customer-followup-${customer.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-muted rounded-lg">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle 
                              className="text-base font-semibold cursor-pointer hover:text-primary transition-colors"
                              onClick={() => openCustomerModal(customer.id)}
                              title="Müşteri detayını aç"
                            >
                              {customer.company_name}
                            </CardTitle>
                            {customer.contact_info?.contact_person && (
                              <p className="text-sm text-muted-foreground">
                                {customer.contact_info.contact_person}
                              </p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleRemoveCustomerFollowup(customer.id)}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Tamamlandı
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRemoveCustomerFollowup(customer.id)}
                              className="text-muted-foreground"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Kaldır
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={`${getStatusColor(customer.status)} border`}>
                            {customer.status}
                          </Badge>
                          {customer.market && (
                            <Badge className="bg-emerald-100 text-emerald-800">
                              {customer.market}
                            </Badge>
                          )}
                        </div>
                        
                        {customer.next_followup_date && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {new Date(customer.next_followup_date).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        )}

                        {customer.website && (
                          <a 
                            href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:text-primary mt-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="truncate">{customer.website}</span>
                          </a>
                        )}

                        {customer.notes && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {customer.notes}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Müşteri follow-up yok</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Müşteri listesinden follow-up ekleyebilirsiniz
                </p>
              </div>
            )}
          </TabsContent>

          {/* Visit Follow-ups */}
          <TabsContent value="visits">
            {followups.visits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {followups.visits.map((visit) => (
                  <Card 
                    key={visit.id} 
                    className="border-border hover:shadow-md transition-shadow"
                    data-testid={`visit-followup-${visit.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Calendar className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold">
                              {visit.customer_name || "Bilinmiyor"}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {visit.visit_date 
                                ? new Date(visit.visit_date).toLocaleDateString('tr-TR')
                                : "—"
                              }
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleRemoveVisitFollowup(visit.id)}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Tamamlandı
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRemoveVisitFollowup(visit.id)}
                              className="text-muted-foreground"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Kaldır
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Badge className={getVisitTypeColor(visit.visit_type)}>
                          {visit.visit_type}
                        </Badge>
                        
                        {visit.outcome && (
                          <p className="text-sm font-medium text-foreground mt-2">
                            Sonuç: {visit.outcome}
                          </p>
                        )}

                        {visit.next_visit_date && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                            <Bell className="w-4 h-4 text-amber-500" />
                            <span>
                              Sonraki: {new Date(visit.next_visit_date).toLocaleDateString('tr-TR')}
                            </span>
                          </div>
                        )}

                        {visit.notes && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {visit.notes}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Ziyaret follow-up yok</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ziyaret listesinden follow-up ekleyebilirsiniz
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Followups;
