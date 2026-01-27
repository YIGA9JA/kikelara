/* ================= MOBILE MENU TOGGLE ================= */
const menuToggle = document.getElementById("menu-toggle");
const navbarLinks = document.getElementById("navbarLinks");

menuToggle.addEventListener("click", () => {
  navbarLinks.classList.toggle("show");
  document.body.classList.toggle("menu-open");
});

/* ================= STORAGE KEYS ================= */
const PRODUCTS_KEY = "allProducts";
const WISHLIST_KEY = "wishlist";
const CART_KEY = "cart";

/* ================= STATE ================= */
let wishlistIds = JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; // ✅ IDs
let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];

const allProducts = JSON.parse(localStorage.getItem(PRODUCTS_KEY)) || []; // ✅ product list

const grid = document.getElementById("wishlistGrid");
const wishlistCount = document.getElementById("wishlistCount");
const cartCount = document.getElementById("cartCount");

/* ================= HELPERS ================= */
function saveAll() {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlistIds));
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function updateCounts() {
  wishlistCount.textContent = wishlistIds.length;
  cartCount.textContent = cart.reduce((sum, i) => sum + (i.qty || 0), 0);
}

function removeFromWishlist(id) {
  wishlistIds = wishlistIds.filter(x => x !== id);
  saveAll();
  renderWishlist();
}

function changeCartQty(product, delta) {
  const idx = cart.findIndex(i => i.id === product.id);

  if (idx === -1) {
    if (delta > 0) cart.push({ ...product, qty: 1 });
  } else {
    cart[idx].qty = (cart[idx].qty || 0) + delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
  }

  saveAll();
  updateCounts();
}

/* ================= ADD FROM WISHLIST TO CART ================= */
function moveToCart(id, btn) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  changeCartQty(product, +1);

  // optional: remove from wishlist after adding to cart
  wishlistIds = wishlistIds.filter(x => x !== id);
  saveAll();
  renderWishlist();

  if (btn) {
    const old = btn.textContent;
    btn.textContent = "✓";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = old;
      btn.disabled = false;
    }, 700);
  }
}

/* ================= RENDER WISHLIST ================= */
function renderWishlist() {
  grid.innerHTML = "";

  if (!Array.isArray(wishlistIds) || wishlistIds.length === 0) {
    grid.innerHTML = "<p>Your wishlist is empty.</p>";
    updateCounts();
    return;
  }

  // convert IDs -> product objects
  const wishlistProducts = wishlistIds
    .map(id => allProducts.find(p => p.id === id))
    .filter(Boolean);

  if (wishlistProducts.length === 0) {
    // IDs exist but products not found (storage mismatch)
    wishlistIds = [];
    saveAll();
    grid.innerHTML = "<p>Your wishlist is empty.</p>";
    updateCounts();
    return;
  }

  wishlistProducts.forEach(product => {
    const card = document.createElement("div");
    card.className = "wishlist-card";

    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h4>${product.name}</h4>
      <p class="price">₦${Number(product.price).toLocaleString()}</p>

      <div class="actions">
        <button class="add-cart" title="Add to Cart">🛒</button>
        <button class="remove" title="Remove">❌</button>
      </div>
    `;

    card.querySelector(".add-cart").onclick = () => moveToCart(product.id, card.querySelector(".add-cart"));
    card.querySelector(".remove").onclick = () => removeFromWishlist(product.id);

    grid.appendChild(card);
  });

  updateCounts();
}

/* ================= INIT ================= */
renderWishlist();
updateCounts();
