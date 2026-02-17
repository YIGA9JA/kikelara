/* ================= auth.js (COOKIE AUTH + CSRF WRAPPER) =================
   ✅ window.apiFetch(path, options) -> credentials:include + CSRF on non-GET
   ✅ window.checkAuth() -> GET /admin/me once
   ✅ window.adminLogout() -> POST /admin/logout
   ✅ window.adminLogin(password, otp?) -> POST /admin/login then stores csrf
   ✅ Prevents infinite redirect loops by showing the real network/CORS error
========================================================================= */

(function () {
  "use strict";

  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");

  const LOGIN_PAGE = window.ADMIN_LOGIN_URL || "admin-login.html";
  const CSRF_COOKIE_NAME = window.ADMIN_CSRF_COOKIE || "admin_csrf";
  const CSRF_STORAGE_KEY = window.ADMIN_CSRF_STORAGE_KEY || "admin_csrf_ls";

  function onLoginPage() {
    return String(location.pathname || "").toLowerCase().includes("admin-login");
  }

  function readCookie(name) {
    try {
      const parts = document.cookie.split(";").map((c) => c.trim());
      for (const p of parts) {
        if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
      }
    } catch {}
    return "";
  }

  function setCsrfToken(token) {
    const t = String(token || "").trim();
    if (!t) return;
    try { sessionStorage.setItem(CSRF_STORAGE_KEY, t); } catch {}
  }

  function getCsrfToken() {
    try {
      const ss = sessionStorage.getItem(CSRF_STORAGE_KEY);
      if (ss) return ss;
    } catch {}

    // fallback: read csrf cookie if it is not HttpOnly
    const ck = readCookie(CSRF_COOKIE_NAME);
    if (ck) {
      setCsrfToken(ck);
      return ck;
    }
    return "";
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

  function showBlocker(title, body) {
    // Don’t stack multiple blockers
    if (document.getElementById("__auth_blocker")) return;

    const wrap = document.createElement("div");
    wrap.id = "__auth_blocker";
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:999999;
      display:grid; place-items:center; padding:18px;
      background:rgba(15,10,6,.55);
    `;
    const card = document.createElement("div");
    card.style.cssText = `
      width:min(560px,100%);
      background:rgba(255,255,255,.94);
      border:1px solid rgba(43,29,18,.14);
      border-radius:18px;
      box-shadow:0 26px 70px rgba(0,0,0,.22);
      padding:16px;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      color:#2b1d12;
    `;

    card.innerHTML = `
      <div style="font-weight:950; font-size:16px; letter-spacing:.01em;">${escapeHtml(title)}</div>
      <div style="margin-top:8px; font-weight:650; color:rgba(43,29,18,.72); line-height:1.4;">
        ${escapeHtml(body)}
      </div>
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
        <button id="__auth_reload" style="border:1px solid rgba(43,29,18,.14); background:rgba(255,255,255,.75); padding:10px 12px; border-radius:12px; font-weight:900; cursor:pointer;">Reload</button>
        <button id="__auth_login" style="border:1px solid rgba(43,29,18,.14); background:linear-gradient(180deg,#EDCC9F,#d9b07c); padding:10px 12px; border-radius:12px; font-weight:950; cursor:pointer;">Go to Login</button>
      </div>
      <div style="margin-top:10px; font-size:12px; color:rgba(43,29,18,.62); font-weight:650;">
        API_BASE: ${escapeHtml(API_BASE)}<br/>
        Page: ${escapeHtml(location.origin + location.pathname)}
      </div>
    `;

    wrap.appendChild(card);
    document.body.appendChild(wrap);

    document.getElementById("__auth_reload")?.addEventListener("click", () => location.reload());
    document.getElementById("__auth_login")?.addEventListener("click", () => (location.href = LOGIN_PAGE));
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

    // CSRF header for non-GET
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) headers.set("X-CSRF-Token", csrf);
    }

    // Do not set Content-Type for FormData
    if (isFormData(body)) headers.delete("Content-Type");

    const res = await fetch(url, {
      ...options,
      method,
      headers,
      body,
      credentials: "include",
      cache: "no-store",
      mode: "cors",
    });

    return res;
  }

  async function checkAuth() {
    try {
      const res = await apiFetch("/admin/me", { method: "GET" });

      // If server says unauthorized, redirect to login
      if (res.status === 401) {
        if (!onLoginPage()) location.href = LOGIN_PAGE;
        return false;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        if (!onLoginPage()) location.href = LOGIN_PAGE;
        return false;
      }

      // Try to keep CSRF synced
      if (data?.csrfToken) setCsrfToken(data.csrfToken);
      const ck = readCookie(CSRF_COOKIE_NAME);
      if (ck) setCsrfToken(ck);

      return true;
    } catch (err) {
      // This is where CORS/network errors show up (TypeError: Failed to fetch)
      showBlocker(
        "Backend not reachable from this page",
        "Your /admin/me request is failing (usually CORS or cross-site cookie blocking). Fix backend CORS + SameSite=None cookies, or host admin on the same domain as the backend."
      );
      return false;
    }
  }

  async function adminLogout() {
    try {
      await apiFetch("/admin/logout", { method: "POST" });
    } catch {}
    clearCsrfToken();
    location.href = LOGIN_PAGE;
  }

  async function adminLogin(password, otp) {
    const payload = { password: String(password || "") };
    if (otp) payload.otp = String(otp);

    const res = await apiFetch("/admin/login", { method: "POST", body: payload });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Login failed");
    }

    // store csrf from response (best), or cookie fallback
    if (data?.csrfToken) setCsrfToken(data.csrfToken);
    const ck = readCookie(CSRF_COOKIE_NAME);
    if (ck) setCsrfToken(ck);

    return true;
  }

  window.apiFetch = apiFetch;
  window.checkAuth = checkAuth;
  window.adminLogout = adminLogout;
  window.adminLogin = adminLogin;
})();
