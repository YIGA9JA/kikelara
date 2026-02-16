/* ================= INDEX.JS (PREMIUM + HERO VIDEO) =================
   ✅ Preloader per-tab
   ✅ Hero background video (loads only when allowed)
   ✅ Featured slider kept
   ✅ Products from sessionStorage(allProducts), backend fallback
   ✅ Latest = newest products
   ✅ Most loved = more products (stable pick)
=========================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/$/, "");
const PRODUCTS_KEY = "allProducts";

/* ================= PRELOADER – PER TAB ================= */
window.addEventListener("load", () => {
  const preloader = document.getElementById("preloader");
  if (!sessionStorage.getItem("visited")) {
    sessionStorage.setItem("visited", "true");
    setTimeout(() => {
      if (preloader) {
        preloader.style.opacity = "0";
        preloader.style.transition = "opacity .45s ease";
        setTimeout(() => preloader.remove(), 480);
      }
    }, 950);
  } else {
    if (preloader) preloader.remove();
  }
});

/* ================= HERO VIDEO (SMART LOAD) ================= */
(function setupHeroVideo() {
  const vid = document.getElementById("heroBgVideo");
  if (!vid) return;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);

  if (reduceMotion || saveData) {
    // Leave poster visible (no video load)
    return;
  }

  const webm = vid.getAttribute("data-webm");
  const mp4 = vid.getAttribute("data-mp4");

  // Add sources only when allowed (prevents loading on save-data / reduced-motion)
  if (webm) {
    const s1 = document.createElement("source");
    s1.src = webm;
    s1.type = "video/webm";
    vid.appendChild(s1);
  }
  if (mp4) {
    const s2 = document.createElement("source");
    s2.src = mp4;
    s2.type = "video/mp4";
    vid.appendChild(s2);
  }

  vid.preload = "metadata";

  const tryPlay = async () => {
    try {
      await vid.play();
    } catch {
      // If autoplay blocked, user will still see poster (fine)
    }
  };

  // Pause video when hero is not visible (performance)
  const hero = document.querySelector(".hero");
  if ("IntersectionObserver" in window && hero) {
    const io = new IntersectionObserver((entries) => {
      const isInView = entries.some(e => e.isIntersecting);
      if (isInView) tryPlay();
      else { try { vid.pause(); } catch {} }
    }, { threshold: 0.2 });
    io.observe(hero);
  } else {
    tryPlay();
  }
})();

/* ================= NAV HELPER ================= */
function goToProduct(id) {
  if (id === undefined || id === null || id === "") return;
  window.location.href = `product-details.html?id=${encodeURIComponent(id)}`;
}

/* ================= SAFE JSON HELPERS ================= */
function safeParseJSONSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function safeSetJSONSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ================= IMAGE URL RESOLVER ================= */
function resolveImageUrl(src) {
  const s = String(src || "").trim();
  if (!s) return "images_brown/bodyButter.png";
  if (/^https?:\/\//i.test(s)) return s;
  if (API_BASE && s.startsWith("/uploads/")) return API_BASE + s;
  return s;
}

/* ================= FEATURED SLIDER ================= */
const featuredProducts = [
  { name: "", img: "images_brown/ad4.png" },
  { name: "", img: "images_brown/ad7.png" },
  { name: "", img: "images_brown/ad8.png" },
  { name: "", img: "images_brown/ad9.png" },
];

let featuredIndex = 0;
const featuredImg = document.getElementById("featuredImage");
const featuredName = document.getElementById("featuredName");

function preloadImage(src, callback) {
  const img = new Image();
  img.src = src;
  img.onload = callback;
  img.onerror = callback;
}

function switchFeatured() {
  if (!featuredImg) return;

  featuredImg.style.opacity = "0";
  if (featuredName) featuredName.style.opacity = "0";

  const next = featuredProducts[featuredIndex];
  preloadImage(next.img, () => {
    setTimeout(() => {
      featuredImg.src = next.img;
      if (featuredName) featuredName.textContent = next.name || "";
      featuredImg.style.opacity = "1";
      if (featuredName) featuredName.style.opacity = "1";
      featuredIndex = (featuredIndex + 1) % featuredProducts.length;
    }, 280);
  });
}
switchFeatured();
setInterval(switchFeatured, 4500);

/* ================= PRODUCTS (SESSION + BACKEND FALLBACK) ================= */
function getAllProducts() {
  const list = safeParseJSONSession(PRODUCTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

function normalizeProduct(p) {
  const image =
    p?.image || p?.image_url || (Array.isArray(p?.images) && p.images[0]) || "images_brown/bodyButter.png";

  return {
    id: p?.id,
    name: String(p?.name || "").trim(),
    image: resolveImageUrl(image),
    category: String(p?.category || p?.payload?.category || "Product").trim(),
    price: Number(p?.price || 0),
    active: p?.active ?? p?.is_active ?? true
  };
}

async function fetchProductsFromBackend() {
  if (!API_BASE) return [];
  try {
    const res = await fetch(`${API_BASE}/api/products`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(normalizeProduct).filter(p => p.id && p.name);
  } catch {
    return [];
  }
}

/* ================= CARD RENDER ================= */
function renderCards(container, items, cardClass) {
  if (!container) return;
  container.innerHTML = "";

  items.forEach((p) => {
    const card = document.createElement("div");
    card.className = cardClass;

    const img = document.createElement("img");
    img.src = resolveImageUrl(p.img);
    img.alt = p.name;
    img.loading = "lazy";

    const title = document.createElement("h4");
    title.textContent = p.name;

    card.addEventListener("click", () => goToProduct(p.id));
    img.addEventListener("click", (e) => { e.stopPropagation(); goToProduct(p.id); });

    card.appendChild(img);
    card.appendChild(title);
    container.appendChild(card);
  });
}

/* ================= DEFAULT FALLBACK LISTS ================= */
const latestGrid = document.getElementById("latestProducts");
const lovedRail = document.getElementById("homeProducts");

const fallbackLatest = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 2, name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { id: 6, name: "Body Butter (Fruity)", img: "images_brown/bodyButter(Fruity).png" },
];

const fallbackLoved = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 2, name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 4, name: "Hair Oil", img: "images_brown/hairOil.png" },
  { id: 5, name: "Baby Body Butter", img: "images_brown/BabyBodyButter.png" },
];

function renderFallback() {
  if (latestGrid) renderCards(latestGrid, fallbackLatest, "latest-card");
  if (lovedRail) renderCards(lovedRail, fallbackLoved, "home-card");
}

/* ================= BUILD “MAKES SENSE” LISTS FROM BACKEND ================= */
function buildLatestFromBackend(all) {
  // newest by ID (works if IDs increment)
  const sorted = [...all].filter(p => p.active !== false).sort((a,b) => Number(b.id) - Number(a.id));
  return sorted.slice(0, 4).map(p => ({ id: p.id, name: p.name, img: p.image }));
}
function buildLovedFromBackend(all) {
  // stable pick: first 10 active products (or fewer)
  const active = all.filter(p => p.active !== false);
  const sorted = [...active].sort((a,b) => Number(a.id) - Number(b.id));
  return sorted.slice(0, 10).map(p => ({ id: p.id, name: p.name, img: p.image }));
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  renderFallback();

  let existing = getAllProducts();
  if (!existing.length) {
    const fetched = await fetchProductsFromBackend();
    if (fetched.length) {
      safeSetJSONSession(PRODUCTS_KEY, fetched);
      existing = fetched;
    }
  }

  if (existing.length) {
    const latest = buildLatestFromBackend(existing);
    const loved = buildLovedFromBackend(existing);

    if (latestGrid && latest.length) renderCards(latestGrid, latest, "latest-card");
    if (lovedRail && loved.length) renderCards(lovedRail, loved, "home-card");
  }
});
