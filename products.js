/* ================= PRODUCTS.JS (FAST LOAD + CORRECT IMAGE RESOLVE) =================
   ✅ Renders cached products IMMEDIATELY (instant UI)
   ✅ Background refresh (stale-while-revalidate)
   ✅ Images:
      - if URL => use immediately
      - if key (products/... or cld:...) => resolve near viewport (fast)
      - on error => re-fetch product fresh image_url and swap ONLY that card
   ✅ Ratings: fetched ONLY near viewport (IntersectionObserver)
   ✅ Concurrency limited requests
   ✅ No full re-render on "Add to cart" (updates only clicked card)
==================================================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";
const PRODUCTS_CACHE_META_KEY = "allProducts_meta_v1";
const CART_KEY = "cart";

// local reviews fallback (optional legacy)
const REVIEWS_KEY = "productReviews_v1";

// backend ratings summary cache
const REVIEWS_SUMMARY_KEY = "productReviewSummary_v1";
const SUMMARY_TTL_MS = 15 * 60 * 1000;
const MAX_RATING_REQUESTS = 6;

// products cache TTL (fast paint from localStorage)
const PRODUCTS_TTL_MS = 1000 * 60 * 10; // 10 minutes

// ✅ image URL cache (session-only so it won’t keep expired URLs forever)
const IMG_URL_CACHE_KEY = "kkl_img_url_cache_v1";
const IMG_URL_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const MAX_IMAGE_REQUESTS = 6;

let products = [];
let currentList = [];
let filtersBound = false;

/* ================= SMALL SPEED WIN: PRECONNECT ================= */
(function preconnectApi() {
  try {
    if (!API_BASE) return;
    const u = new URL(API_BASE);
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = u.origin;
    document.head.appendChild(link);
  } catch {}
})();

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

/* ================= IMAGE HELPERS ================= */
function isHttpUrl(u) {
  return /^https?:\/\//i.test(String(u || ""));
}
function isBlobOrData(u) {
  return /^(blob:|data:)/i.test(String(u || ""));
}

// ✅ treat these as “keys” that must be resolved via backend (or cloudinary)
function looksLikeMediaKey(u) {
  const s = String(u || "").trim();
  if (!s) return false;
  if (isHttpUrl(s) || isBlobOrData(s)) return false;
  if (s.startsWith("/uploads/")) return false;
  if (s.startsWith("images/") || s.startsWith("images_brown/")) return false;
  if (s.startsWith("cld:")) return true;      // Cloudinary public_id reference
  if (s.startsWith("products/")) return true; // Supabase key
  if (s.startsWith("featured/")) return true;
  if (s.startsWith("hero/")) return true;
  return false;
}

// ✅ direct resolve for local/static + /uploads + already-URL
function resolveImageImmediate(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (isHttpUrl(u) || isBlobOrData(u)) return u;
  if (u.startsWith("/uploads/")) return API_BASE ? `${API_BASE}${u}` : u;
  if (u.startsWith("images/") || u.startsWith("images_brown/")) return u;
  // keys return "" here, will be resolved async
  if (looksLikeMediaKey(u)) return "";
  return u;
}

/* ================= IMAGE URL CACHE (SESSION) ================= */
function loadImgCache() {
  const obj = safeJSONSession(IMG_URL_CACHE_KEY, {});
  return obj && typeof obj === "object" ? obj : {};
}
function getImgCached(key) {
  const cache = loadImgCache();
  const item = cache[String(key)];
  if (!item || typeof item !== "object") return null;
  const ts = Number(item.ts || 0);
  if (!ts || Date.now() - ts > IMG_URL_TTL_MS) return null;
  const url = String(item.url || "");
  return url ? url : null;
}
function setImgCached(key, url) {
  const cache = loadImgCache();
  cache[String(key)] = { url: String(url || ""), ts: Date.now() };
  saveJSONSession(IMG_URL_CACHE_KEY, cache);
}

/* ================= FETCH HELPERS ================= */
async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fetchProductsFromBackend() {
  if (!API_BASE) throw new Error("API_BASE not set");
  const res = await fetchWithTimeout(`${API_BASE}/api/products`, 12000);
  if (!res.ok) throw new Error(`Products fetch failed: ${res.status}`);
  const data = await res.json().catch(() => []);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeProduct).filter(p => p.id && p.name);
}

// ✅ fetch single product to refresh broken image
async function fetchProductById(id) {
  if (!API_BASE) return null;
  const res = await fetchWithTimeout(`${API_BASE}/api/products/${encodeURIComponent(id)}`, 12000);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const row = data?.product || null;
  if (!row) return null;
  return normalizeProduct(row);
}

/* ================= PRODUCTS CACHE META ================= */
function loadProductsCache() {
  const stored = safeJSON(PRODUCTS_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.map(normalizeProduct).filter(p => p.id && p.name);
}
function loadProductsCacheMeta() {
  const meta = safeJSON(PRODUCTS_CACHE_META_KEY, {});
  if (!meta || typeof meta !== "object") return { ts: 0 };
  return { ts: Number(meta.ts || 0) };
}
function saveProductsCacheMeta() {
  saveJSON(PRODUCTS_CACHE_META_KEY, { ts: Date.now() });
}

/* ================= NORMALIZE PRODUCT ================= */
function normalizeImages(imagesField) {
  if (!imagesField) return [];
  if (Array.isArray(imagesField)) return imagesField.map(String).map(s => s.trim()).filter(Boolean);

  if (typeof imagesField === "string") {
    const s = imagesField.trim();
    if (!s) return [];
    if (!s.startsWith("[") && !s.startsWith("{")) return [s];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String).map(x => x.trim()).filter(Boolean);
    } catch {}
  }
  return [];
}

function normalizeProduct(p) {
  const id = p?.id;
  const name = String(p?.name || "").trim();

  // Prefer backend-provided URLs
  const rawPrimary =
    p?.image_url ||
    p?.detail_image_url ||
    p?.image ||
    (Array.isArray(p?.images) && p.images[0]) ||
    "";

  // Keys (if backend provides them)
  const rawKey =
    p?.image_key ||
    p?.detail_image_key ||
    p?.payload?.__image_key ||
    "";

  const category = String(p?.category || p?.payload?.category || "Product").trim();
  const price = Number(p?.price || 0);
  const discount = Number(p?.discount || 0);
  const description = String(p?.description || p?.payload?.description || "").trim();

  const fallback = "images_brown/bodyButter.png";

  // Keep original list (URLs or keys). We resolve later.
  const imagesList = normalizeImages(p?.images);
  const primaryImmediate = resolveImageImmediate(rawPrimary);

  // If rawPrimary is a key, keep it as image_key so we can resolve
  const image_key = looksLikeMediaKey(rawPrimary) ? String(rawPrimary) : String(rawKey || "");

  return {
    id,
    name,
    category: category || "Product",
    price: Number.isFinite(price) ? price : 0,
    discount: Number.isFinite(discount) ? discount : 0,

    // this is what we’ll render first (might be empty if it’s a key)
    image_url: primaryImmediate || "",

    // stable resolver key
    image_key: image_key || "",

    // gallery (may contain urls or keys)
    images: imagesList.length ? imagesList : [fallback],

    description
  };
}

/* ================= CART (KStore preferred) ================= */
function getStore() {
  return window.KStore && typeof window.KStore.getCart === "function" ? window.KStore : null;
}
function loadCart() {
  const ks = getStore();
  if (ks) {
    const v = ks.getCart();
    return Array.isArray(v) ? v : [];
  }
  const c = safeJSON(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCartFallback(cart) {
  saveJSON(CART_KEY, Array.isArray(cart) ? cart : []);
  document.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart } }));
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("kikelara_cart_sync_v1");
      bc.postMessage({ type: "CART_UPDATED" });
      bc.close();
    }
  } catch {}
}
function isInCart(cart, id) {
  const sid = String(id);
  return cart.some(i => String(i.id) === sid);
}
function addToCartOnce(product) {
  const ks = getStore();
  if (ks && typeof ks.addToCartOnce === "function") {
    ks.addToCartOnce({
      id: String(product.id),
      name: String(product.name || ""),
      price: Number(product.price || 0),
      image: product.image_url || product.image_key || "",
      qty: 1
    });
    return true;
  }

  const cart = loadCart();
  if (isInCart(cart, product.id)) return false;

  cart.push({
    id: String(product.id),
    name: String(product.name || ""),
    price: Number(product.price || 0),
    image: product.image_url || product.image_key || "",
    qty: 1
  });

  saveCartFallback(cart);
  return true;
}
function updateCartCount() {
  const cartCountEl = document.getElementById("cartCount");
  if (!cartCountEl) return;

  const ks = getStore();
  if (ks && typeof ks.cartQty === "function") {
    const n = ks.cartQty(ks.getCart());
    cartCountEl.textContent = String(n);
    return;
  }

  const cart = loadCart();
  const total = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  cartCountEl.textContent = String(total);
}

/* ================= RATINGS (same as yours) ================= */
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
  if (API_BASE) return `<div class="p-rating is-loading">Loading…</div>`;
  return ratingHTMLFallbackLocal(productId);
}
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
  const res = await fetchWithTimeout(`${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews/summary`, 12000);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || !data.ok || !data.summary) return null;
  return { avg: Number(data.summary.avg || 0), count: Number(data.summary.count || 0) };
}
let ratingObserver = null;
const ratingsSeen = new Set();
function ensureRatingObserver() {
  if (ratingObserver) return;
  if (!("IntersectionObserver" in window)) return;

  ratingObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const card = e.target;
      const productId = card?.getAttribute("data-id");
      if (!productId) return;

      ratingObserver.unobserve(card);

      if (ratingsSeen.has(productId)) return;
      ratingsSeen.add(productId);

      const cached = getCachedSummary(productId);
      if (cached) {
        const el = document.getElementById(`rating-${productId}`);
        if (el) el.innerHTML = ratingHTMLFromSummary(cached);
        return;
      }

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
  }, { rootMargin: "240px 0px" });
}
function observeRatingsForRenderedCards() {
  if (!API_BASE) return;
  ensureRatingObserver();
  if (!ratingObserver) return;

  document.querySelectorAll(".p-card[data-id]").forEach((card) => {
    const id = card.getAttribute("data-id");
    if (!id) return;
    if (getCachedSummary(id)) return;
    ratingObserver.observe(card);
  });
}

/* ================= IMAGE RESOLVE (KEY -> URL) ================= */
let imgInFlight = 0;
const imgQueue = [];
function runImgQueue() {
  while (imgInFlight < MAX_IMAGE_REQUESTS && imgQueue.length) {
    const job = imgQueue.shift();
    if (!job) break;
    imgInFlight++;
    job().finally(() => {
      imgInFlight--;
      runImgQueue();
    });
  }
}
function enqueueImg(job) {
  imgQueue.push(job);
  runImgQueue();
}

// ✅ If you set this in config.js, Cloudinary keys resolve instantly:
// window.CLOUDINARY_CLOUD_NAME="your_cloud_name";
function cloudinaryUrlFromKey(key) {
  const k = String(key || "");
  if (!k.startsWith("cld:")) return "";
  const cloud = String(window.CLOUDINARY_CLOUD_NAME || "").trim();
  if (!cloud) return "";
  const publicId = k.slice(4);
  if (!publicId) return "";
  // auto format + auto quality
  return `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/f_auto,q_auto/${publicId}`;
}

async function resolveMediaKeyToUrl(key) {
  const k = String(key || "").trim();
  if (!k) return "";

  // cached?
  const cached = getImgCached(k);
  if (cached) return cached;

  // Cloudinary direct?
  const cld = cloudinaryUrlFromKey(k);
  if (cld) {
    setImgCached(k, cld);
    return cld;
  }

  // backend resolver (PUBLIC) -> you must add /api/media/sign (snippet below)
  if (!API_BASE) return "";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/media/sign?key=${encodeURIComponent(k)}`, 12000);
    if (!res.ok) return "";
    const data = await res.json().catch(() => null);
    const url = String(data?.url || data?.signedUrl || "");
    if (url) {
      setImgCached(k, url);
      return url;
    }
    return "";
  } catch {
    return "";
  }
}

/* ✅ Images resolve only near viewport */
let imgObserver = null;
const imgSeen = new Set();

function ensureImgObserver() {
  if (imgObserver) return;
  if (!("IntersectionObserver" in window)) return;

  imgObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const img = e.target;
      imgObserver.unobserve(img);

      const key = img.getAttribute("data-key") || "";
      if (!key) return;

      if (imgSeen.has(key)) return;
      imgSeen.add(key);

      enqueueImg(async () => {
        const url = await resolveMediaKeyToUrl(key);
        if (url) img.src = url;
      });
    });
  }, { rootMargin: "320px 0px" });
}

function observeImagesForRenderedCards() {
  ensureImgObserver();
  if (!imgObserver) return;

  document.querySelectorAll("img[data-key]").forEach((img) => {
    const key = img.getAttribute("data-key") || "";
    if (!key) return;

    const cached = getImgCached(key);
    if (cached) {
      img.src = cached;
      img.removeAttribute("data-key");
      return;
    }

    imgObserver.observe(img);
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
  if (filtersBound) return;
  filtersBound = true;

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

    const ry = (x - 0.5) * 10;
    const rx = (0.5 - y) * 8;

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
  const frag = document.createDocumentFragment();

  list.forEach((p, idx) => {
    const inCart = isInCart(cart, p.id);
    const price = Number(p.price || 0);
    const categoryUpper = String(p.category || "Product").toUpperCase();

    const safeName = escapeHtml(p.name);
    const safeCat = escapeHtml(categoryUpper);

    // ✅ image logic
    const immediate = resolveImageImmediate(p.image_url) || resolveImageImmediate(p.image_key);
    const shouldResolveKey = !immediate && looksLikeMediaKey(p.image_key);

    const card = document.createElement("article");
    card.className = "p-card";
    card.setAttribute("data-id", String(p.id));

    card.innerHTML = `
      <div class="p-media">
        <img
          src="${escapeHtml(immediate || "images_brown/bodyButter.png")}"
          ${shouldResolveKey ? `data-key="${escapeHtml(p.image_key)}"` : ""}
          alt="${safeName}"
          class="p-img"
          draggable="false"
          loading="${idx < 2 ? "eager" : "lazy"}"
          decoding="async"
          ${idx < 2 ? `fetchpriority="high"` : `fetchpriority="low"`}
        >
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
          <button class="p-btn ${inCart ? "is-added" : ""}" type="button" data-action="add">
            ${inCart ? "ADDED" : "ADD TO CART"}
          </button>
        </div>
      </div>
    `;

    // ✅ if image breaks, refresh only that product
    const imgEl = card.querySelector(".p-img");
    imgEl?.addEventListener("error", async () => {
      // if it already tried and failed, stop looping
      if (imgEl.getAttribute("data-retried") === "1") return;
      imgEl.setAttribute("data-retried", "1");

      // try re-fetch product for fresh signed url
      const fresh = await fetchProductById(p.id);
      if (fresh?.image_url && isHttpUrl(fresh.image_url)) {
        imgEl.src = fresh.image_url;
        // update local product record in memory
        const idxP = products.findIndex(x => String(x.id) === String(p.id));
        if (idxP >= 0) products[idxP] = fresh;
      } else {
        imgEl.src = "images_brown/bodyButter.png";
      }
    });

    if (CAN_TILT && ("requestIdleCallback" in window)) {
      requestIdleCallback(() => bindTilt(card), { timeout: 1200 });
    } else {
      bindTilt(card);
    }

    frag.appendChild(card);
  });

  grid.appendChild(frag);

  setMeta(`${list.length} product${list.length === 1 ? "" : "s"} available`);
  updateCartCount();

  observeRatingsForRenderedCards();
  observeImagesForRenderedCards(); // ✅ key -> url
}

/* ================= EVENTS (DELEGATED - FAST) ================= */
function bindGridEvents() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.addEventListener("click", (e) => {
    const card = e.target?.closest?.(".p-card");
    if (!card) return;

    const id = card.getAttribute("data-id");
    if (!id) return;

    const addBtn = e.target?.closest?.('button[data-action="add"]');
    if (addBtn) {
      e.stopPropagation();

      const product = (currentList || []).find(p => String(p.id) === String(id));
      if (!product) return;

      const added = addToCartOnce(product);
      updateCartCount();
      window.KStore?.syncBadges?.();

      if (added) {
        addBtn.classList.add("is-added");
        addBtn.textContent = "ADDED";

        const topLine = card.querySelector(".p-topline");
        if (topLine && !topLine.querySelector(".p-flag")) {
          const flag = document.createElement("span");
          flag.className = "p-flag";
          flag.textContent = "IN CART";
          topLine.appendChild(flag);
        }
      }
      return;
    }

    const isImg = !!e.target?.closest?.(".p-img");
    const isBody = !!e.target?.closest?.(".p-body");
    if (isImg || isBody) {
      window.location.href = `product-details.html?id=${encodeURIComponent(id)}`;
    }
  });
}

/* ================= INIT ================= */
async function initProductsPage() {
  showEmpty(false);
  setMeta("Loading products…");

  const cachedMeta = loadProductsCacheMeta();
  const cached = loadProductsCache();
  const cacheFresh = cachedMeta.ts && (Date.now() - cachedMeta.ts) < PRODUCTS_TTL_MS;

  if (cached.length) {
    products = cached;
    populateCategories();
    bindFilters();
    renderProducts(products);
    showEmpty(false);
    setMeta(cacheFresh ? `${products.length} products available` : `Refreshing… (${products.length} cached)`);
  }

  try {
    const backendProducts = await fetchProductsFromBackend();
    if (backendProducts.length) {
      const oldSig = (products || []).map(p => `${p.id}:${p.image_url || p.image_key || ""}`).join("|");
      const newSig = backendProducts.map(p => `${p.id}:${p.image_url || p.image_key || ""}`).join("|");

      products = backendProducts;
      saveJSON(PRODUCTS_KEY, products);
      saveProductsCacheMeta();

      if (!cached.length) {
        populateCategories();
        bindFilters();
        renderProducts(products);
        showEmpty(false);
      } else if (oldSig !== newSig) {
        // keep current filter list if any
        renderProducts(currentList?.length ? currentList : products);
      }

      // refresh categories after backend (in case new ones)
      populateCategories();
      setMeta(`${products.length} product${products.length === 1 ? "" : "s"} available`);
    }
  } catch (e) {
    console.warn("Backend products failed:", e);
    if (!cached.length) {
      products = [];
      setMeta("");
      showEmpty(true);
      return;
    }
    setMeta(`${products.length} products (offline mode)`);
  }

  if (!products.length) {
    setMeta("");
    showEmpty(true);
    return;
  }

  document.addEventListener("cart:updated", () => updateCartCount());
  window.KStore?.subscribe?.((evt) => {
    if (evt?.type === "CART_CHANGED" || evt?.type === "INIT") updateCartCount();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindGridEvents();
  initProductsPage();
  document.getElementById("retryBtn")?.addEventListener("click", () => initProductsPage());
});