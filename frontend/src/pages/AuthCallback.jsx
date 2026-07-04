import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";

// Key for remembering which session_id we already exchanged. A session_id can
// be used ONLY ONCE — if this page reloads (service worker churn, user
// refresh, browser restore), retrying the same id fails with 401 and used to
// cause a login bounce loop. With this guard a reload simply routes the user
// to wherever they belong instead of re-attempting the exchange.
const USED_SESSION_KEY = "crmaster_used_session_id";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState(null);
  // useRef (not state) so the guard works even across synchronous re-renders
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const processAuth = async () => {
      // Read session_id from the URL fragment, then IMMEDIATELY strip it from
      // the address bar so any reload of this page can't resubmit it.
      const hash = window.location.hash || "";
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
      if (sessionId) {
        try {
          window.history.replaceState(null, "", "/auth/callback");
        } catch (e) {
          /* ignore */
        }
      }

      const storedUserRaw = localStorage.getItem("crmaster_user");
      let storedUser = null;
      try {
        storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
      } catch (e) {
        storedUser = null;
      }

      // No session_id in URL → nothing to exchange.
      if (!sessionId) {
        navigate(storedUser?.email ? "/" : "/login", { replace: true });
        return;
      }

      // This exact session_id was already exchanged (page got reloaded).
      // Do NOT retry — decide based on whether we're already logged in.
      if (sessionStorage.getItem(USED_SESSION_KEY) === sessionId) {
        navigate(storedUser?.email ? "/" : "/login", { replace: true });
        return;
      }

      try {
        // Mark as used BEFORE the request — even if the tab reloads mid-flight
        // we must never send the same id twice.
        sessionStorage.setItem(USED_SESSION_KEY, sessionId);

        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ session_id: sessionId })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Authentication failed");
        }

        const user = await response.json();

        // Store user and session_token for fallback auth (cookie may be blocked by browser)
        localStorage.setItem("crmaster_user", JSON.stringify(user));
        if (user.session_token) {
          localStorage.setItem("crmaster_session_token", user.session_token);
        }

        // Update auth context and go to the app
        setUser(user);
        navigate("/", { replace: true });
      } catch (err) {
        console.error("Auth error:", err);
        // If a previous login is still valid, don't bounce the user out —
        // this breaks any callback/login loop.
        if (storedUser?.email) {
          navigate("/", { replace: true });
          return;
        }
        setError(err.message);
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 3000);
      }
    };

    processAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center p-8 bg-card rounded-xl shadow-lg max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Giriş Hatası</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">Giriş sayfasına yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Giriş yapılıyor...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
