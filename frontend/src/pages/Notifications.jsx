import { useState, useEffect } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  Settings,
  Calendar,
  Building2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { useAuth } from "../App";
import CustomerDetailCard from "../components/CustomerDetailCard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ total_count: 0, overdue_count: 0, urgent_count: 0 });
  const [notificationDays, setNotificationDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailCardOpen, setDetailCardOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`, { withCredentials: true });
      setNotifications(response.data.notifications || []);
      setStats({
        total_count: response.data.total_count || 0,
        overdue_count: response.data.overdue_count || 0,
        urgent_count: response.data.urgent_count || 0
      });
      setNotificationDays(response.data.notification_days || 3);
    } catch (error) {
      console.error("Bildirimler yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNotificationDays = async (days) => {
    try {
      await axios.patch(`${API}/users/me/notifications?days=${days}`, {}, { withCredentials: true });
      setNotificationDays(days);
      toast.success(`Bildirim süresi ${days} gün olarak ayarlandı`);
      fetchNotifications();
    } catch (error) {
      toast.error("Ayar güncellenemedi");
    }
  };

  const handleNotificationClick = async (notification) => {
    if (notification.customer_id) {
      try {
        const response = await axios.get(`${API}/customers/${notification.customer_id}`);
        setSelectedCustomer(response.data);
        setDetailCardOpen(true);
      } catch (error) {
        toast.error("Müşteri bilgisi alınamadı");
      }
    }
  };

  const getUrgencyStyle = (urgency) => {
    switch (urgency) {
      case "overdue":
        return "bg-red-50 border-red-200 hover:bg-red-100";
      case "urgent":
        return "bg-amber-50 border-amber-200 hover:bg-amber-100";
      default:
        return "bg-blue-50 border-blue-200 hover:bg-blue-100";
    }
  };

  const getUrgencyBadge = (urgency, days) => {
    switch (urgency) {
      case "overdue":
        return <Badge className="bg-red-100 text-red-700">Gecikmiş ({Math.abs(days)} gün)</Badge>;
      case "urgent":
        return <Badge className="bg-amber-100 text-amber-700">{days === 0 ? "Bugün" : `${days} gün kaldı`}</Badge>;
      default:
        return <Badge className="bg-blue-100 text-primary">{days} gün kaldı</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div data-testid="notifications-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Bildirimler</h1>
          <p className="page-subtitle">Yaklaşan takipler ve ziyaretler</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Uyarı süresi:</span>
          <Select value={notificationDays.toString()} onValueChange={(v) => handleUpdateNotificationDays(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 gün önce</SelectItem>
              <SelectItem value="3">3 gün önce</SelectItem>
              <SelectItem value="5">5 gün önce</SelectItem>
              <SelectItem value="7">7 gün önce</SelectItem>
              <SelectItem value="14">14 gün önce</SelectItem>
              <SelectItem value="30">30 gün önce</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total_count}</p>
              <p className="text-sm text-muted-foreground">Toplam Bildirim</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.overdue_count}</p>
              <p className="text-sm text-muted-foreground">Gecikmiş</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.urgent_count}</p>
              <p className="text-sm text-muted-foreground">Acil (1 gün içinde)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4">Tüm Bildirimler</h3>
        
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification, idx) => (
              <div
                key={idx}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${getUrgencyStyle(notification.urgency)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      notification.type === "followup" ? "bg-amber-500" : "bg-blue-500"
                    } text-white`}>
                      {notification.type === "followup" ? (
                        <Bell className="w-5 h-5" />
                      ) : (
                        <Calendar className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{notification.company_name}</p>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                  </div>
                  {getUrgencyBadge(notification.urgency, notification.days_until)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground">Tüm takipler güncel!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Önümüzdeki {notificationDays} gün içinde herhangi bir takip veya ziyaret yok.
            </p>
          </div>
        )}
      </div>

      {/* Customer Detail Card */}
      <CustomerDetailCard
        open={detailCardOpen}
        onClose={() => {
          setDetailCardOpen(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
        onUpdate={fetchNotifications}
      />
    </div>
  );
};

export default Notifications;
