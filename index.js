/* ================= INDEX.JS (PRODUCTION) =================
   ✅ Latest Drops (newest 4)
   ✅ Most Loved (top 4 by rating summary)
   ✅ Most Loved shows rating badge ON IMAGE
   ✅ Cards show only: image + name + price (no extra wording)
   ✅ FEATURED HERO pulls from /api/featured (Admin Featured)
========================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";

const RATINGS_CACHE_KEY = "ratingsSummary_v1";
const RATINGS_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const RATINGS_CONCURRENCY = 6;

/* ================= PRELOADER – PER TAB ================= */
window.addEventListener("load", () => {
  const preloader = document.getElementById("preloader");

  if (!sessionStorage.getItem("visited")) {
    sessionStorage.setItem("visited", "true");
    setTimeout(() => {
      if (preloader) {
        preloader.style.opacity = "0";
        setTimeout(() => preloader.remove(), 550);
      }
    }, 900);
  } else {
    if (preloader) preloader.remove();
  }
});

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

/* ================= FETCH FEATURED (ADMIN FEATURED -> PUBLIC) ================= */
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
      .filter((x) => x.image_url); // must have image
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
  img.loading = "lazy";
  img.alt = p.name;
  img.src = resolveImageUrl(p.image_url);
  media.appendChild(img);

  // ✅ Rating ON IMAGE for Most Loved
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

/* ================= FEATURED HERO (ADMIN FEATURED) ================= */
let featuredIndex = 0;
let featuredPool = [];
const featuredImg = document.getElementById("featuredImage");
const featuredName = document.getElementById("featuredName");
const featuredLinkEl = document.getElementById("featuredLink"); // optional <a id="featuredLink">

function preloadImage(src, cb) {
  const i = new Image();
  i.onload = cb;
  i.onerror = cb;
  i.src = src;
}

function setFeaturedLink(url) {
  const u = String(url || "").trim();
  if (featuredLinkEl) {
    featuredLinkEl.href = u || "#";
    return;
  }
  // fallback: if the image is inside an <a>
  const a = featuredImg?.closest?.("a");
  if (a) a.href = u || "#";
}

function switchFeatured() {
  if (!featuredImg || !featuredPool.length) return;

  featuredImg.style.opacity = "0";
  if (featuredName) featuredName.style.opacity = "0";

  const next = featuredPool[featuredIndex];

  // Featured item shape:
  // { image_url, title, link_url }
  const src = resolveImageUrl(next.image_url);
  const title = next.title || "";
  const link = next.link_url || "";

  preloadImage(src, () => {
    setTimeout(() => {
      featuredImg.src = src;
      featuredImg.alt = title ? title : "Featured";
      if (featuredName) featuredName.textContent = title;
      setFeaturedLink(link);

      featuredImg.style.opacity = "1";
      if (featuredName) featuredName.style.opacity = "1";

      featuredIndex = (featuredIndex + 1) % featuredPool.length;
    }, 240);
  });
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  const latestGrid = document.getElementById("latestProducts");
  const lovedRail = document.getElementById("homeProducts");

  // fetch featured + products in parallel
  const [featuredItems, products] = await Promise.all([
    fetchFeaturedItems(),
    fetchProducts(),
  ]);

  // ---- PRODUCTS SECTION ----
  safeSetSessionJSON(PRODUCTS_KEY, products);

  if (!products.length) {
    renderList(latestGrid, [], "latest");
    renderList(lovedRail, [], "loved");
  } else {
    const sortedLatest = [...products].sort(sortLatestDesc);
    const latest = sortedLatest.slice(0, 4);

    // show latest immediately
    renderList(latestGrid, latest, "latest");

    // show loved quickly (will re-render after ratings fetch)
    renderList(lovedRail, sortedLatest.slice(0, 4), "loved");

    // ratings hydration
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

    // fallback featured pool from products if admin featured is empty
    if (!featuredItems.length) {
      const seen = new Set();
      featuredPool = [];
      [...loved, ...latest, ...sortedLatest].forEach((p) => {
        const k = String(p.id);
        if (!p.id || seen.has(k)) return;
        seen.add(k);
        featuredPool.push({ image_url: p.image_url, title: p.name, link_url: productUrl(p.id) });
      });
      featuredPool = featuredPool.slice(0, 6);
    }
  }

  // ---- FEATURED HERO SECTION (ADMIN FEATURED FIRST) ----
  if (featuredItems.length) {
    // use admin featured items
    featuredPool = featuredItems
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .slice(0, 10)
      .map((x) => ({ image_url: x.image_url, title: x.title, link_url: x.link_url }));
  }

  if (featuredPool.length) {
    featuredIndex = 0;
    switchFeatured();
    setInterval(switchFeatured, 4200);
  }
});
