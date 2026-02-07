/* ================= PRODUCTS.JS (BACKEND MODE + RATINGS ON CARDS) =================
   ✅ Loads products from backend (/api/products)
   ✅ Keeps reviews/ratings in localStorage (productReviews_v1)
   ✅ Cart stays in localStorage
   ✅ Works with your config.js: window.API_BASE
*/

const API_BASE = window.API_BASE || "http://localhost:4000";

const CART_KEY = "cart";

/* ✅ Reviews storage (same one used by product-details.js) */
const REVIEWS_KEY = "productReviews_v1";

/* ================= SAFE HELPERS ================= */
function safeJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/* ✅ Make sure product images work for:
   - "/uploads/xxx.jpg"  -> API_BASE + "/uploads/xxx.jpg"
   - "uploads/xxx.jpg"   -> API_BASE + "/uploads/xxx.jpg"
   - "http..."           -> keep as is
   - "images_brown/..."  -> keep as is (front-end public folder)
*/
function resolveImg(src) {
  const s = String(src || "").trim();
  if (!s) return "";

  if (/^https?:\/\//i.test(s)) return s;             // absolute url
  if (s.startsWith("/uploads/")) return API_BASE + s;
  if (s.startsWith("uploads/")) return API_BASE + "/" + s;

  // If you stored "/images_brown/..." you can also prefix site base if you want.
  // But normally these are frontend static paths, so return as-is:
  return s;
}

/* ================= CART ================= */
function loadCart() {
  const c = safeJSON(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function isInCart(cart, id) {
  return cart.some((i) => Number(i.id) === Number(id));
}
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
  cartCountEl.textContent = cart.reduce(
    (sum, item) => sum + (Number(item.qty) || 0),
    0
  );
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

/* ================= STATE ================= */
let products = [];
let currentList = [];

/* ================= FILTERS ================= */
function populateCategories() {
  const sel = document.getElementById("categorySelect");
  if (!sel) return;

  sel.innerHTML = `<option value="all">All</option>`;
  [...new Set(products.map((p) => p.category).filter(Boolean))].forEach((cat) => {
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
      const filtered =
        val === "all" ? products : products.filter((p) => p.category === val);
      renderProducts(filtered);
      if (sortSelectEl) sortSelectEl.value = "default";
    });
  }

  if (sortSelectEl) {
    sortSelectEl.addEventListener("change", () => {
      const category = categorySelectEl ? categorySelectEl.value : "all";
      const filtered =
        category === "all"
          ? products
          : products.filter((p) => p.category === category);

      if (sortSelectEl.value === "default") return renderProducts(filtered);

      const sorted = [...filtered];
      if (sortSelectEl.value === "priceLow")
        sorted.sort((a, b) => Number(a.price) - Number(b.price));
      if (sortSelectEl.value === "priceHigh")
        sorted.sort((a, b) => Number(b.price) - Number(a.price));
      if (sortSelectEl.value === "name")
        sorted.sort((a, b) => String(a.name).localeCompare(String(b.name)));

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

  list.forEach((p) => {
    const inCart = isInCart(cart, p.id);

    const cover = resolveImg(p.image);

    const card = document.createElement("div");
    card.className = "p-card";

    card.innerHTML = `
      <div class="p-media">
        <img src="${cover}" alt="${String(p.name || "")}" class="p-img" draggable="false">
      </div>

      <div class="p-info">
        <div class="p-topline">
          <span class="p-cat">${String(p.category || "Product").toUpperCase()}</span>
          ${inCart ? `<span class="p-flag">IN CART</span>` : ``}
        </div>

        <div class="p-name">${String(p.name || "")}</div>
        <div class="p-price">₦${Number(p.price || 0).toLocaleString()}</div>

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
      img.addEventListener("error", () => {
        img.src = "images/logo.jpg";
      });
    }

    // Click info -> details
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
        renderProducts(currentList);
        updateCartCount();
      });
    }

    grid.appendChild(card);
  });

  updateCartCount();
}

/* ================= LOAD FROM BACKEND ================= */
async function loadProductsFromBackend() {
  const grid = document.getElementById("productsGrid");

  try {
    if (grid) grid.innerHTML = `<div style="padding:20px; opacity:.85;">Loading products…</div>`;

    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error("Failed to fetch products");
    const data = await res.json();

    products = Array.isArray(data) ? data : [];

    // Safety normalize
    products = products.map((p) => ({
      ...p,
      id: Number(p.id),
      price: Number(p.price || 0),
      discount: Number(p.discount || 0),
      image: p.image || "",
      images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
      name: p.name || "",
      category: p.category || "",
      description: p.description || ""
    }));

    populateCategories();
    bindFilters();
    renderProducts(products);
    updateCartCount();
  } catch (e) {
    if (grid) {
      grid.innerHTML = `
        <div style="padding:20px;">
          <b>Products not loading.</b><br/>
          <span style="opacity:.85;">Check your backend is running and API_BASE is correct.</span>
        </div>
      `;
    }
    updateCartCount();
  }
}

document.addEventListener("DOMContentLoaded", loadProductsFromBackend);
