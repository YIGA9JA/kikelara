/* ================= PRODUCTS.JS (BACKEND-FIRST + LOCAL FALLBACK + PRIVATE SUPABASE BUCKET OPTION A) =================
   ✅ Backend first: GET `${window.API_BASE}/api/products`
      - image_url is expected to be a SIGNED URL already (private bucket)
   ✅ If backend fails, uses localStorage seed defaults
   ✅ Cart stays in localStorage
   ✅ Ratings: prefer backend /reviews/summary (cached + concurrency limit), fallback to localStorage reviews
   ✅ Saves fetched products into localStorage(allProducts) for compatibility (note signed urls expire eventually)
   ✅ Resolves image_url for:
      - full URLs (SIGNED) ✅
      - /uploads/... (legacy backend uploads) ✅
      - local static: images_brown/... ✅
========================================================================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");

const PRODUCTS_KEY = "allProducts";
const CART_KEY = "cart";

// local reviews fallback (if you used this before)
const REVIEWS_KEY = "productReviews_v1";

// backend ratings summary cache
const REVIEWS_SUMMARY_KEY = "productReviewSummary_v1";
const SUMMARY_TTL_MS = 15 * 60 * 1000; // 15 minutes cache
const MAX_RATING_REQUESTS = 6;

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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Failed saving to localStorage:", key, e);
  }
}

/* ================= SECURITY HELPERS ================= */
function escapeHtml(input) {
  const s = String(input ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ================= IMAGE RESOLUTION =================
   Handles:
   - Full URL (SIGNED): https://... ✅
   - data:/blob: ✅
   - Legacy backend uploads: /uploads/... ✅ -> API_BASE + /uploads/...
   - Local static: images_brown/... ✅
   - If a plain key like "products/....webp" shows up, we cannot build a URL (private bucket).
     In that case we return "" and fallback image will be used.
*/
function resolveImage(url) {
  const u = String(url || "").trim();
  if (!u) return "";

  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;

  if (u.startsWith("/uploads/")) return API_BASE ? `${API_BASE}${u}` : u;

  // private bucket key cannot be resolved on frontend safely
  if (u.startsWith("products/") || u.includes("/")) {
    // This might still be a local relative path (e.g. images_brown/...)
    // Allow known local folders:
    if (u.startsWith("images/") || u.startsWith("images_brown/")) return u;

    // otherwise: treat as non-resolvable key
    return "";
  }

  return u;
}

function normalizeImages(imagesField) {
  if (!imagesField) return [];

  if (Array.isArray(imagesField)) {
    return imagesField.map(resolveImage).filter(Boolean);
  }

  if (typeof imagesField === "string") {
    const s = imagesField.trim();
    if (!s) return [];
    if (!s.startsWith("[") && !s.startsWith("{")) return [resolveImage(s)].filter(Boolean);
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(resolveImage).filter(Boolean);
    } catch {}
  }

  return [];
}

function normalizeProduct(p) {
  const id = p?.id;
  const name = String(p?.name || "").trim();

  const rawImage =
    p?.image || p?.image_url || (Array.isArray(p?.images) && p.images[0]) || "";

  const image = resolveImage(rawImage);
  let images = normalizeImages(p?.images);

  if (!images.length && image) images = [image];

  const category = String(p?.category || p?.payload?.category || "Product").trim();
  const price = Number(p?.price || 0);
  const discount = Number(p?.discount || 0);
  const description = String(p?.description || p?.payload?.description || "").trim();

  const fallback = "images_brown/bodyButter.png";

  return {
    id,
    name,
    category: category || "Product",
    price: Number.isFinite(price) ? price : 0,
    discount: Number.isFinite(discount) ? discount : 0,
    image: image || fallback,
    images: images.length ? images : [fallback],
    description
  };
}

/* ================= LOAD PRODUCTS ================= */
async function fetchProductsFromBackend() {
  if (!API_BASE) throw new Error("API_BASE not set");
  const res = await fetch(`${API_BASE}/api/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Products fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeProduct).filter(p => p.id && p.name);
}

/* ✅ Seed defaults only once (used when backend is down) */
function loadProductsLocal() {
  const stored = safeJSON(PRODUCTS_KEY, null);
  if (Array.isArray(stored) && stored.length) {
    return stored.map(normalizeProduct);
  }
  saveJSON(PRODUCTS_KEY, defaultProducts);
  return defaultProducts.map(normalizeProduct);
}

let products = [];
let currentList = [];

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

/* ================= REVIEWS (CARD RATINGS) ================= */
/** Local fallback reviews (optional legacy) */
function loadAllReviewsLocal() {
  const obj = safeJSON(REVIEWS_KEY, {});
  return obj && typeof obj === "object" ? obj : {};
}
function getReviewsForProductLocal(productId) {
  const all = loadAllReviewsLocal();
  const list = all[String(productId)];
  return Array.isArray(list) ? list : [];
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function starsTextFromAverage(avg) {
  const rounded = clamp(Math.round(avg), 0, 5);
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

/** Backend summary cache */
function loadSummaryCache() {
  const obj = safeJSON(REVIEWS_SUMMARY_KEY, {});
  return obj && typeof obj === "object" ? obj : {};
}
function saveSummaryCache(obj) { saveJSON(REVIEWS_SUMMARY_KEY, obj); }

function getCachedSummary(productId) {
  const cache = loadSummaryCache();
  const item = cache[String(productId)];
  if (!item || typeof item !== "object") return null;

  const ts = Number(item.ts || 0);
  if (!ts || (Date.now() - ts) > SUMMARY_TTL_MS) return null;

  const avg = Number(item.avg || 0);
  const count = Number(item.count || 0);
  return { avg, count };
}

function setCachedSummary(productId, summary) {
  const cache = loadSummaryCache();
  cache[String(productId)] = {
    avg: Number(summary?.avg || 0),
    count: Number(summary?.count || 0),
    ts: Date.now()
  };
  saveSummaryCache(cache);
}

function ratingHTMLFromSummary(summary) {
  const count = Number(summary?.count || 0);
  const avg = Number(summary?.avg || 0);

  if (!count) return `<div class="p-rating is-empty">No reviews yet</div>`;

  const avg1 = Math.round(avg * 10) / 10;
  const stars = starsTextFromAverage(avg);
  return `<div class="p-rating">${stars} <span class="p-rate-num">${avg1}</span> <span class="p-rate-count">(${count})</span></div>`;
}

function ratingHTMLFallbackLocal(productId) {
  const list = getReviewsForProductLocal(productId);
  if (!list.length) return `<div class="p-rating is-empty">No reviews yet</div>`;
  const sum = list.reduce((a, r) => a + (Number(r.rating) || 0), 0);
  const avg = sum / list.length;
  const avg1 = Math.round(avg * 10) / 10;
  const stars = starsTextFromAverage(avg);
  return `<div class="p-rating">${stars} <span class="p-rate-num">${avg1}</span> <span class="p-rate-count">(${list.length})</span></div>`;
}

/** Initial rating line (sync): cached backend -> local fallback -> loading */
function ratingLineHTML(productId) {
  const cached = getCachedSummary(productId);
  if (cached) return ratingHTMLFromSummary(cached);

  // if no API_BASE, just fallback local
  if (!API_BASE) return ratingHTMLFallbackLocal(productId);

  // show quick local fallback while loading backend summary
  const local = ratingHTMLFallbackLocal(productId);
  return local || `<div class="p-rating is-empty">Loading…</div>`;
}

/** Concurrency-limited queue for summary fetch */
let inFlight = 0;
const summaryQueue = [];

function runQueue() {
  while (inFlight < MAX_RATING_REQUESTS && summaryQueue.length) {
    const job = summaryQueue.shift();
    if (!job) break;
    inFlight++;
    job().finally(() => {
      inFlight--;
      runQueue();
    });
  }
}

function enqueue(job) {
  summaryQueue.push(job);
  runQueue();
}

async function fetchSummaryFromBackend(productId) {
  if (!API_BASE) return null;

  const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews/summary`, {
    cache: "no-store"
  });

  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  if (!data || !data.ok || !data.summary) return null;

  const avg = Number(data.summary.avg || 0);
  const count = Number(data.summary.count || 0);
  return { avg, count };
}

function hydrateRatingsForList(list) {
  if (!API_BASE) return;

  list.forEach(p => {
    const productId = p.id;
    if (!productId) return;

    // if already cached, no need
    if (getCachedSummary(productId)) return;

    enqueue(async () => {
      try {
        const summary = await fetchSummaryFromBackend(productId);
        if (!summary) return;

        setCachedSummary(productId, summary);

        const el = document.getElementById(`rating-${productId}`);
        if (el) el.innerHTML = ratingHTMLFromSummary(summary);
      } catch {
        // ignore (keep local fallback)
      }
    });
  });
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

    const price = Number(p.price || 0);
    const categoryUpper = String(p.category || "Product").toUpperCase();

    const imgSrc = resolveImage(p.image) || "images_brown/bodyButter.png";

    // escape all dynamic text
    const safeName = escapeHtml(p.name);
    const safeCat = escapeHtml(categoryUpper);

    card.innerHTML = `
      <div class="p-media">
        <img src="${imgSrc}" alt="${safeName}" class="p-img" draggable="false">
      </div>

      <div class="p-info">
        <div class="p-topline">
          <span class="p-cat">${safeCat}</span>
          ${inCart ? `<span class="p-flag">IN CART</span>` : ``}
        </div>

        <div class="p-name">${safeName}</div>
        <div class="p-price">₦${price.toLocaleString()}</div>

        <div id="rating-${p.id}">
          ${ratingLineHTML(p.id)}
        </div>
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

  // async hydrate ratings from backend summaries
  hydrateRatingsForList(list);
}

/* ================= INIT ================= */
async function initProductsPage() {
  try {
    const backendProducts = await fetchProductsFromBackend();
    if (backendProducts.length) {
      products = backendProducts;
      saveJSON(PRODUCTS_KEY, products); // keep in localStorage for compatibility
    } else {
      products = loadProductsLocal();
    }
  } catch (e) {
    console.warn("Backend products failed, using local fallback:", e);
    products = loadProductsLocal();
  }

  populateCategories();
  bindFilters();
  renderProducts(products);
  updateCartCount();
}

document.addEventListener("DOMContentLoaded", () => {
  initProductsPage();
});
