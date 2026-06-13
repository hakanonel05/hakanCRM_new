import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, createContext, useContext, lazy, Suspense } from "react";
import axios from "axios";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import { Toaster } from "./components/ui/sonner";
import "@/App.css";

// Global axios config — send credentials and X-Session-Token header automatically
// This handles browsers that block 3rd-party cookies (Chrome Privacy Sandbox etc.)
axios.defaults.withCredentials = true;
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("crmaster_session_token");
  if (token) {
    config.headers["X-Session-Token"] = token;
  }
  return config;
});
import { CustomerModalProvider } from "./contexts/CustomerModalContext";
import { ThemeProvider } from "./contexts/ThemeContext";

// Lazy load all pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetailPage = lazy(() => import("./pages/CustomerDetailPage"));
const Visits = lazy(() => import("./pages/Visits"));
const Followups = lazy(() => import("./pages/Followups"));
const Kanban = lazy(() => import("./pages/Kanban"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Notifications = lazy(() => import("./pages/Notifications"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const FiltersPage = lazy(() => import("./pages/FiltersPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const DuplicatesPage = lazy(() => import("./pages/DuplicatesPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const TeamMemberDetailPage = lazy(() => import("./pages/TeamMemberDetailPage"));

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="w-8 h-8 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin"></div>
  </div>
);

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!authChecked) {
      checkAuth();
    }
  }, [authChecked]);

  // Once authenticated, eagerly preload the most-used pages in the background.
  // These dynamic imports are cheap because route chunks are small (~10-50kb)
  // and they kick in only after the first render, so they don't slow login.
  useEffect(() => {
    if (!user) return;
    const preload = () => {
      import("./pages/Dashboard");
      import("./pages/Customers");
      import("./pages/Kanban");
      import("./pages/Visits");
      import("./pages/Followups");
    };
    // Use requestIdleCallback when available so we don't fight the main page render.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(preload, 800);
    return () => clearTimeout(t);
  }, [user]);

  const checkAuth = async () => {
    try {
      // First check localStorage - this is the primary auth source
      const stored = localStorage.getItem("crmaster_user");
      if (stored) {
        try {
          const parsedUser = JSON.parse(stored);
          if (parsedUser && parsedUser.email) {
            setUser(parsedUser);
            setLoading(false);
            setAuthChecked(true);
            return; // User found in localStorage, no need to call API
          }
        } catch {
          localStorage.removeItem("crmaster_user");
    localStorage.removeItem("crmaster_session_token");
        }
      }
      
      // Only call API if no localStorage user (for Emergent Auth callback)
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem("crmaster_user", JSON.stringify(userData));
      }
    } catch (error) {
      console.log("Auth check error:", error);
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.removeItem("crmaster_user");
    localStorage.removeItem("crmaster_session_token");
    setUser(null);
  };

  // Helper to check if user is admin (role=admin OR hakanonel05@gmail.com)
  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === "hakanonel05@gmail.com" || user?.is_admin === true;
  // Super admin = ONLY hakanonel05@gmail.com (manually assigned admins do NOT count).
  // Used to gate the User Management page even from other admins.
  const isSuperAdmin = user?.is_super_admin === true || user?.email?.toLowerCase() === "hakanonel05@gmail.com";
  // Permission flags (admin always true). Falls back to per-user permissions from /auth/me
  const perms = user?.permissions || {};
  const canDelete = isAdmin || !!perms.can_delete;
  const canEditDashboard = isAdmin || !!perms.can_edit_dashboard;

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, isAdmin, isSuperAdmin, canDelete, canEditDashboard }}>
      <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Protected routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <CustomerModalProvider>
                    <Layout />
                  </CustomerModalProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
              <Route path="customers" element={<Suspense fallback={<PageLoader />}><Customers /></Suspense>} />
              <Route path="customers/:id" element={<Suspense fallback={<PageLoader />}><CustomerDetailPage /></Suspense>} />
              <Route path="filters" element={<Suspense fallback={<PageLoader />}><FiltersPage /></Suspense>} />
              <Route path="kanban" element={<Suspense fallback={<PageLoader />}><Kanban /></Suspense>} />
              <Route path="calendar" element={<Suspense fallback={<PageLoader />}><CalendarPage /></Suspense>} />
              <Route path="visits" element={<Suspense fallback={<PageLoader />}><Visits /></Suspense>} />
              <Route path="notifications" element={<Suspense fallback={<PageLoader />}><Notifications /></Suspense>} />
              <Route path="followups" element={<Suspense fallback={<PageLoader />}><Followups /></Suspense>} />
              <Route path="team" element={<Suspense fallback={<PageLoader />}><TeamPage /></Suspense>} />
              <Route path="team/:name" element={<Suspense fallback={<PageLoader />}><TeamMemberDetailPage /></Suspense>} />
              <Route path="reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
              <Route path="duplicates" element={<Suspense fallback={<PageLoader />}><DuplicatesPage /></Suspense>} />
              <Route path="users" element={<Suspense fallback={<PageLoader />}><UsersPage /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </div>
      </ThemeProvider>
    </AuthContext.Provider>
  );
}

export default App;
