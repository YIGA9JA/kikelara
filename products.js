/* ================= PRODUCTS.JS (CLEAN LUXURY SHOP - SINGLE IMAGE COVER) ================= */

const PRODUCTS_KEY = "allProducts";
const DEFAULTS_SIG_KEY = "allProducts_defaults_sig";
const CART_KEY = "cart";

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

/* Helpers */
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
      image: p.image,              // cover
      images: getProductImages(p),  // gallery
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

/* CART */
function loadCart() {
  try {
    const c = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
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

/* Filters */
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

/* Render (USES ONLY p.image as cover) */
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
      </div>

      <button class="p-btn ${inCart ? "is-added" : ""}" type="button">
        ${inCart ? "ADDED" : "ADD TO CART"}
      </button>
    `;

    const img = card.querySelector(".p-img");
    if (img) {
      img.addEventListener("click", () => {
        window.location.href = `product-details.html?id=${p.id}`;
      });
    }

    const btn = card.querySelector(".p-btn");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCartOnce(p);
        renderProducts(currentList);
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
