/* ================= PRODUCTS.JS (BACKEND-FIRST + GLASS 5D) =================
   ✅ Fetches from backend: GET `${API_BASE}/api/products`
      - image_url expected SIGNED URL already (private bucket via backend)
   ✅ If backend fails -> uses cached localStorage(allProducts) only
   ✅ If no cache -> shows empty state + Retry
   ✅ Cart in localStorage(cart)
   ✅ Ratings: backend /reviews/summary with cache + concurrency limit
   ✅ Safe rendering: escapes text
========================================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";
const CART_KEY = "cart";

// local reviews fallback (optional legacy)
const REVIEWS_KEY = "productReviews_v1";

// backend ratings summary cache
const REVIEWS_SUMMARY_KEY = "productReviewSummary_v1";
const SUMMARY_TTL_MS = 15 * 60 * 1000;
const MAX_RATING_REQUESTS = 6;

let products = [];
let currentList = [];

/* ================= SAFE JSON ================= */
function safeJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ================= SECURITY ================= */
function escapeHtml(input) {
  const s = String(input ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ================= IMAGE RESOLUTION ================= */
function resolveImage(url) {
  const u = String(url || "").trim();
  if (!u) return "";

  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;

  if (u.startsWith("/uploads/")) return API_BASE ? `${API_BASE}${u}` : u;

  // signed URLs should already be full; plain keys can’t be resolved safely in frontend
  if (u.startsWith("products/")) return "";

  // allow local static folders
  if (u.startsWith("images/") || u.startsWith("images_brown/")) return u;

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

  const category = String(p?.category || p?.payload?.category || "Product").trim();
  const price = Number(p?.price || 0);
  const discount = Number(p?.discount || 0);
  const description = String(p?.description || p?.payload?.description || "").trim();

  const fallback = "images_brown/bodyButter.png";

  if (!images.length && image) images = [image];
  if (!images.length) images = [fallback];

  return {
    id,
    name,
    category: category || "Product",
    price: Number.isFinite(price) ? price : 0,
    discount: Number.isFinite(discount) ? discount : 0,
    image: image || fallback,
    images,
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

function loadProductsCache() {
  const stored = safeJSON(PRODUCTS_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.map(normalizeProduct).filter(p => p.id && p.name);
}

/* ================= CART ================= */
/* ================= CART (localStorage + sync) ================= */
const CART_CHANNEL = "kikelara_cart_sync_v1";
const cartChannel = ("BroadcastChannel" in window) ? new BroadcastChannel(CART_CHANNEL) : null;

function broadcastCartUpdated() {
  document.dispatchEvent(new Event("cart:updated"));
  if (cartChannel) { try { cartChannel.postMessage({ type: "CART_UPDATED" }); } catch {} }
}

function loadCart() {
  const c = safeJSON(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCart(cart) {
  saveJSON(CART_KEY, cart);
  broadcastCartUpdated();
}
function isInCart(cart, id) {
  const sid = String(id);
  return cart.some(i => String(i.id) === sid);
}

function addToCartOnce(product) {
  const cart = loadCart();
  if (isInCart(cart, product.id)) return;

  cart.push({
    id: String(product.id),
    name: String(product.name || ""),
    price: Number(product.price || 0),
    image: product.image,
    qty: 1
  });

  saveCart(cart);
}

function updateCartCount() {
  const cartCountEl = document.getElementById("cartCount");
  if (!cartCountEl) return;
  const cart = loadCart();
  const total = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  cartCountEl.textContent = String(total);
}

/* ================= REVIEWS (CARD RATINGS) ================= */
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

  return { avg: Number(item.avg || 0), count: Number(item.count || 0) };
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

function ratingLineHTML(productId) {
  const cached = getCachedSummary(productId);
  if (cached) return ratingHTMLFromSummary(cached);

  if (!API_BASE) return ratingHTMLFallbackLocal(productId);
  return ratingHTMLFallbackLocal(productId);
}

/** Concurrency-limited queue */
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

  return { avg: Number(data.summary.avg || 0), count: Number(data.summary.count || 0) };
}

function hydrateRatingsForList(list) {
  if (!API_BASE) return;

  list.forEach(p => {
    const productId = p.id;
    if (!productId) return;
    if (getCachedSummary(productId)) return;

    enqueue(async () => {
      try {
        const summary = await fetchSummaryFromBackend(productId);
        if (!summary) return;

        setCachedSummary(productId, summary);

        const el = document.getElementById(`rating-${productId}`);
        if (el) el.innerHTML = ratingHTMLFromSummary(summary);
      } catch {}
    });
  });
}

/* ================= FILTERS ================= */
function populateCategories() {
  const sel = document.getElementById("categorySelect");
  if (!sel) return;

  sel.innerHTML = `<option value="all">All</option>`;
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
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

  function apply() {
    const cat = categorySelectEl ? categorySelectEl.value : "all";
    const sort = sortSelectEl ? sortSelectEl.value : "default";

    let list = cat === "all" ? products : products.filter(p => p.category === cat);

    if (sort !== "default") {
      list = [...list];
      if (sort === "priceLow") list.sort((a, b) => (a.price || 0) - (b.price || 0));
      if (sort === "priceHigh") list.sort((a, b) => (b.price || 0) - (a.price || 0));
      if (sort === "name") list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    renderProducts(list);
  }

  categorySelectEl?.addEventListener("change", () => {
    if (sortSelectEl) sortSelectEl.value = "default";
    apply();
  });

  sortSelectEl?.addEventListener("change", apply);
}

/* ================= META + EMPTY ================= */
function setMeta(text) {
  const el = document.getElementById("productsMeta");
  if (el) el.textContent = text || "";
}

function showEmpty(show) {
  const empty = document.getElementById("emptyState");
  const grid = document.getElementById("productsGrid");
  if (!empty || !grid) return;
  empty.hidden = !show;
  grid.style.display = show ? "none" : "";
}

/* ================= 5D TILT (DESKTOP ONLY) ================= */
const CAN_TILT = window.matchMedia?.("(hover:hover) and (pointer:fine)")?.matches;

function bindTilt(card) {
  if (!CAN_TILT) return;

  const onMove = (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;

    const ry = (x - 0.5) * 10;   // left/right
    const rx = (0.5 - y) * 8;    // up/down

    card.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    card.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    card.classList.add("is-tilting");
  };

  const onLeave = () => {
    card.classList.remove("is-tilting");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
  };

  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerleave", onLeave);
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
    const price = Number(p.price || 0);
    const categoryUpper = String(p.category || "Product").toUpperCase();

    const imgSrc = resolveImage(p.image) || "images_brown/bodyButter.png";

    const safeName = escapeHtml(p.name);
    const safeCat = escapeHtml(categoryUpper);

    const card = document.createElement("article");
    card.className = "p-card";
    card.setAttribute("data-id", String(p.id));

    card.innerHTML = `
      <div class="p-media">
        <img src="${imgSrc}" alt="${safeName}" class="p-img" draggable="false">
      </div>

      <div class="p-body">
        <div class="p-topline">
          <span class="p-cat">${safeCat}</span>
          ${inCart ? `<span class="p-flag">IN CART</span>` : ``}
        </div>

        <div class="p-name">${safeName}</div>
        <div class="p-price">₦${price.toLocaleString()}</div>

        <div id="rating-${p.id}">
          ${ratingLineHTML(p.id)}
        </div>

        <div class="p-actions">
          <button class="p-btn ${inCart ? "is-added" : ""}" type="button">
            ${inCart ? "ADDED" : "ADD TO CART"}
          </button>
        </div>
      </div>
    `;

    bindTilt(card);

    // Navigate on image/body click
    card.querySelector(".p-img")?.addEventListener("click", () => {
      window.location.href = `product-details.html?id=${encodeURIComponent(p.id)}`;
    });

    card.querySelector(".p-body")?.addEventListener("click", (e) => {
      // don't hijack button clicks
      if (e.target?.closest?.("button")) return;
      window.location.href = `product-details.html?id=${encodeURIComponent(p.id)}`;
    });

    // Add to cart
    card.querySelector(".p-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCartOnce(p);
      renderProducts(currentList);
      updateCartCount();
    });

    grid.appendChild(card);
  });

  setMeta(`${list.length} product${list.length === 1 ? "" : "s"} available`);
  updateCartCount();
  hydrateRatingsForList(list);
}

/* ================= INIT ================= */
async function initProductsPage() {
  showEmpty(false);
  setMeta("Loading products…");

  try {
    const backendProducts = await fetchProductsFromBackend();
    products = backendProducts;
    saveJSON(PRODUCTS_KEY, products);
  } catch (e) {
    console.warn("Backend products failed:", e);
    const cached = loadProductsCache();
    products = cached;
  }

  if (!products.length) {
    setMeta("");
    showEmpty(true);
    return;
  }

  populateCategories();
  bindFilters();
  renderProducts(products);
  showEmpty(false);
}

document.addEventListener("DOMContentLoaded", () => {
  initProductsPage();

  document.getElementById("retryBtn")?.addEventListener("click", () => {
    initProductsPage();
  });
});
