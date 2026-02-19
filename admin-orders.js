// admin-orders.js (COOKIE AUTH + CSRF via auth.js apiFetch)
// ✅ Reads customer/total/cart from `order.payload` (your backend format)
// ✅ Fetches orders from /admin/orders
// ✅ Updates status using multiple fallbacks that now match the server fix below

(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const AUTO_REFRESH_MS = 30_000;

  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const tabsEl = document.getElementById("tabs");
  const searchBox = document.getElementById("searchBox");
  const ordersList = document.getElementById("ordersList");
  const errorBox = document.getElementById("errorBox");
  const toastWrap = document.getElementById("toastWrap");
  const apiChip = document.getElementById("apiChip");
  const autoChip = document.getElementById("autoChip");
  const lastUpdate = document.getElementById("lastUpdate");

  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  if (apiChip) apiChip.textContent = API_BASE || "—";
  if (autoChip) autoChip.textContent = `${Math.round(AUTO_REFRESH_MS / 1000)}s`;

  const TABS = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "shipped", label: "Shipped" },
    { key: "delivered", label: "Delivered" },
  ];

  let allOrders = [];
  let activeTab = "all";
  let timer = null;

  /* ---------- helpers ---------- */
  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtMoney(n) {
    const num = Number(n || 0);
    try {
      return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(num);
    } catch {
      return `₦${Math.round(num).toLocaleString()}`;
    }
  }

  function fmtDate(d) {
    if (!d) return "—";
    try { return new Date(d).toLocaleString(); } catch { return "—"; }
  }

  function setLastUpdate(ts) {
    if (!lastUpdate) return;
    lastUpdate.textContent = fmtDate(ts || Date.now());
  }

  function toast(type, title, body, ms = 3200) {
    if (!toastWrap) return;

    const el = document.createElement("div");
    el.className = `toast ${type || ""}`.trim();
    el.innerHTML = `
      <div class="t-row">
        <div class="t-title">${escapeHtml(title || "")}</div>
        <button class="t-close" type="button" aria-label="Close">✕</button>
      </div>
      ${body ? `<div class="t-body">${escapeHtml(body)}</div>` : ""}
    `;
    toastWrap.appendChild(el);

    const close = () => {
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(() => el.remove(), 180);
    };
    el.querySelector(".t-close")?.addEventListener("click", close);
    if (ms > 0) setTimeout(close, ms);
  }

  function showError(msg) {
    if (!errorBox) return;
    errorBox.style.display = "block";
    errorBox.innerHTML = `❌ ${escapeHtml(msg)}`;
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  async function readJsonSafe(res) {
    return await res.json().catch(() => ({}));
  }

  function mapStatusToTab(status) {
    const s = String(status || "").toLowerCase().trim();
    // ✅ If you ever stored "Paid", show it under Confirmed in the UI
    if (s === "paid") return "confirmed";
    if (s === "processing") return "pending";
    if (s === "complete" || s === "completed") return "delivered";
    return s || "pending";
  }

  function normalizeOrder(o) {
    const p = (o?.payload && typeof o.payload === "object") ? o.payload : {};

    const id =
      o?.id ?? o?.order_id ?? o?.orderId ?? o?.uuid ?? o?.reference ?? o?.ref ?? "";

    const reference =
      o?.reference ?? p?.reference ?? p?.paystackRef ?? o?.ref ?? (id ? String(id).slice(0, 10) : "—");

    const statusRaw = (o?.status ?? p?.status ?? "pending");
    const status = mapStatusToTab(statusRaw);

    const createdAt =
      p?.createdAt ??
      o?.created_at ??
      o?.createdAt ??
      o?.created ??
      o?.date ??
      null;

    const name = p?.name ?? o?.customer_name ?? o?.name ?? o?.full_name ?? o?.fullname ?? "";
    const phone = p?.phone ?? o?.phone ?? o?.customer_phone ?? "";
    const email = p?.email ?? o?.email ?? o?.customer_email ?? "";

    const state = p?.state ?? o?.delivery_state ?? o?.state ?? "";
    const city = p?.city ?? o?.delivery_city ?? o?.city ?? "";
    const address = p?.address ?? o?.delivery_address ?? o?.address ?? "";

    const deliveryFee = Number(p?.deliveryFee ?? o?.delivery_fee ?? o?.deliveryFee ?? 0);
    const total = Number(p?.total ?? o?.total_amount ?? o?.total ?? o?.amount ?? 0);

    const items =
      Array.isArray(p?.cart) ? p.cart :
      Array.isArray(o?.items) ? o.items :
      Array.isArray(o?.cart) ? o.cart :
      Array.isArray(o?.products) ? o.products :
      [];

    return {
      raw: o,
      payload: p,
      id: String(id),
      reference: String(reference),
      status,
      createdAt,
      name: String(name || ""),
      phone: String(phone || ""),
      email: String(email || ""),
      state: String(state || ""),
      city: String(city || ""),
      address: String(address || ""),
      deliveryFee,
      total,
      items
    };
  }

  /* ---------- API ---------- */
  async function fetchOrdersFromServer() {
    const endpoints = [
      "/admin/orders",
      "/admin/orders/list",
      "/admin/orders/all",
      "/admin/all-orders"
    ];

    let lastErr = null;

    for (const ep of endpoints) {
      try {
        const res = await apiFetch(ep, { method: "GET" });

        if (res.status === 401) {
          toast("err", "Session expired", "Please login again.");
          adminLogout();
          return null;
        }
        if (res.status === 404) {
          lastErr = new Error(`404 on ${ep}`);
          continue;
        }

        const data = await readJsonSafe(res);

        const arr =
          (Array.isArray(data?.orders) && data.orders) ||
          (Array.isArray(data?.data) && data.data) ||
          (Array.isArray(data?.rows) && data.rows) ||
          (Array.isArray(data) && data) ||
          null;

        if (res.ok && arr) return arr;

        lastErr = new Error(data?.message || `Failed (${res.status})`);
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Failed to load orders");
  }

  async function updateOrderStatusOnServer(orderId, newStatus) {
    const status = String(newStatus || "").toLowerCase();
    const id = encodeURIComponent(String(orderId));

    const tries = [
      { url: `/admin/orders/${id}/status`, method: "PUT", body: { status } },
      { url: `/admin/orders/${id}`, method: "PUT", body: { status } },
      { url: `/admin/orders/status`, method: "PUT", body: { id: orderId, status } }
    ];

    let lastErr = null;

    for (const t of tries) {
      try {
        const res = await apiFetch(t.url, { method: t.method, body: t.body });

        if (res.status === 401) {
          toast("err", "Session expired", "Please login again.");
          adminLogout();
          return null;
        }
        if (res.status === 404) {
          lastErr = new Error(`404 on ${t.url}`);
          continue;
        }

        const data = await readJsonSafe(res);
        if (res.ok && (data?.success || data?.ok || data?.order)) return data;

        lastErr = new Error(data?.message || `Update failed (${res.status})`);
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Update failed");
  }

  /* ---------- render ---------- */
  function renderTabs() {
    if (!tabsEl) return;
    tabsEl.innerHTML = TABS.map(t => {
      const active = t.key === activeTab ? "active" : "";
      return `<button class="tab ${active}" data-tab="${escapeHtml(t.key)}" type="button">${escapeHtml(t.label)}</button>`;
    }).join("");
  }

  function filteredOrders() {
    const q = String(searchBox?.value || "").trim().toLowerCase();

    return allOrders.filter(o => {
      const statusOk = (activeTab === "all") ? true : o.status === activeTab;

      if (!statusOk) return false;
      if (!q) return true;

      const hay = [
        o.reference, o.name, o.phone, o.email,
        o.state, o.city, o.address
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });
  }

  function statusBadge(status) {
    const s = String(status || "").toLowerCase();
    return `<span class="badge ${escapeHtml(s)}">${escapeHtml(s)}</span>`;
  }

  function itemsPreview(items) {
    if (!Array.isArray(items) || items.length === 0) return "—";

    const names = items
      .map(x => x?.name || x?.title || x?.product_name || x?.product || "")
      .filter(Boolean)
      .slice(0, 3);

    if (names.length) {
      const extra = items.length > names.length ? ` +${items.length - names.length} more` : "";
      return `${escapeHtml(names.join(", "))}${escapeHtml(extra)}`;
    }

    return `${items.length} item(s)`;
  }

  function renderOrders() {
    if (!ordersList) return;

    const list = filteredOrders();

    if (!list.length) {
      ordersList.innerHTML = `<div class="empty">No orders found.</div>`;
      return;
    }

    ordersList.innerHTML = list.map(o => {
      return `
        <article class="order-card" data-id="${escapeHtml(o.id)}">
          <div class="order-top">
            <div class="order-ref">
              <div class="ref">${escapeHtml(o.reference)}</div>
              <div class="date muted">${escapeHtml(fmtDate(o.createdAt))}</div>
            </div>

            <div class="order-status">
              ${statusBadge(o.status)}
            </div>
          </div>

          <div class="order-mid">
            <div class="grid">
              <div>
                <div class="label">Customer</div>
                <div class="value">${escapeHtml(o.name || "—")}</div>
              </div>
              <div>
                <div class="label">Phone</div>
                <div class="value">${escapeHtml(o.phone || "—")}</div>
              </div>
              <div>
                <div class="label">Email</div>
                <div class="value">${escapeHtml(o.email || "—")}</div>
              </div>
            </div>

            <div class="addr">
              <div class="label">Delivery</div>
              <div class="value">
                ${escapeHtml([o.address, o.city, o.state].filter(Boolean).join(", ") || "—")}
              </div>
            </div>

            <div class="grid">
              <div>
                <div class="label">Delivery Fee</div>
                <div class="value">${escapeHtml(fmtMoney(o.deliveryFee))}</div>
              </div>
              <div>
                <div class="label">Total</div>
                <div class="value strong">${escapeHtml(fmtMoney(o.total))}</div>
              </div>
              <div>
                <div class="label">Items</div>
                <div class="value">${itemsPreview(o.items)}</div>
              </div>
            </div>
          </div>

          <div class="order-actions">
            <select class="statusSel" data-status>
              ${TABS.filter(t => t.key !== "all").map(t => `
                <option value="${escapeHtml(t.key)}" ${o.status === t.key ? "selected" : ""}>
                  ${escapeHtml(t.label)}
                </option>
              `).join("")}
            </select>

            <button class="btn primary" data-save type="button">Update Status</button>
          </div>
        </article>
      `;
    }).join("");
  }

  /* ---------- load / refresh ---------- */
  async function refreshFromServer({ silent = false } = {}) {
    try {
      clearError();
      if (!silent) {
        ordersList.innerHTML = `
          <div class="skeleton"></div>
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        `;
      }

      const rows = await fetchOrdersFromServer();
      if (!rows) return;

      allOrders = rows.map(normalizeOrder);

      // newest first (use createdAt fallback safely)
      allOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setLastUpdate(Date.now());
      renderTabs();
      renderOrders();

      if (!silent) toast("ok", "Loaded", "Orders loaded from server.");
    } catch (e) {
      console.error(e);
      showError(`Failed to load orders from ${API_BASE}. (Your backend may be returning 404 for the orders endpoint.)`);
      toast("err", "Error", "Failed to load orders.");
    }
  }

  /* ---------- events ---------- */
  logoutBtn?.addEventListener("click", () => adminLogout());
  refreshBtn?.addEventListener("click", () => refreshFromServer());

  tabsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    activeTab = btn.getAttribute("data-tab") || "all";
    renderTabs();
    renderOrders();
  });

  searchBox?.addEventListener("input", () => renderOrders());

  document.addEventListener("click", async (e) => {
    const saveBtn = e.target.closest("[data-save]");
    if (!saveBtn) return;

    const card = saveBtn.closest(".order-card");
    const id = card?.getAttribute("data-id");
    const sel = card?.querySelector("[data-status]");
    const status = sel?.value;

    if (!id || !status) return;

    saveBtn.disabled = true;
    const oldText = saveBtn.textContent;
    saveBtn.textContent = "Updating...";

    try {
      await updateOrderStatusOnServer(id, status);

      // update local state
      const idx = allOrders.findIndex(x => x.id === id);
      if (idx >= 0) allOrders[idx].status = String(status).toLowerCase();

      renderTabs();
      renderOrders();
      toast("ok", "Updated", `Order status set to ${status}.`);
    } catch (err) {
      console.error(err);
      toast("err", "Update failed", "Backend update route missing. Paste the server.js fix below.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = oldText || "Update Status";
    }
  });

  // auto refresh
  function startAuto() {
    stopAuto();
    timer = setInterval(() => refreshFromServer({ silent: true }), AUTO_REFRESH_MS);
  }
  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // first load
  await refreshFromServer();
  startAuto();
})();
