/* ================= store.js (KÍKÉLÁRÁ Shared Store) =================
   ✅ SessionStorage ONLY (cart + wishlist)
   ✅ Cross-tab sync via BroadcastChannel (sends full payload)
   ✅ Shared helpers for products.js, product-details.js, cart.js
   ✅ Auto-updates header badges: #cartCount, #wishlistCount
==================================================================== */

(() => {
  const CART_KEY = "cart";
  const WISHLIST_KEY = "wishlist";

  const CHANNEL = "kikelara_store_sync_v3";
  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL) : null;

  const subs = new Set();

  function safeParse(v, fallback) {
    try {
      const out = JSON.parse(v);
      return out ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readSession(key, fallback) {
    return safeParse(sessionStorage.getItem(key), fallback);
  }

  function writeSession(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function normId(id) { return String(id ?? "").trim(); }

  function sanitizeItem(p) {
    const id = normId(p?.id);
    if (!id) return null;

    return {
      id,
      name: String(p?.name || "Product"),
      price: Number(p?.price || 0),
      image: String(p?.image || p?.image_url || "images_brown/bodyButter.png"),
      qty: Math.max(1, Number(p?.qty || 1))
    };
  }

  function getCart() {
    const v = readSession(CART_KEY, []);
    return Array.isArray(v) ? v : [];
  }

  function getWishlist() {
    const v = readSession(WISHLIST_KEY, []);
    return Array.isArray(v) ? v : [];
  }

  function cartQty(cart = getCart()) {
    return cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }

  function syncBadges(cart = getCart(), wishlist = getWishlist()) {
    const cartEl = document.getElementById("cartCount");
    if (cartEl) cartEl.textContent = String(cartQty(cart));

    const wishEl = document.getElementById("wishlistCount");
    if (wishEl) wishEl.textContent = String(Array.isArray(wishlist) ? wishlist.length : 0);
  }

  // Header injection sometimes happens after DOMContentLoaded
  function softBadgeSync() {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      syncBadges();
      if (tries >= 12) clearInterval(t);
    }, 150);
  }

  function emit(type, payload = {}) {
    const evt = { type, ...payload };
    subs.forEach(fn => {
      try { fn(evt); } catch {}
    });
  }

  function setCart(nextCart, { broadcast = true } = {}) {
    const cart = Array.isArray(nextCart) ? nextCart : [];
    writeSession(CART_KEY, cart);
    syncBadges(cart);
    emit("CART_CHANGED", { cart });

    if (broadcast && bc) {
      try { bc.postMessage({ type: "SYNC", cart, wishlist: getWishlist() }); } catch {}
    }
  }

  function setWishlist(nextWishlist, { broadcast = true } = {}) {
    const wishlist = Array.isArray(nextWishlist) ? nextWishlist : [];
    writeSession(WISHLIST_KEY, wishlist);
    syncBadges(getCart(), wishlist);
    emit("WISHLIST_CHANGED", { wishlist });

    if (broadcast && bc) {
      try { bc.postMessage({ type: "SYNC", cart: getCart(), wishlist }); } catch {}
    }
  }

  function isInCart(id) {
    const key = normId(id);
    return getCart().some(i => normId(i.id) === key);
  }

  // Default behavior: ADD ONCE (does not increase qty if already exists)
  function addToCartOnce(product) {
    const item = sanitizeItem(product);
    if (!item) return;

    const cart = getCart();
    if (cart.some(i => normId(i.id) === item.id)) {
      syncBadges(cart);
      return;
    }

    cart.push({ ...item, qty: 1 });
    setCart(cart);
  }

  function removeFromCart(id) {
    const key = normId(id);
    const cart = getCart().filter(i => normId(i.id) !== key);
    setCart(cart);
  }

  function setQty(id, qty) {
    const key = normId(id);
    let q = Number(qty || 0);
    const cart = getCart();

    if (q <= 0) {
      setCart(cart.filter(i => normId(i.id) !== key));
      return;
    }

    const next = cart.map(i => {
      if (normId(i.id) !== key) return i;
      return { ...i, qty: Math.max(1, q) };
    });

    setCart(next);
  }

  function incQty(id) {
    const key = normId(id);
    const cart = getCart();
    const next = cart.map(i => (normId(i.id) === key ? { ...i, qty: (Number(i.qty) || 1) + 1 } : i));
    setCart(next);
  }

  function decQty(id) {
    const key = normId(id);
    const cart = getCart();
    const found = cart.find(i => normId(i.id) === key);
    if (!found) return;
    const nextQty = (Number(found.qty) || 1) - 1;
    setQty(key, nextQty);
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    subs.add(fn);
    // immediate snapshot
    try { fn({ type: "INIT", cart: getCart(), wishlist: getWishlist() }); } catch {}
    return () => subs.delete(fn);
  }

  // Cross-tab sync: copies payload into THIS tab’s sessionStorage too
  if (bc) {
    bc.onmessage = (msg) => {
      if (msg?.data?.type !== "SYNC") return;

      const incomingCart = Array.isArray(msg.data.cart) ? msg.data.cart : [];
      const incomingWishlist = Array.isArray(msg.data.wishlist) ? msg.data.wishlist : [];

      writeSession(CART_KEY, incomingCart);
      writeSession(WISHLIST_KEY, incomingWishlist);

      syncBadges(incomingCart, incomingWishlist);
      emit("CART_CHANGED", { cart: incomingCart });
      emit("WISHLIST_CHANGED", { wishlist: incomingWishlist });
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncBadges();
    softBadgeSync();
  });

  // Public API
  window.KStore = {
    // cart
    getCart,
    setCart,
    cartQty,
    isInCart,
    addToCartOnce,
    removeFromCart,
    setQty,
    incQty,
    decQty,

    // wishlist (optional)
    getWishlist,
    setWishlist,

    // ui / listeners
    syncBadges,
    subscribe
  };
})();
