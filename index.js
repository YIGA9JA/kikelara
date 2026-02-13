/* ================= INDEX.JS (FULL UPDATED) =================
   ✅ Preloader (first visit only)
   ✅ Featured slider kept
   ✅ Home products + Latest products clickable -> product-details.html?id=ID
   ✅ Uses REAL product IDs from localStorage(allProducts) when available
   ✅ Falls back to your hardcoded display list if localStorage has no products yet
   ✅ Greeting + logout kept
   ✅ Hamburger toggle kept
=========================================================== */

/* PRELOADER – SHOW ONLY ON FIRST VISIT */
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
function safeParseJSON(key, fallback) {
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

/* Initial load */
switchFeatured();
/* Auto switch */
setInterval(switchFeatured, 4500);

/* ================= PRODUCTS SOURCE =================
   Reads products saved by products.js into localStorage(allProducts).
   Ensures clicking a card opens the correct product id.
*/
function getAllProducts() {
  const list = safeParseJSON("allProducts", []);
  return Array.isArray(list) ? list : [];
}

function findProductIdByName(name) {
  const all = getAllProducts();
  const target = normalizeName(name);
  const found = all.find(p => normalizeName(p?.name) === target);
  return found?.id ?? null;
}

/* ================= CARD RENDER HELPER ================= */
function renderCards(container, items, cardClass) {
  if (!container) return;

  items.forEach((p) => {
    // Try real ID from allProducts; fallback to the provided id
    const realId = findProductIdByName(p.name);
    const idToUse = realId ?? p.id;

    const card = document.createElement("div");
    card.className = cardClass;
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}" loading="lazy" class="clickable-img">
      <h4>${p.name}</h4>
    `;

    card.style.cursor = "pointer";
    card.addEventListener("click", () => goToProduct(idToUse));

    const img = card.querySelector("img");
    if (img) {
      img.style.cursor = "pointer";
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        goToProduct(idToUse);
      });
    }

    container.appendChild(card);
  });
}

/* ================= HOMEPAGE PRODUCTS ================= */
const homeProductsEl = document.getElementById("homeProducts");

const homepageProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 2, name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 4, name: "Hair Oil", img: "images_brown/hairOil.png" },
  { id: 5, name: "Baby Body Butter", img: "images_brown/BabyBodyButter.png" },
];

if (homeProductsEl) {
  renderCards(homeProductsEl, homepageProducts, "home-card");
}

/* ================= LATEST PRODUCTS ================= */
const latestGrid = document.getElementById("latestProducts");

const latestProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 2, name: "Bright Aura Oil", img: "images_brown/bodyOil.png" },
  { id: 6, name: "Body Butter (Fruity)", img: "images_brown/bodyButter(Fruity).png" },
];

if (latestGrid) {
  renderCards(latestGrid, latestProducts, "latest-card");
}

/* ================= USER GREETING ================= */
const user = safeParseJSON("loggedInUser", null);

if (user) {
  const greet = document.getElementById("userGreeting");
  const logoutBtn = document.getElementById("logoutBtn");

  if (greet) greet.textContent = `Hi, ${user.username || "Guest"}`;
  if (logoutBtn) logoutBtn.classList.remove("hidden");
}

/* ================= HAMBURGER TOGGLE ================= */
const hamburger = document.getElementById("hamburger");
const mobileNav = document.getElementById("mobileNav");

if (hamburger && mobileNav) {
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    mobileNav.classList.toggle("active");
  });
}
