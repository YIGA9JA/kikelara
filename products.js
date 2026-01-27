/* ================= PRODUCTS.JS (FULL UPDATED) =================
   Fixes your errors:
   - Prevents null crashes if #cartCount/#wishlistCount/#categorySelect/#sortSelect are missing
   - Runs only after DOMContentLoaded
   - Still supports: wishlist, qty +/- counter, cart icon +1, filters, sorting
   - Keeps your "reset when defaults change" logic
=============================================================== */

/* ================= LOAD / SEED PRODUCTS ================= */

/** Change these only if you want to rename storage keys globally */
const PRODUCTS_KEY = "allProducts";
const DEFAULTS_SIG_KEY = "allProducts_defaults_sig";
const WISHLIST_KEY = "wishlist";
const CART_KEY = "cart";

/** Your default products */
const defaultProducts = [
  {
    id: 1,
    name: "Body Butter",
    category: "Body",
    price: 10000,
    discount: 0,
    image: "images/bodyButter.JPG",
    description: "Shea Butter, Almond Oil, Mango Butter, Cocoa Butter, Glycerin."
  },
  {
    id: 2,
    name: "Bright Aura Oil",
    category: "Oil",
    price: 10000,
    discount: 0,
    image: "images/bodyOil.JPG",
    description: "Jojoba Oil, Carrot Oil, Palm Kernel Oil, Almond Oil, Vitamin E."
  },
  {
    id: 3,
    name: "Hair Butter",
    category: "Serum",
    price: 5500,
    discount: 0,
    image: "images/hairButter.png",
    description: "Strengthens and moisturizes hair deeply."
  },
  {
    id: 4,
    name: "Hair Oil",
    category: "Serum",
    price: 7500,
    discount: 0,
    image: "images/hairOil1.JPG",
    description: "Locks in moisture. Jojoba Oil, Castor Oil, Argan Oil, Vitamin E."
  },
  {
    id: 5,
    name: "Baby Body Butter",
    category: "Body",
    price: 10000,
    discount: 0,
    image: "images/BabyBodyButter.png",
    description: "Gentle care, naturally."
  },
  {
    id: 6,
    name: "Body Butter (Fruity)",
    category: "Body",
    price: 10000,
    discount: 0,
    image: "images/bodyButter(Fruity).png",
    description: "Whisper of fruity freshness. Gentle care, naturally."
  },
  {
    id: 7,
    name: "Glow Elixir Oil",
    category: "Oil",
    price: 8500,
    discount: 0,
    image: "images/bodyOil.JPG",
    description: "Jojoba Oil, Carrot Oil, Palm Kernel Oil, Almond Oil, Vitamin E."
  }
];

/**
 * Create a "signature" of defaultProducts.
 * If ANY product changes, signature changes and we reset localStorage products.
 */
function makeDefaultsSignature(items) {
  const normalized = [...items]
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      discount: p.discount,
      image: p.image,
      description: p.description
    }));
  return JSON.stringify(normalized);
}

/**
 * Ensures localStorage products match current defaults.
 */
function syncProductsWithDefaults() {
  const currentSig = makeDefaultsSignature(defaultProducts);
  const savedSig = localStorage.getItem(DEFAULTS_SIG_KEY);

  let savedProducts;
  try {
    savedProducts = JSON.parse(localStorage.getItem(PRODUCTS_KEY));
  } catch (e) {
    savedProducts = null;
  }

  const savedValid = Array.isArray(savedProducts) && savedProducts.length > 0;

  if (!savedValid || savedSig !== currentSig) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts));
    localStorage.setItem(DEFAULTS_SIG_KEY, currentSig);
    return defaultProducts;
  }

  return savedProducts;
}

// Always sync on load
let products = syncProductsWithDefaults();

/* ================= STATE ================= */
let wishlist = [];
let cart = [];
let currentList = products;

/* ================= ELEMENTS (SAFE - will be set on DOMContentLoaded) ================= */
let grid = null;
let wishlistCountEl = null;
let cartCountEl = null;
let categorySelectEl = null;
let sortSelectEl = null;

/* ================= STORAGE LOADERS (SAFE) ================= */
function loadWishlist() {
  try {
    const w = JSON.parse(localStorage.getItem(WISHLIST_KEY));
    wishlist = Array.isArray(w) ? w : [];
  } catch {
    wishlist = [];
  }
}

function loadCart() {
  try {
    const c = JSON.parse(localStorage.getItem(CART_KEY));
    cart = Array.isArray(c) ? c : [];
  } catch {
    cart = [];
  }
}

/* ================= COUNTS (SAFE) ================= */
function updateCounts() {
  const wishNum = Array.isArray(wishlist) ? wishlist.length : 0;
  const cartNum = Array.isArray(cart)
    ? cart.reduce((t, i) => t + (Number(i.qty) || 0), 0)
    : 0;

  if (wishlistCountEl) wishlistCountEl.textContent = wishNum;
  if (cartCountEl) cartCountEl.textContent = cartNum;
}

/* ================= POPULATE CATEGORIES (SAFE) ================= */
function populateCategories() {
  if (!categorySelectEl) return;

  categorySelectEl.innerHTML = `<option value="all">All</option>`;
  const categories = [...new Set(products.map(p => p.category))];

  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelectEl.appendChild(opt);
  });
}

/* ================= CART HELPERS ================= */
function getQtyInCart(id) {
  return (cart.find(c => c.id === id)?.qty) || 0;
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function saveWishlist() {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
}

function changeQty(id, delta) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const idx = cart.findIndex(c => c.id === id);

  if (idx === -1) {
    if (delta > 0) cart.push({ ...product, qty: 1 });
  } else {
    cart[idx].qty = (Number(cart[idx].qty) || 0) + delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
  }

  saveCart();
  updateCounts();
  renderProducts(currentList);
}

/* ================= WISHLIST ================= */
function toggleWishlist(id) {
  wishlist = wishlist.includes(id)
    ? wishlist.filter(w => w !== id)
    : [...wishlist, id];

  saveWishlist();
  renderProducts(currentList);
  updateCounts();
}

/* ================= RENDER PRODUCTS ================= */
function renderProducts(list = products) {
  if (!grid) return;

  currentList = list;
  grid.innerHTML = "";

  list.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";

    const isWishlisted = wishlist.includes(p.id);
    const qtyInCart = getQtyInCart(p.id);

    card.innerHTML = `
      ${p.discount ? `<span class="discount">-${p.discount}%</span>` : ""}

      <div class="product-image-wrapper">
        <img src="${p.image}" alt="${p.name}" class="clickable-image">
      </div>

      <h4>${p.name}</h4>
      <p class="price">₦${Number(p.price).toLocaleString()}</p>

      <div class="product-actions-row">
        <button class="wishlist-btn" aria-label="Add to wishlist">
          ${isWishlisted ? "♥" : "♡"}
        </button>

        <div class="qty-box" aria-label="Quantity">
          <button class="qty-btn minus" aria-label="Decrease quantity">−</button>
          <span class="qty-num">${qtyInCart}</span>
          <button class="qty-btn plus" aria-label="Increase quantity">+</button>
        </div>

        <button class="cart-btn" aria-label="Add to cart">🛒</button>
      </div>
    `;

    // Navigate only on image tap
    const img = card.querySelector("img");
    if (img) {
      img.onclick = () => {
        window.location.href = `product-details.html?id=${p.id}`;
      };
    }

    // Wishlist toggle
    const wishBtn = card.querySelector(".wishlist-btn");
    if (wishBtn) {
      wishBtn.onclick = (e) => {
        e.stopPropagation();
        toggleWishlist(p.id);
      };
    }

    // Qty controls
    const plusBtn = card.querySelector(".qty-btn.plus");
    const minusBtn = card.querySelector(".qty-btn.minus");

    if (plusBtn) {
      plusBtn.onclick = (e) => {
        e.stopPropagation();
        changeQty(p.id, +1);
      };
    }

    if (minusBtn) {
      minusBtn.onclick = (e) => {
        e.stopPropagation();
        changeQty(p.id, -1);
      };
    }

    // Cart icon = quick +1
    const cartBtn = card.querySelector(".cart-btn");
    if (cartBtn) {
      cartBtn.onclick = (e) => {
        e.stopPropagation();
        changeQty(p.id, +1);
      };
    }

    grid.appendChild(card);
  });

  updateCounts();
}

/* ================= FILTERS (SAFE) ================= */
function bindFilters() {
  if (categorySelectEl) {
    categorySelectEl.addEventListener("change", () => {
      const val = categorySelectEl.value;

      const filtered = val === "all"
        ? products
        : products.filter(p => p.category === val);

      renderProducts(filtered);

      if (sortSelectEl) sortSelectEl.value = "default";
    });
  }

  if (sortSelectEl) {
    sortSelectEl.addEventListener("change", () => {
      const val = categorySelectEl ? categorySelectEl.value : "all";

      const filtered = val === "all"
        ? products
        : products.filter(p => p.category === val);

      if (sortSelectEl.value === "default") {
        renderProducts(filtered);
        return;
      }

      let sorted = [...filtered];

      if (sortSelectEl.value === "priceLow") sorted.sort((a, b) => a.price - b.price);
      if (sortSelectEl.value === "priceHigh") sorted.sort((a, b) => b.price - a.price);
      if (sortSelectEl.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));

      renderProducts(sorted);
    });
  }
}

/* ================= INIT (RUN AFTER DOM READY) ================= */
document.addEventListener("DOMContentLoaded", () => {
  // Load storage first
  loadWishlist();
  loadCart();

  // Grab elements safely
  grid = document.getElementById("productsGrid");
  wishlistCountEl = document.getElementById("wishlistCount");
  cartCountEl = document.getElementById("cartCount");
  categorySelectEl = document.getElementById("categorySelect");
  sortSelectEl = document.getElementById("sortSelect");

  // If this page doesn't have the products grid, don't run
  if (!grid) {
    // Still update counters if they exist (e.g. header shared layout)
    updateCounts();
    return;
  }

  populateCategories();
  bindFilters();
  renderProducts(products);
  updateCounts();
});
