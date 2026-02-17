/* ================= cart.js (USES store.js / KStore) =================
   ✅ Renders cart from KStore
   ✅ Qty +/- remove
   ✅ Checkout button totals
   ✅ Sticky mobile bar
   ✅ Safe DOM rendering (no innerHTML injection)
   ✅ Image resolver supports image_url + /uploads + full https
==================================================================== */

(() => {
  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  const FALLBACK_IMG = "images_brown/bodyButter.png";

  const cartItems = document.getElementById("cartItems");
  const subtotalEl = document.getElementById("subtotal");
  const totalEl = document.getElementById("total");

  const checkoutBtn = document.getElementById("checkoutBtn");
  const checkoutBtnTotal = document.getElementById("checkoutBtnTotal");

  const mobileCheckout = document.getElementById("mobileCheckout");
  const mobileCheckoutBtn = document.getElementById("mobileCheckoutBtn");
  const mobileCheckoutTotal = document.getElementById("mobileCheckoutTotal");

  const isMobileMQ = window.matchMedia("(max-width: 980px)");

  function formatNaira(n) {
    const num = Number(n || 0);
    return `₦${num.toLocaleString()}`;
  }

  function resolveImageUrl(val) {
    const s = String(val || "").trim();
    if (!s) return FALLBACK_IMG;

    if (/^https?:\/\//i.test(s)) return s;

    if (s.startsWith("/uploads/") && API_BASE) return `${API_BASE}${s}`;
    if (s.startsWith("uploads/") && API_BASE) return `${API_BASE}/${s}`;

    return s; // local relative path
  }

  function getCart() {
    // Prefer KStore
    const ks = window.KStore;
    if (ks && typeof ks.getCart === "function") {
      const v = ks.getCart();
      return Array.isArray(v) ? v : [];
    }

    // Fallback (if someone opens cart page without store.js)
    try {
      const raw = sessionStorage.getItem("cart");
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function calcSubtotal(cart) {
    return cart.reduce((sum, item) => {
      const price = Number(item?.price || 0);
      const qty = Number(item?.qty || 0);
      return sum + (price * qty);
    }, 0);
  }

  function setDisabled(btn, disabled) {
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.style.opacity = disabled ? "0.55" : "1";
  }

  function updateSummary(cart) {
    const sub = calcSubtotal(cart);
    const total = sub; // delivery calculated at checkout

    if (subtotalEl) subtotalEl.textContent = formatNaira(sub);
    if (totalEl) totalEl.textContent = formatNaira(total);
    if (checkoutBtnTotal) checkoutBtnTotal.textContent = formatNaira(total);
    if (mobileCheckoutTotal) mobileCheckoutTotal.textContent = formatNaira(total);

    const empty = cart.length === 0;
    setDisabled(checkoutBtn, empty);
    setDisabled(mobileCheckoutBtn, empty);
  }

  function makeEmptyState() {
    const wrap = document.createElement("div");
    wrap.className = "empty";

    const t = document.createElement("div");
    t.className = "empty-title";
    t.textContent = "Your cart is empty.";

    const s = document.createElement("div");
    s.className = "empty-sub";
    s.textContent = "Go to the shop and add something you love.";

    const a = document.createElement("a");
    a.className = "empty-btn";
    a.href = "products.html";
    a.textContent = "Back to Shop";

    wrap.appendChild(t);
    wrap.appendChild(s);
    wrap.appendChild(a);
    return wrap;
  }

  function makeRow(item) {
    const id = String(item?.id ?? "");
    const qty = Math.max(1, Number(item?.qty || 1));
    const price = Number(item?.price || 0);

    const name = String(item?.name || "Product").trim();

    // support different key names used across pages
    const imgVal = item?.image_url || item?.image || item?.img || "";
    const imgSrc = resolveImageUrl(imgVal);

    const row = document.createElement("div");
    row.className = "cart-item";

    // image
    const img = document.createElement("img");
    img.className = "cart-img";
    img.src = imgSrc;
    img.alt = name;
    img.draggable = false;

    // info
    const info = document.createElement("div");
    info.className = "cart-info";

    const nm = document.createElement("div");
    nm.className = "cart-name";
    nm.textContent = name;

    const meta = document.createElement("div");
    meta.className = "cart-meta";

    const priceEl = document.createElement("span");
    priceEl.className = "cart-price";
    priceEl.textContent = formatNaira(price);

    const dot = document.createElement("span");
    dot.className = "cart-dot";
    dot.textContent = "•";

    const line = document.createElement("span");
    line.className = "cart-line";
    line.textContent = formatNaira(price * qty);

    meta.appendChild(priceEl);
    meta.appendChild(dot);
    meta.appendChild(line);

    // qty controls
    const qtyWrap = document.createElement("div");
    qtyWrap.className = "qty";

    const dec = document.createElement("button");
    dec.className = "qty-btn";
    dec.type = "button";
    dec.dataset.action = "decrease";
    dec.dataset.id = id;
    dec.setAttribute("aria-label", "Decrease quantity");
    dec.textContent = "−";

    const num = document.createElement("span");
    num.className = "qty-num";
    num.textContent = String(qty);

    const inc = document.createElement("button");
    inc.className = "qty-btn";
    inc.type = "button";
    inc.dataset.action = "increase";
    inc.dataset.id = id;
    inc.setAttribute("aria-label", "Increase quantity");
    inc.textContent = "+";

    qtyWrap.appendChild(dec);
    qtyWrap.appendChild(num);
    qtyWrap.appendChild(inc);

    info.appendChild(nm);
    info.appendChild(meta);
    info.appendChild(qtyWrap);

    // remove
    const rm = document.createElement("button");
    rm.className = "remove";
    rm.type = "button";
    rm.dataset.action = "remove";
    rm.dataset.id = id;
    rm.setAttribute("aria-label", "Remove item");
    rm.textContent = "Remove";

    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(rm);

    return row;
  }

  function render(cart) {
    if (!cartItems) return;

    cartItems.innerHTML = "";

    if (!cart.length) {
      cartItems.appendChild(makeEmptyState());
      updateSummary([]);
      return;
    }

    cart.forEach((item) => cartItems.appendChild(makeRow(item)));
    updateSummary(cart);
  }

  function updateMobileBar() {
    if (!mobileCheckout) return;
    mobileCheckout.style.display = isMobileMQ.matches ? "block" : "none";
  }

  function goCheckout() {
    const cart = getCart();
    if (!cart.length) return;
    window.location.href = "checkout.html";
  }

  function applyAction(action, id) {
    const ks = window.KStore;

    if (ks) {
      if (action === "increase" && typeof ks.incQty === "function") ks.incQty(id);
      if (action === "decrease" && typeof ks.decQty === "function") ks.decQty(id);
      if (action === "remove" && typeof ks.removeFromCart === "function") ks.removeFromCart(id);
      return;
    }

    // fallback if KStore missing: do nothing
  }

  cartItems?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    applyAction(btn.dataset.action, btn.dataset.id);
  });

  checkoutBtn?.addEventListener("click", goCheckout);
  mobileCheckoutBtn?.addEventListener("click", goCheckout);

  document.addEventListener("DOMContentLoaded", () => {
    updateMobileBar();
    isMobileMQ.addEventListener?.("change", updateMobileBar);
    window.addEventListener("resize", updateMobileBar);

    // initial render
    render(getCart());

    // optional: update header badge if store provides it
    window.KStore?.syncBadges?.();

    // LIVE updates:
    // 1) store subscription (best)
    if (window.KStore?.subscribe) {
      window.KStore.subscribe((evt) => {
        if (evt?.type === "CART_CHANGED" || evt?.type === "INIT") {
          render(evt.cart || getCart());
        }
      });
    }

    // 2) fallback event (works if store dispatches cart:updated)
    document.addEventListener("cart:updated", () => render(getCart()));
  });
})();
