// SINGLE SOURCE OF TRUTH for app-wide configuration.
// The super-admin address used to be hardcoded in 4 different files; changing
// it meant editing all of them. Now it lives here and can be overridden at
// build time with the REACT_APP_ADMIN_EMAIL environment variable on Netlify.

export const ADMIN_EMAIL = (
  process.env.REACT_APP_ADMIN_EMAIL || "hakanonel05@gmail.com"
).toLowerCase();

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
