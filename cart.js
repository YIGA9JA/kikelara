/* ================= CART.JS (PREMIUM + YOUR COLORS) =================
   ✅ Qty +/- only in cart
   ✅ No wishlist dependency (but won’t crash if wishlistCount exists in header)
   ✅ Delivery shown as “calculated at checkout”
   ✅ Shows totals inside checkout button
   ✅ Sticky mobile checkout bar
==================================================================== */

const CART_KEY = "cart";
const WISHLIST_KEY = "wishlist"; // optional safety for header badge

let cart = [];
try {
  cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
} catch {
  cart = [];
}

const cartItems = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");

const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutBtnTotal = document.getElementById("checkoutBtnTotal");

const mobileCheckout = document.getElementById("mobileCheckout");
const mobileCheckoutBtn = document.getElementById("mobileCheckoutBtn");
const mobileCheckoutTotal = document.getElementById("mobileCheckoutTotal");

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function formatNaira(n) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

/* ================= HEADER BADGES ================= */
function updateHeaderBadges() {
  const cartCountEl = document.getElementById("cartCount");
  const wishlistCountEl = document.getElementById("wishlistCount");

  const cartQty = Array.isArray(cart)
    ? cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
    : 0;

  if (cartCountEl) cartCountEl.textContent = cartQty;

  if (wishlistCountEl) {
    let wishlist = [];
    try { wishlist = JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; } catch {}
    wishlistCountEl.textContent = Array.isArray(wishlist) ? wishlist.length : 0;
  }
}

/* ================= TOTALS ================= */
function calcSubtotal() {
  return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 0)), 0);
}

function updateSummary() {
  const subtotal = calcSubtotal();
  const total = subtotal; // delivery at checkout

  if (subtotalEl) subtotalEl.textContent = formatNaira(subtotal);
  if (totalEl) totalEl.textContent = formatNaira(total);

  // Put total inside buttons
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
    const qty = Number(item.qty || 1);
    const price = Number(item.price || 0);

    const row = document.createElement("div");
    row.className = "cart-item";

    row.innerHTML = `
      <img class="cart-img" src="${item.image}" alt="${item.name}" draggable="false">
      <div class="cart-info">
        <div class="cart-name">${item.name}</div>

        <div class="cart-meta">
          <span class="cart-price">${formatNaira(price)}</span>
          <span class="cart-dot">•</span>
          <span class="cart-line">${formatNaira(price * qty)}</span>
        </div>

        <div class="qty">
          <button class="qty-btn" data-action="decrease" data-id="${item.id}" aria-label="Decrease quantity">−</button>
          <span class="qty-num">${qty}</span>
          <button class="qty-btn" data-action="increase" data-id="${item.id}" aria-label="Increase quantity">+</button>
        </div>
      </div>

      <button class="remove" data-action="remove" data-id="${item.id}" type="button" aria-label="Remove item">
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
  const id = Number(btn.dataset.id);
  if (!id) return;

  const item = cart.find(i => Number(i.id) === id);

  if (action === "increase" && item) {
    item.qty = (Number(item.qty) || 1) + 1;
  }

  if (action === "decrease" && item) {
    item.qty = (Number(item.qty) || 1) - 1;
    if (item.qty <= 0) cart = cart.filter(i => Number(i.id) !== id);
  }

  if (action === "remove") {
    cart = cart.filter(i => Number(i.id) !== id);
  }

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

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  updateMobileBar();

  window.addEventListener("resize", updateMobileBar);

  // header inject can be late
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    updateHeaderBadges();
    if (tries >= 10) clearInterval(t);
  }, 150);
});
