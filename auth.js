/* ================= auth.js (COOKIE AUTH + CSRF WRAPPER)
   ✅ Works with your server.js (cookie session + csrf)
   ✅ window.apiFetch(path, options) -> credentials:include + CSRF on non-GET
   ✅ window.checkAuth() -> checks /admin/me once
   ✅ window.adminLogout() -> POST /admin/logout
   ✅ window.adminLogin(password) -> POST /admin/login then stores csrf
========================================================== */

(function () {
  "use strict";

  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  const CSRF_STORAGE_KEY = "admin_csrf_token";
  const LOGIN_PAGE = window.ADMIN_LOGIN_URL || "admin-login.html";

  function readCookie(name) {
    try {
      const parts = document.cookie.split(";").map((c) => c.trim());
      for (const p of parts) {
        if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
      }
    } catch {}
    return "";
  }

  function getCsrfToken() {
    const ss = sessionStorage.getItem(CSRF_STORAGE_KEY);
    if (ss) return ss;

    const ck = readCookie(window.ADMIN_CSRF_COOKIE || "admin_csrf");
    if (ck) {
      try { sessionStorage.setItem(CSRF_STORAGE_KEY, ck); } catch {}
      return ck;
    }
    return "";
  }

  function setCsrfToken(token) {
    const t = String(token || "").trim();
    if (!t) return;
    try { sessionStorage.setItem(CSRF_STORAGE_KEY, t); } catch {}
  }

  function clearCsrfToken() {
    try { sessionStorage.removeItem(CSRF_STORAGE_KEY); } catch {}
  }

  function toUrl(path) {
    const p = String(path || "");
    if (!p) return API_BASE;
    if (/^https?:\/\//i.test(p)) return p;
    if (!p.startsWith("/")) return `${API_BASE}/${p}`;
    return `${API_BASE}${p}`;
  }

  function isFormData(x) {
    return typeof FormData !== "undefined" && x instanceof FormData;
  }

  function isPlainObject(x) {
    return x && typeof x === "object" && !Array.isArray(x) && !isFormData(x);
  }

  async function apiFetch(path, options = {}) {
    const url = toUrl(path);
    const method = String(options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});

    let body = options.body;
    if (isPlainObject(body)) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) headers.set("X-CSRF-Token", csrf);
    }

    if (isFormData(body)) headers.delete("Content-Type");

    const res = await fetch(url, {
      ...options,
      method,
      headers,
      body,
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      const onLogin = String(location.pathname || "").toLowerCase().includes("admin-login");
      if (!onLogin) location.href = LOGIN_PAGE;
    }
    return res;
  }

  async function checkAuth() {
    try {
      const res = await apiFetch("/admin/me", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        location.href = LOGIN_PAGE;
        return false;
      }

      const ck = readCookie(window.ADMIN_CSRF_COOKIE || "admin_csrf");
      if (ck) setCsrfToken(ck);

      return true;
    } catch {
      location.href = LOGIN_PAGE;
      return false;
    }
  }

  async function adminLogout() {
    try { await apiFetch("/admin/logout", { method: "POST" }); } catch {}
    clearCsrfToken();
    location.href = LOGIN_PAGE;
  }

  async function adminLogin(password) {
    const payload = { password: String(password || "") };

    const res = await apiFetch("/admin/login", { method: "POST", body: payload });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) throw new Error(data?.message || "Login failed");

    if (data.csrfToken) setCsrfToken(data.csrfToken);

    const ck = readCookie(window.ADMIN_CSRF_COOKIE || "admin_csrf");
    if (ck) setCsrfToken(ck);

    return true;
  }

  window.apiFetch = apiFetch;
  window.checkAuth = checkAuth;
  window.adminLogout = adminLogout;
  window.adminLogin = adminLogin;
})();
