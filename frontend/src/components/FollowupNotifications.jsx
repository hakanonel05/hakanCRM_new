import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import axios from "axios";
import { Bell, X, Calendar, Building2, Clock, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Notification storage key
const NOTIF_STORAGE_KEY = "crmaster_dismissed_notifications";
const LAST_CHECK_KEY = "crmaster_last_notification_check";

const FollowupNotifications = () => {
  const navigate = useNavigate();
  const { openCustomerModal } = useCustomerModal();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // Keep latest dismissedIds in a ref so fetchFollowups doesn't have to
  // depend on it. Otherwise every dismiss triggers a full refetch + resets
  // the 5-minute interval.
  const dismissedRef = useRef(dismissedIds);
  useEffect(() => {
    dismissedRef.current = dismissedIds;
  }, [dismissedIds]);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    try {
      // Use the lightweight /followups endpoint instead of /customers?limit=5000
      // which forces full pagination across all 3000+ customers.
      const response = await axios.get(`${API}/followups`);
      const customers = response.data?.customers || [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      // Filter customers with upcoming followups
      const followupNotifications = customers
        .filter(c => c.is_followup && c.next_followup_date)
        .map(c => {
          const followupDate = new Date(c.next_followup_date);
          followupDate.setHours(0, 0, 0, 0);
          
          let urgency = "normal";
          let message = "";
          
          if (followupDate < today) {
            urgency = "overdue";
            const daysOverdue = Math.floor((today - followupDate) / (1000 * 60 * 60 * 24));
            message = `${daysOverdue} gün gecikmiş!`;
          } else if (followupDate.getTime() === today.getTime()) {
            urgency = "today";
            message = "Bugün takip edilmeli!";
          } else if (followupDate.getTime() === tomorrow.getTime()) {
            urgency = "tomorrow";
            message = "Yarın takip edilmeli";
          } else if (followupDate <= nextWeek) {
            urgency = "upcoming";
            const daysUntil = Math.floor((followupDate - today) / (1000 * 60 * 60 * 24));
            message = `${daysUntil} gün içinde`;
          } else {
            return null;
          }
          
          return {
            id: c.id,
            customer_id: c.id,
            company_name: c.company_name,
            followup_date: c.next_followup_date,
            urgency,
            message,
            dismissed: dismissedRef.current.includes(c.id)
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          // Sort by urgency: overdue > today > tomorrow > upcoming
          const urgencyOrder = { overdue: 0, today: 1, tomorrow: 2, upcoming: 3 };
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        });
      
      setNotifications(followupNotifications);
      setUnreadCount(followupNotifications.filter(n => !n.dismissed).length);
      
      // Show toast for urgent notifications (only once per session)
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
      const now = new Date().toDateString();
      
      if (lastCheck !== now) {
        const overdueCount = followupNotifications.filter(n => n.urgency === "overdue" && !n.dismissed).length;
        const todayCount = followupNotifications.filter(n => n.urgency === "today" && !n.dismissed).length;
        
        if (overdueCount > 0) {
          toast.error(`${overdueCount} gecikmiş takip var!`, {
            description: "Hemen kontrol edin",
            action: {
              label: "Göster",
              onClick: () => setOpen(true)
            }
          });
        } else if (todayCount > 0) {
          toast.warning(`${todayCount} müşteri bugün takip edilmeli`, {
            action: {
              label: "Göster",
              onClick: () => setOpen(true)
            }
          });
        }
        
        localStorage.setItem(LAST_CHECK_KEY, now);
      }
    } catch (error) {
      console.error("Followup notifications error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowups();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchFollowups, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFollowups]);

  const dismissNotification = (id) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(newDismissed));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const dismissAll = () => {
    const allIds = notifications.map(n => n.id);
    setDismissedIds(allIds);
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(allIds));
    setUnreadCount(0);
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case "overdue": return "bg-red-100 text-red-700 border-red-200";
      case "today": return "bg-amber-100 text-amber-700 border-amber-200";
      case "tomorrow": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-muted text-foreground border-border";
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case "overdue": return "🔴";
      case "today": return "🟡";
      case "tomorrow": return "🔵";
      default: return "⚪";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="notification-bell"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div>
            <h3 className="font-semibold text-foreground">Takip Bildirimleri</h3>
            <p className="text-xs text-muted-foreground">{notifications.length} bekleyen takip</p>
          </div>
          {notifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs"
              onClick={dismissAll}
            >
              Tümünü Kapat
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground/70">
              <div className="w-6 h-6 border-2 border-border border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
              Yükleniyor...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground/70">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Yaklaşan takip yok</p>
              <p className="text-xs mt-1">Tüm takipler güncel</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notif) => (
                <div 
                  key={notif.id}
                  className={`p-3 hover:bg-muted/30 transition-colors ${notif.dismissed ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{getUrgencyIcon(notif.urgency)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                        <span 
                          className="font-medium text-sm text-foreground truncate cursor-pointer hover:text-blue-600"
                          onClick={() => {
                            openCustomerModal(notif.customer_id);
                            setOpen(false);
                          }}
                        >
                          {notif.company_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(notif.followup_date).toLocaleDateString("tr-TR")}</span>
                      </div>
                      <Badge className={`text-xs ${getUrgencyColor(notif.urgency)}`}>
                        <Clock className="w-3 h-3 mr-1" />
                        {notif.message}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => {
                          openCustomerModal(notif.customer_id);
                          setOpen(false);
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      {!notif.dismissed && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground/70 hover:text-muted-foreground"
                          onClick={() => dismissNotification(notif.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 border-t bg-muted/30">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
            onClick={() => {
              navigate("/followups");
              setOpen(false);
            }}
          >
            Tüm Takipleri Gör
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FollowupNotifications;
