// SINGLE SOURCE OF TRUTH for app-wide configuration.
// The super-admin address used to be hardcoded in 4 different files; changing
// it meant editing all of them. Now it lives here and can be overridden at
// build time with the REACT_APP_ADMIN_EMAIL environment variable on Netlify.
//
// SECURITY: no hardcoded personal-email fallback. If the env var is missing,
// ADMIN_EMAIL is empty — nobody matches it, so the app fails "closed" (no
// accidental admin) instead of leaking/relying on a fixed address in the
// bundle. A console warning makes a missing env var impossible to miss.
if (!process.env.REACT_APP_ADMIN_EMAIL) {
  // eslint-disable-next-line no-console
  console.warn(
    "REACT_APP_ADMIN_EMAIL ayarlanmamış — Netlify Environment variables'a ekleyip yeniden deploy et. Admin paneli bu env var olmadan çalışmaz."
  );
}

export const ADMIN_EMAIL = (process.env.REACT_APP_ADMIN_EMAIL || "").toLowerCase();

// role=admin OR the super-admin address OR backend-provided is_admin flag
export const isAdminUser = (user) =>
  user?.role === "admin" ||
  user?.is_admin === true ||
  (user?.email || "").toLowerCase() === ADMIN_EMAIL;

// Super admin = ONLY the ADMIN_EMAIL account (manually assigned admins do NOT
// count). Gates user management and permission editing screens.
export const isSuperAdminUser = (user) =>
  user?.is_super_admin === true ||
  (user?.email || "").toLowerCase() === ADMIN_EMAIL;
