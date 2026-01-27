/* ================= STORAGE KEYS ================= */
const CART_KEY = "cart";
const WISHLIST_KEY = "wishlist";

/* ================= STATE ================= */
let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
let wishlist = JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];

/* ================= ELEMENTS ================= */
const cartItems = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const cartCount = document.getElementById("cartCount");
const wishlistCount = document.getElementById("wishlistCount");
const checkoutBtn = document.getElementById("checkoutBtn");

const DELIVERY_FEE = 2000;

/* ================= SAVE CART ================= */
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/* ================= COUNTS ================= */
function updateCounts() {
  // cart badge = total qty
  const cartQty = cart.reduce((sum, item) => sum + (item.qty || 0), 0);
  if (cartCount) cartCount.textContent = cartQty;

  // wishlist badge = IDs length
  if (wishlistCount) wishlistCount.textContent = Array.isArray(wishlist) ? wishlist.length : 0;
}

/* ================= SUMMARY ================= */
function updateSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 0)), 0);

  subtotalEl.textContent = `₦${subtotal.toLocaleString()}`;
  totalEl.textContent = `₦${(subtotal + (cart.length ? DELIVERY_FEE : 0)).toLocaleString()}`;
}

/* ================= CHECKOUT STATE ================= */
function updateCheckoutState() {
  if (!checkoutBtn) return;

  if (cart.length === 0) {
    checkoutBtn.disabled = true;
    checkoutBtn.style.opacity = "0.5";
    checkoutBtn.style.cursor = "not-allowed";
  } else {
    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = "1";
    checkoutBtn.style.cursor = "pointer";
  }
}

/* ================= RENDER CART ================= */
function renderCart() {
  cartItems.innerHTML = "";

  if (!Array.isArray(cart) || cart.length === 0) {
    cartItems.innerHTML = "<p>Your cart is empty.</p>";
    subtotalEl.textContent = "₦0";
    totalEl.textContent = "₦0";
    updateCounts();
    updateCheckoutState();
    return;
  }

  cart.forEach(item => {
    const div = document.createElement("div");
    div.className = "cart-item";

    div.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-info">
        <h4>${item.name}</h4>
        <p>₦${Number(item.price).toLocaleString()}</p>
        <div class="quantity">
          <button data-id="${item.id}" data-action="decrease">−</button>
          <span>${item.qty || 1}</span>
          <button data-id="${item.id}" data-action="increase">+</button>
        </div>
      </div>
      <span class="remove" data-id="${item.id}">Remove</span>
    `;

    cartItems.appendChild(div);
  });

  updateSummary();
  updateCounts();
  updateCheckoutState();
}

/* ================= EVENT DELEGATION ================= */
cartItems.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  const id = Number(e.target.dataset.id);

  if (!id) return;

  if (action === "increase") {
    const item = cart.find(i => i.id === id);
    if (item) item.qty = (item.qty || 1) + 1;
  }

  if (action === "decrease") {
    const item = cart.find(i => i.id === id);
    if (item) {
      item.qty = (item.qty || 1) - 1;
      if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
    }
  }

  if (e.target.classList.contains("remove")) {
    cart = cart.filter(i => i.id !== id);
  }

  saveCart();
  renderCart();
});

/* ================= CHECKOUT ================= */
checkoutBtn?.addEventListener("click", () => {
  if (cart.length === 0) return;
  window.location.href = "checkout.html";
});

/* ================= HAMBURGER TOGGLE ================= */
const menuToggle = document.getElementById("menuToggle");
const navbarLinks = document.getElementById("navbarLinks");

menuToggle?.addEventListener("click", () => {
  navbarLinks.classList.toggle("show");
  document.body.classList.toggle("menu-open");
});

/* ================= INIT ================= */
renderCart();
updateCounts();
