/* ================= store.js (KÍKÉLÁRÁ CART ONLY) =================
   ✅ Canonical cart in localStorage (persists)
   ✅ Mirrors into sessionStorage (legacy compatibility)
   ✅ Cross-tab sync via BroadcastChannel:
      - REQUEST_SYNC handshake (new tabs instantly get cart)
      - SYNC payload copies cart into each tab
   ✅ Shared helpers for cart pages + header badge sync
   ✅ Updates: #cartCount + #cartCountMobile
   ✅ Resolves /uploads paths using window.API_BASE
================================================================== */

(() => {
  const CART_KEY = "cart";

  // ✅ Support both channels (older + newer)
  const CHANNEL_V2 = "kikelara_cart_sync_v2";
  const CHANNEL_V1 = "kikelara_cart_sync_v1";

  const bc2 = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL_V2) : null;
  const bc1 = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL_V1) : null;

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
    if (!val) return "images_brown/bodyButter.png";

    // already absolute (signed url)
    if (/^https?:\/\//i.test(val)) return val;

    // backend uploads
    const base = apiBase();
    if (val.startsWith("/uploads/") && base) return `${base}${val}`;
    if (val.startsWith("uploads/") && base) return `${base}/${val}`;

    // normal relative file
    return val;
  }

  /* ----------------- Storage: read/write ----------------- */
  function readLocal() {
    const v = safeParse(localStorage.getItem(CART_KEY), []);
    return Array.isArray(v) ? v : [];
  }
  function writeLocal(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }

  function readSession() {
    const v = safeParse(sessionStorage.getItem(CART_KEY), []);
    return Array.isArray(v) ? v : [];
  }
  function writeSession(cart) {
    try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }

  // ✅ Canonical read = localStorage; if empty but session has items, migrate.
  function readCart() {
    const local = readLocal();
    if (local.length) return local;

    const sess = readSession();
    if (sess.length) {
      writeLocal(sess);
      return sess;
    }
    return [];
  }

  // ✅ Canonical write = localStorage; mirror sessionStorage for old pages
  function writeCart(cart) {
    writeLocal(cart);
    writeSession(cart);
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

  function sanitizeCart(list) {
    const arr = Array.isArray(list) ? list : [];
    return arr.map(sanitizeItem).filter(Boolean);
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

  function post(msg) {
    try { bc2?.postMessage(msg); } catch {}
    try { bc1?.postMessage(msg); } catch {}
  }

  /* ----------------- Core Set/Get ----------------- */
  function setCart(nextCart, { broadcast = true } = {}) {
    const cart = sanitizeCart(nextCart);
    writeCart(cart);
    syncBadges(cart);
    notify(cart);

    if (broadcast) post({ type: "SYNC", cart });
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

  // increases qty if exists; otherwise adds
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
  function onMessage(msg) {
    const data = msg?.data || {};
    const type = data?.type;

    if (type === "REQUEST_SYNC") {
      post({ type: "SYNC", cart: readCart() });
      return;
    }

    if (type === "SYNC") {
      const incoming = sanitizeCart(data.cart);
      // ✅ Apply incoming without rebroadcast (avoid loops)
      setCart(incoming, { broadcast: false });
      return;
    }

    // optional legacy: CART_UPDATED ping (some pages use it)
    if (type === "CART_UPDATED") {
      syncBadges(readCart());
      notify(readCart());
    }
  }

  if (bc2) bc2.onmessage = onMessage;
  if (bc1) bc1.onmessage = onMessage;

  /* ----------------- Init ----------------- */
  document.addEventListener("DOMContentLoaded", () => {
    // initial
    syncBadges(readCart());

    // header inject retry (because header.js mounts later)
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      syncBadges(readCart());
      if (tries >= 14) clearInterval(t);
    }, 140);

    // ask other tabs for cart so this tab immediately matches
    post({ type: "REQUEST_SYNC" });
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
    addToCart,
    removeFromCart,
    setQty,
    incQty,
    decQty,
    clearCart,

    // events
    subscribe
  };
})();
