// admin-api.js
// ✅ Matches your backend exactly (COOKIE: admin_session + admin_csrf)

const API_BASE = window.API_BASE || "";

function getCookie(name) {
  const parts = (`; ${document.cookie}`).split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return "";
}

function getCsrfToken() {
  // ✅ backend cookie name
  return getCookie("admin_csrf");
}

async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");

  const isFormData = opts.body instanceof FormData;
  const method = (opts.method || "GET").toUpperCase();
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(method);

  // Only set Content-Type when body isn't FormData
  if (!isFormData && opts.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // ✅ CSRF required for write requests
  if (isWrite) {
    const csrf = getCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    credentials: "include",
  });

  // Parse JSON safely
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// expose globally (so you can use api() anywhere)
window.api = api;
window.getCsrfToken = getCsrfToken;
