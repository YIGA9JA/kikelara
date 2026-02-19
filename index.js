/* ================= INDEX.JS (PRODUCTION + PRELOADER WAITS FOR IMAGES ✅) =================
   ✅ Latest Drops (newest 4)
   ✅ Most Loved (top 4 by rating summary)
   ✅ Most Loved shows rating badge ON IMAGE
   ✅ FEATURED HERO pulls from /api/featured
   ✅ Preloader stays until critical images are loaded
======================================================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";

const RATINGS_CACHE_KEY = "ratingsSummary_v1";
const RATINGS_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const RATINGS_CONCURRENCY = 6;

/* ================= PRELOADER CONTROL (WAIT FOR IMAGES) ================= */
const preloader = document.getElementById("preloader");
const PRELOADER_MIN_MS = 450;     // avoid flash
const PRELOADER_MAX_MS = 12000;   // safety escape (don’t trap users forever)

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function lockScroll(lock){
  if (!preloader) return;
  if (lock){
    document.body.dataset._prevOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = document.body.dataset._prevOverflow || "";
    delete document.body.dataset._prevOverflow;
  }
}

function hidePreloader(){
  if (!preloader) return;
  preloader.style.opacity = "0";
  setTimeout(() => preloader.remove(), 550);
  lockScroll(false);
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

/* ================= HERO VIDEO (LAZY + SAFE) ================= */
(function initHeroVideo() {
  const v = document.getElementById("heroBgVideo");
  if (!v) return;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduce) return;

  const webm = v.dataset.webm || "";
  const mp4 = v.dataset.mp4 || "";
  if (!webm && !mp4) return;

  function attachSources() {
    if (v.querySelector("source")) return;

    if (webm) {
      const s = document.createElement("source");
      s.src = webm;
      s.type = "video/webm";
      v.appendChild(s);
    }
    if (mp4) {
      const s = document.createElement("source");
      s.src = mp4;
      s.type = "video/mp4";
      v.appendChild(s);
    }

    v.load();
    const play = () => v.play().catch(() => {});
    if (document.visibilityState === "visible") play();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") play();
      else v.pause();
    });
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const ent = entries[0];
        if (ent && ent.isIntersecting) {
          attachSources();
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "200px" }
    );
    io.observe(v);
  } else {
    attachSources();
  }
})();

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
  return `₦${num.toLocaleString()}`;
}

function resolveImageUrl(img) {
  const val = String(img || "").trim();
  if (!val) return "images_brown/bodyButter.png";
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

/* ================= RENDER CARDS ================= */
function makeCard(p, kind) {
  const card = document.createElement("a");
  card.className = kind === "latest" ? "p-card p-latest" : "p-card p-loved";
  card.href = productUrl(p.id);
  card.style.textDecoration = "none";

  const media = document.createElement("div");
  media.className = "p-media";

  const img = document.createElement("img");
  img.alt = p.name;
  img.src = resolveImageUrl(p.image_url);
  img.decoding = "async";

  // ✅ IMPORTANT: if you want preloader to wait for these images, DON'T lazy-load them
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
  items.forEach((p) => container.appendChild(makeCard(p, kind)));
}

/* ================= FEATURED HERO ================= */
let featuredIndex = 0;
let featuredPool = [];

const featuredImg = document.getElementById("featuredImage");
const featuredName = document.getElementById("featuredName");
const featuredLinkEl = document.getElementById("featuredLink");

function setFeaturedLink(url) {
  const u = String(url || "").trim();
  if (featuredLinkEl) featuredLinkEl.href = u || "products.html";
}

function setFeaturedNow(item){
  if (!featuredImg || !item) return;

  const src = resolveImageUrl(item.image_url);
  const title = item.title || "Featured";
  const link = item.link_url || "products.html";

  featuredImg.src = src;
  featuredImg.alt = title;
  if (featuredName) featuredName.textContent = title;
  setFeaturedLink(link);
}

function switchFeatured() {
  if (!featuredImg || !featuredPool.length) return;

  const next = featuredPool[featuredIndex];
  const src = resolveImageUrl(next.image_url);

  featuredImg.style.opacity = "0";
  if (featuredName) featuredName.style.opacity = "0";

  preloadUrl(src).then(() => {
    setTimeout(() => {
      setFeaturedNow(next);
      featuredImg.style.opacity = "1";
      if (featuredName) featuredName.style.opacity = "1";
      featuredIndex = (featuredIndex + 1) % featuredPool.length;
    }, 220);
  });
}

/* ================= MOST LOVED RAIL SCROLL BUTTONS ================= */
function initLovedRailControls(){
  const rail = document.getElementById("homeProducts");
  const prev = document.querySelector(".rail-prev");
  const next = document.querySelector(".rail-next");
  if (!rail || !prev || !next) return;

  function scrollByAmt(dir){
    const amt = Math.max(240, Math.floor(rail.clientWidth * 0.72));
    rail.scrollBy({ left: dir * amt, behavior: "smooth" });
  }
  prev.addEventListener("click", () => scrollByAmt(-1));
  next.addEventListener("click", () => scrollByAmt(1));
}

/* ================= HERO BRAND ANIMATION: BUBBLES + LETTER REVEAL ================= */
function initHeroBrandAnimation(){
  const brandEl = document.getElementById("heroBrandmark");
  const bubbleWrap = document.getElementById("heroBubbles");
  if (!brandEl) return;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const TEXT = "KIKELARA";

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

  if (!bubbleWrap || reduce) return;

  function rand(min, max){ return Math.random() * (max - min) + min; }
  let timer = null;

  function spawnBubble(){
    if (document.visibilityState !== "visible") return;

    const b = document.createElement("span");
    b.className = "bubble";

    const size = rand(14, 64);
    const left = rand(-6, 106);
    const bottom = rand(-18, 14);

    b.style.setProperty("--s", `${size}px`);
    b.style.setProperty("--l", `${left}%`);
    b.style.setProperty("--b", `${bottom}%`);
    b.style.setProperty("--dur", `${rand(6.5, 13.5)}s`);
    b.style.setProperty("--x", `${rand(-36, 36)}px`);
    b.style.setProperty("--o", `${rand(0.08, 0.20)}`);
    b.style.setProperty("--blur", `${rand(0, 6)}px`);

    b.addEventListener("animationend", () => b.remove());
    bubbleWrap.appendChild(b);

    if (bubbleWrap.childElementCount > 26) bubbleWrap.firstElementChild?.remove();
  }

  function start(){
    if (timer) return;
    for (let i = 0; i < 8; i++) spawnBubble();
    timer = setInterval(spawnBubble, 360);
  }

  function stop(){
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  start();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") start();
    else stop();
  });
}

/* ================= INIT (WITH IMAGE-GATED PRELOADER) ================= */
document.addEventListener("DOMContentLoaded", async () => {
  const start = performance.now();
  lockScroll(true);

  // allow header/footer injection to mount first
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  initLovedRailControls();
  initHeroBrandAnimation();

  const latestGrid = document.getElementById("latestProducts");
  const lovedRail = document.getElementById("homeProducts");

  // 1) fetch featured + products
  const [featuredItems, products] = await Promise.all([
    fetchFeaturedItems(),
    fetchProducts(),
  ]);

  safeSetSessionJSON(PRODUCTS_KEY, products);

  const sortedLatest = [...products].sort(sortLatestDesc);
  const latest = sortedLatest.slice(0, 4);

  // base loved (fast) before ratings
  const baseLoved = sortedLatest.slice(0, 4);

  // 2) decide featured pool (admin first, else fallback)
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

  // 3) PRELOAD critical images BEFORE reveal
  const heroPoster = document.getElementById("heroBgVideo")?.getAttribute("poster") || "";
  const criticalUrls = [
    heroPoster,
    featuredPool[0]?.image_url ? resolveImageUrl(featuredPool[0].image_url) : "",
    ...latest.map(p => resolveImageUrl(p.image_url)),
    ...baseLoved.map(p => resolveImageUrl(p.image_url)),
  ];

  // preload the URLs first
  await Promise.race([
    preloadUrls(criticalUrls),
    sleep(PRELOADER_MAX_MS)
  ]);

  // 4) render UI now (images already likely cached from preloads)
  renderList(latestGrid, latest, "latest");
  renderList(lovedRail, baseLoved, "loved");

  // set first featured immediately
  if (featuredPool.length) {
    featuredIndex = 0;
    setFeaturedNow(featuredPool[0]);
    featuredIndex = (featuredIndex + 1) % featuredPool.length;
    setInterval(switchFeatured, 4200);
  }

  // 5) hydrate ratings (does NOT block preloader — faster perceived)
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
    renderList(lovedRail, loved, "loved");
  })().catch(() => {});

  // 6) Now wait for all DOM imgs (including header logo) to complete
  await Promise.race([
    (async () => {
      // wait for fonts too (optional, helps polish)
      try { await document.fonts?.ready; } catch {}
      await waitForAllImgsInDom();
    })(),
    sleep(PRELOADER_MAX_MS)
  ]);

  // 7) keep preloader for minimum time, then hide
  const elapsed = performance.now() - start;
  if (elapsed < PRELOADER_MIN_MS) await sleep(PRELOADER_MIN_MS - elapsed);
  hidePreloader();
});
