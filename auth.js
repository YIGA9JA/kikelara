// auth.js (COOKIE SESSION + CSRF) — REDIRECT-FIRST (ONE LOGIN)
// Requires config.js to be loaded first.

(() => {
  "use strict";

  const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
  const CSRF_COOKIE_NAME = window.ADMIN_CSRF_COOKIE || "admin_csrf";
  const CSRF_STORAGE_KEY = window.ADMIN_CSRF_STORAGE_KEY || "admin_csrf_ls";

  const AUTH_MODE = window.ADMIN_AUTH_MODE || "redirect"; // "modal" | "redirect"
  const LOGIN_URL = window.ADMIN_LOGIN_URL || "admin-login.html";

  let authAlreadyTriggered = false;

  function readCookie(name) {
    const raw = String(document.cookie || "");
    if (!raw) return "";
    const parts = raw.split(";").map(s => s.trim());
    for (const p of parts) {
      if (p.startsWith(name + "=")) {
        try { return decodeURIComponent(p.slice(name.length + 1)); }
        catch { return p.slice(name.length + 1); }
      }
    }
    return "";
  }

  function getCsrfToken() {
    const fromCookie = readCookie(CSRF_COOKIE_NAME);
    if (fromCookie) return String(fromCookie).trim();
    try { return String(localStorage.getItem(CSRF_STORAGE_KEY) || "").trim(); }
    catch { return ""; }
  }

  function withCsrfHeaders(headers = {}) {
    const csrf = getCsrfToken();
    return csrf ? { ...headers, "X-CSRF-Token": csrf } : headers;
  }

  function authRequired() {
    if (authAlreadyTriggered) return;
    authAlreadyTriggered = true;

    if (AUTH_MODE === "modal") {
      window.dispatchEvent(new CustomEvent("admin:auth-required"));
      return;
    }
    location.replace(LOGIN_URL);
  }

  async function apiFetch(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);

    const headersBase = { ...(options.headers || {}) };
    if (!("Accept" in headersBase)) headersBase["Accept"] = "application/json";

    // ❌ Remove this unless server explicitly allows it:
    // headersBase["X-Requested-With"] = "XMLHttpRequest";

    const headers = needsCsrf ? withCsrfHeaders(headersBase) : headersBase;

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      credentials: "include",
      cache: "no-store",
    });

    // ✅ Only treat 401 as "login needed"
    if (res.status === 401) authRequired();

    // ✅ If CSRF blocked (403), force re-login to refresh CSRF cookie/token
    if (res.status === 403) {
      try {
        const data = await res.clone().json();
        const msg = String(data?.message || "");
        if (msg.toLowerCase().includes("csrf")) authRequired();
      } catch {}
    }

    return res;
  }

  async function checkAuth() {
    try {
      const res = await apiFetch("/admin/me", { method: "GET" });
      if (!res.ok) throw new Error("not authed");
      authAlreadyTriggered = false;
      return true;
    } catch {
      authRequired();
      return false;
    }
  }

  async function adminLogout() {
    try { await apiFetch("/admin/logout", { method: "POST" }); } catch {}
    try { localStorage.removeItem(CSRF_STORAGE_KEY); } catch {}

    if (AUTH_MODE === "modal") {
      authAlreadyTriggered = false;
      window.dispatchEvent(new CustomEvent("admin:auth-required"));
      return;
    }
    location.replace(LOGIN_URL);
  }

  window.apiFetch = apiFetch;
  window.checkAuth = checkAuth;
  window.adminLogout = adminLogout;
})();
