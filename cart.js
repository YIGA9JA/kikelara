/* ================= cart.js (USES store.js / KStore) =================
   ✅ Renders cart from KStore
   ✅ Qty +/- remove
   ✅ Checkout button totals
   ✅ Sticky mobile bar (mobile only)
   ✅ Safe DOM rendering (no unsafe innerHTML)
   ✅ Image resolver supports image_url + /uploads + full https
   ✅ Robust init (works even if load order changes)
==================================================================== */

(() => {
  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  const FALLBACK_IMG = "images_brown/bodyButter.png";
  const isMobileMQ = window.matchMedia("(max-width: 980px)");

  function formatNaira(n) {
    const num = Number(n || 0);
    try {
      return `₦${num.toLocaleString()}`;
    } catch {
      return `₦${num}`;
    }
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
    const ks = window.KStore;
    if (ks && typeof ks.getCart === "function") {
      const v = ks.getCart();
      return Array.isArray(v) ? v : [];
    }

    // fallback if store.js missing
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
      return sum + price * qty;
    }, 0);
  }

  function setDisabled(btn, disabled) {
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function init() {
    const cartItems = document.getElementById("cartItems");
    const subtotalEl = document.getElementById("subtotal");
    const totalEl = document.getElementById("total");

    const checkoutBtn = document.getElementById("checkoutBtn");
    const checkoutBtnTotal = document.getElementById("checkoutBtnTotal");

    const mobileCheckout = document.getElementById("mobileCheckout");
    const mobileCheckoutBtn = document.getElementById("mobileCheckoutBtn");
    const mobileCheckoutTotal = document.getElementById("mobileCheckoutTotal");

    if (!cartItems) return;

    function updateSummary(cart) {
      const sub = calcSubtotal(cart);
      const total = sub;

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

      const imgVal = item?.image_url || item?.image || item?.img || "";
      const imgSrc = resolveImageUrl(imgVal);

      const row = document.createElement("div");
      row.className = "cart-item";
      row.dataset.id = id;

      // media
      const media = document.createElement("div");
      media.className = "cart-media";

      const img = document.createElement("img");
      img.className = "cart-img";
      img.src = imgSrc;
      img.alt = name || "Product image";
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;

      img.addEventListener("error", () => {
        if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
      });

      media.appendChild(img);

      // info
      const info = document.createElement("div");
      info.className = "cart-info";

      const nm = document.createElement("div");
      nm.className = "cart-name";
      nm.textContent = name || "Product";

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

      // actions row (qty + remove)
      const actions = document.createElement("div");
      actions.className = "cart-actions";

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
      num.setAttribute("aria-label", `Quantity ${qty}`);

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

      const rm = document.createElement("button");
      rm.className = "remove";
      rm.type = "button";
      rm.dataset.action = "remove";
      rm.dataset.id = id;
      rm.setAttribute("aria-label", "Remove item");
      rm.textContent = "Remove";

      actions.appendChild(qtyWrap);
      actions.appendChild(rm);

      info.appendChild(nm);
      info.appendChild(meta);
      info.appendChild(actions);

      row.appendChild(media);
      row.appendChild(info);

      return row;
    }

    function render(cart) {
      // no unsafe injection; replace children
      cartItems.replaceChildren();

      if (!Array.isArray(cart) || cart.length === 0) {
        cartItems.appendChild(makeEmptyState());
        updateSummary([]);
        return;
      }

      for (const item of cart) {
        cartItems.appendChild(makeRow(item));
      }
      updateSummary(cart);
    }

    function updateMobileBar() {
      if (!mobileCheckout) return;
      const show = isMobileMQ.matches;
      mobileCheckout.style.display = show ? "block" : "none";
      mobileCheckout.setAttribute("aria-hidden", show ? "false" : "true");
    }

    function goCheckout() {
      const cart = getCart();
      if (!cart.length) return;
      window.location.href = "checkout.html";
    }

    function applyAction(action, id) {
      const ks = window.KStore;
      if (!ks || !id) return;

      if (action === "increase" && typeof ks.incQty === "function") ks.incQty(id);
      if (action === "decrease" && typeof ks.decQty === "function") ks.decQty(id);
      if (action === "remove" && typeof ks.removeFromCart === "function") ks.removeFromCart(id);
    }

    cartItems.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      applyAction(btn.dataset.action, btn.dataset.id);
    });

    checkoutBtn?.addEventListener("click", goCheckout);
    mobileCheckoutBtn?.addEventListener("click", goCheckout);

    // init responsive UI
    updateMobileBar();
    isMobileMQ.addEventListener?.("change", updateMobileBar);
    window.addEventListener("resize", updateMobileBar);

    // initial render
    render(getCart());
    window.KStore?.syncBadges?.();

    // best: store subscription
    if (window.KStore?.subscribe) {
      window.KStore.subscribe((evt) => {
        if (evt?.type === "CART_CHANGED" || evt?.type === "INIT") {
          render(evt.cart || getCart());
        }
      });
    }

    // fallback event
    document.addEventListener("cart:updated", () => render(getCart()));
  }

  // ✅ Robust init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
