/* ================= PRODUCTS.JS (BACKEND ONLY - UPDATED + SECURE) =================
   ✅ Loads products from backend only
   ✅ Saves fetched products into sessionStorage(allProducts)
   ✅ Cart stored in sessionStorage(cart)
   ✅ Card star rating uses backend reviews endpoint
   ✅ FIX: resolves /uploads/... image_url with API_BASE
   ✅ FIX: avoids HTML injection by escaping user content
   ✅ FIX: shows only active products by default (configurable)
=============================================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";
const CART_KEY = "cart";

// Change to false if you want to show hidden products on products page
const SHOW_ONLY_ACTIVE = true;

/* =============== SAFE HELPERS (SESSION ONLY) =============== */
function safeJSONSession(key, fallback) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJSONSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* =============== SECURITY HELPERS =============== */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(str) {
  return String(str ?? "").trim();
}

/* =============== IMAGE URL RESOLVER =============== */
function resolveImageUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";

  // already absolute
  if (u.startsWith("http://") || u.startsWith("https://")) return u;

  // backend uploads path
  if (u.startsWith("/uploads/")) {
    // If API_BASE is missing, at least return the raw path
    return API_BASE ? `${API_BASE}${u}` : u;
  }

  // relative image paths like images_brown/...
  return u;
}

/* =============== NORMALIZE PRODUCT =============== */
function normalizeProduct(p) {
  const id = p?.id;
  const name = safeText(p?.name);

  // image sources could come from: image, image_url, images[]
  const rawImage =
    p?.image ||
    p?.image_url ||
    (Array.isArray(p?.images) && p.images[0]) ||
    "";

  let images = [];
  if (Array.isArray(p?.images)) images = p.images;
  else if (typeof p?.images === "string") {
    try { images = JSON.parse(p.images); } catch { images = []; }
  }

  const category = safeText(p?.category || p?.payload?.category || "Product");
  const price = Number(p?.price || 0);
  const discount = Number(p?.discount || 0);
  const description = safeText(p?.description || p?.payload?.description || "");

  const fallbackImg = "images_brown/bodyButter.png";

  // resolve main image + all images
  const mainImage = resolveImageUrl(rawImage) || fallbackImg;
  const resolvedImages = (Array.isArray(images) ? images : [])
    .map(resolveImageUrl)
    .filter(Boolean);

  const is_active = (p?.is_active === undefined || p?.is_active === null)
    ? true
    : Boolean(p.is_active);

  return {
    id,
    name,
    category: category || "Product",
    price: Number.isFinite(price) ? price : 0,
    discount: Number.isFinite(discount) ? discount : 0,
    image: mainImage,
    images: resolvedImages.length ? resolvedImages : [mainImage],
    description,
    is_active
  };
}

/* =============== BACKEND =============== */
async function fetchProducts() {
  if (!API_BASE) throw new Error("API_BASE is missing in config.js");

  const res = await fetch(`${API_BASE}/api/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Products fetch failed: ${res.status}`);

  const data = await res.json();

  // backend could return array or {products:[...]}
  const list = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
  if (!Array.isArray(list)) return [];

  return list
    .map(normalizeProduct)
    .filter(p => p.id && p.name)
    .filter(p => (SHOW_ONLY_ACTIVE ? p.is_active : true));
}

/* =============== CART (SESSION ONLY) =============== */
function loadCart() {
  const c = safeJSONSession(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCart(cart) { saveJSONSession(CART_KEY, cart); }
function isInCart(cart, id) { return cart.some(i => Number(i.id) === Number(id)); }

function addToCartOnce(product) {
  const cart = loadCart();
  if (isInCart(cart, product.id)) return;
  cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, qty: 1 });
  saveCart(cart);
}

function updateCartCount() {
  const cartCountEl = document.getElementById("cartCount");
  if (!cartCountEl) return;
  const cart = loadCart();
  cartCountEl.textContent = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

/* =============== REVIEWS SUMMARY (CARD RATINGS FROM BACKEND) =============== */
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function starsTextFromAverage(avg) {
  const rounded = clamp(Math.round(avg), 0, 5);
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

async function fetchReviewSummary(productId) {
  if (!API_BASE) return { avg: 0, count: 0 };

  try {
    const r = await fetch(
      `${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews/summary`,
      { cache: "no-store" }
    );
    if (!r.ok) return { avg: 0, count: 0 };

    const data = await r.json();
    const s = data?.summary || {};
    return { avg: Number(s.avg || 0), count: Number(s.count || 0) };
  } catch {
    return { avg: 0, count: 0 };
  }
}

function ratingLineHTMLFromSummary(summary) {
  const count = Number(summary?.count || 0);
  if (!count) return `<div class="p-rating is-empty">No reviews yet</div>`;
  const avg = Number(summary?.avg || 0);
  const avg1 = Math.round(avg * 10) / 10;
  const stars = starsTextFromAverage(avg);
  return `<div class="p-rating">${stars} <span class="p-rate-num">${avg1}</span> <span class="p-rate-count">(${count})</span></div>`;
}

/* =============== FILTERS =============== */
let products = [];
let currentList = [];
let reviewSummaryCache = new Map(); // productId -> {avg,count}

function populateCategories() {
  const sel = document.getElementById("categorySelect");
  if (!sel) return;

  sel.innerHTML = `<option value="all">All</option>`;

  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  cats.forEach(cat => {
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

/* =============== RENDER =============== */
async function primeSummaries(list) {
  const tasks = list.map(async (p) => {
    if (reviewSummaryCache.has(p.id)) return;
    const sum = await fetchReviewSummary(p.id);
    reviewSummaryCache.set(p.id, sum);
  });
  await Promise.all(tasks);
}

async function renderProducts(list = products) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  currentList = list;
  grid.innerHTML = "";

  const cart = loadCart();

  await primeSummaries(list);

  list.forEach(p => {
    const inCart = isInCart(cart, p.id);
    const card = document.createElement("div");
    card.className = "p-card";

    const price = Number(p.price || 0);
    const category = safeText(p.category || "Product").toUpperCase();
    const sum = reviewSummaryCache.get(p.id) || { avg: 0, count: 0 };

    // ✅ Escape any text inserted into HTML
    const safeName = escapeHtml(p.name);
    const safeCategory = escapeHtml(category);

    // ✅ Image already resolved by normalizeProduct
    const imgSrc = escapeHtml(p.image);

    card.innerHTML = `
      <div class="p-media">
        <img src="${imgSrc}" alt="${safeName}" class="p-img" draggable="false" loading="lazy">
      </div>

      <div class="p-info">
        <div class="p-topline">
          <span class="p-cat">${safeCategory}</span>
          ${inCart ? `<span class="p-flag">IN CART</span>` : ``}
        </div>

        <div class="p-name">${safeName}</div>
        <div class="p-price">₦${price.toLocaleString()}</div>

        ${ratingLineHTMLFromSummary(sum)}
      </div>

      <button class="p-btn ${inCart ? "is-added" : ""}" type="button">
        ${inCart ? "ADDED" : "ADD TO CART"}
      </button>
    `;

    card.querySelector(".p-img")?.addEventListener("click", () => {
      window.location.href = `product-details.html?id=${encodeURIComponent(p.id)}`;
    });

    const info = card.querySelector(".p-info");
    if (info) {
      info.style.cursor = "pointer";
      info.addEventListener("click", () => {
        window.location.href = `product-details.html?id=${encodeURIComponent(p.id)}`;
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

/* =============== INIT =============== */
async function initProductsPage() {
  try {
    const backendProducts = await fetchProducts();
    products = backendProducts;

    // ✅ store in sessionStorage for index.js + other pages
    saveJSONSession(PRODUCTS_KEY, products);

    populateCategories();
    bindFilters();
    await renderProducts(products);
    updateCartCount();
  } catch (e) {
    console.warn(e);

    // fallback: try session cache
    const fallback = safeJSONSession(PRODUCTS_KEY, null);
    if (Array.isArray(fallback) && fallback.length) {
      products = fallback;

      populateCategories();
      bindFilters();
      await renderProducts(products);
      updateCartCount();
      return;
    }

    const grid = document.getElementById("productsGrid");
    if (grid) {
      const msg = API_BASE
        ? `Could not load products. Please try again.`
        : `API_BASE missing. Set window.API_BASE in config.js.`;
      grid.innerHTML = `<div style="padding:18px">${escapeHtml(msg)}</div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initProductsPage();
});
