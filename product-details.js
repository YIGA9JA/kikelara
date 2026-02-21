/* ================= PRODUCT-DETAILS.JS (FAST LIKE PRODUCTS PAGE) =================
   ✅ Instant paint from session cache (fast LCP)
   ✅ Stale-while-revalidate product fetch
   ✅ Images:
      - URL => use immediately
      - key (products/... or cld:...) => resolve async + cached (session)
      - on error => re-fetch product once for fresh signed URLs
   ✅ Reviews do NOT block product render (idle/background)
   ✅ Concurrency limited media signing requests
   ✅ KStore cart supported
================================================================================= */

const API_BASE = (window.API_BASE || "https://kikelara1.onrender.com").replace(/\/+$/, "");
const CART_KEY = "cart";

/* ---- session caches ---- */
const PRODUCT_CACHE_PREFIX = "pd_product_v2_";      // sessionStorage only
const PRODUCT_TTL_MS = 1000 * 60 * 30;              // 30 mins (signed urls can expire)

const IMG_URL_CACHE_KEY = "kkl_img_url_cache_v1";   // shared with products page
const IMG_URL_TTL_MS = 1000 * 60 * 60 * 6;          // 6 hours (tune to your signed TTL)
const MAX_IMAGE_REQUESTS = 4;

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

/* ================= DOM helpers ================= */
function el(id) { return document.getElementById(id); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(msg) {
  const container = document.querySelector(".pd");
  const safe = escapeHtml(msg);
  if (!container) {
    document.body.innerHTML = `<h2 style="padding:50px">${safe}</h2>`;
    return;
  }
  container.innerHTML = `<h2 style="padding:30px">${safe}</h2>`;
}

/* ================= SAFE JSON ================= */
function safeJSON(storage, key, fallback) {
  try { const v = JSON.parse(storage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
}
function saveJSON(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ================= fast fetch with timeout ================= */
async function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/* ================= IMAGE HELPERS (same concept as products.js) ================= */
function isHttpUrl(u) { return /^https?:\/\//i.test(String(u || "")); }
function isBlobOrData(u) { return /^(blob:|data:)/i.test(String(u || "")); }

function looksLikeMediaKey(u) {
  const s = String(u || "").trim();
  if (!s) return false;
  if (isHttpUrl(s) || isBlobOrData(s)) return false;
  if (s.startsWith("/uploads/")) return false;
  if (s.startsWith("images/") || s.startsWith("images_brown/")) return false;
  if (s.startsWith("cld:")) return true;
  if (s.startsWith("products/")) return true;
  if (s.startsWith("featured/")) return true;
  if (s.startsWith("hero/")) return true;
  return false;
}

function resolveImageImmediate(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (isHttpUrl(u) || isBlobOrData(u)) return u;
  if (u.startsWith("/uploads/")) return API_BASE ? `${API_BASE}${u}` : u;
  if (u.startsWith("images/") || u.startsWith("images_brown/")) return u;
  if (looksLikeMediaKey(u)) return ""; // async resolve later
  return u;
}

/* ================= IMAGE URL CACHE (SESSION) ================= */
function loadImgCache() {
  const obj = safeJSON(sessionStorage, IMG_URL_CACHE_KEY, {});
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
  saveJSON(sessionStorage, IMG_URL_CACHE_KEY, cache);
}

/* ================= MEDIA KEY -> URL ================= */
function cloudinaryUrlFromKey(key) {
  const k = String(key || "");
  if (!k.startsWith("cld:")) return "";
  const cloud = String(window.CLOUDINARY_CLOUD_NAME || "").trim();
  if (!cloud) return "";
  const publicId = k.slice(4);
  if (!publicId) return "";
  return `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/f_auto,q_auto/${publicId}`;
}

async function resolveMediaKeyToUrl(key) {
  const k = String(key || "").trim();
  if (!k) return "";

  const cached = getImgCached(k);
  if (cached) return cached;

  const cld = cloudinaryUrlFromKey(k);
  if (cld) {
    setImgCached(k, cld);
    return cld;
  }

  if (!API_BASE) return "";
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/media/sign?key=${encodeURIComponent(k)}`, {}, 12000);
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

/* ================= CONCURRENCY LIMITED IMAGE RESOLVE ================= */
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

async function resolveImgEl(imgEl) {
  if (!imgEl) return;
  const key = imgEl.getAttribute("data-key") || "";
  if (!key) return;

  // quick cached swap
  const cached = getImgCached(key);
  if (cached) {
    imgEl.src = cached;
    imgEl.removeAttribute("data-key");
    return;
  }

  enqueueImg(async () => {
    const url = await resolveMediaKeyToUrl(key);
    if (url) {
      imgEl.src = url;
      imgEl.removeAttribute("data-key");
    }
  });
}

/* Resolve thumbs only when near viewport */
let imgObserver = null;
function ensureImgObserver() {
  if (imgObserver) return;
  if (!("IntersectionObserver" in window)) return;

  imgObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const img = e.target;
      imgObserver.unobserve(img);
      resolveImgEl(img);
    });
  }, { rootMargin: "260px 0px" });
}
function observeThumbs() {
  ensureImgObserver();
  if (!imgObserver) return;

  document.querySelectorAll("#productThumbs img[data-key]").forEach((img) => {
    imgObserver.observe(img);
  });
}

/* ================= PRODUCT NORMALIZE ================= */
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
  const rawPrimary =
    p?.detail_image_url ||
    p?.image_url ||
    p?.image ||
    (Array.isArray(p?.all_images) ? p.all_images[0] : "") ||
    (Array.isArray(p?.images) ? p.images[0] : "") ||
    "";

  const rawKey =
    p?.detail_image_key ||
    p?.image_key ||
    p?.payload?.__image_key ||
    "";

  const primaryImmediate = resolveImageImmediate(rawPrimary);
  const image_key = looksLikeMediaKey(rawPrimary) ? String(rawPrimary) : String(rawKey || "");

  const rawArr =
    Array.isArray(p?.all_images) ? p.all_images :
    Array.isArray(p?.images) ? p.images :
    normalizeImages(p?.images);

  const imagesRaw = normalizeImages(rawArr);
  const fallback = "images_brown/bodyButter.png";
  const finalImages = imagesRaw.length ? imagesRaw : [primaryImmediate || image_key || fallback];

  return {
    id: p?.id,
    name: String(p?.name || "").trim(),
    price: Number(p?.price || 0),
    category: String(p?.category || p?.payload?.category || "Product"),
    description: String(p?.description || p?.payload?.description || ""),

    // render-first url (may be "")
    image_url: primaryImmediate || "",
    // stable resolver key (may be "")
    image_key: image_key || "",
    // raw gallery list (urls or keys)
    images: finalImages
  };
}

/* ================= PRODUCT CACHE ================= */
function getCachedProduct(productId) {
  const key = PRODUCT_CACHE_PREFIX + String(productId);
  const cached = safeJSON(sessionStorage, key, null);
  const ts = Number(cached?.ts || 0);
  if (!ts) return null;
  if (Date.now() - ts > PRODUCT_TTL_MS) return cached?.product || null; // still paint stale
  return cached?.product || null;
}
function setCachedProduct(productId, product) {
  const key = PRODUCT_CACHE_PREFIX + String(productId);
  saveJSON(sessionStorage, key, { ts: Date.now(), product });
}

/* ================= PRODUCT FETCH ================= */
async function fetchProduct(productId) {
  const r = await fetchWithTimeout(`${API_BASE}/api/products/${encodeURIComponent(productId)}`, {}, 12000);
  const data = await r.json().catch(() => ({}));
  // support both {success:true, product} and {ok:true, product}
  const ok = Boolean(data?.success || data?.ok);
  if (!r.ok || !ok || !data?.product) throw new Error(data?.message || "Product not found");
  return normalizeProduct(data.product);
}

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("id");
  return raw ? String(raw).trim() : "";
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
  const c = safeJSON(localStorage, CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCartFallback(cart) {
  saveJSON(localStorage, CART_KEY, Array.isArray(cart) ? cart : []);
  document.dispatchEvent(new CustomEvent("cart:updated", { detail: { cart } }));
}
function isInCart(cart, id) { return cart.some(i => String(i.id) === String(id)); }

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

function updateHeaderCartCount() {
  const cartCount = el("cartCount");
  if (!cartCount) return;

  const ks = getStore();
  if (ks && typeof ks.cartQty === "function") {
    cartCount.textContent = String(ks.cartQty(ks.getCart()));
    return;
  }

  const cart = loadCart();
  cartCount.textContent = String(cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0));
}

function setCartButtonState(inCart) {
  const btn = el("cartBtn");
  const flag = el("productInCart");
  const viewCart = el("viewCartLink");
  if (!btn) return;

  if (inCart) {
    btn.textContent = "ADDED";
    btn.classList.add("is-added");
    if (flag) flag.style.display = "inline-flex";
    if (viewCart) viewCart.style.display = "inline-flex";
  } else {
    btn.textContent = "ADD TO CART";
    btn.classList.remove("is-added");
    if (flag) flag.style.display = "none";
    if (viewCart) viewCart.style.display = "none";
  }
}

/* ================= 5D tilt (desktop only) ================= */
const CAN_TILT = window.matchMedia?.("(hover:hover) and (pointer:fine)")?.matches;
function bindTilt(node) {
  if (!CAN_TILT || !node) return;

  node.addEventListener("pointermove", (e) => {
    const r = node.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;

    const ry = (x - 0.5) * 10;
    const rx = (0.5 - y) * 8;

    node.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    node.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    node.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    node.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    node.classList.add("tilting");
  });

  node.addEventListener("pointerleave", () => {
    node.classList.remove("tilting");
    node.style.setProperty("--ry", "0deg");
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--mx", "50%");
    node.style.setProperty("--my", "50%");
  });
}

/* ================= GALLERY (LAST 4) ================= */
function pickLastFour(list) {
  const arr = (Array.isArray(list) ? list : []).map(String).map(s => s.trim()).filter(Boolean);
  const fallback = "images_brown/bodyButter.png";
  if (!arr.length) return [fallback, fallback, fallback, fallback];
  const last = arr.length >= 4 ? arr.slice(-4) : arr.slice(0);
  while (last.length < 4) last.push(last[last.length - 1] || arr[0] || fallback);
  return last;
}

function toGalleryItem(raw) {
  const s = String(raw || "").trim();
  if (!s) return { src: "images_brown/bodyButter.png", key: "" };

  const immediate = resolveImageImmediate(s);
  if (immediate) return { src: immediate, key: "" };

  // key path
  if (looksLikeMediaKey(s)) {
    const cached = getImgCached(s);
    if (cached) return { src: cached, key: "" };
    return { src: "images_brown/bodyButter.png", key: s };
  }

  return { src: "images_brown/bodyButter.png", key: "" };
}

function renderGallery(items, activeIndex = 0) {
  const mainImg = el("productImage");
  const thumbsWrap = el("productThumbs");
  if (!mainImg || !Array.isArray(items) || !items.length) return;

  const main = items[activeIndex] || items[0];
  mainImg.src = main.src || "images_brown/bodyButter.png";
  mainImg.alt = "Product image";
  mainImg.loading = "eager";
  mainImg.decoding = "async";

  if (main.key) mainImg.setAttribute("data-key", main.key);
  else mainImg.removeAttribute("data-key");

  // main resolve ASAP (no observer)
  resolveImgEl(mainImg);

  // main error => attempt refresh once
  mainImg.onerror = () => handleImgError(mainImg);

  if (!thumbsWrap) return;
  thumbsWrap.innerHTML = "";

  items.forEach((it, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pd-thumb" + (idx === activeIndex ? " active" : "");

    const kAttr = it.key ? ` data-key="${escapeHtml(it.key)}"` : "";
    b.innerHTML = `<img src="${escapeHtml(it.src)}"${kAttr} alt="thumbnail ${idx + 1}" draggable="false" loading="lazy" decoding="async">`;

    b.addEventListener("click", () => renderGallery(items, idx));
    thumbsWrap.appendChild(b);
  });

  // thumbs resolve near viewport
  observeThumbs();

  // attach error handler to thumbs too
  thumbsWrap.querySelectorAll("img").forEach(img => {
    img.addEventListener("error", () => handleImgError(img));
  });
}

/* ================= IMAGE ERROR RECOVERY (REFRESH PRODUCT ONCE) ================= */
let productRefreshedForImages = false;

async function handleImgError(imgEl) {
  if (!imgEl) return;

  // stop infinite loop
  if (imgEl.getAttribute("data-retried") === "1") return;
  imgEl.setAttribute("data-retried", "1");

  // if it has a key, retry resolving key first
  const key = imgEl.getAttribute("data-key") || "";
  if (key) {
    const url = await resolveMediaKeyToUrl(key);
    if (url) {
      imgEl.src = url;
      imgEl.removeAttribute("data-key");
      return;
    }
  }

  // else: re-fetch product once for fresh signed URLs and repaint gallery
  if (productRefreshedForImages) {
    imgEl.src = "images_brown/bodyButter.png";
    return;
  }
  productRefreshedForImages = true;

  try {
    const productId = getProductId();
    if (!productId) throw new Error("no id");
    const fresh = await fetchProduct(productId);
    setCachedProduct(productId, fresh);
    paintProduct(fresh, { skipTilt: true }); // repaint quickly
  } catch {
    imgEl.src = "images_brown/bodyButter.png";
  }
}

/* ================= PRODUCT PAINT (FAST) ================= */
function paintProduct(product, opts = {}) {
  if (!product) return;

  el("productName") && (el("productName").textContent = product.name || "");
  el("productPrice") && (el("productPrice").textContent = `₦${Number(product.price || 0).toLocaleString()}`);
  el("productDescription") && (el("productDescription").textContent = product.description || "");
  el("productCategory") && (el("productCategory").textContent = String(product.category || "Product").toUpperCase());

  // build gallery from LAST 4 raw items (urls or keys)
  const raw = pickLastFour(product.images?.length ? product.images : [product.image_url || product.image_key]);
  const items = raw.map(toGalleryItem);

  renderGallery(items, 0);

  // tilt deferred (never block paint)
  if (!opts.skipTilt) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => bindTilt(el("tiltMain")), { timeout: 1200 });
    } else {
      setTimeout(() => bindTilt(el("tiltMain")), 250);
    }
  }

  // cart state
  const cart = loadCart();
  setCartButtonState(isInCart(cart, product.id));
  updateHeaderCartCount();

  const btn = el("cartBtn");
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      addToCartOnce(product);
      setCartButtonState(true);
      updateHeaderCartCount();
      window.KStore?.syncBadges?.();
    });
  }

  try { document.title = `${product.name} — KÍKÉLÁRÁ`; } catch {}
}

/* ================= REVIEWS (UNCHANGED LOGIC, BUT DEFERRED) ================= */
/* NOTE: This section keeps your review code behavior, just scheduled to not block product paint. */

const DEVICE_ID_KEY = "reviewDeviceId_v2";
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getCookie(name) {
  const v = `; ${document.cookie}`;
  const parts = v.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return "";
}
function csrfToken() { return getCookie("admin_csrf") || ""; }

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const method = (opts.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const c = csrfToken();
    if (c) headers["X-CSRF-Token"] = c;
  }
  return fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: "include" });
}

let isAdmin = false;
async function detectAdminSession() {
  try {
    const r = await api("/admin/me", { method: "GET" });
    const data = await r.json().catch(() => ({}));
    isAdmin = Boolean(r.ok && data?.success);
  } catch {
    isAdmin = false;
  }
}

let rvAll = [];
let rvFilteredStar = 0;
let rvSortMode = "recent";
let rvShown = 5;
const RV_PAGE_SIZE = 5;

function helpfulScore(r) {
  const up = Number(r?.votes?.up) || 0;
  const down = Number(r?.votes?.down) || 0;
  return up - down;
}
function calcAverage(list) {
  if (!list.length) return 0;
  return list.reduce((a, r) => a + (Number(r.rating) || 0), 0) / list.length;
}
function breakdownCounts(list) {
  const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  list.forEach(r => { counts[clamp(Number(r.rating)||1,1,5)] += 1; });
  return counts;
}
function starsText(rating) {
  const r = clamp(Number(rating) || 0, 0, 5);
  return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
}
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

function setStarUI(value) {
  const stars = document.querySelectorAll("#starInput .star");
  stars.forEach(btn => {
    const v = Number(btn.dataset.value);
    btn.classList.toggle("is-on", v <= value);
  });
  const hint = el("rvHint");
  if (hint) hint.textContent = value ? `${value} star${value === 1 ? "" : "s"}` : "Select a rating";
}

function renderSummary(list) {
  const avgEl = el("rvAvg");
  const avgStarsEl = el("rvAvgStars");
  const countEl = el("rvCount");
  const breakdownEl = el("rvBreakdown");

  const total = list.length;
  const avg = total ? calcAverage(list) : 0;
  const avg1 = Math.round(avg * 10) / 10;

  if (avgEl) avgEl.textContent = avg1.toFixed(1);
  if (avgStarsEl) avgStarsEl.textContent = starsText(Math.round(avg));
  if (countEl) countEl.textContent = `${total} rating${total === 1 ? "" : "s"}`;

  if (!breakdownEl) return;
  breakdownEl.innerHTML = "";

  const counts = breakdownCounts(list);
  for (let star = 5; star >= 1; star--) {
    const c = counts[star];
    const pct = total ? Math.round((c / total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "rv-bar-row";
    row.innerHTML = `
      <div class="rv-bar-label">${star}★</div>
      <div class="rv-bar-track"><div class="rv-bar-fill" style="width:${pct}%"></div></div>
      <div class="rv-bar-count">${c}</div>
    `;
    breakdownEl.appendChild(row);
  }
}

function getDisplayList() {
  let list = [...rvAll];

  if (rvFilteredStar) list = list.filter(r => Number(r.rating) === Number(rvFilteredStar));

  if (rvSortMode === "recent") list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  else if (rvSortMode === "high") list.sort((a,b) => (b.rating - a.rating) || (new Date(b.created_at) - new Date(a.created_at)));
  else if (rvSortMode === "low") list.sort((a,b) => (a.rating - b.rating) || (new Date(b.created_at) - new Date(a.created_at)));
  else if (rvSortMode === "helpful") list.sort((a,b) => (helpfulScore(b) - helpfulScore(a)) || (new Date(b.created_at) - new Date(a.created_at)));

  return list;
}

async function loadReviews(productId) {
  const r = await fetchWithTimeout(`${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews`, {}, 12000);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) return [];
  return Array.isArray(data.reviews) ? data.reviews : [];
}

async function submitReview(productId, payload) {
  const deviceId = getDeviceId();
  const r = await fetchWithTimeout(`${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, deviceId }),
  }, 12000);

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) throw new Error(data?.message || "Failed to submit review");
  return data.review;
}

async function voteReview(reviewId, voteType) {
  const deviceId = getDeviceId();
  voteType = (voteType === "up" || voteType === "down") ? voteType : "up";

  const r = await fetchWithTimeout(`${API_BASE}/api/reviews/${encodeURIComponent(reviewId)}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voteType, deviceId }),
  }, 12000);

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok || !data?.votes) throw new Error(data?.message || "Vote failed");
  return data.votes;
}

async function adminDeleteReview(reviewId) {
  const r = await api(`/admin/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.success) {
    if (r.status === 401) throw new Error("Unauthorized. Please login as admin.");
    if (r.status === 403) throw new Error("Blocked (CSRF). Please refresh + login again.");
    throw new Error(data?.message || "Delete failed");
  }
  return true;
}

function renderListUI(productId) {
  const wrap = el("reviewsList");
  const moreBtn = el("rvMoreBtn");
  if (!wrap) return;

  const list = getDisplayList();
  const visible = list.slice(0, rvShown);

  if (!visible.length) {
    wrap.innerHTML = `<div class="rv-empty">No reviews for this filter yet.</div>`;
    if (moreBtn) moreBtn.hidden = true;
    return;
  }

  wrap.innerHTML = "";
  visible.forEach(r => {
    const up = Number(r?.votes?.up) || 0;
    const down = Number(r?.votes?.down) || 0;

    const item = document.createElement("div");
    item.className = "rv-item";
    item.dataset.id = r.id;

    item.innerHTML = `
      <div class="rv-item-top">
        <div class="rv-item-left">
          <div class="rv-item-stars">${starsText(r.rating)}</div>
          ${r.title ? `<div class="rv-item-title">${escapeHtml(r.title)}</div>` : ``}
        </div>

        <div class="rv-item-meta">
          <span class="rv-item-name">${escapeHtml(r.name || "Anonymous")}</span>
          ${r.verified ? `<span class="rv-badge">Verified purchase</span>` : ``}
          <span class="rv-item-date">${escapeHtml(formatDate(r.created_at))}</span>
        </div>
      </div>

      <div class="rv-item-text">${escapeHtml(r.text || "")}</div>

      <div class="rv-item-actions">
        <button type="button" class="rv-vote" data-vote="up">Helpful <span class="rv-vnum">(${up})</span></button>
        <button type="button" class="rv-vote" data-vote="down">Not helpful <span class="rv-vnum">(${down})</span></button>
        ${isAdmin ? `<button type="button" class="rv-del-btn" data-del="${r.id}">Delete</button>` : ``}
      </div>
    `;

    item.querySelectorAll(".rv-vote").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          const votes = await voteReview(r.id, btn.dataset.vote);
          rvAll = rvAll.map(x => {
            if (String(x.id) !== String(r.id)) return x;
            return { ...x, votes: { up: Number(votes.up || 0), down: Number(votes.down || 0) } };
          });
          renderSummary(rvAll);
          renderListUI(productId);
        } catch (e) {
          alert(String(e.message || e));
        }
      });
    });

    const delBtn = item.querySelector(".rv-del-btn");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (!confirm("Delete this review permanently?")) return;
        try {
          await adminDeleteReview(delBtn.dataset.del);
          rvAll = rvAll.filter(x => String(x.id) !== String(delBtn.dataset.del));
          renderSummary(rvAll);
          rvShown = Math.min(rvShown, rvAll.length || RV_PAGE_SIZE);
          renderListUI(productId);
        } catch (e) {
          alert(String(e.message || e));
        }
      });
    }

    wrap.appendChild(item);
  });

  if (moreBtn) moreBtn.hidden = rvShown >= list.length;
}

async function initReviews(productId) {
  // Do admin detection + reviews fetch in parallel (faster than sequential)
  const [_, reviews] = await Promise.all([
    detectAdminSession().catch(() => {}),
    loadReviews(productId).catch(() => [])
  ]);

  rvAll = Array.isArray(reviews) ? reviews : [];
  renderSummary(rvAll);

  rvShown = RV_PAGE_SIZE;
  renderListUI(productId);

  const toggle = el("rvToggleForm");
  const formWrap = el("rvFormWrap");
  if (toggle && formWrap) {
    toggle.addEventListener("click", () => {
      formWrap.hidden = !formWrap.hidden;
      toggle.textContent = formWrap.hidden ? "Write a review" : "Close";
    });
  }

  const starsWrap = el("starInput");
  const ratingInput = el("reviewRating");
  if (starsWrap && ratingInput) {
    starsWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".star");
      if (!btn) return;
      const val = clamp(Number(btn.dataset.value) || 0, 0, 5);
      ratingInput.value = String(val);
      setStarUI(val);
    });
  }

  const filters = el("rvStarFilters");
  if (filters) {
    filters.addEventListener("click", (e) => {
      const b = e.target.closest(".rv-filter");
      if (!b) return;
      rvFilteredStar = Number(b.dataset.star) || 0;

      filters.querySelectorAll(".rv-filter").forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active");

      rvShown = RV_PAGE_SIZE;
      renderListUI(productId);
    });
  }

  const sort = el("rvSort");
  if (sort) {
    sort.addEventListener("change", () => {
      rvSortMode = sort.value || "recent";
      rvShown = RV_PAGE_SIZE;
      renderListUI(productId);
    });
  }

  const moreBtn = el("rvMoreBtn");
  if (moreBtn) {
    moreBtn.addEventListener("click", () => {
      rvShown += RV_PAGE_SIZE;
      renderListUI(productId);
    });
  }

  const form = el("reviewForm");
  const nameEl = el("reviewName");
  const titleEl = el("reviewTitle");
  const textEl = el("reviewText");
  const err = el("reviewError");

  if (form && ratingInput && textEl) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const rating = clamp(Number(ratingInput.value) || 0, 0, 5);
      const name = (nameEl?.value || "").trim();
      const title = (titleEl?.value || "").trim();
      const text = (textEl.value || "").trim();

      if (err) err.textContent = "";

      if (rating < 1) return (err ? (err.textContent = "Please select a star rating.") : alert("Select rating"));
      if (title.length < 3) return (err ? (err.textContent = "Please add a short review title (min 3 characters).") : alert("Title too short"));
      if (text.length < 10) return (err ? (err.textContent = "Please write a fuller review (min 10 characters).") : alert("Text too short"));

      try {
        const newReview = await submitReview(productId, {
          name: name || "Anonymous",
          title: title.slice(0, 60),
          text: text.slice(0, 500),
          rating
        });

        rvAll.unshift(newReview);
        rvAll = rvAll.slice(0, 200);

        renderSummary(rvAll);
        rvShown = RV_PAGE_SIZE;
        renderListUI(productId);

        ratingInput.value = "0";
        setStarUI(0);
        if (nameEl) nameEl.value = "";
        if (titleEl) titleEl.value = "";
        textEl.value = "";
      } catch (e2) {
        if (err) err.textContent = String(e2.message || e2);
        else alert(String(e2.message || e2));
      }
    });
  }
}

/* ================= INIT (STALE-WHILE-REVALIDATE) ================= */
async function init() {
  const productId = getProductId();
  if (!productId) return showMessage("Invalid product link.");

  // 1) instant paint from session cache
  const cached = getCachedProduct(productId);
  if (cached) paintProduct(cached);

  // 2) revalidate product in background
  const productPromise = fetchProduct(productId)
    .then((p) => {
      setCachedProduct(productId, p);
      paintProduct(p);
      return p;
    })
    .catch(() => null);

  // 3) reviews in idle/background (never block product)
  const startReviews = () => initReviews(productId).catch(() => {});
  if ("requestIdleCallback" in window) requestIdleCallback(startReviews, { timeout: 2000 });
  else setTimeout(startReviews, 250);

  const fresh = await productPromise;
  if (!fresh && !cached) return showMessage("Product not found.");

  // header cart sync
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    updateHeaderCartCount();
    if (tries >= 12) clearInterval(t);
  }, 150);

  document.addEventListener("cart:updated", () => updateHeaderCartCount());
  window.KStore?.subscribe?.((evt) => {
    if (evt?.type === "CART_CHANGED" || evt?.type === "INIT") updateHeaderCartCount();
  });
}

document.addEventListener("DOMContentLoaded", init);