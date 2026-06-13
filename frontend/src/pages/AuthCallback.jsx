import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [error, setError] = useState(null);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // Prevent double processing
    if (processed) return;
    setProcessed(true);

    const processAuth = async () => {
      // Get session_id from URL fragment
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (!sessionIdMatch) {
        console.log("No session_id found, redirecting to login");
        navigate("/login", { replace: true });
        return;
      }

      const sessionId = sessionIdMatch[1];
      console.log("Processing session_id:", sessionId.substring(0, 10) + "...");

      try {
        // Exchange session_id for user data
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
        console.log("Auth successful, user:", user.email);
        
        // Store user and session_token for fallback auth (cookie may be blocked by browser)
        localStorage.setItem("crmaster_user", JSON.stringify(user));
        if (user.session_token) {
          localStorage.setItem("crmaster_session_token", user.session_token);
        }
        
        // Update auth context
        setUser(user);
        
        // Navigate to dashboard
        navigate("/", { replace: true });
      } catch (error) {
        console.error("Auth error:", error);
        setError(error.message);
        // Wait a bit then redirect to login
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 3000);
      }
    };

    processAuth();
  }, [location, navigate, setUser, processed]);

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
