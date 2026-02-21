/* ================= INDEX.JS (FAST LOAD + PREMIUM LAYOUT + MEDIA KEY SUPPORT)
   ✅ Hero slider pulls from /api/hero
   ✅ Featured pulls from /api/featured
   ✅ Supports images stored as:
      - full URL
      - /uploads/...
      - Cloudinary key: cld:public_id
      - Supabase key: products/... featured/... hero/...
   ✅ Uses /api/media/sign?key=... for non-cloudinary keys
============================================================================ */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";

/* ================= MEDIA KEY RESOLVER (shared style like products.js) ================= */
const IMG_URL_CACHE_KEY = "kkl_img_url_cache_v1";
const IMG_URL_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const MAX_IMAGE_REQUESTS = 6;

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
  if (u.startsWith("/uploads/") && API_BASE) return `${API_BASE}${u}`;
  if (u.startsWith("uploads/") && API_BASE) return `${API_BASE}/${u}`;
  if (u.startsWith("images/") || u.startsWith("images_brown/")) return u;
  if (looksLikeMediaKey(u)) return ""; // resolve async
  return u;
}

// ✅ FIXED Cloudinary URL builder (doesn't break public_id with "/")
function cloudinaryUrlFromKey(key) {
  const k = String(key || "").trim();
  if (!k.startsWith("cld:")) return "";
  const cloud = String(window.CLOUDINARY_CLOUD_NAME || "").trim();
  if (!cloud) return "";
  const publicId = k.slice(4).trim();
  if (!publicId) return "";
  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/f_auto,q_auto/${encodedPublicId}`;
}

async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
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

async function resolveAnyImage(raw) {
  const r = String(raw || "").trim();
  if (!r) return "";
  const immediate = resolveImageImmediate(r);
  if (immediate) return immediate;
  if (looksLikeMediaKey(r)) return await resolveMediaKeyToUrl(r);
  return r;
}

// concurrency for resolving card images
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

let imgObserver = null;
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

      const cached = getImgCached(key);
      if (cached) {
        img.src = cached;
        img.removeAttribute("data-key");
        return;
      }

      enqueueImg(async () => {
        const url = await resolveMediaKeyToUrl(key);
        if (url) {
          img.src = url;
          img.removeAttribute("data-key");
        }
      });
    });
  }, { rootMargin: "320px 0px" });
}

function observeKeyImages(container) {
  ensureImgObserver();
  if (!imgObserver) return;
  (container || document).querySelectorAll("img[data-key]").forEach((img) => imgObserver.observe(img));
}

/* ================= PRELOADER CONTROL (same as yours) ================= */
const preloader = document.getElementById("preloader");
const PRELOADER_MIN_MS = 450;
const PRELOADER_MAX_MS = 12000;
const PRELOADER_KEY = "kkl_home_preloader_seen_v1";
const navType = performance.getEntriesByType("navigation")?.[0]?.type || "navigate";
const SHOW_PRELOADER = sessionStorage.getItem(PRELOADER_KEY) !== "1" && navType !== "back_forward";

if (SHOW_PRELOADER) sessionStorage.setItem(PRELOADER_KEY, "1");
else { if (preloader) preloader.remove(); }

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function preloaderAlive(){ return !!(preloader && preloader.isConnected); }
function lockScroll(lock){
  if (!preloaderAlive()) return;
  if (lock){
    document.body.dataset._prevOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = document.body.dataset._prevOverflow || "";
    delete document.body.dataset._prevOverflow;
  }
}
function hidePreloader(){
  if (!preloaderAlive()) return;
  preloader.style.opacity = "0";
  setTimeout(() => preloader.remove(), 550);
  lockScroll(false);
}
window.addEventListener("pageshow", (e) => {
  if (e.persisted && preloaderAlive()) {
    preloader.remove();
    lockScroll(false);
  }
});

/* ================= NETWORK HINTS ================= */
function ensurePreconnect(apiBase){
  if (!apiBase) return;
  try{
    const u = new URL(apiBase);
    const origin = u.origin;
    const head = document.head || document.documentElement;

    const dns = document.createElement("link");
    dns.rel = "dns-prefetch";
    dns.href = origin;
    head.appendChild(dns);

    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = origin;
    pre.crossOrigin = "anonymous";
    head.appendChild(pre);
  } catch {}
}
function setFetchPriority(img, priority){
  try {
    if (!img) return;
    img.fetchPriority = priority;
    img.setAttribute("fetchpriority", priority);
  } catch {}
}
function waitForImgEl(img){
  return new Promise((resolve) => {
    if (!img) return resolve();
    if (img.complete && img.naturalWidth > 0) return resolve();
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}
function preloadUrl(src){
  return new Promise((resolve) => {
    if (!src) return resolve();
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}
async function preloadUrls(urls){
  const uniq = Array.from(new Set((urls || []).filter(Boolean)));
  await Promise.all(uniq.map(preloadUrl));
}

/* ================= HELPERS ================= */
function productUrl(id) {
  if (id === undefined || id === null || id === "") return "products.html";
  return `product-details.html?id=${encodeURIComponent(id)}`;
}
function safeGetSessionJSON(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    const val = JSON.parse(raw);
    return val ?? fallback;
  } catch {
    return fallback;
  }
}
function safeSetSessionJSON(key, val) {
  try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function now(){ return Date.now(); }

const HERO_CACHE_KEY = "kkl_cache_hero_v1";
const FEATURED_CACHE_KEY = "kkl_cache_featured_v1";
const API_CACHE_TTL_MS = 1000 * 60 * 5;

function getApiCache(key){
  const cached = safeGetSessionJSON(key, null);
  if (!cached || typeof cached !== "object") return null;
  if (!cached.ts || (now() - cached.ts) > API_CACHE_TTL_MS) return null;
  return cached.data ?? null;
}
function setApiCache(key, data){
  safeSetSessionJSON(key, { ts: now(), data });
}
function formatNaira(n) {
  const num = Number(n || 0);
  try { return `₦${num.toLocaleString()}`; } catch { return `₦${num}`; }
}

/* ================= FETCH PRODUCTS ================= */
function normalizeProduct(row) {
  const createdAtRaw = row?.created_at || row?.createdAt || null;
  const created_at = createdAtRaw ? new Date(createdAtRaw).getTime() : null;

  const rawImg = String(row?.image_url || row?.image || row?.img || "").trim();
  const immediate = resolveImageImmediate(rawImg);
  const key = looksLikeMediaKey(rawImg) ? rawImg : String(row?.image_key || "").trim();

  return {
    id: row?.id,
    name: String(row?.name || "").trim(),
    price: Number(row?.price || 0),
    image_url: immediate || "",      // immediate url if possible
    image_key: key || "",            // if needs resolving
    is_active: row?.is_active !== undefined ? Boolean(row.is_active) : true,
    created_at,
  };
}

async function fetchProducts() {
  if (!API_BASE) return [];
  try {
    const res = await fetch(`${API_BASE}/api/products`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    if (!Array.isArray(data)) return [];
    return data.map(normalizeProduct).filter((p) => p.id && p.name);
  } catch {
    return [];
  }
}

/* ================= FETCH FEATURED (RESOLVES KEYS) ================= */
function normalizeFeaturedItem(it) {
  return {
    id: it?.id,
    title: String(it?.title || "").trim(),
    link_url: String(it?.link_url || "").trim(),
    sort_order: Number(it?.sort_order || 0),
    image_raw: String(it?.image_url || "").trim(),
    image_url: "", // resolved later
  };
}

async function fetchFeaturedItems() {
  if (!API_BASE) return [];
  const cached = getApiCache(FEATURED_CACHE_KEY);
  if (Array.isArray(cached) && cached.length) {
    fetchFeaturedItemsFresh().catch(() => {});
    return cached;
  }
  return fetchFeaturedItemsFresh();
}

async function fetchFeaturedItemsFresh() {
  try {
    const res = await fetch(`${API_BASE}/api/featured`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);

    const items = Array.isArray(data?.items) ? data.items : [];
    const raw = items.map(normalizeFeaturedItem).filter((x) => x.image_raw);

    // ✅ resolve keys now (featured is above fold)
    const out = [];
    for (const it of raw) {
      const url = await resolveAnyImage(it.image_raw);
      if (url) out.push({ ...it, image_url: url });
    }

    setApiCache(FEATURED_CACHE_KEY, out);
    return out;
  } catch {
    return [];
  }
}

/* ================= FETCH HERO (RESOLVES KEYS) ================= */
function normalizeHeroItem(it) {
  return {
    id: it?.id,
    title: String(it?.title || "").trim(),
    description: String(it?.description || "").trim(),
    link_url: String(it?.link_url || "").trim(),
    sort_order: Number(it?.sort_order || 0),
    image_raw: String(it?.image_url || "").trim(),
    image_url: "", // resolved later
  };
}

async function fetchHeroItems() {
  if (!API_BASE) return [];
  const cached = getApiCache(HERO_CACHE_KEY);
  if (Array.isArray(cached) && cached.length) {
    fetchHeroItemsFresh().catch(() => {});
    return cached;
  }
  return fetchHeroItemsFresh();
}

async function fetchHeroItemsFresh() {
  try {
    const res = await fetch(`${API_BASE}/api/hero`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);

    const items = Array.isArray(data?.items) ? data.items : [];
    const raw = items.map(normalizeHeroItem).filter((x) => x.image_raw);

    // ✅ resolve keys now (hero is above fold)
    const out = [];
    for (const it of raw) {
      const url = await resolveAnyImage(it.image_raw);
      if (url) out.push({ ...it, image_url: url });
    }

    setApiCache(HERO_CACHE_KEY, out);
    return out;
  } catch {
    return [];
  }
}

/* ================= SORT HELPERS ================= */
function sortLatestDesc(a, b) {
  const ta = a.created_at ?? -1;
  const tb = b.created_at ?? -1;
  if (tb !== ta) return tb - ta;

  const ia = Number(a.id), ib = Number(b.id);
  if (Number.isFinite(ia) && Number.isFinite(ib)) return ib - ia;
  return 0;
}

/* ================= RENDER CARDS ================= */
function makeCard(p) {
  const card = document.createElement("a");
  card.className = "p-card";
  card.href = productUrl(p.id);
  card.style.textDecoration = "none";

  const media = document.createElement("div");
  media.className = "p-media";

  const img = document.createElement("img");
  img.alt = p.name;
  img.decoding = "async";
  img.loading = "lazy";
  setFetchPriority(img, "low");

  // ✅ object-fit cover guaranteed
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.display = "block";

  const immediate = p.image_url || "";
  if (immediate) {
    img.src = immediate;
  } else if (p.image_key && looksLikeMediaKey(p.image_key)) {
    img.src = "images_brown/bodyButter.png";
    img.setAttribute("data-key", p.image_key);
  } else {
    img.src = "images_brown/bodyButter.png";
  }

  img.addEventListener("error", () => { img.src = "images_brown/bodyButter.png"; });

  media.appendChild(img);

  const body = document.createElement("div");
  body.className = "p-body";

  const title = document.createElement("div");
  title.className = "p-title";
  title.textContent = p.name;

  const price = document.createElement("div");
  price.className = "p-price";
  price.textContent = formatNaira(p.price);

  body.appendChild(title);
  body.appendChild(price);

  card.appendChild(media);
  card.appendChild(body);

  return card;
}

function renderList(container, items) {
  if (!container) return;
  container.innerHTML = "";

  items.forEach((p, idx) => {
    const card = makeCard(p);
    card.style.setProperty("--d", `${Math.min(idx, 8) * 70}ms`);
    container.appendChild(card);
  });

  // ✅ resolve key images near viewport
  observeKeyImages(container);
}

/* ================= HERO SLIDER ================= */
const HERO_SWITCH_MS = 12000;
let heroIndex = 0;
let heroPool = [];
let heroTimer = null;

const heroBg = document.getElementById("heroBgImage");
const heroCard = document.getElementById("heroSlideCard");
const heroSlideTitle = document.getElementById("heroSlideTitle");
const heroSlideDesc = document.getElementById("heroSlideDesc");

function setHeroNow(item){
  if (!heroBg || !item) return;

  const src = String(item.image_url || "");
  const title = item.title || "";
  const desc = item.description || "";
  const link = item.link_url || "products.html";

  heroBg.decoding = "async";
  heroBg.loading = "eager";
  setFetchPriority(heroBg, "high");

  heroBg.style.opacity = "0";
  preloadUrl(src).then(() => {
    heroBg.src = src;
    heroBg.style.transform = "scale(1.02)";
    requestAnimationFrame(() => {
      heroBg.style.opacity = "0.90";
      heroBg.style.transform = "scale(1.0)";
    });
  });

  if (heroCard){
    heroCard.href = link;
    heroCard.style.display = (title || desc) ? "block" : "none";
  }
  if (heroSlideTitle) heroSlideTitle.textContent = title;
  if (heroSlideDesc) heroSlideDesc.textContent = desc;
}
function switchHero(){
  if (!heroPool.length) return;
  heroIndex = (heroIndex + 1) % heroPool.length;
  setHeroNow(heroPool[heroIndex]);
}
function startHeroLoop(){
  stopHeroLoop();
  if (heroPool.length > 1) {
    heroTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      switchHero();
    }, HERO_SWITCH_MS);
  }
}
function stopHeroLoop(){
  if (heroTimer) clearInterval(heroTimer);
  heroTimer = null;
}

/* ================= FEATURED (FULL IMAGE) ================= */
const FEATURED_SWITCH_MS = 14000;
let featuredIndex = 0;
let featuredPool = [];
let featuredTimer = null;

const featuredImg = document.getElementById("featuredImage");
const featuredTitleEl = document.getElementById("featuredTitle");
const featuredLinkEl = document.getElementById("featuredLink");

function setFeaturedLink(url) {
  const u = String(url || "").trim();
  const href = u || "products.html";
  if (featuredLinkEl) featuredLinkEl.href = href;
}
function setFeaturedNow(item){
  if (!featuredImg || !item) return;

  const src = String(item.image_url || "");
  const title = item.title || "Featured";
  const link = item.link_url || "products.html";

  featuredImg.decoding = "async";
  featuredImg.loading = "eager";
  setFetchPriority(featuredImg, "high");

  featuredImg.style.opacity = "0";
  preloadUrl(src).then(() => {
    featuredImg.src = src;
    featuredImg.alt = title;
    if (featuredTitleEl) featuredTitleEl.textContent = title;
    setFeaturedLink(link);
    requestAnimationFrame(() => (featuredImg.style.opacity = "1"));
  });
}
function switchFeatured() {
  if (!featuredPool.length) return;
  featuredIndex = (featuredIndex + 1) % featuredPool.length;
  setFeaturedNow(featuredPool[featuredIndex]);
}
function startFeaturedLoop(){
  stopFeaturedLoop();
  if (featuredPool.length > 1) {
    featuredTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      switchFeatured();
    }, FEATURED_SWITCH_MS);
  }
}
function stopFeaturedLoop(){
  if (featuredTimer) clearInterval(featuredTimer);
  featuredTimer = null;
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  const start = performance.now();
  ensurePreconnect(API_BASE);

  lockScroll(true);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const latestGrid = document.getElementById("latestProducts");
  const lovedGrid = document.getElementById("homeProducts");

  const [heroItems, featuredItems, products] = await Promise.all([
    fetchHeroItems(),
    fetchFeaturedItems(),
    fetchProducts(),
  ]);

  safeSetSessionJSON(PRODUCTS_KEY, products);

  const sortedLatest = [...products].sort(sortLatestDesc);
  const latest = sortedLatest.slice(0, 4);
  const loved = sortedLatest.slice(0, 4);

  if (heroItems.length) {
    heroPool = heroItems
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, 2);

    heroIndex = 0;
    setHeroNow(heroPool[0]);
    startHeroLoop();
  } else {
    if (heroCard) heroCard.style.display = "none";
  }

  if (featuredItems.length) {
    featuredPool = featuredItems
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, 10)
      .map((x) => ({ image_url: x.image_url, title: x.title, link_url: x.link_url }));
  } else {
    featuredPool = [];
  }

  // ✅ preload only first hero + first featured (already resolved URLs)
  const criticalUrls = [
    heroPool[0]?.image_url || "",
    featuredPool[0]?.image_url || "",
  ];
  await Promise.race([preloadUrls(criticalUrls), sleep(PRELOADER_MAX_MS)]);

  renderList(latestGrid, latest);
  renderList(lovedGrid, loved);

  if (featuredPool.length) {
    featuredIndex = 0;
    setFeaturedNow(featuredPool[0]);
    startFeaturedLoop();
  }

  await Promise.race([
    (async () => {
      try { await document.fonts?.ready; } catch {}
      await Promise.all([waitForImgEl(heroBg), waitForImgEl(featuredImg)]);
    })(),
    sleep(PRELOADER_MAX_MS)
  ]);

  const elapsed = performance.now() - start;
  if (elapsed < PRELOADER_MIN_MS) await sleep(PRELOADER_MIN_MS - elapsed);

  hidePreloader();
});