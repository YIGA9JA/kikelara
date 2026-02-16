// auth.js (COOKIE SESSION + CSRF)
// Requires config.js to be loaded first.
// ✅ Cookie session auth (credentials include)
// ✅ CSRF header for non-GET requests
// ✅ Uses cookie token if readable; falls back to localStorage token from login response

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const CSRF_COOKIE_NAME = window.ADMIN_CSRF_COOKIE || "admin_csrf";
const CSRF_STORAGE_KEY = window.ADMIN_CSRF_STORAGE_KEY || "admin_csrf_ls";

/** Read cookie value by name (returns "" if not readable or missing) */
function readCookie(name) {
  const parts = document.cookie.split(";").map(s => s.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return "";
}

/** Read CSRF token from cookie first, then localStorage fallback */
function getCsrfToken() {
  const fromCookie = readCookie(CSRF_COOKIE_NAME);
  if (fromCookie) return fromCookie;

  try {
    const fromLS = localStorage.getItem(CSRF_STORAGE_KEY) || "";
    return String(fromLS || "").trim();
  } catch {
    return "";
  }
}

/** Attach CSRF for non-GET requests */
function withCsrfHeaders(headers = {}) {
  const csrf = getCsrfToken();
  return csrf ? { ...headers, "X-CSRF-Token": csrf } : headers;
}

/** Fetch helper that always sends cookies */
async function apiFetch(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);

  const headers = {
    ...(options.headers || {}),
    ...(needsCsrf ? withCsrfHeaders() : {}),
  };

  return fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include", // ✅ critical for cookie auth
    cache: "no-store",
  });
}

/** Guard: redirect to login if not authenticated */
async function checkAuth() {
  try {
    const res = await apiFetch("/admin/me", { method: "GET" });
    if (!res.ok) throw new Error("not authed");
    return true;
  } catch {
    location.replace("admin-login.html");
    return false;
  }
}

/** Logout: clears cookies server-side */
async function adminLogout() {
  try {
    await apiFetch("/admin/logout", { method: "POST" });
  } catch {}
  try { localStorage.removeItem(CSRF_STORAGE_KEY); } catch {}
  location.replace("admin-login.html");
}
