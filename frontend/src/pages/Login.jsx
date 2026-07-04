import { useEffect, useState } from "react";
import { getStoredUser, fetchCurrentUser, storeUser } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Users,
  BarChart3,
  Bell,
  Shield,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FEATURES = [
  { icon: Users, text: "Sınırsız müşteri ve kişi takibi" },
  { icon: BarChart3, text: "Anlık raporlar ve analizler" },
  { icon: Bell, text: "Akıllı takip ve hatırlatıcılar" },
  { icon: Shield, text: "Güvenli bulut yedekleme" },
];

const Login = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [slowServer, setSlowServer] = useState(false);

  // Warm up the backend as soon as the login screen mounts (Render free tier
  // sleeps when idle; cold starts take 30-60s). By the time the user types
  // their credentials, the server is usually already awake.
  useEffect(() => {
    fetch(`${API}/health`, { cache: "no-store" }).catch(() => {});
  }, []);

  // If a login request takes more than ~4s, the backend is almost certainly
  // cold-starting — tell the user instead of showing a silent spinner.
  useEffect(() => {
    if (!loading) {
      setSlowServer(false);
      return;
    }
    const t = setTimeout(() => setSlowServer(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (authChecked) return;
    const checkAuth = async () => {
      // Shared logic — same helpers App.js uses (lib/auth.js).
      // IMPORTANT: use a FULL page load (window.location.replace), not SPA
      // navigate(). With navigate(), App's in-memory user state could
      // disagree with localStorage right after logout, and the two pages
      // bounced each other forever (login <-> /). A full reload re-boots App
      // so both sides always read the same source — the loop is impossible.
      if (getStoredUser()) {
        window.location.replace("/");
        return;
      }
      const userData = await fetchCurrentUser();
      if (userData) {
        window.location.replace("/");
        return;
      }
      setChecking(false);
      setAuthChecked(true);
    };
    checkAuth();
  }, [navigate, authChecked]);

  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("E-posta ve şifre gereklidir");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        const userData = await response.json();
        toast.success("Giriş başarılı!");
        storeUser(userData);
        window.location.href = "/";
      } else {
        const data = await response.json();
        toast.error(data.detail || "Giriş başarısız");
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error("Tüm alanları doldurun");
      return;
    }
    if (password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalı");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });
      if (response.ok) {
        const userData = await response.json();
        toast.success("Kayıt başarılı! Hoş geldiniz.");
        storeUser(userData);
        window.location.href = "/";
      } else {
        const data = await response.json();
        toast.error(data.detail || "Kayıt başarısız");
      }
    } catch {
      toast.error("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#002a43" }}>
        <div className="w-10 h-10 border-[3px] border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel — Lumina navy ── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative flex-col overflow-hidden" style={{ background: "#002a43" }}>
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#1b405b]/60 blur-[120px]" />
          <div className="absolute top-1/2 -right-20 w-[400px] h-[400px] rounded-full bg-[#0e2a3d]/50 blur-[100px]" />
          <div className="absolute -bottom-20 left-1/3 w-[350px] h-[350px] rounded-full bg-[#264054]/40 blur-[90px]" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative flex flex-col h-full px-12 xl:px-16 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm tracking-tight">CR</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">CRMaster</span>
          </div>

          {/* Headline */}
          <div className="mt-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a7caeb] animate-pulse" />
              <span className="text-[#a7caeb] text-xs font-medium tracking-wide">CRM Suite v2</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] tracking-tight">
              Müşteri ilişkilerini
              <br />
              <span style={{ color: "#a7caeb" }}>bir adım öne taşı.</span>
            </h1>
            <p className="mt-5 text-white/60 text-base xl:text-lg leading-relaxed max-w-md">
              Müşterilerinizi takip edin, ziyaretleri planlayın ve satış sürecinizi
              kolayca yönetin — her yerden.
            </p>

            {/* Feature list */}
            <ul className="mt-8 space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#a7caeb]" strokeWidth={2} />
                  </span>
                  <span className="text-white/70 text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 pb-2">
            {[
              { val: "∞", label: "Müşteri" },
              { val: "24/7", label: "Erişim" },
              { val: "100%", label: "Güvenli" },
            ].map(({ val, label }) => (
              <div
                key={label}
                className="rounded-xl bg-white/[0.05] border border-white/[0.08] p-4 text-center"
              >
                <div className="text-2xl font-bold" style={{ color: "#a7caeb" }}>{val}</div>
                <div className="text-white/40 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel — glass light ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:px-10"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(211,231,223,0.5) 0%, #f6fafd 50%, rgba(204,229,255,0.4) 100%)"
        }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">CR</span>
          </div>
          <span className="font-bold text-xl text-primary">CRMaster</span>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-primary tracking-tight">
              {mode === "login" ? "Tekrar hoş geldiniz" : "Hesap oluşturun"}
            </h2>
            <p className="text-on-surface-variant text-sm mt-1.5">
              {mode === "login"
                ? "Devam etmek için giriş yapın"
                : "Ücretsiz başlayın, istediğiniz zaman iptal edin"}
            </p>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            data-testid="btn-google-login"
            className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-border bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-foreground text-sm font-medium shadow-sm transition-colors"
          >
            <svg className="w-4.5 h-4.5 flex-shrink-0" style={{width:"18px",height:"18px"}} viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google ile {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white dark:bg-slate-900 text-muted-foreground text-xs font-medium">
                veya e-posta ile devam et
              </span>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={mode === "login" ? handleLocalLogin : handleRegister}
            className="space-y-4"
          >
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">Ad Soyad</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Adınız Soyadınız"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 h-11 rounded-xl"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">E-posta</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Şifre</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-11 rounded-xl"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p className="text-xs text-muted-foreground">En az 6 karakter</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all
                ${loading
                  ? "bg-primary/60 text-white cursor-not-allowed"
                  : "bg-primary hover:opacity-90 text-white shadow-[0_4px_16px_-4px_rgba(0,42,67,0.5)] hover:shadow-[0_6px_20px_-4px_rgba(0,42,67,0.6)] hover:-translate-y-px active:translate-y-0"
                }`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {slowServer && (
              <p className="text-xs text-muted-foreground text-center animate-pulse">
                Sunucu uyandırılıyor, lütfen bekleyin... (ücretsiz sunucu planında ilk açılış 30-60 sn sürebilir)
              </p>
            )}
          </form>

          {/* Mode toggle */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setEmail("");
                setPassword("");
                setName("");
              }}
              className="text-primary hover:opacity-70 font-semibold hover:underline underline-offset-2"
            >
              {mode === "login" ? "Hesap Oluştur" : "Giriş Yap"}
            </button>
          </p>

          {/* Trust badge */}
          <div className="mt-8 flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: "rgba(211,231,223,0.5)", border: "1px solid rgba(211,231,223,0.8)" }}>
            <CheckCircle2 className="w-4 h-4 text-secondary-md flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed" style={{ color: "#50625c" }}>
              Verileriniz şifreli bulut veritabanında güvenle saklanır ve
              yalnızca sizin hesabınızdan erişilebilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
