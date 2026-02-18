/* ================= store.js (KÍKÉLÁRÁ CART ONLY) =================
   ✅ SessionStorage ONLY (cart)
   ✅ Cross-tab sync via BroadcastChannel:
      - REQUEST_SYNC handshake (new tabs instantly get cart)
      - SYNC payload copies cart into each tab's sessionStorage
   ✅ Shared helpers for cart pages + header badge sync
   ✅ Updates: #cartCount + #cartCountMobile
   ✅ Resolves /uploads paths using window.API_BASE
================================================================== */

(() => {
  const CART_KEY = "cart";

  // BroadcastChannel name
  const CHANNEL = "kikelara_cart_sync_v2";
  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL) : null;

  const subs = new Set();

  /* ----------------- Utils ----------------- */
  function safeParse(v, fallback) {
    try { return JSON.parse(v) ?? fallback; } catch { return fallback; }
  }

  function normId(id) {
    return String(id ?? "").trim();
  }

  function num(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function clampInt(n, min = 1, max = 9999) {
    const x = Math.floor(num(n, min));
    return Math.max(min, Math.min(max, x));
  }

  function apiBase() {
    return String(window.API_BASE || "").replace(/\/+$/, "");
  }

  // Make image URL usable everywhere (supports backend /uploads)
  function resolveImageUrl(img) {
    const val = String(img || "").trim();
    if (!val) return "images/placeholder.png"; // ✅ use your butter/cream placeholder image

    // already absolute (signed url)
    if (/^https?:\/\//i.test(val)) return val;

    // backend uploads
    const base = apiBase();
    if (val.startsWith("/uploads/") && base) return `${base}${val}`;
    if (val.startsWith("uploads/") && base) return `${base}/${val}`;

    // normal relative file
    return val;
  }

  function readCart() {
    const v = safeParse(sessionStorage.getItem(CART_KEY), []);
    return Array.isArray(v) ? v : [];
  }

  function writeCart(cart) {
    try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }

  function sanitizeItem(p) {
    const id = normId(p?.id);
    if (!id) return null;

    return {
      id,
      name: String(p?.name || "Product").trim() || "Product",
      price: num(p?.price, 0),
      image: resolveImageUrl(p?.image || p?.image_url || p?.img || ""),
      qty: clampInt(p?.qty || 1, 1, 999)
    };
  }

  /* ----------------- Badge Sync ----------------- */
  function cartQty(cart = readCart()) {
    return cart.reduce((sum, it) => sum + clampInt(it?.qty || 0, 0, 999), 0);
  }

  function syncBadges(cart = readCart()) {
    const n = cartQty(cart);

    const desktop = document.getElementById("cartCount");
    const mobile = document.getElementById("cartCountMobile");

    if (desktop) {
      desktop.textContent = String(n);
      desktop.hidden = n <= 0;
      desktop.setAttribute("aria-label", `${n} items in cart`);
    }
    if (mobile) {
      mobile.textContent = String(n);
    }
  }

  /* ----------------- Events ----------------- */
  function emit(evt) {
    subs.forEach(fn => { try { fn(evt); } catch {} });
  }

  function notify(cart) {
    emit({ type: "CART_CHANGED", cart });
    document.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart } }));
  }

  /* ----------------- Core Set/Get ----------------- */
  function setCart(nextCart, { broadcast = true } = {}) {
    const cart = Array.isArray(nextCart) ? nextCart : [];
    writeCart(cart);
    syncBadges(cart);
    notify(cart);

    if (broadcast && bc) {
      try { bc.postMessage({ type: "SYNC", cart }); } catch {}
    }
  }

  function getCart() {
    return readCart();
  }

  /* ----------------- Cart Operations ----------------- */
  function addToCartOnce(product) {
    const item = sanitizeItem(product);
    if (!item) return;

    const cart = readCart();
    if (cart.some(i => normId(i.id) === item.id)) {
      syncBadges(cart);
      return;
    }

    cart.push({ ...item, qty: 1 });
    setCart(cart);
  }

  // Optional helper (nice for product pages): increases qty if exists
  function addToCart(product, qty = 1) {
    const item = sanitizeItem(product);
    if (!item) return;

    const q = clampInt(qty, 1, 999);
    const cart = readCart();
    const idx = cart.findIndex(i => normId(i.id) === item.id);

    if (idx >= 0) {
      cart[idx] = { ...cart[idx], qty: clampInt(num(cart[idx].qty, 1) + q, 1, 999) };
    } else {
      cart.push({ ...item, qty: q });
    }
    setCart(cart);
  }

  function removeFromCart(id) {
    const key = normId(id);
    setCart(readCart().filter(i => normId(i.id) !== key));
  }

  function setQty(id, qty) {
    const key = normId(id);
    const q = Math.floor(num(qty, 0));

    const cart = readCart();
    if (q <= 0) return setCart(cart.filter(i => normId(i.id) !== key));

    const next = cart.map(i => (normId(i.id) === key ? { ...i, qty: clampInt(q, 1, 999) } : i));
    setCart(next);
  }

  function incQty(id) {
    const key = normId(id);
    const cart = readCart();
    const next = cart.map(i => (
      normId(i.id) === key
        ? { ...i, qty: clampInt(num(i.qty, 1) + 1, 1, 999) }
        : i
    ));
    setCart(next);
  }

  function decQty(id) {
    const key = normId(id);
    const cart = readCart();
    const found = cart.find(i => normId(i.id) === key);
    if (!found) return;
    setQty(key, num(found.qty, 1) - 1);
  }

  function clearCart() {
    setCart([]);
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    subs.add(fn);
    try { fn({ type: "INIT", cart: readCart() }); } catch {}
    return () => subs.delete(fn);
  }

  /* ----------------- Cross-tab Sync ----------------- */
  if (bc) {
    bc.onmessage = (msg) => {
      const data = msg?.data || {};
      const type = data?.type;

      // Someone asks for cart -> respond with our current cart
      if (type === "REQUEST_SYNC") {
        try { bc.postMessage({ type: "SYNC", cart: readCart() }); } catch {}
        return;
      }

      // Receive cart -> store in THIS tab sessionStorage
      if (type === "SYNC") {
        const incoming = Array.isArray(data.cart) ? data.cart : [];
        writeCart(incoming);
        syncBadges(incoming);
        notify(incoming);
      }
    };
  }

  /* ----------------- Init ----------------- */
  document.addEventListener("DOMContentLoaded", () => {
    // sync once now
    const cart = readCart();
    syncBadges(cart);

    // header inject retry (because header.js mounts later)
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      syncBadges(readCart());
      if (tries >= 14) clearInterval(t);
    }, 140);

    // ask other tabs for cart so this tab immediately matches (IMPORTANT)
    if (bc) {
      try { bc.postMessage({ type: "REQUEST_SYNC" }); } catch {}
    }
  });

  /* ----------------- Export ----------------- */
  window.KStore = {
    // data
    getCart,
    setCart,
    cartQty,
    syncBadges,

    // ops
    addToCartOnce,
    addToCart,      // ✅ optional, useful on product pages
    removeFromCart,
    setQty,
    incQty,
    decQty,
    clearCart,

    // events
    subscribe
  };
})();
