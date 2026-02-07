/* ================= PRODUCTS.JS (LOCALSTORAGE MODE - NO BACKEND) ================= */

const PRODUCTS_KEY = "allProducts";
const CART_KEY = "cart";
const REVIEWS_KEY = "productReviews_v1";

/** Default products (seed once only) */
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

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getProductImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (typeof p.image === "string" && p.image.trim()) return [p.image];
  return [];
}

/* ✅ Seed defaults only once */
function loadProducts() {
  const stored = safeJSON(PRODUCTS_KEY, null);
  if (Array.isArray(stored) && stored.length) return stored;

  saveJSON(PRODUCTS_KEY, defaultProducts);
  return defaultProducts;
}

let products = loadProducts();
let currentList = products;

/* ================= CART ================= */
function loadCart() {
  const c = safeJSON(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCart(cart) { saveJSON(CART_KEY, cart); }
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
  if (!list.length) return `<div class="p-rating is-empty">No reviews yet</div>`;
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

/* ================= RENDER ================= */
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

        ${ratingLineHTML(p.id)}
      </div>

      <button class="p-btn ${inCart ? "is-added" : ""}" type="button">
        ${inCart ? "ADDED" : "ADD TO CART"}
      </button>
    `;

    card.querySelector(".p-img")?.addEventListener("click", () => {
      window.location.href = `product-details.html?id=${p.id}`;
    });

    const info = card.querySelector(".p-info");
    if (info) {
      info.style.cursor = "pointer";
      info.addEventListener("click", () => {
        window.location.href = `product-details.html?id=${p.id}`;
      });
    }

    card.querySelector(".p-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCartOnce(p);
      renderProducts(currentList);
      updateCartCount();
    });

    grid.appendChild(card);
  });

  updateCartCount();
}

document.addEventListener("DOMContentLoaded", () => {
  products = loadProducts(); // refresh
  populateCategories();
  bindFilters();
  renderProducts(products);
  updateCartCount();
});
