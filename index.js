/* ================= INDEX.JS (BACKEND ONLY — matches your server.js) =================
   ✅ Preloader (per-tab sessionStorage)
   ✅ Hero video lazy-load (reduced-motion safe)
   ✅ Fetch ALL products from backend /api/products (already created_at DESC)
   ✅ Latest Drops = newest 4 (slice(0,4))
   ✅ Most Loved = top 4 by rating using /api/products/:id/reviews/summary
   ✅ Caches rating summaries in sessionStorage (TTL) + concurrency limit
   ✅ Cards navigate to product-details.html?id=ID
==================================================================================== */

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

/* ================= NAV HELPER ================= */
function goToProduct(id) {
  if (id === undefined || id === null || id === "") return;
  window.location.href = `product-details.html?id=${encodeURIComponent(id)}`;
}

/* ================= SAFE STORAGE ================= */
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
  try {
    sessionStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

/* ================= IMAGE URL RESOLVER ================= */
function resolveImageUrl(img) {
  const val = String(img || "").trim();
  if (!val) return "images_brown/bodyButter.png";

  // signed url from your backend -> already https://...
  if (/^https?:\/\//i.test(val)) return val;

  // /uploads/... from backend
  if (val.startsWith("/uploads/") && API_BASE) return `${API_BASE}${val}`;

  // uploads/... from backend
  if (val.startsWith("uploads/") && API_BASE) return `${API_BASE}/${val}`;

  // local relative file
  return val;
}

/* ================= NORMALIZE PRODUCT (your DB row shape) ================= */
function normalizeProduct(row) {
  const createdAtRaw = row?.created_at || row?.createdAt || null;
  const created_at = createdAtRaw ? new Date(createdAtRaw).getTime() : null;

  return {
    id: row?.id,
    name: String(row?.name || "").trim(),
    price: Number(row?.price || 0),
    description: String(row?.description || ""),
    image_url: resolveImageUrl(row?.image_url || row?.image || row?.img || ""),
    is_active: row?.is_active !== undefined ? Boolean(row.is_active) : true,
    created_at, // timestamp number or null
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

/* ================= RATINGS CACHE ================= */
function loadRatingsCache() {
  const cached = safeGetSessionJSON(RATINGS_CACHE_KEY, {});
  if (!cached || typeof cached !== "object") return {};
  return cached;
}
function saveRatingsCache(cacheObj) {
  safeSetSessionJSON(RATINGS_CACHE_KEY, cacheObj);
}
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

/* ================= FETCH REVIEW SUMMARY (your endpoint) ================= */
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
    return { avg: Number.isFinite(avg) ? avg : 0, count: Number.isFinite(count) ? count : 0 };
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
  // your API already returns created_at DESC,
  // but we still sort safely if missing fields
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

function lovedMetaText(p) {
  const avg = Number(p.avg_rating ?? 0);
  const count = Number(p.review_count ?? 0);

  if (!count) return "Customer favorite";

  const clamped = Math.max(0, Math.min(5, avg));
  const rounded = Math.round(clamped);
  const stars = "★".repeat(rounded) + "☆".repeat(5 - rounded);
  return `${stars} ${clamped.toFixed(1)} (${count})`;
}

/* ================= RENDER ================= */
function makeCard(p, kind) {
  const card = document.createElement("a");
  card.className = kind === "latest" ? "p-card p-latest" : "p-card p-loved";
  card.href = "javascript:void(0)";
  card.setAttribute("role", "link");
  card.style.textDecoration = "none";

  const media = document.createElement("div");
  media.className = "p-media";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = p.name;
  img.src = resolveImageUrl(p.image_url);
  media.appendChild(img);

  const body = document.createElement("div");
  body.className = "p-body";

  const title = document.createElement("div");
  title.className = "p-title";
  title.textContent = p.name;

  const meta = document.createElement("div");
  meta.className = "p-meta";
  meta.textContent = kind === "latest" ? "New in" : lovedMetaText(p);

  body.appendChild(title);
  body.appendChild(meta);

  card.appendChild(media);
  card.appendChild(body);

  card.addEventListener("click", () => goToProduct(p.id));
  return card;
}

function renderList(container, items, kind) {
  if (!container) return;
  container.innerHTML = "";
  items.forEach((p) => container.appendChild(makeCard(p, kind)));
}

/* ================= FEATURED AUTO SWITCH ================= */
let featuredIndex = 0;
let featuredPool = [];
const featuredImg = document.getElementById("featuredImage");
const featuredName = document.getElementById("featuredName");

function preloadImage(src, cb) {
  const i = new Image();
  i.src = src;
  i.onload = cb;
  i.onerror = cb;
}

function switchFeatured() {
  if (!featuredImg || !featuredPool.length) return;

  featuredImg.style.opacity = "0";
  if (featuredName) featuredName.style.opacity = "0";

  const next = featuredPool[featuredIndex];
  const src = resolveImageUrl(next.image_url);

  preloadImage(src, () => {
    setTimeout(() => {
      featuredImg.src = src;
      if (featuredName) featuredName.textContent = next.name || "";
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

  // 1) Get products from backend only
  const products = await fetchProducts();

  // Save for other pages (product-details lookup, etc.)
  safeSetSessionJSON(PRODUCTS_KEY, products);

  // If none, render nothing
  if (!products.length) {
    renderList(latestGrid, [], "latest");
    renderList(lovedRail, [], "loved");
    return;
  }

  // 2) Latest Drops = newest 4 (your API already returns newest first)
  const sortedLatest = [...products].sort(sortLatestDesc);
  const latest = sortedLatest.slice(0, 4);

  // If you truly meant "oldest 4", switch to:
  // const latest = sortedLatest.slice(-4);

  renderList(latestGrid, latest, "latest");

  // 3) Render loved quickly (temporary) then upgrade after ratings load
  renderList(lovedRail, sortedLatest.slice(0, 4), "loved");

  // 4) Build "Most Loved" using review summaries (cached + limited concurrency)
  const cache = loadRatingsCache();

  const ratedProducts = [...products].map((p) => {
    const c = getCachedRating(cache, p.id);
    return {
      ...p,
      avg_rating: c ? c.avg : null,
      review_count: c ? c.count : null,
    };
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

  // 5) Most Loved = top 4 highest rated (avg desc, then count desc)
  const loved = ratedProducts.sort(sortLovedDesc).slice(0, 4);
  renderList(lovedRail, loved, "loved");

  // 6) Featured pool: loved then latest then rest (unique)
  const seen = new Set();
  featuredPool = [];
  [...loved, ...latest, ...sortedLatest].forEach((p) => {
    const k = String(p.id);
    if (!p.id || seen.has(k)) return;
    seen.add(k);
    featuredPool.push(p);
  });
  featuredPool = featuredPool.slice(0, 6);

  if (featuredPool.length) {
    featuredIndex = 0;
    switchFeatured();
    setInterval(switchFeatured, 4200);
  }
});
