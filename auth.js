// auth.js (COOKIE SESSION + CSRF) — HARDENED DROP-IN
// Requires config.js to be loaded first.
//
// ✅ Cookie session auth (credentials include)
// ✅ CSRF header for non-GET requests (cookie first; localStorage fallback)
// ✅ Timeout protection (GET: 20s, writes/uploads: 60s)
// ✅ X-Requested-With header (basic CSRF hardening)
// ✅ no-store caching for admin requests
//
// Exported globals: apiFetch, checkAuth, adminLogout

(() => {
  "use strict";

  const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
  const CSRF_COOKIE_NAME = window.ADMIN_CSRF_COOKIE || "admin_csrf";
  const CSRF_STORAGE_KEY = window.ADMIN_CSRF_STORAGE_KEY || "admin_csrf_ls";

  // Expose for other scripts if needed
  window.API_BASE = API_BASE;
  window.ADMIN_CSRF_COOKIE = CSRF_COOKIE_NAME;
  window.ADMIN_CSRF_STORAGE_KEY = CSRF_STORAGE_KEY;

  function safeDecode(v) {
    try { return decodeURIComponent(v); } catch { return v; }
  }

  /** Read cookie value by name (returns "" if not readable or missing) */
  function readCookie(name) {
    const raw = String(document.cookie || "");
    if (!raw) return "";

    // robust split; handles spaces
    const parts = raw.split(";").map(s => s.trim());
    for (const p of parts) {
      if (p.startsWith(name + "=")) {
        return safeDecode(p.slice(name.length + 1));
      }
    }
    return "";
  }

  /** Read CSRF token from cookie first, then localStorage fallback */
  function getCsrfToken() {
    const fromCookie = readCookie(CSRF_COOKIE_NAME);
    if (fromCookie) return String(fromCookie).trim();

    try {
      const fromLS = localStorage.getItem(CSRF_STORAGE_KEY) || "";
      return String(fromLS).trim();
    } catch {
      return "";
    }
  }

  /** Attach CSRF for non-GET requests */
  function withCsrfHeaders(headersObj) {
    const csrf = getCsrfToken();
    if (!csrf) return headersObj;
    return { ...headersObj, "X-CSRF-Token": csrf };
  }

  function isAbsoluteUrl(s) {
    return /^https?:\/\//i.test(String(s || ""));
  }

  function joinUrl(base, path) {
    const p = String(path || "");
    if (isAbsoluteUrl(p)) return p;
    if (!base) return p; // allows relative if API_BASE not set (but you should set it)
    if (!p.startsWith("/")) return `${base}/${p}`;
    return `${base}${p}`;
  }

  function withTimeout(options, ms) {
    // If caller already supplied a signal, don’t override
    if (options.signal) return { options, cleanup: () => {} };

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);

    return {
      options: { ...options, signal: controller.signal },
      cleanup: () => clearTimeout(t),
    };
  }

  /** Fetch helper that always sends cookies */
  async function apiFetch(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);

    // timeouts: GET 20s, writes/uploads 60s (override with options.timeoutMs)
    const timeoutMs =
      Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs)
      : (method === "GET" ? 20000 : 60000);

    const baseHeaders = { ...(options.headers || {}) };

    // Default Accept; do NOT force Content-Type (FormData must set it automatically)
    if (!("Accept" in baseHeaders)) baseHeaders["Accept"] = "application/json";

    // helpful signal to backend that this is an AJAX request
    baseHeaders["X-Requested-With"] = "XMLHttpRequest";

    const headers = needsCsrf ? withCsrfHeaders(baseHeaders) : baseHeaders;

    const url = joinUrl(API_BASE, path);

    const { options: opts2, cleanup } = withTimeout(options, timeoutMs);

    try {
      return await fetch(url, {
        ...opts2,
        method,
        headers,
        credentials: "include", // ✅ critical for cookie auth
        cache: "no-store",
        redirect: "follow",
        referrerPolicy: "strict-origin-when-cross-origin",
      });
    } finally {
      cleanup();
    }
  }

  /** Guard: redirect to login if not authenticated */
  async function checkAuth() {
    try {
      const res = await apiFetch("/admin/me", { method: "GET" });
      // some backends return 200 with {success:false}; handle both safely:
      if (!res.ok) throw new Error("not authed");
      const data = await res.json().catch(() => ({}));
      if (data && typeof data === "object" && "success" in data && !data.success) {
        throw new Error("not authed");
      }
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

  // Export globals explicitly (safer across bundlers / strict scopes)
  window.apiFetch = apiFetch;
  window.checkAuth = checkAuth;
  window.adminLogout = adminLogout;
})();
