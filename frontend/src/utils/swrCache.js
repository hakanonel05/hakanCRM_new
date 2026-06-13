/**
 * Simple stale-while-revalidate cache backed by sessionStorage.
 *
 * Usage:
 *   const cached = swrCache.get('customers:p1:l15');
 *   if (cached) hydrateInstant(cached);
 *   const fresh = await fetcher();
 *   swrCache.set('customers:p1:l15', fresh);
 *
 * • Persists across same-tab navigation (sessionStorage).
 * • Auto-invalidate after `MAX_AGE_MS` (5 min default).
 * • Pattern-based invalidate for after mutations.
 */

const PREFIX = "crm_swr:";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 min

const isStale = (entry) => !entry || (Date.now() - entry.ts) > MAX_AGE_MS;

export const swrCache = {
  get(key) {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (isStale(entry)) {
        sessionStorage.removeItem(PREFIX + key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },
  set(key, data) {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // Quota exceeded / private-mode — silently ignore.
    }
  },
  /** Invalidate all entries whose key starts with the given prefix. */
  invalidate(prefix = "") {
    try {
      const full = PREFIX + prefix;
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(full)) keys.push(k);
      }
      keys.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  },
  /** Clear everything we own. */
  clear() {
    this.invalidate("");
  },
};

export default swrCache;
