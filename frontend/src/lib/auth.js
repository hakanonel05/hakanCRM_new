// Shared session helpers. The same "read the stored user from localStorage,
// validate it, fall back to /auth/me" logic used to be copy-pasted in both
// App.js and Login.jsx — any fix had to be made twice. Both now import from
// here.

const USER_KEY = "crmaster_user";
const TOKEN_KEY = "crmaster_session_token";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Returns the locally stored user object, or null. Cleans up corrupt entries.
export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    return user?.email ? user : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

// Persists a freshly authenticated user (+ optional fallback token used by
// the axios interceptor when third-party cookies are blocked).
export function storeUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user?.session_token) {
    localStorage.setItem(TOKEN_KEY, user.session_token);
  }
}

export function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

// Asks the backend who we are (cookie or X-Session-Token). Returns the user
// object on success, null otherwise. Never throws.
export async function fetchCurrentUser() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${API}/auth/me`, {
      credentials: "include",
      headers: token ? { "X-Session-Token": token } : {},
    });
    if (!response.ok) return null;
    const user = await response.json();
    if (user?.email) {
      storeUser(user);
      return user;
    }
    return null;
  } catch {
    return null;
  }
}
