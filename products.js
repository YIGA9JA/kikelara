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
 * If ANY product changes (id/name/category/price/discount/image/description),
 * the signature changes and we reset localStorage products.
 */
function makeDefaultsSignature(items) {
  // Sort by id to keep signature stable even if you reorder the array
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
 * - If no products saved -> seed defaults
 * - If defaults changed -> overwrite saved products with defaults
 * - If saved products corrupt -> reset to defaults
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

  // If no saved data OR signature mismatch => reset to defaults
  if (!savedValid || savedSig !== currentSig) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts));
    localStorage.setItem(DEFAULTS_SIG_KEY, currentSig);

    // Optional: also clear cart/wishlist if you want a full reset
    // localStorage.removeItem(CART_KEY);
    // localStorage.removeItem(WISHLIST_KEY);

    return defaultProducts;
  }

  // If everything is fine, use saved products
  return savedProducts;
}

// Always sync on load
let products = syncProductsWithDefaults();

/* ================= STATE ================= */
let wishlist = JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; // IDs only
let cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
let currentList = products; // used for sorting filtered results

/* ================= ELEMENTS ================= */
const grid = document.getElementById("productsGrid");
const wishlistCount = document.getElementById("wishlistCount");
const cartCount = document.getElementById("cartCount");
const categorySelect = document.getElementById("categorySelect");
const sortSelect = document.getElementById("sortSelect");

/* ================= POPULATE CATEGORIES (DIRECT FROM PRODUCTS) ================= */
function populateCategories() {
  categorySelect.innerHTML = `<option value="all">All</option>`;

  const categories = [...new Set(products.map(p => p.category))];
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
}

/* ================= RENDER PRODUCTS ================= */
function renderProducts(list = products) {
  currentList = list;
  grid.innerHTML = "";

  list.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";

    const isWishlisted = wishlist.includes(p.id);

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
        <button class="cart-btn" aria-label="Add to cart">🛒</button>
      </div>
    `;

    // Navigate only on image tap
    card.querySelector("img").onclick = () => {
      window.location.href = `product-details.html?id=${p.id}`;
    };

    // Wishlist
    card.querySelector(".wishlist-btn").onclick = e => {
      e.stopPropagation();
      toggleWishlist(p.id);
    };

    // Cart
    card.querySelector(".cart-btn").onclick = e => {
      e.stopPropagation();
      addToCart(p.id, e.target);
    };

    grid.appendChild(card);
  });

  updateCounts();
}

/* ================= FILTERS ================= */
categorySelect.addEventListener("change", () => {
  const val = categorySelect.value;

  const filtered = val === "all"
    ? products
    : products.filter(p => p.category === val);

  renderProducts(filtered);
  sortSelect.value = "default";
});

sortSelect.addEventListener("change", () => {
  const val = categorySelect.value;

  // get list for the current category first
  const filtered = val === "all"
    ? products
    : products.filter(p => p.category === val);

  if (sortSelect.value === "default") {
    renderProducts(filtered);
    return;
  }

  let sorted = [...filtered];

  if (sortSelect.value === "priceLow") sorted.sort((a, b) => a.price - b.price);
  if (sortSelect.value === "priceHigh") sorted.sort((a, b) => b.price - a.price);
  if (sortSelect.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));

  renderProducts(sorted);
});

/* ================= WISHLIST ================= */
function toggleWishlist(id) {
  wishlist = wishlist.includes(id)
    ? wishlist.filter(w => w !== id)
    : [...wishlist, id];

  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  renderProducts(currentList);
}

/* ================= CART ================= */
function addToCart(id, btn) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const item = cart.find(c => c.id === id);
  item ? item.qty++ : cart.push({ ...product, qty: 1 });

  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCounts();

  // Mobile-friendly feedback
  const old = btn.textContent;
  btn.textContent = "✓";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 700);
}

/* ================= COUNTS ================= */
function updateCounts() {
  wishlistCount.textContent = wishlist.length;
  cartCount.textContent = cart.reduce((t, i) => t + (i.qty || 0), 0);
}

/* ================= INIT ================= */
populateCategories();
renderProducts();
updateCounts();
