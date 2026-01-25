/* ================= MOBILE MENU TOGGLE ================= */
const menuToggle = document.getElementById("menu-toggle");
const navbarLinks = document.getElementById("navbarLinks");

menuToggle.addEventListener("click", () => {
  navbarLinks.classList.toggle("show");
  document.body.classList.toggle("menu-open"); // lock scroll when menu is open
});

/* ================= STATE ================= */
let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];

const grid = document.getElementById("wishlistGrid");
const wishlistCount = document.getElementById("wishlistCount");
const cartCount = document.getElementById("cartCount");

/* ================= RENDER WISHLIST ================= */
function renderWishlist() {
  grid.innerHTML = "";

  if (wishlist.length === 0) {
    grid.innerHTML = "<p>Your wishlist is empty.</p>";
    updateCounts();
    return;
  }

  wishlist.forEach(product => {
    const card = document.createElement("div");
    card.className = "wishlist-card";

    card.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <h4>${product.name}</h4>
      <p class="price">₦${Number(product.price).toLocaleString()}</p>

   <div class="actions">
  <button class="add-cart" onclick="moveToCart(${product.id}, this)" title="Add to Cart">🛒</button>
  <button class="remove" onclick="removeFromWishlist(${product.id})" title="Remove">❌</button>
</div>
    `;

    grid.appendChild(card);
  });

  updateCounts();
}

/* ================= CART/WISHLIST ACTIONS ================= */
function moveToCart(id, btn) {
  const product = wishlist.find(p => p.id == id);
  if (!product) return;

  const existing = cart.find(p => p.id == id);
  existing ? existing.qty++ : cart.push({ ...product, qty: 1 });

  wishlist = wishlist.filter(p => p.id != id);
  saveAll();
  renderWishlist();

  btn.textContent = "Added ✓";
  btn.disabled = true;
}

function removeFromWishlist(id) {
  wishlist = wishlist.filter(p => p.id != id);
  saveAll();
  renderWishlist();
}

function updateCounts() {
  wishlistCount.textContent = wishlist.length;
  cartCount.textContent = cart.reduce((sum, i) => sum + (i.qty || 0), 0);
}

function saveAll() {
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  localStorage.setItem("cart", JSON.stringify(cart));
}

/* ================= INIT ================= */
renderWishlist();
