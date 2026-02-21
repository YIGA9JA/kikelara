/* ================= INDEX.JS (PRODUCTION + PREMIUM LAYOUT) =================
   ✅ Hero slider pulls from /api/hero (Admin Hero) + switches SLOWER
   ✅ Featured is AFTER hero (single big image, no thumbs, no buttons)
   ✅ Latest Drops (newest 4)
   ✅ Most Loved (top 4 by rating summary) -> 4-grid
   ✅ Most Loved shows rating badge ON IMAGE
   ✅ Preloader shows ONLY on first homepage load per session (not on back)
   ✅ Animate ALL sections/cards via scroll reveal
============================================================================ */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";

const RATINGS_CACHE_KEY = "ratingsSummary_v1";
const RATINGS_TTL_MS = 1000 * 60 * 60 * 6;
const RATINGS_CONCURRENCY = 6;

/* ✅ Slower timing */
const HERO_SWITCH_MS = 12000;      // slower than before
const FEATURED_SWITCH_MS = 14000;  // slower featured rotation

/* ================= PRELOADER CONTROL ================= */
const preloader = document.getElementById("preloader");
const PRELOADER_MIN_MS = 450;
const PRELOADER_MAX_MS = 12000;

/** ✅ show preloader only on first-ever homepage load (per tab/session) */
const PRELOADER_KEY = "kkl_home_preloader_seen_v1";
const navType = performance.getEntriesByType("navigation")?.[0]?.type || "navigate";
const SHOW_PRELOADER =
  sessionStorage.getItem(PRELOADER_KEY) !== "1" &&
  navType !== "back_forward";

if (SHOW_PRELOADER) {
  sessionStorage.setItem(PRELOADER_KEY, "1");
} else {
  if (preloader) preloader.remove();
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function preloaderAlive(){
  return !!(preloader && preloader.isConnected);
}

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

/** ✅ If page is restored from bfcache, ensure no preloader shows */
window.addEventListener("pageshow", (e) => {
  if (e.persisted && preloaderAlive()) {
    preloader.remove();
    lockScroll(false);
  }
});

/* ================= IMAGE WAITERS ================= */
function waitForImgEl(img){
  return new Promise((resolve) => {
    if (!img) return resolve();
    if (img.complete && img.naturalWidth > 0) return resolve();
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}
async function waitForAllImgsInDom(){
  const imgs = Array.from(document.querySelectorAll("img"))
    .filter(i => i && i.getAttribute("src"));
  await Promise.all(imgs.map(waitForImgEl));
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

function formatNaira(n) {
  const num = Number(n || 0);
  try { return `₦${num.toLocaleString()}`; } catch { return `₦${num}`; }
}

function resolveImageUrl(img) {
  const val = String(img || "").trim();
  if (!val) return "images/about-hero.jpg";
  if (/^https?:\/\//i.test(val)) return val;
  if (val.startsWith("/uploads/") && API_BASE) return `${API_BASE}${val}`;
  if (val.startsWith("uploads/") && API_BASE) return `${API_BASE}/${val}`;
  return val;
}

function normalizeProduct(row) {
  const createdAtRaw = row?.created_at || row?.createdAt || null;
  const created_at = createdAtRaw ? new Date(createdAtRaw).getTime() : null;

  return {
    id: row?.id,
    name: String(row?.name || "").trim(),
    price: Number(row?.price || 0),
    image_url: resolveImageUrl(row?.image_url || row?.image || row?.img || ""),
    is_active: row?.is_active !== undefined ? Boolean(row.is_active) : true,
    created_at,
  };
}

/* ================= FETCH PRODUCTS ================= */
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

/* ================= FETCH FEATURED ================= */
function normalizeFeaturedItem(it) {
  return {
    id: it?.id,
    title: String(it?.title || "").trim(),
    link_url: String(it?.link_url || "").trim(),
    sort_order: Number(it?.sort_order || 0),
    image_url: resolveImageUrl(it?.image_url || ""),
  };
}
async function fetchFeaturedItems() {
  if (!API_BASE) return [];
  try {
    const res = await fetch(`${API_BASE}/api/featured`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);

    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .map(normalizeFeaturedItem)
      .filter((x) => x.image_url);
  } catch {
    return [];
  }
}

/* ================= FETCH HERO (Admin Hero) ================= */
function normalizeHeroItem(it) {
  return {
    id: it?.id,
    title: String(it?.title || "").trim(),
    description: String(it?.description || "").trim(),
    link_url: String(it?.link_url || "").trim(),
    sort_order: Number(it?.sort_order || 0),
    image_url: resolveImageUrl(it?.image_url || ""),
  };
}
async function fetchHeroItems() {
  if (!API_BASE) return [];
  try {
    const res = await fetch(`${API_BASE}/api/hero`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);

    const items = Array.isArray(data?.items) ? data.items : [];
    return items
      .map(normalizeHeroItem)
      .filter((x) => x.image_url);
  } catch {
    return [];
  }
}

/* ================= RATINGS CACHE ================= */
function loadRatingsCache() {
  const cached = safeGetSessionJSON(RATINGS_CACHE_KEY, {});
  if (!cached || typeof cached !== "object") return {};
  return cached;
}
function saveRatingsCache(cacheObj) { safeSetSessionJSON(RATINGS_CACHE_KEY, cacheObj); }
function getCachedRating(cache, productId) {
  const k = String(productId);
  const v = cache[k];
  if (!v) return null;
  if (!v.ts || Date.now() - v.ts > RATINGS_TTL_MS) return null;
  return { avg: Number(v.avg || 0), count: Number(v.count || 0) };
}
function setCachedRating(cache, productId, avg, count) {
  cache[String(productId)] = { avg: Number(avg || 0), count: Number(count || 0), ts: Date.now() };
}

/* ================= FETCH REVIEW SUMMARY ================= */
async function fetchReviewSummary(productId) {
  if (!API_BASE) return { avg: 0, count: 0 };
  try {
    const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews/summary`, {
      cache: "no-store",
    });
    if (!res.ok) return { avg: 0, count: 0 };
    const data = await res.json().catch(() => null);
    const avg = Number(data?.summary?.avg || 0);
    const count = Number(data?.summary?.count || 0);
    return {
      avg: Number.isFinite(avg) ? avg : 0,
      count: Number.isFinite(count) ? count : 0
    };
  } catch {
    return { avg: 0, count: 0 };
  }
}

/* ================= CONCURRENCY LIMIT ================= */
async function runWithLimit(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;

  async function runner() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  }

  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => runner()));
  return out;
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
function sortLovedDesc(a, b) {
  const ar = a.avg_rating ?? 0;
  const br = b.avg_rating ?? 0;
  if (br !== ar) return br - ar;

  const ac = a.review_count ?? 0;
  const bc = b.review_count ?? 0;
  if (bc !== ac) return bc - ac;

  return sortLatestDesc(a, b);
}

/* ================= UI: RATING BADGE ================= */
function makeRatingBadge(avg, count) {
  const c = Number(count || 0);
  const a = Number(avg || 0);
  if (c <= 0 || !Number.isFinite(a) || a <= 0) return null;

  const clamped = Math.max(0, Math.min(5, a));
  const el = document.createElement("div");
  el.className = "p-rating";
  el.setAttribute("aria-label", `Rated ${clamped.toFixed(1)} out of 5 from ${c} reviews`);

  const star = document.createElement("span");
  star.className = "p-rating-star";
  star.textContent = "★";

  const val = document.createElement("span");
  val.className = "p-rating-val";
  val.textContent = clamped.toFixed(1);

  const cnt = document.createElement("span");
  cnt.className = "p-rating-count";
  cnt.textContent = `(${c})`;

  el.appendChild(star);
  el.appendChild(val);
  el.appendChild(cnt);
  return el;
}

/* ================= REVEAL (ANIMATE ALL) ================= */
let revealObserver = null;

function ensureRevealObserver(){
  if (revealObserver) return;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduce) {
    revealObserver = null;
    document.querySelectorAll(".kkl-reveal").forEach(el => el.classList.add("is-inview"));
    return;
  }

  revealObserver = new IntersectionObserver((entries) => {
    for (const e of entries){
      if (e.isIntersecting){
        e.target.classList.add("is-inview");
        revealObserver.unobserve(e.target);
      }
    }
  }, { threshold: 0.14, rootMargin: "0px 0px -10% 0px" });
}

function markAndObserve(el){
  if (!el) return;
  el.classList.add("kkl-reveal");
  ensureRevealObserver();
  if (revealObserver) revealObserver.observe(el);
  else el.classList.add("is-inview");
}

function observeBatch(selector){
  document.querySelectorAll(selector).forEach(markAndObserve);
}

/* ================= RENDER CARDS ================= */
function makeCard(p, kind) {
  const card = document.createElement("a");
  card.className = "p-card";
  card.href = productUrl(p.id);
  card.style.textDecoration = "none";

  const media = document.createElement("div");
  media.className = "p-media";

  const img = document.createElement("img");
  img.alt = p.name;
  img.src = resolveImageUrl(p.image_url);
  img.decoding = "async";
  img.loading = "eager";
  media.appendChild(img);

  if (kind === "loved") {
    const badge = makeRatingBadge(p.avg_rating, p.review_count);
    if (badge) media.appendChild(badge);
  }

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

function renderList(container, items, kind) {
  if (!container) return;
  container.innerHTML = "";

  items.forEach((p, idx) => {
    const card = makeCard(p, kind);
    card.style.setProperty("--d", `${Math.min(idx, 8) * 70}ms`); // stagger
    container.appendChild(card);
    markAndObserve(card);
  });
}

/* ================= HERO SLIDER ================= */
let heroIndex = 0;
let heroPool = [];

const heroBg = document.getElementById("heroBgImage");
const heroCard = document.getElementById("heroSlideCard");
const heroSlideTitle = document.getElementById("heroSlideTitle");
const heroSlideDesc = document.getElementById("heroSlideDesc");

function setHeroNow(item){
  if (!heroBg || !item) return;

  const src = resolveImageUrl(item.image_url);
  const title = item.title || "";
  const desc = item.description || "";
  const link = item.link_url || "products.html";

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
    markAndObserve(heroCard);
  }
  if (heroSlideTitle) heroSlideTitle.textContent = title;
  if (heroSlideDesc) heroSlideDesc.textContent = desc;
}

function switchHero(){
  if (!heroPool.length) return;
  heroIndex = (heroIndex + 1) % heroPool.length;
  setHeroNow(heroPool[heroIndex]);
}

/* ================= FEATURED (FULL IMAGE) ================= */
let featuredIndex = 0;
let featuredPool = [];

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

  const src = resolveImageUrl(item.image_url);
  const title = item.title || "Featured";
  const link = item.link_url || "products.html";

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

/* ================= HERO BRAND ANIMATION ================= */
function initHeroBrandAnimation(){
  const brandEl = document.getElementById("heroBrandmark");
  if (!brandEl) return;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const TEXT = "KÍKÉ LÁRÁ";

  function buildWordmark(text){
    brandEl.replaceChildren();
    const chars = Array.from(String(text || ""));
    const spans = [];
    for (const ch of chars){
      const s = document.createElement("span");
      s.className = "hm-letter";
      s.textContent = ch === " " ? "\u00A0" : ch;
      brandEl.appendChild(s);
      spans.push(s);
    }
    return spans;
  }

  const letters = buildWordmark(TEXT);

  function revealLetters(){
    brandEl.classList.remove("done");
    if (reduce){
      letters.forEach(s => s.classList.add("on"));
      brandEl.classList.add("done");
      return;
    }
    const baseDelay = 110;
    const startDelay = 140;

    letters.forEach((s, i) => {
      setTimeout(() => s.classList.add("on"), startDelay + i * baseDelay);
    });
    setTimeout(() => brandEl.classList.add("done"), startDelay + letters.length * baseDelay + 220);
  }

  revealLetters();
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  const start = performance.now();
  lockScroll(true);

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  initHeroBrandAnimation();

  // reveal core blocks
  observeBatch(".hero-left");
  observeBatch(".featured-card");
  observeBatch(".section");
  observeBatch(".panel");
  observeBatch(".how-card");
  observeBatch(".quote");
  observeBatch(".tips-grid .hero-mini");

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
  const baseLoved = sortedLatest.slice(0, 4);

  // hero pool
  if (heroItems.length) {
    heroPool = heroItems
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, 2);

    heroIndex = 0;
    setHeroNow(heroPool[0]);

    if (heroPool.length > 1) {
      setInterval(switchHero, HERO_SWITCH_MS);
    }
  } else {
    if (heroCard) heroCard.style.display = "none";
  }

  // featured pool
  if (featuredItems.length) {
    featuredPool = featuredItems
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, 10)
      .map((x) => ({ image_url: x.image_url, title: x.title, link_url: x.link_url }));
  } else {
    const seen = new Set();
    featuredPool = [];
    [...baseLoved, ...latest, ...sortedLatest].forEach((p) => {
      const k = String(p.id);
      if (!p.id || seen.has(k)) return;
      seen.add(k);
      featuredPool.push({ image_url: p.image_url, title: p.name, link_url: productUrl(p.id) });
    });
    featuredPool = featuredPool.slice(0, 6);
  }

  // preload critical images (so first view is premium)
  const fallbackHeroSrc = heroBg?.getAttribute("src") || "images/about-hero.jpg";
  const criticalUrls = [
    heroPool[0]?.image_url ? resolveImageUrl(heroPool[0].image_url) : fallbackHeroSrc,
    featuredPool[0]?.image_url ? resolveImageUrl(featuredPool[0].image_url) : "",
    ...latest.map(p => resolveImageUrl(p.image_url)),
    ...baseLoved.map(p => resolveImageUrl(p.image_url)),
  ];

  await Promise.race([preloadUrls(criticalUrls), sleep(PRELOADER_MAX_MS)]);

  // render sections
  renderList(latestGrid, latest, "latest");
  renderList(lovedGrid, baseLoved, "loved");

  // set featured
  if (featuredPool.length) {
    featuredIndex = 0;
    setFeaturedNow(featuredPool[0]);
    if (featuredPool.length > 1) setInterval(switchFeatured, FEATURED_SWITCH_MS);
  }

  // ratings hydration -> final “most loved”
  (async () => {
    const cache = loadRatingsCache();
    const ratedProducts = [...products].map((p) => {
      const c = getCachedRating(cache, p.id);
      return { ...p, avg_rating: c ? c.avg : null, review_count: c ? c.count : null };
    });

    const needsFetch = ratedProducts.filter((p) => p.avg_rating === null || p.review_count === null);

    if (needsFetch.length) {
      await runWithLimit(needsFetch, RATINGS_CONCURRENCY, async (p) => {
        const s = await fetchReviewSummary(p.id);
        setCachedRating(cache, p.id, s.avg, s.count);
        p.avg_rating = s.avg;
        p.review_count = s.count;
        return p;
      });
      saveRatingsCache(cache);
    }

    const loved = ratedProducts.sort(sortLovedDesc).slice(0, 4);
    renderList(lovedGrid, loved, "loved"); // (re-renders + re-reveals)
  })().catch(() => {});

  // wait for DOM images
  await Promise.race([
    (async () => {
      try { await document.fonts?.ready; } catch {}
      await waitForAllImgsInDom();
    })(),
    sleep(PRELOADER_MAX_MS)
  ]);

  const elapsed = performance.now() - start;
  if (elapsed < PRELOADER_MIN_MS) await sleep(PRELOADER_MIN_MS - elapsed);

  hidePreloader();
});
