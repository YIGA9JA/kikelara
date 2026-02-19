/* ================= auth.js (COOKIE AUTH + CSRF WRAPPER) =================
   ✅ window.apiFetch(path, options) -> credentials:include + CSRF on non-GET
   ✅ Auto-CSRF recovery: if 403 CSRF blocked → rotate once → retry
   ✅ window.checkAuth() -> GET /admin/me once
   ✅ window.adminLogout() -> POST /admin/logout
   ✅ window.adminLogin(password, otp?) -> POST /admin/login then stores csrf
   ✅ Prevents infinite redirect loops by showing real network/CORS errors
========================================================================= */

(function () {
  "use strict";

  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");

  const LOGIN_PAGE = window.ADMIN_LOGIN_URL || "admin-login.html";
  const CSRF_COOKIE_NAME = window.ADMIN_CSRF_COOKIE || "admin_csrf";
  const CSRF_STORAGE_KEY = window.ADMIN_CSRF_STORAGE_KEY || "admin_csrf_ls";

  // Optional: redirect back after login (?next=/admin-orders.html)
  const NEXT_PARAM = "next";

  // In-memory cache (fast)
  let csrfCached = "";

  function onLoginPage() {
    return String(location.pathname || "").toLowerCase().includes("admin-login");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readCookie(name) {
    try {
      const parts = String(document.cookie || "").split(";").map((c) => c.trim());
      for (const p of parts) {
        if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
      }
    } catch {}
    return "";
  }

  function setCsrfToken(token) {
    const t = String(token || "").trim();
    if (!t) return;
    csrfCached = t;
    try { sessionStorage.setItem(CSRF_STORAGE_KEY, t); } catch {}
  }

  function getCsrfToken() {
    if (csrfCached) return csrfCached;

    try {
      const ss = sessionStorage.getItem(CSRF_STORAGE_KEY);
      if (ss) {
        csrfCached = ss;
        return ss;
      }
    } catch {}

    const ck = readCookie(CSRF_COOKIE_NAME);
    if (ck) {
      setCsrfToken(ck);
      return ck;
    }
    return "";
  }

  function clearCsrfToken() {
    csrfCached = "";
    try { sessionStorage.removeItem(CSRF_STORAGE_KEY); } catch {}
  }

  function toUrl(path) {
    const p = String(path || "");
    if (!API_BASE) return p; // will fail, but blocker will explain
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

  async function readJsonSafe(res) {
    try {
      // Some responses can be empty (204)
      const txt = await res.text();
      if (!txt) return {};
      return JSON.parse(txt);
    } catch {
      return {};
    }
  }

  function buildLoginUrl() {
    const url = new URL(LOGIN_PAGE, location.origin);
    // Preserve current page for redirect after login
    if (!onLoginPage()) {
      const next = location.pathname + location.search + location.hash;
      url.searchParams.set(NEXT_PARAM, next);
    }
    return url.toString();
  }

  function showBlocker(title, body) {
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
      width:min(600px,100%);
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
        API_BASE: ${escapeHtml(API_BASE || "(missing)") }<br/>
        Page: ${escapeHtml(location.origin + location.pathname)}
      </div>
    `;

    wrap.appendChild(card);
    document.body.appendChild(wrap);

    document.getElementById("__auth_reload")?.addEventListener("click", () => location.reload());
    document.getElementById("__auth_login")?.addEventListener("click", () => (location.href = buildLoginUrl()));
  }

  async function rotateCsrfOnce() {
    // Only works when already logged in (admin cookie present)
    try {
      const res = await fetch(toUrl("/admin/csrf/rotate"), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        mode: "cors",
      });
      const data = await readJsonSafe(res);
      if (res.ok && data?.success && data?.csrfToken) {
        setCsrfToken(data.csrfToken);
        return true;
      }
    } catch {}
    return false;
  }

  async function apiFetch(path, options = {}) {
    if (!API_BASE) {
      showBlocker(
        "API_BASE is not set",
        "window.API_BASE is missing. Ensure config.js loads BEFORE auth.js on this page."
      );
      throw new Error("API_BASE missing");
    }

    const url = toUrl(path);
    const method = String(options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});

    let body = options.body;

    // JSON body handling
    if (isPlainObject(body)) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }

    // CSRF header for non-GET
    const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);
    if (needsCsrf) {
      const csrf = getCsrfToken();
      if (csrf) headers.set("X-CSRF-Token", csrf);
    }

    // Do not set Content-Type for FormData
    if (isFormData(body)) headers.delete("Content-Type");

    // 1st attempt
    let res = await fetch(url, {
      ...options,
      method,
      headers,
      body,
      credentials: "include",
      cache: "no-store",
      mode: "cors",
    });

    // Auto-recover CSRF once
    // If backend returns 403 and message indicates CSRF, rotate and retry once
    if (needsCsrf && res.status === 403) {
      const data = await readJsonSafe(res);
      const msg = String(data?.message || "").toLowerCase();
      const looksCsrf = msg.includes("csrf");

      if (looksCsrf) {
        const rotated = await rotateCsrfOnce();
        if (rotated) {
          const headers2 = new Headers(options.headers || {});
          let body2 = options.body;

          if (isPlainObject(body2)) {
            if (!headers2.has("Content-Type")) headers2.set("Content-Type", "application/json");
            body2 = JSON.stringify(body2);
          }
          const csrf2 = getCsrfToken();
          if (csrf2) headers2.set("X-CSRF-Token", csrf2);
          if (isFormData(body2)) headers2.delete("Content-Type");

          res = await fetch(url, {
            ...options,
            method,
            headers: headers2,
            body: body2,
            credentials: "include",
            cache: "no-store",
            mode: "cors",
          });
        }
      }
    }

    return res;
  }

  async function checkAuth() {
    try {
      const res = await apiFetch("/admin/me", { method: "GET" });

      if (res.status === 401) {
        if (!onLoginPage()) location.href = buildLoginUrl();
        return false;
      }

      const data = await readJsonSafe(res);

      if (!res.ok || !data?.success) {
        if (!onLoginPage()) location.href = buildLoginUrl();
        return false;
      }

      // Sync CSRF from response (best) or cookie
      if (data?.csrfToken) setCsrfToken(data.csrfToken);
      const ck = readCookie(CSRF_COOKIE_NAME);
      if (ck) setCsrfToken(ck);

      return true;
    } catch (err) {
      // This catches CORS/network errors (TypeError: Failed to fetch)
      showBlocker(
        "Backend not reachable from this page",
        "Your /admin/me request is failing (usually CORS or cross-site cookie blocking). Fix backend CORS + SameSite=None cookies, or host admin on the same domain as the backend."
      );
      return false;
    }
  }

  async function adminLogout() {
    try {
      await apiFetch("/admin/logout", { method: "POST", body: {} });
    } catch {}
    clearCsrfToken();
    location.href = LOGIN_PAGE;
  }

  async function adminLogin(password, otp) {
    const payload = { password: String(password || "") };
    if (otp) payload.otp = String(otp);

    const res = await apiFetch("/admin/login", { method: "POST", body: payload });
    const data = await readJsonSafe(res);

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Login failed");
    }

    // store csrf from response (best), or cookie fallback
    if (data?.csrfToken) setCsrfToken(data.csrfToken);
    const ck = readCookie(CSRF_COOKIE_NAME);
    if (ck) setCsrfToken(ck);

    // redirect to next if present
    try {
      const u = new URL(location.href);
      const next = u.searchParams.get(NEXT_PARAM);
      if (next) {
        location.href = next;
        return true;
      }
    } catch {}

    return true;
  }

  window.apiFetch = apiFetch;
  window.checkAuth = checkAuth;
  window.adminLogout = adminLogout;
  window.adminLogin = adminLogin;
})();
