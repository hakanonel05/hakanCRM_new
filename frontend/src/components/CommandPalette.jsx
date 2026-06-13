import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "./ui/command";
import {
  LayoutDashboard,
  Users,
  Filter,
  Kanban,
  CalendarDays,
  Calendar,
  Bell,
  FileSpreadsheet,
  Copy,
  User,
  Settings,
  Plus,
  Building2,
} from "lucide-react";
import { useCustomerModal } from "../contexts/CustomerModalContext";
import { useAuth } from "../App";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAGES = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, keywords: "anasayfa genel bakış" },
  { label: "Müşteriler", to: "/customers", icon: Users, keywords: "firma customer" },
  { label: "Filtreler", to: "/filters", icon: Filter, keywords: "filter" },
  { label: "Kanban", to: "/kanban", icon: Kanban, keywords: "pano board" },
  { label: "Takvim", to: "/calendar", icon: CalendarDays, keywords: "calendar" },
  { label: "Ziyaretler", to: "/visits", icon: Calendar, keywords: "visit" },
  { label: "Follow-up", to: "/followups", icon: Bell, keywords: "takip" },
];

const ADMIN_PAGES = [
  { label: "Raporlama", to: "/reports", icon: FileSpreadsheet, keywords: "report" },
  { label: "Yinelenenler", to: "/duplicates", icon: Copy, keywords: "duplicate merge" },
  { label: "Kullanıcılar", to: "/users", icon: User, keywords: "users" },
  { label: "Ayarlar", to: "/settings", icon: Settings, keywords: "settings" },
];

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { openCustomerModal } = useCustomerModal();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef(null);

  // Reset state when closed.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setCustomers([]);
    }
  }, [open]);

  // Debounced customer search.
  useEffect(() => {
    if (!open) return;
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        params.append("search", query);
        params.append("limit", "8");
        params.append("page", "1");
        const { data } = await axios.get(`${API}/customers?${params}`, {
          signal: controller.signal,
        });
        const rows = data?.data || (Array.isArray(data) ? data : []);
        setCustomers(rows);
      } catch (e) {
        if (e?.name !== "CanceledError" && e?.code !== "ERR_CANCELED") {
          console.error(e);
        }
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, open]);

  const allPages = useMemo(
    () => (isAdmin ? [...PAGES, ...ADMIN_PAGES] : PAGES),
    [isAdmin]
  );

  const runCommand = (fn) => {
    onOpenChange(false);
    setTimeout(fn, 50);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Sayfa, müşteri veya komut ara… (en az 2 karakter)"
        value={query}
        onValueChange={setQuery}
        data-testid="command-palette-input"
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Aranıyor…" : query.length >= 2 ? "Sonuç bulunamadı." : "Yazmaya başla."}
        </CommandEmpty>

        {/* Hızlı eylemler */}
        <CommandGroup heading="Hızlı Eylemler">
          <CommandItem
            value="yeni-musteri yeni müşteri ekle add"
            onSelect={() =>
              runCommand(() => {
                navigate("/customers");
                // Customers page picks up `?new=1` to open the add modal.
                window.dispatchEvent(new CustomEvent("crm:open-new-customer"));
              })
            }
            data-testid="cmd-new-customer"
          >
            <Plus className="text-primary" />
            <span>Yeni Müşteri Ekle</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">N</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Sayfalar */}
        <CommandGroup heading="Sayfalar">
          {allPages.map((p) => (
            <CommandItem
              key={p.to}
              value={`${p.label} ${p.keywords || ""}`}
              onSelect={() => runCommand(() => navigate(p.to))}
              data-testid={`cmd-page-${p.label}`}
            >
              <p.icon className="text-muted-foreground" />
              <span>{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Müşteri sonuçları */}
        {customers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Müşteriler (${customers.length})`}>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.company_name} ${c.city || ""} ${c.market || ""}`}
                  onSelect={() => runCommand(() => openCustomerModal(c.id))}
                  data-testid={`cmd-customer-${c.id}`}
                >
                  <Building2 className="text-muted-foreground" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate font-medium">{c.company_name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {[c.city, c.market, c.application].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
