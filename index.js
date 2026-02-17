/* ================= INDEX.JS (PREMIUM) =================
   ✅ Preloader (per-tab sessionStorage)
   ✅ Hero video lazy-load (reduced-motion safe)
   ✅ Featured slider kept
   ✅ Reads products from sessionStorage(allProducts)
   ✅ If empty, fetches from backend and saves into sessionStorage(allProducts)
   ✅ Cards navigate to product-details.html?id=ID
======================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";

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
(function initHeroVideo(){
  const v = document.getElementById("heroBgVideo");
  if (!v) return;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduce) return; // keep poster only

  const webm = v.dataset.webm || "";
  const mp4  = v.dataset.mp4  || "";
  if (!webm && !mp4) return;

  function attachSources(){
    if (v.querySelector("source")) return;

    // Prefer webm when possible
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

  // Load only when hero is near viewport
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      const ent = entries[0];
      if (ent && ent.isIntersecting) {
        attachSources();
        io.disconnect();
      }
    }, { root: null, threshold: 0.12, rootMargin: "200px" });

    io.observe(v);
  } else {
    // fallback
    attachSources();
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
function normalizeName(str) {
  return String(str || "").trim().toLowerCase();
}

/* ================= FEATURED SLIDER ================= */
const featuredProducts = [
  { name: "Body Butter", img: "images_brown/bodyButter.png" },
  { name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { name: "Baby Body Butter", img: "images_brown/BabyBodyButter.png" },
];

let featuredIndex = 0;
const featuredImg = document.getElementById("featuredImage");
const featuredName = document.getElementById("featuredName");

function preloadImage(src, callback) {
  const img = new Image();
  img.src = src;
  img.onload = callback;
  img.onerror = callback; // still switch even if image missing
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
    }, 260);
  });
}
switchFeatured();
setInterval(switchFeatured, 4200);

/* ================= PRODUCTS (SESSION + BACKEND FALLBACK) ================= */
function getAllProducts() {
  const list = safeParseJSONSession(PRODUCTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

function resolveImageUrl(img) {
  const val = String(img || "").trim();
  if (!val) return "images_brown/bodyButter.png";
  if (/^https?:\/\//i.test(val)) return val;

  // if backend returns /uploads/... then prefix API_BASE
  if (val.startsWith("/uploads/") && API_BASE) return `${API_BASE}${val}`;
  return val; // local file path
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

function findProductIdByName(name) {
  const all = getAllProducts();
  const target = normalizeName(name);
  const found = all.find(p => normalizeName(p?.name) === target);
  return found?.id ?? null;
}

/* ================= RENDER HELPERS ================= */
function makeCard({ id, name, img, kind }) {
  const card = document.createElement("a");
  card.className = kind === "latest" ? "p-card p-latest" : "p-card p-loved";
  card.href = "javascript:void(0)";
  card.setAttribute("role", "link");
  card.style.textDecoration = "none";

  const media = document.createElement("div");
  media.className = "p-media";

  const image = document.createElement("img");
  image.loading = "lazy";
  image.alt = name;
  image.src = resolveImageUrl(img);
  media.appendChild(image);

  const body = document.createElement("div");
  body.className = "p-body";

  const title = document.createElement("div");
  title.className = "p-title";
  title.textContent = name;

  const meta = document.createElement("div");
  meta.className = "p-meta";
  meta.textContent = kind === "latest" ? "New in" : "Customer favorite";

  body.appendChild(title);
  body.appendChild(meta);

  card.appendChild(media);
  card.appendChild(body);

  card.addEventListener("click", () => {
    const realId = findProductIdByName(name);
    goToProduct(realId ?? id);
  });

  return card;
}

function renderLatest(container, items) {
  if (!container) return;
  container.innerHTML = "";
  items.forEach(p => container.appendChild(makeCard({ ...p, kind: "latest" })));
}

function renderLoved(container, items) {
  if (!container) return;
  container.innerHTML = "";
  items.forEach(p => container.appendChild(makeCard({ ...p, kind: "loved" })));
}

/* ================= DATA (your display list) ================= */
const latestGrid = document.getElementById("latestProducts");
const lovedRail = document.getElementById("homeProducts");

const latestProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 2, name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { id: 6, name: "Body Butter (Fruity)", img: "images_brown/bodyButter(Fruity).png" },
];

const lovedProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 2, name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 4, name: "Hair Oil", img: "images_brown/hairOil.png" },
  { id: 5, name: "Baby Body Butter", img: "images_brown/BabyBodyButter.png" },
];

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  // First render (fast)
  renderLatest(latestGrid, latestProducts);
  renderLoved(lovedRail, lovedProducts);

  // Ensure products in session (for correct IDs)
  const existing = getAllProducts();
  if (!existing.length) {
    const fetched = await fetchProductsFromBackend();
    if (fetched.length) safeSetJSONSession(PRODUCTS_KEY, fetched);
  }
});
