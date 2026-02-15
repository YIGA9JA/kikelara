(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const API_BASE = (window.API_BASE || "").replace(/\/$/, "");

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
  let allOrdersCache = [];
  let isInteracting = false;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1600);
  }

  function money(n) {
    const v = Number(n || 0);
    try { return v.toLocaleString("en-NG"); } catch { return String(v); }
  }

  function safeText(v) { return String(v ?? "").trim() || "-"; }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function domSafeId(v) {
    return String(v ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function statusSlug(s) {
    return String(s || "Pending")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  // Your DB stores main values in row.payload (jsonb)
  function normalizeOrderRow(row) {
    const p = (row && typeof row.payload === "object" && row.payload) ? row.payload : {};
    const cart = Array.isArray(p.cart) ? p.cart : (Array.isArray(p.items) ? p.items : []);

    const total = Number(p.total ?? row.total ?? 0) || 0;
    const deliveryFee = Number(p.deliveryFee ?? p.delivery_fee ?? row.delivery_fee ?? 0) || 0;
    const subtotal = Number(p.subtotal ?? 0) || 0;

    const createdAt = row.created_at || row.createdAt || p.createdAt || p.created_at || null;

    return {
      id: row.id,
      reference: row.reference || p.reference || p.paystackRef || p.paystack_ref || row.id,
      status: row.status || p.status || "Pending",
      createdAt,

      name: p.name || p.customer?.name || "",
      email: p.email || p.customer?.email || "",
      phone: p.phone || p.customer?.phone || "",
      shippingType: p.shippingType || p.shipping_type || "",
      state: p.state || "",
      city: p.city || "",
      address: p.address || "",
      deliveryFee,
      subtotal,
      total,
      cart
    };
  }

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

  async function fetchOrders() {
    const params = new URLSearchParams();
    if (currentStatusFilter !== "all") params.set("status", currentStatusFilter);
    if (currentSearch) params.set("q", currentSearch);

    const url = `/orders${params.toString() ? `?${params}` : ""}`;
    const res = await apiFetch(url, { cache: "no-store" });

    if (!res.ok) {
      if (res.status === 401) {
        location.href = "admin-login.html";
        return [];
      }
      throw new Error("Failed to load orders");
    }

    const rows = await res.json().catch(() => []);
    const arr = Array.isArray(rows) ? rows : [];
    return arr.map(normalizeOrderRow);
  }

  async function patchStatus(orderId, status) {
    const res = await apiFetch(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      if (res.status === 401) {
        location.href = "admin-login.html";
        return null;
      }
      throw new Error("Failed to update");
    }
    return res.json().catch(() => ({}));
  }

  function renderStats(orders) {
    if (!statsRow) return;

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const pending = orders.filter(o => String(o.status || "Pending") === "Pending").length;
    const delivered = orders.filter(o => String(o.status || "Pending") === "Delivered").length;

    statsRow.innerHTML = `
      <div class="stat"><div class="k">Orders</div><div class="v">${money(totalOrders)}</div></div>
      <div class="stat"><div class="k">Revenue</div><div class="v">₦${money(totalRevenue)}</div></div>
      <div class="stat"><div class="k">Pending</div><div class="v">${money(pending)}</div></div>
      <div class="stat"><div class="k">Delivered</div><div class="v">${money(delivered)}</div></div>
    `;
  }

  function sortOrders(orders) {
    const out = [...orders];
    out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return out;
  }

  function renderOrders(orders) {
    if (!ordersContainer) return;

    const openSet = new Set(
      Array.from(document.querySelectorAll(".order-body.open"))
        .map(el => el.id.replace("body-", ""))
    );

    if (!orders.length) {
      ordersContainer.innerHTML = `<p style="opacity:.85;font-weight:900;">No orders found.</p>`;
      return;
    }

    ordersContainer.innerHTML = "";

    orders.forEach(order => {
      const rawKey = String(order.id ?? order.reference ?? "");
      const domId = domSafeId(rawKey);

      const items = getItems(order);
      const computedSub = subtotal(items);
      const sub = Number(order.subtotal || computedSub || 0);

      const status = safeText(order.status || "Pending");
      const statusCls = statusSlug(status);

      const shippingText = (String(order.shippingType).toLowerCase() === "pickup")
        ? "Pickup"
        : `${safeText(order.state)}, ${safeText(order.city)}`;

      const createdNice = order.createdAt ? new Date(order.createdAt).toLocaleString() : "-";

      const card = document.createElement("div");
      card.className = "order-card";

      card.innerHTML = `
        <div class="order-head" data-toggle="${escapeHtml(domId)}" role="button" tabindex="0">
          <div class="order-left">
            <div class="order-title">Order #${escapeHtml(safeText(order.reference || order.id))}</div>
            <div class="order-sub">
              ${escapeHtml(safeText(order.name))} •
              ${escapeHtml(safeText(order.phone))} •
              ${escapeHtml(shippingText)}
            </div>
          </div>

          <div class="badges">
            <span class="badge status-${escapeHtml(statusCls)}">${escapeHtml(status)}</span>
            <span class="badge">₦${money(order.total)}</span>
            <span class="badge">${escapeHtml(createdNice)}</span>
          </div>
        </div>

        <div class="order-body ${openSet.has(domId) ? "open" : ""}" id="body-${escapeHtml(domId)}">
          <div class="inner">
            <div class="grid">
              <div class="kv"><div class="k">Name</div><div class="v">${escapeHtml(safeText(order.name))}</div></div>
              <div class="kv"><div class="k">Email</div><div class="v">${escapeHtml(safeText(order.email))}</div></div>
              <div class="kv"><div class="k">Phone</div><div class="v">${escapeHtml(safeText(order.phone))}</div></div>
              <div class="kv"><div class="k">Shipping</div><div class="v">${escapeHtml(shippingText)}</div></div>
              <div class="kv" style="grid-column:1/-1;"><div class="k">Address</div><div class="v">${escapeHtml(safeText(order.address))}</div></div>
            </div>

            <div class="items">
              ${items.length ? items.map(i => `
                <div class="row">
                  <div>
                    <div class="name">${escapeHtml(safeText(i.name))} × ${escapeHtml(safeText(i.qty))}</div>
                    <div class="meta">₦${money(i.price)} each</div>
                  </div>
                  <div class="total">₦${money(lineTotal(i))}</div>
                </div>
              `).join("") : `<div class="row"><div style="opacity:.85;font-weight:900;">No items found in payload.</div><div></div></div>`}
            </div>

            <div class="grid">
              <div class="kv"><div class="k">Subtotal</div><div class="v">₦${money(sub)}</div></div>
              <div class="kv"><div class="k">Delivery Fee</div><div class="v">₦${money(order.deliveryFee)}</div></div>
              <div class="kv"><div class="k">Total</div><div class="v">₦${money(order.total)}</div></div>
              <div class="kv"><div class="k">Reference</div><div class="v">${escapeHtml(safeText(order.reference))}</div></div>
            </div>

            <div class="actions">
              <div>
                <label style="font-weight:1000; opacity:.85; font-size:.9rem;">Status</label><br/>
                <select id="status-${escapeHtml(domId)}" data-orderid="${escapeHtml(order.id)}">
                  ${["Pending","Confirmed","Shipped","Delivered"].map(s =>
                    `<option value="${s}" ${s===status ? "selected":""}>${s}</option>`
                  ).join("")}
                </select>
              </div>

              <button class="btn" type="button" data-update="${escapeHtml(domId)}">Update Status</button>
            </div>
          </div>
        </div>
      `;

      ordersContainer.appendChild(card);
    });
  }

  function rerenderFromCache() {
    renderStats(allOrdersCache);
    renderOrders(sortOrders(allOrdersCache));
  }

  async function refreshFromServer() {
    if (ordersContainer) ordersContainer.innerHTML = `<p style="opacity:.85;font-weight:900;">Loading orders...</p>`;
    try {
      allOrdersCache = await fetchOrders();
      rerenderFromCache();
    } catch (err) {
      console.error(err);
      if (ordersContainer) {
        ordersContainer.innerHTML =
          `<p style="opacity:.85;font-weight:900;">❌ Failed to load orders from ${escapeHtml(API_BASE)}.</p>`;
      }
      toast("❌ Failed to load orders");
    }
  }

  async function updateStatus(domId) {
    const select = document.getElementById(`status-${domId}`);
    if (!select) return;

    const newStatus = select.value;
    const orderId = select.getAttribute("data-orderid");

    if (!orderId || !/^\d+$/.test(String(orderId))) {
      toast("❌ Order ID missing (cannot update status)");
      return;
    }

    try {
      await patchStatus(orderId, newStatus);
      toast(`✅ Status updated: ${newStatus}`);
      await refreshFromServer();
    } catch (err) {
      console.error(err);
      toast("❌ Failed to update status");
    }
  }

  refreshBtn?.addEventListener("click", refreshFromServer);

  statusTabs?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");

    currentStatusFilter = btn.dataset.status || "all";
    await refreshFromServer();
  });

  let searchTimer = null;
  searchBox?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      currentSearch = String(searchBox.value || "").trim();
      await refreshFromServer();
    }, 220);
  });

  document.addEventListener("focusin", (e) => {
    if (e.target.closest("select, input, textarea, button")) isInteracting = true;
  });
  document.addEventListener("focusout", () => {
    setTimeout(() => (isInteracting = false), 150);
  });

  function toggleById(id) {
    const body = document.getElementById(`body-${id}`);
    if (body) body.classList.toggle("open");
  }

  document.addEventListener("click", (e) => {
    const head = e.target.closest(".order-head");
    if (head) {
      const id = head.getAttribute("data-toggle");
      toggleById(id);
      return;
    }
    const upd = e.target.closest("[data-update]");
    if (upd) updateStatus(upd.getAttribute("data-update"));
  });

  document.addEventListener("keydown", (e) => {
    const head = e.target.closest?.(".order-head");
    if (head && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      const id = head.getAttribute("data-toggle");
      toggleById(id);
    }
  });

  await refreshFromServer();
  setInterval(() => { if (!isInteracting) refreshFromServer(); }, 30000);
})();
