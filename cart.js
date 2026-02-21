/* ================= cart.js (WORLD-CLASS CART UX)
   ✅ Premium layout + better mobile hierarchy
   ✅ Reads cart from KStore (preferred) OR localStorage(cart)
   ✅ If KStore exists but empty, imports localStorage cart into KStore
   ✅ Qty +/- remove works with KStore OR fallback localStorage
   ✅ Undo remove toast (best practice)
   ✅ Clear cart
   ✅ Sticky summary desktop + mobile sticky bar
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

  function productUrl(id) {
    if (id === undefined || id === null || id === "") return "products.html";
    return `product-details.html?id=${encodeURIComponent(String(id))}`;
  }

  function resolveImageUrl(val) {
    const s = String(val || "").trim();
    if (!s) return FALLBACK_IMG;

    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/uploads/") && API_BASE) return `${API_BASE}${s}`;
    if (s.startsWith("uploads/") && API_BASE) return `${API_BASE}/${s}`;
    return s; // relative local path
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
          image,
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

  function setCartUnified(cart) {
    const ks = getKStore();
    const clean = normalizeCart(cart);

    if (ks && typeof ks.setCart === "function") {
      try { ks.setCart(clean); return true; } catch {}
    }

    // fallback (canonical localStorage)
    safeWriteCart(localStorage, clean);
    safeWriteCart(sessionStorage, clean);
    try { document.dispatchEvent(new Event("cart:updated")); } catch {}
    try { bc2?.postMessage({ type: "CART_UPDATED" }); } catch {}
    try { bc1?.postMessage({ type: "CART_UPDATED" }); } catch {}
    return true;
  }

  function readLocalPreferred() {
    const local = normalizeCart(safeReadCart(localStorage));
    if (local.length) return local;
    const sess = normalizeCart(safeReadCart(sessionStorage));
    return sess;
  }

  function getCart() {
    const ksCart = getKStoreCart();
    if (Array.isArray(ksCart) && ksCart.length) return normalizeCart(ksCart);

    const local = readLocalPreferred();
    if (local.length) {
      if (Array.isArray(ksCart) && ksCart.length === 0) {
        setCartUnified(local); // import once
      }
      return local;
    }
    return [];
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

  /* ---------- Toast (Undo) ---------- */
  function makeToast(host, message, { actionText, onAction, ttlMs = 5200 } = {}) {
    if (!host) return () => {};

    const toast = document.createElement("div");
    toast.className = "toast";

    const msg = document.createElement("div");
    msg.className = "toast-msg";
    msg.textContent = message;

    const actions = document.createElement("div");
    actions.className = "toast-actions";

    let cleared = false;
    let timer = null;

    function close() {
      if (cleared) return;
      cleared = true;
      if (timer) clearTimeout(timer);
      toast.remove();
    }

    if (actionText && typeof onAction === "function") {
      const act = document.createElement("button");
      act.type = "button";
      act.className = "toast-btn";
      act.textContent = actionText;
      act.addEventListener("click", () => {
        try { onAction(); } catch {}
        close();
      });
      actions.appendChild(act);
    }

    const x = document.createElement("button");
    x.type = "button";
    x.className = "toast-x";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "✕";
    x.addEventListener("click", close);
    actions.appendChild(x);

    toast.appendChild(msg);
    toast.appendChild(actions);
    host.appendChild(toast);

    timer = setTimeout(close, Math.max(2000, ttlMs));
    return close;
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

    const cartCountText = document.getElementById("cartCountText");
    const itemsCount = document.getElementById("itemsCount");
    const mobileItemsText = document.getElementById("mobileItemsText");

    const clearCartBtn = document.getElementById("clearCartBtn");
    const cartSummary = document.getElementById("cartSummary");
    const toastHost = document.getElementById("toastHost");

    if (!cartItems) return;

    function totalItems(cart) {
      return cart.reduce((n, it) => n + Math.max(0, Number(it?.qty || 0)), 0);
    }

    function updateSummary(cart) {
      const sub = calcSubtotal(cart);
      const total = sub;
      const count = totalItems(cart);

      if (subtotalEl) subtotalEl.textContent = formatNaira(sub);
      if (totalEl) totalEl.textContent = formatNaira(total);
      if (checkoutBtnTotal) checkoutBtnTotal.textContent = formatNaira(total);
      if (mobileCheckoutTotal) mobileCheckoutTotal.textContent = formatNaira(total);

      if (itemsCount) itemsCount.textContent = String(count);
      if (cartCountText) cartCountText.textContent = `${count} item${count === 1 ? "" : "s"}`;
      if (mobileItemsText) mobileItemsText.textContent = `${count} item${count === 1 ? "" : "s"}`;

      const empty = cart.length === 0;
      setDisabled(checkoutBtn, empty);
      setDisabled(mobileCheckoutBtn, empty);
      setDisabled(clearCartBtn, empty);

      // sticky class control
      const isMobile = isMobileMQ.matches;
      if (cartSummary) {
        if (!isMobile) cartSummary.classList.add("is-sticky");
        else cartSummary.classList.remove("is-sticky");
      }
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
      const name = String(item?.name || "Product").trim() || "Product";

      const imgVal = item?.image_url || item?.image || item?.img || "";
      const imgSrc = resolveImageUrl(imgVal);

      const row = document.createElement("div");
      row.className = "cart-item";
      row.dataset.id = id;

      // media link
      const mediaLink = document.createElement("a");
      mediaLink.className = "cart-media";
      mediaLink.href = productUrl(id);
      mediaLink.setAttribute("aria-label", `View ${name}`);

      const img = document.createElement("img");
      img.className = "cart-img";
      img.src = imgSrc;
      img.alt = name;
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;
      img.addEventListener("error", () => {
        if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
      });
      mediaLink.appendChild(img);

      // info
      const info = document.createElement("div");
      info.className = "cart-info";

      const topline = document.createElement("div");
      topline.className = "cart-topline";

      const nm = document.createElement("a");
      nm.className = "cart-name";
      nm.href = productUrl(id);
      nm.textContent = name;

      topline.appendChild(nm);

      const prices = document.createElement("div");
      prices.className = "cart-prices";

      const unit = document.createElement("span");
      unit.className = "cart-unit";
      unit.textContent = `Unit: ${formatNaira(price)}`;

      const lineTotal = document.createElement("span");
      lineTotal.className = "cart-line-total";
      lineTotal.textContent = formatNaira(price * qty);
      lineTotal.setAttribute("aria-label", `Line total ${formatNaira(price * qty)}`);

      prices.appendChild(unit);
      prices.appendChild(lineTotal);

      const actions = document.createElement("div");
      actions.className = "cart-actions";

      const qtyWrap = document.createElement("div");
      qtyWrap.className = "qty";

      const ql = document.createElement("span");
      ql.className = "qty-label";
      ql.textContent = "Qty";

      const controls = document.createElement("div");
      controls.className = "qty-controls";

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

      controls.appendChild(dec);
      controls.appendChild(num);
      controls.appendChild(inc);

      qtyWrap.appendChild(ql);
      qtyWrap.appendChild(controls);

      const rm = document.createElement("button");
      rm.className = "remove-btn";
      rm.type = "button";
      rm.dataset.action = "remove";
      rm.dataset.id = id;
      rm.setAttribute("aria-label", "Remove item");

      const ico = document.createElement("span");
      ico.className = "remove-ico";
      ico.textContent = "✕";

      const txt = document.createElement("span");
      txt.textContent = "Remove";

      rm.appendChild(ico);
      rm.appendChild(txt);

      actions.appendChild(qtyWrap);
      actions.appendChild(rm);

      info.appendChild(topline);
      info.appendChild(prices);
      info.appendChild(actions);

      row.appendChild(mediaLink);
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

      // For undo-remove we want a snapshot BEFORE removing
      if (action === "remove") {
        const before = getCart();
        const idx = before.findIndex(x => String(x.id) === String(id));
        if (idx === -1) return;

        const removed = before[idx];

        // remove via KStore if possible
        if (ks && typeof ks.removeFromCart === "function") {
          try { ks.removeFromCart(id); } catch {}
        } else {
          before.splice(idx, 1);
          setCartUnified(before);
          render(before);
        }

        // Undo (reinsert only the removed item)
        makeToast(toastHost, `Removed “${removed.name}”.`, {
          actionText: "UNDO",
          onAction: () => {
            const cur = getCart();
            const exists = cur.some(x => String(x.id) === String(removed.id));
            if (exists) return;

            const insertAt = Math.min(idx, cur.length);
            const next = cur.slice();
            next.splice(insertAt, 0, removed);
            setCartUnified(next);
            render(next);
            window.KStore?.syncBadges?.();
          },
          ttlMs: 6000
        });

        window.KStore?.syncBadges?.();
        return;
      }

      // Qty changes
      if (ks) {
        if (action === "increase" && typeof ks.incQty === "function") { try { ks.incQty(id); } catch {} return; }
        if (action === "decrease" && typeof ks.decQty === "function") { try { ks.decQty(id); } catch {} return; }
      }

      // fallback: manipulate localStorage cart directly
      const cart = getCart();
      const idx = cart.findIndex(x => String(x.id) === String(id));
      if (idx === -1) return;

      if (action === "increase") cart[idx].qty = Math.max(1, Number(cart[idx].qty || 1) + 1);
      if (action === "decrease") cart[idx].qty = Math.max(1, Number(cart[idx].qty || 1) - 1);

      setCartUnified(cart);
      render(cart);
      window.KStore?.syncBadges?.();
    }

    function clearCart() {
      const cart = getCart();
      if (!cart.length) return;

      // snapshot for undo
      const before = cart.slice();

      setCartUnified([]);
      render([]);

      makeToast(toastHost, "Cart cleared.", {
        actionText: "UNDO",
        onAction: () => {
          setCartUnified(before);
          render(before);
          window.KStore?.syncBadges?.();
        },
        ttlMs: 6500
      });

      window.KStore?.syncBadges?.();
    }

    cartItems.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      applyAction(btn.dataset.action, btn.dataset.id);
    });

    checkoutBtn?.addEventListener("click", goCheckout);
    mobileCheckoutBtn?.addEventListener("click", goCheckout);
    clearCartBtn?.addEventListener("click", clearCart);

    // responsive UI
    updateMobileBar();
    isMobileMQ.addEventListener?.("change", () => {
      updateMobileBar();
      updateSummary(getCart());
    });
    window.addEventListener("resize", () => {
      updateMobileBar();
      updateSummary(getCart());
    });

    // initial render
    const first = getCart();
    render(first);
    window.KStore?.syncBadges?.();

    /* ---------- live sync listeners ---------- */

    // KStore subscription (best)
    if (window.KStore?.subscribe) {
      window.KStore.subscribe((evt) => {
        if (evt?.type === "CART_CHANGED" || evt?.type === "INIT") {
          const next = normalizeCart(evt.cart || getCart());
          render(next);
        }
      });
    }

    // cart:updated event
    document.addEventListener("cart:updated", () => render(getCart()));

    // localStorage cross-tab fallback
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
