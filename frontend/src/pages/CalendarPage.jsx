import { useState, useEffect, useRef } from "react";
import Breadcrumb from "../components/Breadcrumb";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useCustomerModal } from "../contexts/CustomerModalContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const calendarRef = useRef(null);
  const { openCustomerModal } = useCustomerModal();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/calendar-events`);
      setEvents(response.data);
    } catch (error) {
      console.error("Takvim etkinlikleri yüklenirken hata:", error);
      toast.error("Etkinlikler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (info) => {
    const customerId = info.event.extendedProps?.customer_id;
    if (customerId) {
      openCustomerModal(customerId);
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
    <div data-testid="calendar-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Breadcrumb className="mb-1" />
          <h1 className="page-title">Ziyaret Takvimi</h1>
          <p className="page-subtitle">Tüm ziyaretler ve takipler takvim görünümünde</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 sm:gap-4 px-4 sm:px-0 my-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-xs sm:text-sm text-muted-foreground">Yapılan Ziyaret</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-xs sm:text-sm text-muted-foreground">Planlanan Ziyaret</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-xs sm:text-sm text-muted-foreground">Takip</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card rounded-xl border border-border p-2 sm:p-4 mx-2 sm:mx-0 calendar-host">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          eventClick={handleEventClick}
          locale="tr"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek"
          }}
          buttonText={{
            today: "Bugün",
            month: "Ay",
            week: "Hafta"
          }}
          height="auto"
          eventDisplay="block"
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            meridiem: false
          }}
          dayMaxEvents={3}
          moreLinkText={(n) => `+${n} daha`}
        />
      </div>
    </div>
  );
};

export default CalendarPage;
