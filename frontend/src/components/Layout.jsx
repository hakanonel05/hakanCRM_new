import { useState, useEffect, memo, useMemo } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Bell,
  LogOut,
  User,
  Kanban,
  CalendarDays,
  Settings,
  ChevronLeft,
  Filter,
  Menu,
  X,
  FileSpreadsheet,
  Copy,
  Search,
  Plus,
} from "lucide-react";
import { useAuth } from "../App";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import FollowupNotifications from "./FollowupNotifications";
import CommandPalette from "./CommandPalette";

/* CRMaster logo mark */
function LogoMark({ size = 36 }) {
  return (
    <div
      className="relative inline-flex items-center justify-center rounded-xl bg-primary text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        boxShadow: "0 4px 14px -4px rgba(0,42,67,0.45)",
      }}
      aria-hidden="true"
    >
      <span className="font-heading text-base tracking-tighter">CR</span>
      <span className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
    </div>
  );
}

const PUBLIC_NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/customers", icon: Users, label: "Müşteriler" },
  { to: "/filters", icon: Filter, label: "Filtreler" },
  { to: "/kanban", icon: Kanban, label: "Kanban" },
  { to: "/calendar", icon: CalendarDays, label: "Takvim" },
  { to: "/visits", icon: Calendar, label: "Ziyaretler" },
  { to: "/followups", icon: Bell, label: "Follow-up" },
];

const ADMIN_NAV = [
  { to: "/reports", icon: FileSpreadsheet, label: "Raporlama" },
  { to: "/duplicates", icon: Copy, label: "Yinelenenler" },
  { to: "/users", icon: User, label: "Kullanıcılar" },
  { to: "/settings", icon: Settings, label: "Ayarlar" },
];

const PREFETCH = {
  "/": () => import("../pages/Dashboard"),
  "/customers": () => import("../pages/Customers"),
  "/filters": () => import("../pages/FiltersPage"),
  "/kanban": () => import("../pages/Kanban"),
  "/calendar": () => import("../pages/CalendarPage"),
  "/visits": () => import("../pages/Visits"),
  "/followups": () => import("../pages/Followups"),
  "/reports": () => import("../pages/ReportsPage"),
  "/duplicates": () => import("../pages/DuplicatesPage"),
  "/users": () => import("../pages/UsersPage"),
  "/settings": () => import("../pages/SettingsPage"),
};
const _prefetched = new Set();
const prefetch = (to) => {
  if (_prefetched.has(to)) return;
  const fn = PREFETCH[to];
  if (fn) {
    _prefetched.add(to);
    fn().catch(() => _prefetched.delete(to));
  }
};

const SidebarItem = memo(function SidebarItem({ to, icon: Icon, label, collapsed, end, isActive }) {
  return (
    <NavLink
      to={to}
      end={end}
      onMouseEnter={() => prefetch(to)}
      onFocus={() => prefetch(to)}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={[
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
        "transition-colors duration-150",
        collapsed ? "justify-center" : "",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-on-surface-variant hover:text-primary hover:bg-white/40 dark:text-gray-400 dark:hover:text-primary dark:hover:bg-white/10",
      ].join(" ")}
      title={collapsed ? label : undefined}
    >
      <Icon
        className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-primary" : ""}`}
        strokeWidth={isActive ? 2.2 : 1.9}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
});

const UserCard = memo(function UserCard({ user, isAdmin, collapsed, onLogout, onSettings }) {
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-full group flex items-center gap-3 p-2 rounded-xl
            hover:bg-white/40 dark:hover:bg-white/10 transition-colors duration-150
            border border-transparent hover:border-white/40 ${collapsed ? "justify-center" : ""}`}
          data-testid="user-profile-trigger"
        >
          <div className="relative shrink-0">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white/40"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-sm ring-2 ring-white/30">
                {initial}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-semibold text-primary truncate">
                  {user?.name || "Kullanıcı"}
                </p>
                {isAdmin && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant truncate">
                {user?.email || ""}
              </p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" sideOffset={8} data-testid="user-profile-menu">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSettings} data-testid="user-menu-settings">
          <Settings className="w-4 h-4 mr-2" />
          Ayarlar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive focus:text-destructive"
          data-testid="btn-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Çıkış Yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  const handleLogoutCb = useMemo(() => async () => {
    await logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const handleSettingsCb = useMemo(() => () => navigate("/settings"), [navigate]);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("crmaster_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem("crmaster_sidebar_collapsed", collapsed ? "1" : "0");
    } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const editable = document.activeElement?.isContentEditable;
      const inField = tag === "input" || tag === "textarea" || editable;

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCmdkOpen((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
        if (inField) return;
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = handleLogoutCb;

  const navItems = useMemo(
    () => isAdmin ? [...PUBLIC_NAV, ...ADMIN_NAV] : PUBLIC_NAV,
    [isAdmin]
  );

  const navItemsWithActive = useMemo(() =>
    navItems.map(item => ({
      ...item,
      isActive: item.end
        ? location.pathname === item.to
        : location.pathname === item.to || location.pathname.startsWith(item.to + "/"),
    })),
    [navItems, location.pathname]
  );

  /* ============ MOBILE LAYOUT ============ */
  if (isMobile) {
    return (
      <div className="min-h-screen text-foreground">
        {/* Ambient blobs */}
        <div className="fixed top-[-10%] left-[-10%] w-80 h-80 bg-[#d3e7df]/50 rounded-full blur-[90px] pointer-events-none z-0" />
        <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-[#cce5ff]/45 rounded-full blur-[110px] pointer-events-none z-0" />

        {/* Mobile Topbar */}
        <header
          className="fixed top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-4 safe-area-top"
          style={{
            background: "rgba(246,250,253,0.75)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "0 1px 16px rgba(0,42,67,0.04)",
          }}
          data-testid="mobile-topbar"
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-xl hover:bg-white/40 transition-colors"
            aria-label="Menü aç"
          >
            <Menu className="w-5 h-5 text-primary" />
          </button>
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="font-heading font-bold text-primary">CRMaster</span>
          </div>
          <div className="flex items-center gap-1">
            <FollowupNotifications />
          </div>
        </header>

        {/* Mobile Sidebar Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          >
            <aside
              className="w-72 h-full flex flex-col animate-slide-in-right"
              style={{
                background: "rgba(246,250,253,0.88)",
                backdropFilter: "blur(24px)",
                borderRight: "1px solid rgba(255,255,255,0.5)",
                boxShadow: "8px 0 40px rgba(0,42,67,0.12)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between p-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.4)" }}
              >
                <div className="flex items-center gap-2.5">
                  <LogoMark size={32} />
                  <div>
                    <span className="font-heading font-bold text-lg text-primary">CRMaster</span>
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">CRM Suite</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/40"
                >
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              {/* Quick add button */}
              <div className="px-4 pt-4">
                <button className="w-full py-2.5 px-4 bg-primary text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" />
                  Yeni Kayıt
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 mt-2" data-stagger>
                <div className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.14em] px-3 py-2">
                  Ana Menü
                </div>
                {navItemsWithActive.filter(i => PUBLIC_NAV.some(p => p.to === i.to)).map((item) => (
                  <SidebarItem key={item.to} {...item} collapsed={false} />
                ))}

                {isAdmin && (
                  <>
                    <div className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.14em] px-3 py-2 mt-4">
                      Yönetim
                    </div>
                    {navItemsWithActive.filter(i => ADMIN_NAV.some(a => a.to === i.to)).map((item) => (
                      <SidebarItem key={item.to} {...item} collapsed={false} />
                    ))}
                  </>
                )}
              </nav>

              <div
                className="p-3 safe-area-bottom"
                style={{ borderTop: "1px solid rgba(255,255,255,0.4)" }}
              >
                <UserCard
                  user={user}
                  isAdmin={isAdmin}
                  collapsed={false}
                  onLogout={handleLogout}
                  onSettings={handleSettingsCb}
                />
              </div>
            </aside>
          </div>
        )}

        <main className="pt-14 relative z-10">
          <Outlet />
        </main>

        <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} />
      </div>
    );
  }

  /* ============ DESKTOP LAYOUT ============ */
  const sidebarWidth = collapsed ? "w-[72px]" : "w-64";

  return (
    <div className="min-h-screen flex text-foreground relative">
      {/* Ambient background blobs — behind everything */}
      <div className="fixed top-[-8%] left-[-6%] w-[420px] h-[420px] bg-[#d3e7df]/50 rounded-full blur-[110px] pointer-events-none z-0" />
      <div className="fixed bottom-[-8%] right-[-6%] w-[520px] h-[520px] bg-[#cce5ff]/45 rounded-full blur-[130px] pointer-events-none z-0" />

      {/* Sidebar */}
      <aside
        className={`${sidebarWidth} shrink-0 h-screen sticky top-0 z-30 flex flex-col transition-[width] duration-200 ease-out`}
        style={{
          background: "rgba(246,250,253,0.72)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          borderRight: "1px solid rgba(255,255,255,0.45)",
          boxShadow: "4px 0 32px rgba(0,42,67,0.06)",
        }}
        data-testid="sidebar"
      >
        {/* Logo + Notifications + Collapse */}
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} h-16 px-4`}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.4)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoMark size={34} />
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-heading font-bold text-primary leading-tight">CRMaster</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider leading-tight">
                  CRM Suite
                </p>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1">
              <FollowupNotifications />
              <button
                onClick={() => setCollapsed(true)}
                className="p-1.5 rounded-xl hover:bg-white/40 transition-colors text-on-surface-variant hover:text-primary"
                aria-label="Daralt"
                data-testid="sidebar-collapse-btn"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Expand button (collapsed state) */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-white/60 shadow-glass flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-colors duration-150"
            aria-label="Genişlet"
            data-testid="sidebar-expand-btn"
          >
            <ChevronLeft className="w-3 h-3 rotate-180" />
          </button>
        )}

        {/* Quick Add CTA */}
        {!collapsed && (
          <div className="px-3 pt-4 pb-2">
            <button className="w-full py-2.5 px-4 bg-primary text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" />
              Yeni Kayıt
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {/* Command palette trigger */}
          {!collapsed ? (
            <button
              type="button"
              onClick={() => setCmdkOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-xl border border-white/40 bg-white/30 hover:bg-white/50 transition-colors duration-150 text-sm text-on-surface-variant hover:text-primary"
              data-testid="cmdk-trigger"
              title="Hızlı arama (⌘K)"
            >
              <Search className="w-4 h-4" />
              <span>Hızlı ara…</span>
              <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border border-outline-variant/40 bg-white/50">
                ⌘K
              </kbd>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCmdkOpen(true)}
              className="w-full flex items-center justify-center px-3 py-2.5 mb-2 rounded-xl hover:bg-white/40 transition-colors duration-150 text-on-surface-variant hover:text-primary"
              title="Hızlı arama (⌘K)"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>
          )}

          {!collapsed && (
            <div className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.14em] px-3 py-2">
              Ana Menü
            </div>
          )}
          {navItemsWithActive.filter(i => PUBLIC_NAV.some(p => p.to === i.to)).map((item) => (
            <SidebarItem key={item.to} {...item} collapsed={collapsed} />
          ))}

          {isAdmin && (
            <>
              {!collapsed && (
                <div className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-[0.14em] px-3 py-2 mt-4">
                  Yönetim
                </div>
              )}
              {navItemsWithActive.filter(i => ADMIN_NAV.some(a => a.to === i.to)).map((item) => (
                <SidebarItem key={item.to} {...item} collapsed={collapsed} />
              ))}
            </>
          )}
        </nav>

        {/* Footer: User card */}
        <div
          className={collapsed ? "p-2" : "p-3"}
          style={{ borderTop: "1px solid rgba(255,255,255,0.4)" }}
        >
          <UserCard
            user={user}
            isAdmin={isAdmin}
            collapsed={collapsed}
            onLogout={handleLogout}
            onSettings={handleSettingsCb}
          />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <main className="flex-1 min-h-0">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} />
    </div>
  );
}
