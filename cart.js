/* ================= STATE ================= */
let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* ================= ELEMENTS ================= */
const cartItems = document.getElementById("cartItems");
const subtotalEl = document.getElementById("subtotal");
const totalEl = document.getElementById("total");
const cartCount = document.getElementById("cartCount");
const checkoutBtn = document.getElementById("checkoutBtn");

const DELIVERY_FEE = 2000;

/* ================= RENDER CART ================= */
function renderCart() {
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartItems.innerHTML = "<p>Your cart is empty.</p>";
    subtotalEl.textContent = "₦0";
    totalEl.textContent = "₦0";
    cartCount.textContent = "0";
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
        <p>₦${item.price.toLocaleString()}</p>
        <div class="quantity">
          <button data-id="${item.id}" data-action="decrease">−</button>
          <span>${item.qty}</span>
          <button data-id="${item.id}" data-action="increase">+</button>
        </div>
      </div>
      <span class="remove" data-id="${item.id}">Remove</span>
    `;
    cartItems.appendChild(div);
  });

  updateSummary();
  updateCheckoutState();
}

/* ================= SUMMARY ================= */
function updateSummary() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  subtotalEl.textContent = `₦${subtotal.toLocaleString()}`;
  totalEl.textContent = `₦${(subtotal + DELIVERY_FEE).toLocaleString()}`;
  cartCount.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
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

/* ================= SAVE CART ================= */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

/* ================= EVENT DELEGATION ================= */
cartItems.addEventListener("click", e => {
  const id = parseInt(e.target.dataset.id);

  if (e.target.dataset.action === "increase") {
    const item = cart.find(i => i.id === id);
    if (item) item.qty++;
  }

  if (e.target.dataset.action === "decrease") {
    const item = cart.find(i => i.id === id);
    if (item) {
      item.qty--;
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
checkoutBtn.addEventListener("click", () => {
  if (cart.length === 0) return;
  window.location.href = "checkout.html";
});

/* ================= HAMBURGER TOGGLE ================= */
const menuToggle = document.getElementById("menuToggle");
const navbarLinks = document.getElementById("navbarLinks");

menuToggle.addEventListener("click", () => {
  navbarLinks.classList.toggle("show");
  document.body.classList.toggle("menu-open");
});

/* ================= INIT ================= */
renderCart();
