// auth.js (COOKIE SESSION + CSRF)
// Requires config.js to be loaded first.

const API_BASE = (window.API_BASE || "").replace(/\/$/, "");
const CSRF_COOKIE_NAME = window.ADMIN_CSRF_COOKIE || "admin_csrf";

/** Read cookie value by name */
function readCookie(name) {
  const parts = document.cookie.split(";").map(s => s.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return "";
}

/** Attach CSRF for non-GET requests */
function withCsrfHeaders(headers = {}) {
  const csrf = readCookie(CSRF_COOKIE_NAME);
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
  });
}

/** Guard: redirect to login if not authenticated */
async function checkAuth() {
  try {
    const res = await apiFetch("/admin/me", { method: "GET", cache: "no-store" });
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
  location.replace("admin-login.html");
}
