/* ================= store.js (KÍKÉLÁRÁ CART ONLY) =================
   ✅ SessionStorage ONLY (cart)
   ✅ Cross-tab sync via BroadcastChannel (copies payload into each tab)
   ✅ Shared helpers for cart pages + header badge sync
   ✅ Updates: #cartCount + #cartCountMobile
================================================================== */

(() => {
  const CART_KEY = "cart";

  const CHANNEL = "kikelara_cart_sync_v1";
  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL) : null;

  const subs = new Set();

  function safeParse(v, fallback) {
    try { return JSON.parse(v) ?? fallback; } catch { return fallback; }
  }
  function readCart() {
    const v = safeParse(sessionStorage.getItem(CART_KEY), []);
    return Array.isArray(v) ? v : [];
  }
  function writeCart(cart) {
    try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
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

  function cartQty(cart = readCart()) {
    return cart.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
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
    if (mobile) mobile.textContent = String(n);
  }

  function emit(evt) {
    subs.forEach(fn => { try { fn(evt); } catch {} });
  }

  function setCart(nextCart, { broadcast = true } = {}) {
    const cart = Array.isArray(nextCart) ? nextCart : [];
    writeCart(cart);
    syncBadges(cart);
    emit({ type: "CART_CHANGED", cart });

    document.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart } }));

    if (broadcast && bc) {
      try { bc.postMessage({ type: "SYNC", cart }); } catch {}
    }
  }

  function getCart() { return readCart(); }

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

  function removeFromCart(id) {
    const key = normId(id);
    setCart(readCart().filter(i => normId(i.id) !== key));
  }

  function setQty(id, qty) {
    const key = normId(id);
    let q = Number(qty || 0);

    const cart = readCart();
    if (q <= 0) return setCart(cart.filter(i => normId(i.id) !== key));

    const next = cart.map(i => (normId(i.id) === key ? { ...i, qty: Math.max(1, q) } : i));
    setCart(next);
  }

  function incQty(id) {
    const key = normId(id);
    const cart = readCart();
    const next = cart.map(i => (normId(i.id) === key ? { ...i, qty: (Number(i.qty) || 1) + 1 } : i));
    setCart(next);
  }

  function decQty(id) {
    const key = normId(id);
    const cart = readCart();
    const found = cart.find(i => normId(i.id) === key);
    if (!found) return;
    setQty(key, (Number(found.qty) || 1) - 1);
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    subs.add(fn);
    try { fn({ type: "INIT", cart: readCart() }); } catch {}
    return () => subs.delete(fn);
  }

  // Cross-tab sync
  if (bc) {
    bc.onmessage = (msg) => {
      if (msg?.data?.type !== "SYNC") return;
      const incoming = Array.isArray(msg.data.cart) ? msg.data.cart : [];
      writeCart(incoming);
      syncBadges(incoming);
      emit({ type: "CART_CHANGED", cart: incoming });
      document.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart: incoming } }));
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncBadges(readCart());

    // header inject retry
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      syncBadges(readCart());
      if (tries >= 12) clearInterval(t);
    }, 150);
  });

  window.KStore = {
    getCart,
    setCart,
    cartQty,
    syncBadges,
    addToCartOnce,
    removeFromCart,
    setQty,
    incQty,
    decQty,
    subscribe
  };
})();
