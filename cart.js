/* ================= cart.js (UPDATED FOR NEW store.js) =================
   ✅ Reads cart from KStore (preferred) OR localStorage(cart)
   ✅ If KStore exists but empty, imports localStorage cart into KStore
   ✅ Qty +/- remove works with KStore OR fallback localStorage
   ✅ Sync via:
      - KStore.subscribe
      - cart:updated event
      - localStorage "storage" event
      - BroadcastChannel v2 + v1
   ✅ Safe DOM rendering (no unsafe innerHTML)
====================================================================== */

(() => {
  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  const FALLBACK_IMG = "images_brown/bodyButter.png";
  const isMobileMQ = window.matchMedia("(max-width: 980px)");

  const CART_KEY = "cart";
  const CHANNEL_V2 = "kikelara_cart_sync_v2";
  const CHANNEL_V1 = "kikelara_cart_sync_v1";

  const bc2 = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL_V2) : null;
  const bc1 = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL_V1) : null;

  function formatNaira(n) {
    const num = Number(n || 0);
    try { return `₦${num.toLocaleString()}`; } catch { return `₦${num}`; }
  }

  function resolveImageUrl(val) {
    const s = String(val || "").trim();
    if (!s) return FALLBACK_IMG;

    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/uploads/") && API_BASE) return `${API_BASE}${s}`;
    if (s.startsWith("uploads/") && API_BASE) return `${API_BASE}/${s}`;

    return s; // relative local path like images_brown/...
  }

  function safeReadCart(storage) {
    try {
      const raw = storage.getItem(CART_KEY);
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function safeWriteCart(storage, cart) {
    try { storage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }

  function normalizeCart(cart) {
    const list = Array.isArray(cart) ? cart : [];
    return list
      .map((i) => {
        const id = String(i?.id ?? "").trim();
        if (!id) return null;

        const price = Number(i?.price || 0);
        const qty = Math.max(1, Math.floor(Number(i?.qty || 1)));

        const image = i?.image_url || i?.image || i?.img || "";

        return {
          id,
          name: String(i?.name || "Product").trim() || "Product",
          price: Number.isFinite(price) ? price : 0,
          qty: Number.isFinite(qty) ? qty : 1,
          image, // renderer resolves it
          image_url: i?.image_url || undefined
        };
      })
      .filter(Boolean);
  }

  /* ---------- KStore helpers ---------- */
  function getKStore() {
    return window.KStore && typeof window.KStore.getCart === "function" ? window.KStore : null;
  }

  function getKStoreCart() {
    const ks = getKStore();
    if (!ks) return null;
    const v = ks.getCart();
    return Array.isArray(v) ? v : [];
  }

  function setKStoreCartIfPossible(cart) {
    const ks = getKStore();
    if (!ks) return false;

    if (typeof ks.setCart === "function") {
      try { ks.setCart(cart); return true; } catch {}
    }

    // no setter available
    return false;
  }

  function readLocalPreferred() {
    const local = normalizeCart(safeReadCart(localStorage));
    if (local.length) return local;
    const sess = normalizeCart(safeReadCart(sessionStorage));
    return sess;
  }

  function getCart() {
    // 1) Prefer KStore if it has data
    const ksCart = getKStoreCart();
    if (Array.isArray(ksCart) && ksCart.length) return normalizeCart(ksCart);

    // 2) Else localStorage (canonical)
    const local = readLocalPreferred();
    if (local.length) {
      // If KStore exists but empty, import once
      if (Array.isArray(ksCart) && ksCart.length === 0) {
        setKStoreCartIfPossible(local);
      }
      return local;
    }

    return [];
  }

  function broadcastCartUpdated() {
    document.dispatchEvent(new Event("cart:updated"));

    // Ping both channels for older listeners
    try { bc2?.postMessage({ type: "CART_UPDATED" }); } catch {}
    try { bc1?.postMessage({ type: "CART_UPDATED" }); } catch {}
  }

  function saveCartFallback(cart) {
    const clean = normalizeCart(cart);

    // ✅ Canonical: localStorage
    safeWriteCart(localStorage, clean);
    // legacy mirror
    safeWriteCart(sessionStorage, clean);

    // keep KStore in sync if possible
    setKStoreCartIfPossible(clean);

    broadcastCartUpdated();
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
      cartItems.replaceChildren();

      if (!Array.isArray(cart) || cart.length === 0) {
        cartItems.appendChild(makeEmptyState());
        updateSummary([]);
        return;
      }

      for (const item of cart) cartItems.appendChild(makeRow(item));
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
      if (!id) return;

      const ks = getKStore();

      // ✅ Use KStore when possible (it will also update localStorage via store.js)
      if (ks) {
        if (action === "increase" && typeof ks.incQty === "function") return ks.incQty(id);
        if (action === "decrease" && typeof ks.decQty === "function") return ks.decQty(id);
        if (action === "remove" && typeof ks.removeFromCart === "function") return ks.removeFromCart(id);
      }

      // fallback: manipulate localStorage cart directly
      const cart = getCart();
      const idx = cart.findIndex(x => String(x.id) === String(id));
      if (idx === -1) return;

      if (action === "increase") cart[idx].qty = Math.max(1, Number(cart[idx].qty || 1) + 1);
      if (action === "decrease") cart[idx].qty = Math.max(1, Number(cart[idx].qty || 1) - 1);
      if (action === "remove") cart.splice(idx, 1);

      saveCartFallback(cart);
      render(cart);
      window.KStore?.syncBadges?.();
    }

    cartItems.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      applyAction(btn.dataset.action, btn.dataset.id);
    });

    checkoutBtn?.addEventListener("click", goCheckout);
    mobileCheckoutBtn?.addEventListener("click", goCheckout);

    // responsive UI
    updateMobileBar();
    isMobileMQ.addEventListener?.("change", updateMobileBar);
    window.addEventListener("resize", updateMobileBar);

    // initial render (and import if needed)
    const first = getCart();
    render(first);
    window.KStore?.syncBadges?.();

    /* ---------- live sync listeners ---------- */

    // KStore subscription (best)
    if (window.KStore?.subscribe) {
      window.KStore.subscribe((evt) => {
        if (evt?.type === "CART_CHANGED" || evt?.type === "INIT") {
          render(normalizeCart(evt.cart || getCart()));
        }
      });
    }

    // cart:updated event
    document.addEventListener("cart:updated", () => render(getCart()));

    // localStorage cross-tab (fallback when BroadcastChannel not supported)
    window.addEventListener("storage", (e) => {
      if (e.key === CART_KEY) render(getCart());
    });

    // BroadcastChannels (v2 + v1)
    function onBCMessage(msg) {
      const data = msg?.data || {};
      if (data.type === "CART_UPDATED" || data.type === "SYNC") {
        render(getCart());
      }
      if (data.type === "REQUEST_SYNC") {
        // store.js responds; but if store.js missing, we can respond too
        try {
          const payload = { type: "SYNC", cart: safeReadCart(localStorage) };
          bc2?.postMessage(payload);
          bc1?.postMessage(payload);
        } catch {}
      }
    }

    bc2?.addEventListener?.("message", onBCMessage);
    bc1?.addEventListener?.("message", onBCMessage);
  }

  // ✅ Robust init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
