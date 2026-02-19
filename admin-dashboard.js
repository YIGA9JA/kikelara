/* ================= admin-dashboard.js (AUTHED)
   ✅ Uses config.js + auth.js
   ✅ Checks auth once (cookie session) then loads KPI counts
   ✅ Shows API base in header pill
   ✅ Navigates cards reliably (click + keyboard)
   ✅ ADDED: Featured KPI count via /admin/featured
================================================ */

(async function () {
  "use strict";

  const apiPill = document.getElementById("apiPill");
  const logoutBtn = document.getElementById("logoutBtn");
  const statusLine = document.getElementById("statusLine");

  const kOrders = document.getElementById("kOrders");
  const kPending = document.getElementById("kPending");
  const kProducts = document.getElementById("kProducts");
  const kMessages = document.getElementById("kMessages");
  const kFeatured = document.getElementById("kFeatured"); // ✅ NEW

  const chipOrders = document.getElementById("chipOrders");
  const chipProducts = document.getElementById("chipProducts");
  const chipMessages = document.getElementById("chipMessages");
  const chipFeatured = document.getElementById("chipFeatured"); // ✅ NEW

  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  const apiFetch = window.apiFetch;

  function setStatus(text, type) {
    if (!statusLine) return;
    statusLine.textContent = text || "";
    if (type) statusLine.setAttribute("data-type", type);
    else statusLine.removeAttribute("data-type");
  }

  function fmt(n) {
    const num = Number(n || 0);
    if (!Number.isFinite(num)) return "—";
    return num.toLocaleString();
  }

  function hostLabel(url) {
    try {
      const u = new URL(url);
      return u.host;
    } catch {
      return url || "—";
    }
  }

  if (apiPill) apiPill.textContent = `API: ${hostLabel(API_BASE)}`;

  if (typeof apiFetch !== "function") {
    setStatus("auth.js missing. Ensure auth.js loads before admin-dashboard.js", "err");
    return;
  }

  // ✅ Require login once
  const ok = await window.checkAuth?.();
  if (!ok) return;

  logoutBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    window.adminLogout?.();
  });

  // Card navigation
  const cards = Array.from(document.querySelectorAll(".card[data-go]"));
  cards.forEach((btn) => {
    btn.addEventListener("click", () => {
      const go = btn.getAttribute("data-go");
      if (go) location.href = go;
    });

    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const go = btn.getAttribute("data-go");
        if (go) location.href = go;
      }
    });
  });

  async function getJson(path) {
    const res = await apiFetch(path, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || `Request failed: ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // Try multiple possible endpoints without breaking
  async function tryCount(label, paths, pickCountFn) {
    for (const p of paths) {
      try {
        const data = await getJson(p);
        const count = pickCountFn(data);
        if (Number.isFinite(count)) return { ok: true, count, used: p };
      } catch {
        // continue
      }
    }
    return { ok: false, count: NaN, used: "" };
  }

  // Compute pending orders from common structures
  function computePendingFromOrdersArray(arr) {
    const orders = Array.isArray(arr) ? arr : [];
    const pending = orders.filter((o) => {
      const s = String(o?.status || o?.order_status || o?.state || "").toLowerCase();
      return s.includes("pending") || s.includes("unpaid") || s.includes("processing");
    }).length;
    return { total: orders.length, pending };
  }

  setStatus("Loading dashboard…", "info");

  // Products: your backend definitely has /admin/products
  const productsPromise = tryCount(
    "products",
    ["/admin/products"],
    (d) => (Array.isArray(d?.products) ? d.products.length : NaN)
  );

  // Orders: /admin/orders or /admin/orders/list
  const ordersPromise = (async () => {
    try {
      const d = await getJson("/admin/orders");
      const arr = Array.isArray(d?.orders) ? d.orders : (Array.isArray(d) ? d : []);
      const { total, pending } = computePendingFromOrdersArray(arr);
      return { ok: Number.isFinite(total), total, pending };
    } catch {
      try {
        const d = await getJson("/admin/orders/list");
        const arr = Array.isArray(d?.orders) ? d.orders : (Array.isArray(d) ? d : []);
        const { total, pending } = computePendingFromOrdersArray(arr);
        return { ok: Number.isFinite(total), total, pending };
      } catch {
        return { ok: false, total: NaN, pending: NaN };
      }
    }
  })();

  // ✅ Featured: your backend returns { success:true, items:[...] }
  const featuredPromise = tryCount(
    "featured",
    ["/admin/featured"],
    (d) => (Array.isArray(d?.items) ? d.items.length : NaN)
  );

  // Messages: /admin/messages returns raw array in your backend (NOT {messages:[]})
  const messagesPromise = tryCount(
    "messages",
    ["/admin/messages", "/admin/contact", "/admin/inbox"],
    (d) => (Array.isArray(d) ? d.length : (Array.isArray(d?.messages) ? d.messages.length : NaN))
  );

  const [prodR, ordersR, featR, msgR] = await Promise.allSettled([
    productsPromise,
    ordersPromise,
    featuredPromise,
    messagesPromise,
  ]);

  const prod = prodR.status === "fulfilled" ? prodR.value : { ok: false };
  const ord = ordersR.status === "fulfilled" ? ordersR.value : { ok: false };
  const feat = featR.status === "fulfilled" ? featR.value : { ok: false };
  const msg = msgR.status === "fulfilled" ? msgR.value : { ok: false };

  // Set KPIs
  if (kProducts) kProducts.textContent = prod.ok ? fmt(prod.count) : "—";
  if (chipProducts) chipProducts.textContent = prod.ok ? fmt(prod.count) : "—";

  if (kOrders) kOrders.textContent = ord.ok ? fmt(ord.total) : "—";
  if (chipOrders) chipOrders.textContent = ord.ok ? fmt(ord.total) : "—";

  if (kPending) kPending.textContent = ord.ok ? fmt(ord.pending) : "—";

  if (kFeatured) kFeatured.textContent = feat.ok ? fmt(feat.count) : "—";
  if (chipFeatured) chipFeatured.textContent = feat.ok ? fmt(feat.count) : "—";

  if (kMessages) kMessages.textContent = msg.ok ? fmt(msg.count) : "—";
  if (chipMessages) chipMessages.textContent = msg.ok ? fmt(msg.count) : "—";

  // Status line summary
  const anyOk = !!(prod.ok || ord.ok || feat.ok || msg.ok);
  if (anyOk) {
    setStatus("Dashboard ready ✅", "ok");
  } else {
    setStatus(
      "Logged in ✅ (Some KPI endpoints not found — update routes in admin-dashboard.js if needed)",
      "warn"
    );
  }
})();
