/* ================= WISHLIST.JS (FIXED + SAFE) =================
   - Works with wishlist stored as IDs: [1,2,3]
   - Works with cart stored as items with qty: [{id, name, price, ... , qty}]
   - Seeds products if localStorage is empty (so wishlist can find products)
   - Safe for pages missing header counters or menu toggle
=============================================================== */

/* ================= STORAGE KEYS ================= */
const PRODUCTS_KEY = "allProducts";
const DEFAULTS_SIG_KEY = "allProducts_defaults_sig";
const WISHLIST_KEY = "wishlist";
const CART_KEY = "cart";

/* ================= DEFAULT PRODUCTS (MUST MATCH YOUR PRODUCTS.JS) ================= */
const defaultProducts = [
  {
    id: 1,
    name: "Body Butter",
    category: "Body",
    price: 10000,
    discount: 0,
    image: "images_brown/bodyButter.png",
    description: "Shea Butter, Almond Oil, Mango Butter, Cocoa Butter, Glycerin."
  },
  {
    id: 2,
    name: "Bright Aura Oil",
    category: "Oil",
    price: 10000,
    discount: 0,
    image: "images_brown/bodyOil.png",
    description: "Jojoba Oil, Carrot Oil, Palm Kernel Oil, Almond Oil, Vitamin E."
  },
  {
    id: 3,
    name: "Hair Butter",
    category: "Serum",
    price: 5500,
    discount: 0,
    image: "images_brown/hairButter.png",
    description: "Strengthens and moisturizes hair deeply."
  },
  {
    id: 4,
    name: "Hair Oil",
    category: "Serum",
    price: 5500,
    discount: 0,
    image: "images_brown/hairOil.png",
    description: "Strengthens and moisturizes hair deeply."
  },
  {
    id: 5,
    name: "Baby Body Butter",
    category: "Body",
    price: 10000,
    discount: 0,
    image: "images_brown/BabyBodyButter.png",
    description: "Gentle care, naturally."
  },
  {
    id: 6,
    name: "Body Butter (Fruity)",
    category: "Body",
    price: 10000,
    discount: 0,
    image: "images_brown/bodyButter(Fruity).png",
    description: "Whisper of fruity freshness. Gentle care, naturally."
  },
  {
    id: 7,
    name: "Glow Elixir Oil",
    category: "Oil",
    price: 8500,
    discount: 0,
    image: "images_brown/bodyOil.png",
    description: "Jojoba Oil, Carrot Oil, Palm Kernel Oil, Almond Oil, Vitamin E."
  }
];

/* ================= DEFAULT SYNC (SO WISHLIST CAN FIND PRODUCTS) ================= */
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

function syncProductsWithDefaults() {
  const currentSig = makeDefaultsSignature(defaultProducts);
  const savedSig = localStorage.getItem(DEFAULTS_SIG_KEY);

  let savedProducts = null;
  try {
    savedProducts = JSON.parse(localStorage.getItem(PRODUCTS_KEY));
  } catch {}

  const savedValid = Array.isArray(savedProducts) && savedProducts.length > 0;

  if (!savedValid || savedSig !== currentSig) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts));
    localStorage.setItem(DEFAULTS_SIG_KEY, currentSig);
    return defaultProducts;
  }

  return savedProducts;
}

/* ================= SAFE LOADERS ================= */
function loadJSON(key, fallback) {
  try {
    const val = JSON.parse(localStorage.getItem(key));
    return val ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

/* ================= APP ================= */
document.addEventListener("DOMContentLoaded", () => {
  // Seed products if needed
  const allProducts = syncProductsWithDefaults();

  // Load wishlist + cart
  let wishlistIds = loadJSON(WISHLIST_KEY, []);
  let cart = loadJSON(CART_KEY, []);

  if (!Array.isArray(wishlistIds)) wishlistIds = [];
  if (!Array.isArray(cart)) cart = [];

  // Elements (safe)
  const grid = document.getElementById("wishlistGrid");
  const wishlistCountEl = document.getElementById("wishlistCount");
  const cartCountEl = document.getElementById("cartCount");

  function updateCounts() {
    const wishNum = Array.isArray(wishlistIds) ? wishlistIds.length : 0;
    const cartNum = Array.isArray(cart)
      ? cart.reduce((sum, i) => sum + (Number(i.qty) || 0), 0)
      : 0;

    if (wishlistCountEl) wishlistCountEl.textContent = wishNum;
    if (cartCountEl) cartCountEl.textContent = cartNum;
  }

  function changeCartQty(product, delta) {
    const idx = cart.findIndex(i => i.id === product.id);

    if (idx === -1) {
      if (delta > 0) cart.push({ ...product, qty: 1 });
    } else {
      cart[idx].qty = (Number(cart[idx].qty) || 0) + delta;
      if (cart[idx].qty <= 0) cart.splice(idx, 1);
    }

    saveJSON(CART_KEY, cart);
    updateCounts();
  }

  function removeFromWishlist(id) {
    wishlistIds = wishlistIds.filter(x => x !== id);
    saveJSON(WISHLIST_KEY, wishlistIds);
    renderWishlist();
    updateCounts();
  }

  function moveToCart(id, btn) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    changeCartQty(product, +1);

    // remove after add (optional behavior)
    wishlistIds = wishlistIds.filter(x => x !== id);
    saveJSON(WISHLIST_KEY, wishlistIds);

    renderWishlist();
    updateCounts();

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

  function renderWishlist() {
    if (!grid) return;

    grid.innerHTML = "";

    if (!wishlistIds.length) {
      grid.innerHTML = `<p>Your wishlist is empty.</p>`;
      return;
    }

    const wishlistProducts = wishlistIds
      .map(id => allProducts.find(p => p.id === id))
      .filter(Boolean);

    // If ids exist but products not found (storage mismatch), cleanup
    if (!wishlistProducts.length) {
      wishlistIds = [];
      saveJSON(WISHLIST_KEY, wishlistIds);
      grid.innerHTML = `<p>Your wishlist is empty.</p>`;
      return;
    }

    wishlistProducts.forEach(product => {
      const card = document.createElement("div");
      card.className = "wishlist-card";

      card.innerHTML = `
        <div class="wishlist-img">
          <img src="${product.image}" alt="${product.name}">
        </div>

        <h4>${product.name}</h4>
        <p class="price">₦${Number(product.price).toLocaleString()}</p>

        <div class="actions">
          <button class="add-cart" type="button" title="Add to Cart">🛒 Add</button>
          <button class="remove" type="button" title="Remove">❌ Remove</button>
        </div>
      `;

      const addBtn = card.querySelector(".add-cart");
      const removeBtn = card.querySelector(".remove");

      if (addBtn) addBtn.onclick = () => moveToCart(product.id, addBtn);
      if (removeBtn) removeBtn.onclick = () => removeFromWishlist(product.id);

      grid.appendChild(card);
    });
  }

  // Initial paint
  renderWishlist();
  updateCounts();

  /* ================= MOBILE MENU TOGGLE (SAFE) ================= */
  const menuToggle = document.getElementById("menu-toggle");
  const navbarLinks = document.getElementById("navbarLinks");

  if (menuToggle && navbarLinks) {
    menuToggle.addEventListener("click", () => {
      navbarLinks.classList.toggle("show");
      document.body.classList.toggle("menu-open");
    });
  }
});
