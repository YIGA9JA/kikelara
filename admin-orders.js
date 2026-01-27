// admin-orders.js (FULL + TOKEN AUTH) - stable (no constant "refreshing")

(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const API_BASE = "http://localhost:4000";
  const TOKEN_KEY = "admin-token";

  const ordersContainer = document.getElementById("ordersContainer");
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const apiLabel = document.getElementById("apiLabel");

  const statusTabs = document.getElementById("statusTabs");
  const searchBox = document.getElementById("searchBox");
  const statsRow = document.getElementById("statsRow");
  const toastEl = document.getElementById("toast");

  if (apiLabel) apiLabel.textContent = API_BASE;

  logoutBtn?.addEventListener("click", adminLogout);

  let currentStatusFilter = "all";
  let currentSearch = "";
  let autoTimer = null;

  // ✅ Cache so searching/tabs don't refetch (prevents “refreshing”)
  let allOrdersCache = [];

  // ✅ prevent auto refresh while user is interacting
  let isInteracting = false;

  function authHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchWithAuth(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), ...authHeaders() }
    });

    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "admin-login.html";
      return null;
    }

    return res;
  }

  /* ================= UI ================= */
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1600);
  }

  function money(n) {
    return Number(n || 0).toLocaleString();
  }

  function safeText(v) {
    return String(v ?? "").trim() || "-";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ DOM-safe id (prevents weird bugs if id contains special chars)
  function domSafeId(v) {
    return String(v ?? "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  /* ================= Data helpers ================= */
  function getItems(order) {
    if (Array.isArray(order.cart)) return order.cart;
    if (Array.isArray(order.items)) return order.items;
    return [];
  }

  function lineTotal(item) {
    const price = Number(item.price || 0);
    const qty = Number(item.qty || 0);
    const computed = price * qty;
    const raw = item.total ?? computed;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function subtotal(items) {
    return items.reduce((sum, i) => sum + lineTotal(i), 0);
  }

  /* ================= Fetch ================= */
  async function fetchOrders() {
    const res = await fetchWithAuth(`${API_BASE}/orders`, { cache: "no-store" });
    if (!res) return [];
    if (!res.ok) throw new Error("Failed to load orders");
    const orders = await res.json();
    return Array.isArray(orders) ? orders : [];
  }

  async function patchStatus(orderId, status) {
    const res = await fetchWithAuth(
      `${API_BASE}/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      }
    );
    if (!res) return null;
    if (!res.ok) throw new Error("Failed to update");
    return res.json();
  }

  /* ================= Render ================= */
  function renderStats(orders) {
    if (!statsRow) return;

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const pending = orders.filter(o => (o.status || "Pending") === "Pending").length;
    const delivered = orders.filter(o => (o.status || "Pending") === "Delivered").length;

    statsRow.innerHTML = `
      <div class="stat"><div class="k">Orders</div><div class="v">${money(totalOrders)}</div></div>
      <div class="stat"><div class="k">Revenue</div><div class="v">₦${money(totalRevenue)}</div></div>
      <div class="stat"><div class="k">Pending</div><div class="v">${money(pending)}</div></div>
      <div class="stat"><div class="k">Delivered</div><div class="v">${money(delivered)}</div></div>
    `;
  }

  function applyFilters(orders) {
    let out = [...orders];

    if (currentStatusFilter !== "all") {
      out = out.filter(o => String(o.status || "Pending") === currentStatusFilter);
    }

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      out = out.filter(o => {
        const ref = String(o.reference || o.id || o._id || "").toLowerCase();
        const name = String(o.name || o.customer?.name || "").toLowerCase();
        const phone = String(o.phone || o.customer?.phone || "").toLowerCase();
        const email = String(o.email || o.customer?.email || "").toLowerCase();
        return ref.includes(q) || name.includes(q) || phone.includes(q) || email.includes(q);
      });
    }

    out.sort((a, b) => {
      const da = new Date(a.createdAt || a.created_at || 0).getTime();
      const db = new Date(b.createdAt || b.created_at || 0).getTime();
      return db - da;
    });

    return out;
  }

  function renderOrders(orders) {
    if (!ordersContainer) return;

    // ✅ preserve which cards are open before rerender
    const openSet = new Set(
      Array.from(document.querySelectorAll(".order-body.open"))
        .map(el => el.id.replace("body-", ""))
    );

    if (!orders.length) {
      ordersContainer.innerHTML = `<p style="opacity:.85;">No orders found.</p>`;
      return;
    }

    ordersContainer.innerHTML = "";

    orders.forEach(order => {
      const rawId = String(order.id ?? order._id ?? order.reference ?? "");
      const id = domSafeId(rawId); // for DOM usage
      const items = getItems(order);
      const sub = subtotal(items);

      const status = safeText(order.status || "Pending");
      const shippingText = (order.shippingType === "pickup")
        ? "Pickup"
        : `${safeText(order.state)}, ${safeText(order.city)}`;

      const created = order.createdAt || order.created_at || "";
      const createdNice = created ? new Date(created).toLocaleString() : "-";

      const card = document.createElement("div");
      card.className = "order-card";

      card.innerHTML = `
        <div class="order-head" data-toggle="${escapeHtml(id)}">
          <div class="order-left">
            <div class="order-title">Order #${escapeHtml(safeText(order.reference || order.id || order._id))}</div>
            <div class="order-sub">${escapeHtml(safeText(order.name || order.customer?.name))} • ${escapeHtml(safeText(order.phone || order.customer?.phone))} • ${escapeHtml(shippingText)}</div>
          </div>

          <div class="badges">
            <span class="badge status-${escapeHtml(status)}">${escapeHtml(status)}</span>
            <span class="badge">₦${money(order.total)}</span>
            <span class="badge">${escapeHtml(createdNice)}</span>
          </div>
        </div>

        <div class="order-body ${openSet.has(id) ? "open" : ""}" id="body-${escapeHtml(id)}">
          <div class="grid">
            <div class="kv"><div class="k">Name</div><div class="v">${escapeHtml(safeText(order.name || order.customer?.name))}</div></div>
            <div class="kv"><div class="k">Email</div><div class="v">${escapeHtml(safeText(order.email || order.customer?.email))}</div></div>
            <div class="kv"><div class="k">Phone</div><div class="v">${escapeHtml(safeText(order.phone || order.customer?.phone))}</div></div>
            <div class="kv"><div class="k">Shipping</div><div class="v">${escapeHtml(shippingText)}</div></div>
            <div class="kv" style="grid-column:1/-1;"><div class="k">Address</div><div class="v">${escapeHtml(safeText(order.address || order.shipping?.address))}</div></div>
          </div>

          <div class="items">
            ${items.map(i => `
              <div class="row">
                <div>
                  <div class="name">${escapeHtml(safeText(i.name))} × ${escapeHtml(safeText(i.qty))}</div>
                  <div class="meta">₦${money(i.price)} each</div>
                </div>
                <div class="total">₦${money(lineTotal(i))}</div>
              </div>
            `).join("")}
          </div>

          <div class="grid">
            <div class="kv"><div class="k">Subtotal</div><div class="v">₦${money(sub)}</div></div>
            <div class="kv"><div class="k">Delivery Fee</div><div class="v">₦${money(order.deliveryFee)}</div></div>
            <div class="kv"><div class="k">Total</div><div class="v">₦${money(order.total)}</div></div>
            <div class="kv"><div class="k">Reference</div><div class="v">${escapeHtml(safeText(order.reference))}</div></div>
          </div>

          <div class="actions">
            <div>
              <label style="font-weight:900; opacity:.85; font-size:.9rem;">Status</label><br/>
              <select id="status-${escapeHtml(id)}" data-rawid="${escapeHtml(rawId)}">
                ${["Pending","Confirmed","Shipped","Delivered"].map(s =>
                  `<option value="${s}" ${s===status ? "selected":""}>${s}</option>`
                ).join("")}
              </select>
            </div>

            <button class="btn" type="button" data-update="${escapeHtml(id)}">Update Status</button>
          </div>
        </div>
      `;

      ordersContainer.appendChild(card);
    });
  }

  /* ================= Actions ================= */
  function rerenderFromCache() {
    renderStats(allOrdersCache);
    renderOrders(applyFilters(allOrdersCache));
  }

  async function refreshFromServer() {
    if (!ordersContainer) return;

    ordersContainer.innerHTML = `<p style="opacity:.85;">Loading orders...</p>`;

    try {
      allOrdersCache = await fetchOrders();
      rerenderFromCache();
    } catch (err) {
      console.error(err);
      ordersContainer.innerHTML =
        `<p style="opacity:.85;">Failed to load orders. Make sure backend is running on ${escapeHtml(API_BASE)}.</p>`;
    }
  }

  async function updateStatus(domId) {
    const select = document.getElementById(`status-${domId}`);
    if (!select) return;

    const newStatus = select.value;
    const rawId = select.getAttribute("data-rawid") || domId;

    try {
      await patchStatus(rawId, newStatus);
      toast(`✅ Status updated: ${newStatus}`);
      // ✅ refresh server after update so you see latest data
      await refreshFromServer();
    } catch (err) {
      console.error(err);
      toast("❌ Failed to update status");
    }
  }

  /* ================= Events ================= */

  // refresh button should fetch from server
  refreshBtn?.addEventListener("click", refreshFromServer);

  // tabs: just change filter + rerender (no fetch)
  statusTabs?.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");

    currentStatusFilter = btn.dataset.status || "all";
    rerenderFromCache();
  });

  // search: rerender only (no fetch) + debounce
  let searchTimer = null;
  searchBox?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = String(searchBox.value || "").trim();
      rerenderFromCache();
    }, 180);
  });

  // mark interaction so auto refresh doesn't fight user clicks
  document.addEventListener("focusin", (e) => {
    if (e.target.closest("select, input, textarea, button")) isInteracting = true;
  });
  document.addEventListener("focusout", () => {
    // small delay so clicking doesn’t instantly flip it off
    setTimeout(() => (isInteracting = false), 150);
  });

  document.addEventListener("click", (e) => {
    const head = e.target.closest(".order-head");
    if (head) {
      const id = head.getAttribute("data-toggle");
      const body = document.getElementById(`body-${id}`);
      if (body) body.classList.toggle("open");
      return;
    }

    const upd = e.target.closest("[data-update]");
    if (upd) {
      const id = upd.getAttribute("data-update");
      updateStatus(id);
    }
  });

  /* ================= Init ================= */
  await refreshFromServer();

  // ✅ auto refresh server, but don’t interrupt user interactions
  autoTimer = setInterval(() => {
    if (!isInteracting) refreshFromServer();
  }, 30000);
})();
