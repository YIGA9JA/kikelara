/* ================= INDEX.JS (UPDATED) =================
   ✅ Preloader (per-tab sessionStorage)
   ✅ Featured slider kept
   ✅ Reads products from sessionStorage(allProducts)
   ✅ If empty, fetches from backend and saves into sessionStorage(allProducts)
   ✅ Cards navigate to product-details.html?id=ID
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
        setTimeout(() => preloader.remove(), 600);
      }
    }, 1200);
  } else {
    if (preloader) preloader.remove();
  }
});

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

function safeParseJSONLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeName(str) {
  return String(str || "").trim().toLowerCase();
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
    }, 400);
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
    image,
    category: String(p?.category || p?.payload?.category || "Product").trim(),
    price: Number(p?.price || 0),
  };
}

async function fetchProductsFromBackend() {
  if (!API_BASE) return [];
  const res = await fetch(`${API_BASE}/api/products`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeProduct).filter(p => p.id && p.name);
}

function findProductIdByName(name) {
  const all = getAllProducts();
  const target = normalizeName(name);
  const found = all.find(p => normalizeName(p?.name) === target);
  return found?.id ?? null;
}

/* ================= CARD RENDER HELPER (SAFER) ================= */
function renderCards(container, items, cardClass) {
  if (!container) return;

  container.innerHTML = "";

  items.forEach((p) => {
    const realId = findProductIdByName(p.name);
    const idToUse = realId ?? p.id;

    const card = document.createElement("div");
    card.className = cardClass;
    card.style.cursor = "pointer";

    const img = document.createElement("img");
    img.src = p.img;
    img.alt = p.name;
    img.loading = "lazy";
    img.className = "clickable-img";
    img.style.cursor = "pointer";

    const title = document.createElement("h4");
    title.textContent = p.name;

    img.addEventListener("click", (e) => {
      e.stopPropagation();
      goToProduct(idToUse);
    });

    card.addEventListener("click", () => goToProduct(idToUse));

    card.appendChild(img);
    card.appendChild(title);

    container.appendChild(card);
  });
}

/* ================= HOMEPAGE + LATEST ================= */
const homeProductsEl = document.getElementById("homeProducts");
const homepageProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 2, name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 4, name: "Hair Oil", img: "images_brown/hairOil.png" },
  { id: 5, name: "Baby Body Butter", img: "images_brown/BabyBodyButter.png" },
];

const latestGrid = document.getElementById("latestProducts");
const latestProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 2, name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { id: 6, name: "Body Butter (Fruity)", img: "images_brown/bodyButter(Fruity).png" },
];

function renderHomeSections() {
  if (homeProductsEl) renderCards(homeProductsEl, homepageProducts, "home-card");
  if (latestGrid) renderCards(latestGrid, latestProducts, "latest-card");
}

/* ================= USER GREETING ================= */
(function greetUser() {
  const user = safeParseJSONLocal("loggedInUser", null);
  if (!user) return;

  const greet = document.getElementById("userGreeting");
  const logoutBtn = document.getElementById("logoutBtn");

  if (greet) greet.textContent = `Hi, ${user.username || "Guest"}`;
  if (logoutBtn) logoutBtn.classList.remove("hidden");
})();

/* ================= HAMBURGER TOGGLE ================= */
(function mobileMenu() {
  const hamburger = document.getElementById("hamburger");
  const mobileNav = document.getElementById("mobileNav");

  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    mobileNav.classList.toggle("active");
  });
})();

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  renderHomeSections();

  const existing = getAllProducts();
  if (!existing.length) {
    const fetched = await fetchProductsFromBackend();
    if (fetched.length) {
      safeSetJSONSession(PRODUCTS_KEY, fetched);
      renderHomeSections();
    }
  }
});
