/* ================= PRODUCTS.JS (CLEAN LUXURY SHOP + RATINGS ON CARDS) ================= */

const PRODUCTS_KEY = "allProducts";
const DEFAULTS_SIG_KEY = "allProducts_defaults_sig";
const CART_KEY = "cart";

/* ✅ Reviews storage (same one used by product-details.js) */
const REVIEWS_KEY = "productReviews_v1";

/** Default products (single cover image + 4pics for details gallery) */
const defaultProducts = [
  { id: 1, name: "Body Butter", category: "Body", price: 10000, discount: 0, image: "images_brown/bodyButter.png",
    images: ["images_brown/bodyButter.png","images_brown/bodyButter.png","images_brown/bodyButter.png","images_brown/bodyButter.png"],
    description: "Shea Butter, Almond Oil, Mango Butter, Cocoa Butter, Glycerin." },

  { id: 2, name: "Bright Aura Oil", category: "Oil", price: 10000, discount: 0, image: "images_brown/bodyOil.png",
    images: ["images_brown/bodyOil.png","images_brown/bodyOil.png","images_brown/bodyOil.png","images_brown/bodyOil.png"],
    description: "Jojoba Oil, Carrot Oil, Palm Kernel Oil, Almond Oil, Vitamin E." },

  { id: 3, name: "Hair Butter", category: "Serum", price: 5500, discount: 0, image: "images_brown/hairButter.png",
    images: ["images_brown/hairButter.png","images_brown/hairButter.png","images_brown/hairButter.png","images_brown/hairButter.png"],
    description: "Strengthens and moisturizes hair deeply." },

  { id: 4, name: "Hair Oil", category: "Serum", price: 5500, discount: 0, image: "images_brown/hairOil.png",
    images: ["images_brown/hairOil.png","images_brown/hairOil.png","images_brown/hairOil.png","images_brown/hairOil.png"],
    description: "Strengthens and moisturizes hair deeply." },

  { id: 5, name: "Baby Body Butter", category: "Body", price: 10000, discount: 0, image: "images_brown/BabyBodyButter.png",
    images: ["images_brown/BabyBodyButter.png","images_brown/BabyBodyButter.png","images_brown/BabyBodyButter.png","images_brown/BabyBodyButter.png"],
    description: "Gentle care, naturally." },

  { id: 6, name: "Body Butter (Fruity)", category: "Body", price: 10000, discount: 0, image: "images_brown/bodyButter(Fruity).png",
    images: ["images_brown/bodyButter(Fruity).png","images_brown/bodyButter(Fruity).png","images_brown/bodyButter(Fruity).png","images_brown/bodyButter(Fruity).png"],
    description: "Whisper of fruity freshness. Gentle care, naturally." },

  { id: 7, name: "Glow Elixir Oil", category: "Oil", price: 8500, discount: 0, image: "images_brown/glowElixir.png",
    images: ["images_brown/glowElixir.png","images_brown/glowElixir.png","images_brown/glowElixir.png","images_brown/glowElixir.png"],
    description: "Jojoba Oil, Carrot Oil, Palm Kernel Oil, Almond Oil, Vitamin E." }
];

/* ================= SAFE HELPERS ================= */
function safeJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function getProductImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (typeof p.image === "string" && p.image.trim()) return [p.image];
  return [];
}

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
      images: getProductImages(p),
      description: p.description
    }));
  return JSON.stringify(normalized);
}

function syncProductsWithDefaults() {
  const currentSig = makeDefaultsSignature(defaultProducts);
  const savedSig = localStorage.getItem(DEFAULTS_SIG_KEY);

  let savedProducts;
  try { savedProducts = JSON.parse(localStorage.getItem(PRODUCTS_KEY)); }
  catch { savedProducts = null; }

  const savedValid = Array.isArray(savedProducts) && savedProducts.length > 0;

  if (!savedValid || savedSig !== currentSig) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts));
    localStorage.setItem(DEFAULTS_SIG_KEY, currentSig);
    return defaultProducts;
  }
  return savedProducts;
}

let products = syncProductsWithDefaults();
let currentList = products;

/* ================= CART ================= */
function loadCart() {
  const c = safeJSON(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
function isInCart(cart, id) { return cart.some(i => Number(i.id) === Number(id)); }

function addToCartOnce(product) {
  const cart = loadCart();
  if (isInCart(cart, product.id)) return;
  cart.push({ ...product, qty: 1 });
  saveCart(cart);
}

function updateCartCount() {
  const cartCountEl = document.getElementById("cartCount");
  if (!cartCountEl) return;
  const cart = loadCart();
  cartCountEl.textContent = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

/* ================= REVIEWS (FOR CARD RATINGS) ================= */
function loadAllReviews() {
  const obj = safeJSON(REVIEWS_KEY, {});
  return obj && typeof obj === "object" ? obj : {};
}

function getReviewsForProduct(productId) {
  const all = loadAllReviews();
  const list = all[String(productId)];
  return Array.isArray(list) ? list : [];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function calcAverage(list) {
  if (!list.length) return 0;
  const sum = list.reduce((a, r) => a + (Number(r.rating) || 0), 0);
  return sum / list.length;
}

function starsTextFromAverage(avg) {
  const rounded = clamp(Math.round(avg), 0, 5);
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

function ratingLineHTML(productId) {
  const list = getReviewsForProduct(productId);
  if (!list.length) {
    return `<div class="p-rating is-empty">No reviews yet</div>`;
  }
  const avg = calcAverage(list);
  const avg1 = Math.round(avg * 10) / 10;
  const stars = starsTextFromAverage(avg);
  return `<div class="p-rating">${stars} <span class="p-rate-num">${avg1}</span> <span class="p-rate-count">(${list.length})</span></div>`;
}

/* ================= FILTERS ================= */
function populateCategories() {
  const sel = document.getElementById("categorySelect");
  if (!sel) return;

  sel.innerHTML = `<option value="all">All</option>`;
  [...new Set(products.map(p => p.category))].forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

function bindFilters() {
  const categorySelectEl = document.getElementById("categorySelect");
  const sortSelectEl = document.getElementById("sortSelect");

  if (categorySelectEl) {
    categorySelectEl.addEventListener("change", () => {
      const val = categorySelectEl.value;
      const filtered = val === "all" ? products : products.filter(p => p.category === val);
      renderProducts(filtered);
      if (sortSelectEl) sortSelectEl.value = "default";
    });
  }

  if (sortSelectEl) {
    sortSelectEl.addEventListener("change", () => {
      const category = categorySelectEl ? categorySelectEl.value : "all";
      const filtered = category === "all" ? products : products.filter(p => p.category === category);

      if (sortSelectEl.value === "default") return renderProducts(filtered);

      const sorted = [...filtered];
      if (sortSelectEl.value === "priceLow") sorted.sort((a, b) => a.price - b.price);
      if (sortSelectEl.value === "priceHigh") sorted.sort((a, b) => b.price - a.price);
      if (sortSelectEl.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
      renderProducts(sorted);
    });
  }
}

/* ================= RENDER (USES ONLY p.image as cover) ================= */
function renderProducts(list = products) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  currentList = list;
  grid.innerHTML = "";

  const cart = loadCart();

  list.forEach(p => {
    const inCart = isInCart(cart, p.id);

    const card = document.createElement("div");
    card.className = "p-card";

    card.innerHTML = `
      <div class="p-media">
        <img src="${p.image}" alt="${p.name}" class="p-img" draggable="false">
      </div>

      <div class="p-info">
        <div class="p-topline">
          <span class="p-cat">${String(p.category || "Product").toUpperCase()}</span>
          ${inCart ? `<span class="p-flag">IN CART</span>` : ``}
        </div>

        <div class="p-name">${p.name}</div>
        <div class="p-price">₦${Number(p.price).toLocaleString()}</div>

        <!-- ✅ Rating line -->
        ${ratingLineHTML(p.id)}
      </div>

      <button class="p-btn ${inCart ? "is-added" : ""}" type="button">
        ${inCart ? "ADDED" : "ADD TO CART"}
      </button>
    `;

    // Click image -> details
    const img = card.querySelector(".p-img");
    if (img) {
      img.addEventListener("click", () => {
        window.location.href = `product-details.html?id=${p.id}`;
      });
    }

    // Click name/info -> details (optional, feels premium)
    const info = card.querySelector(".p-info");
    if (info) {
      info.style.cursor = "pointer";
      info.addEventListener("click", () => {
        window.location.href = `product-details.html?id=${p.id}`;
      });
    }

    // Button -> add to cart
    const btn = card.querySelector(".p-btn");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCartOnce(p);
        renderProducts(currentList); // re-render so “IN CART” updates
        updateCartCount();
      });
    }

    grid.appendChild(card);
  });

  updateCartCount();
}

document.addEventListener("DOMContentLoaded", () => {
  populateCategories();
  bindFilters();
  renderProducts(products);
  updateCartCount();
});
