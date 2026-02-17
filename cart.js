/* ================= CART.JS (PREMIUM + YOUR COLORS) =================
   ✅ Qty +/- only in cart
   ✅ No wishlist dependency (safe if wishlistCount exists)
   ✅ Delivery shown as “calculated at checkout”
   ✅ Shows totals inside checkout button
   ✅ Sticky mobile checkout bar
   ✅ Cart stored in localStorage(cart) for consistency across pages/tabs
   ✅ Cross-tab sync via storage event + BroadcastChannel
==================================================================== */

const CART_KEY = "cart";
const WISHLIST_KEY = "wishlist"; // optional badge safety

const CART_CHANNEL = "kikelara_cart_sync_v1";
const cartChannel = ("BroadcastChannel" in window) ? new BroadcastChannel(CART_CHANNEL) : null;

function safeJSON(storage, key, fallback) {
  try {
    const v = JSON.parse(storage.getItem(key));
    return v ?? fallback;
  } catch { return fallback; }
}
function saveJSON(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch {}
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* Resolve image safely (avoid broken / risky values) */
function resolveImage(url) {
  const u = String(url || "").trim();
  if (!u) return "images_brown/bodyButter.png";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (u.startsWith("images/") || u.startsWith("images_brown/")) return u;
  if (u.startsWith("/uploads/") && window.API_BASE) {
    const base = String(window.API_BASE || "").replace(/\/+$/, "");
    return `${base}${u}`;
  }
  return "images_brown/bodyButter.png";
}

function broadcastCartUpdated() {
  document.dispatchEvent(new Event("cart:updated"));
  if (cartChannel) { try { cartChannel.postMessage({ type: "CART_UPDATED" }); } catch {} }
}

let cart = [];

/* ✅ migrate old sessionStorage cart -> localStorage once */
(function migrateCartOnce() {
  const local = safeJSON(localStorage, CART_KEY, null);
  if (Array.isArray(local)) return;

  const old = safeJSON(sessionStorage, CART_KEY, null);
  if (Array.isArray(old)) {
    saveJSON(localStorage, CART_KEY, old);
    try { sessionStorage.removeItem(CART_KEY); } catch {}
  }
})();

function readCart() {
  const v = safeJSON(localStorage, CART_KEY, []);
  return Array.isArray(v) ? v : [];
}
function saveCart({ broadcast = true } = {}) {
  saveJSON(localStorage, CART_KEY, cart);
  if (broadcast) broadcastCartUpdated();
}

function formatNaira(n) { return `₦${Number(n || 0).toLocaleString()}`; }

const cartItems = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");

const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutBtnTotal = document.getElementById("checkoutBtnTotal");

const mobileCheckout = document.getElementById("mobileCheckout");
const mobileCheckoutBtn = document.getElementById("mobileCheckoutBtn");
const mobileCheckoutTotal = document.getElementById("mobileCheckoutTotal");

/* ================= HEADER BADGES ================= */
function updateHeaderBadges() {
  const cartCountEl = document.getElementById("cartCount");
  const wishlistCountEl = document.getElementById("wishlistCount");

  const cartQty = Array.isArray(cart)
    ? cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
    : 0;

  if (cartCountEl) {
    cartCountEl.textContent = String(cartQty);
    // if your header.js hides badge automatically, this is fine
  }

  if (wishlistCountEl) {
    const wLocal = safeJSON(localStorage, WISHLIST_KEY, []);
    const wSession = safeJSON(sessionStorage, WISHLIST_KEY, []);
    const w = Array.isArray(wLocal) ? wLocal : (Array.isArray(wSession) ? wSession : []);
    wishlistCountEl.textContent = String(w.length);
  }
}

/* ================= TOTALS ================= */
function calcSubtotal() {
  return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 0)), 0);
}
function updateSummary() {
  const subtotal = calcSubtotal();
  const total = subtotal;

  if (subtotalEl) subtotalEl.textContent = formatNaira(subtotal);
  if (totalEl) totalEl.textContent = formatNaira(total);

  if (checkoutBtnTotal) checkoutBtnTotal.textContent = formatNaira(total);
  if (mobileCheckoutTotal) mobileCheckoutTotal.textContent = formatNaira(total);
}
function updateCheckoutState() {
  const empty = !Array.isArray(cart) || cart.length === 0;

  if (checkoutBtn) {
    checkoutBtn.disabled = empty;
    checkoutBtn.style.opacity = empty ? "0.55" : "1";
    checkoutBtn.style.cursor = empty ? "not-allowed" : "pointer";
  }
  if (mobileCheckoutBtn) {
    mobileCheckoutBtn.disabled = empty;
    mobileCheckoutBtn.style.opacity = empty ? "0.55" : "1";
    mobileCheckoutBtn.style.cursor = empty ? "not-allowed" : "pointer";
  }
}

/* ================= RENDER ================= */
function renderCart() {
  if (!cartItems) return;
  cartItems.innerHTML = "";

  if (!Array.isArray(cart) || cart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty">
        <div class="empty-title">Your cart is empty.</div>
        <div class="empty-sub">Go to the shop and add something you love.</div>
        <a class="empty-btn" href="products.html">Back to Shop</a>
      </div>
    `;
    if (subtotalEl) subtotalEl.textContent = "₦0";
    if (totalEl) totalEl.textContent = "₦0";
    if (checkoutBtnTotal) checkoutBtnTotal.textContent = "₦0";
    if (mobileCheckoutTotal) mobileCheckoutTotal.textContent = "₦0";
    updateHeaderBadges();
    updateCheckoutState();
    return;
  }

  cart.forEach(item => {
    const id = String(item.id ?? "");
    const qty = Number(item.qty || 1);
    const price = Number(item.price || 0);

    const row = document.createElement("div");
    row.className = "cart-item";

    const imgSrc = resolveImage(item.image);
    const safeName = escapeHtml(item.name || "Item");

    row.innerHTML = `
      <img class="cart-img" src="${escapeHtml(imgSrc)}" alt="${safeName}" draggable="false">
      <div class="cart-info">
        <div class="cart-name">${safeName}</div>

        <div class="cart-meta">
          <span class="cart-price">${formatNaira(price)}</span>
          <span class="cart-dot">•</span>
          <span class="cart-line">${formatNaira(price * qty)}</span>
        </div>

        <div class="qty">
          <button class="qty-btn" data-action="decrease" data-id="${escapeHtml(id)}" aria-label="Decrease quantity">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" data-action="increase" data-id="${escapeHtml(id)}" aria-label="Increase quantity">+</button>
        </div>
      </div>

      <button class="remove" data-action="remove" data-id="${escapeHtml(id)}" type="button" aria-label="Remove item">
        Remove
      </button>
    `;
    cartItems.appendChild(row);
  });

  updateSummary();
  updateHeaderBadges();
  updateCheckoutState();
}

/* ================= EVENTS ================= */
cartItems?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = String(btn.dataset.id || "");
  if (!id) return;

  const item = cart.find(i => String(i.id) === id);

  if (action === "increase" && item) item.qty = (Number(item.qty) || 1) + 1;

  if (action === "decrease" && item) {
    item.qty = (Number(item.qty) || 1) - 1;
    if (item.qty <= 0) cart = cart.filter(i => String(i.id) !== id);
  }

  if (action === "remove") cart = cart.filter(i => String(i.id) !== id);

  saveCart();
  renderCart();
});

function goCheckout() {
  if (!cart.length) return;
  window.location.href = "checkout.html";
}

checkoutBtn?.addEventListener("click", goCheckout);
mobileCheckoutBtn?.addEventListener("click", goCheckout);

/* ================= MOBILE STICKY TOGGLE ================= */
function updateMobileBar() {
  const isMobile = window.matchMedia("(max-width: 980px)").matches;
  if (!mobileCheckout) return;
  mobileCheckout.style.display = isMobile ? "block" : "none";
}

/* ================= CROSS-TAB SYNC ================= */
window.addEventListener("storage", (e) => {
  if (e.key !== CART_KEY) return;
  cart = readCart();
  renderCart();
});

if (cartChannel) {
  cartChannel.onmessage = (msg) => {
    if (msg?.data?.type !== "CART_UPDATED") return;
    cart = readCart();
    renderCart();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  cart = readCart();
  renderCart();
  updateMobileBar();
  window.addEventListener("resize", updateMobileBar);

  // if header.js injects after, keep badge sync
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    updateHeaderBadges();
    if (tries >= 12) clearInterval(t);
  }, 150);
});
