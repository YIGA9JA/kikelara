/* ================= INDEX.JS (FULL UPDATED) =================
   What’s fixed/added:
   ✅ Preloader (first visit only) kept
   ✅ Featured slider kept
   ✅ Home products: image/card click goes to product-details.html?id=ID
   ✅ Latest products: now ALSO clickable and goes to product-details.html?id=ID
   ✅ Uses querystring id (recommended) instead of localStorage selectedProduct
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
  // ✅ Go to product details using URL param (works with your product-details.js)
  window.location.href = `product-details.html?id=${id}`;
}

/* ================= FEATURED SLIDER ================= */
/* SMART FEATURED SLIDER */
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

/* ================= HOMEPAGE PRODUCTS ================= */
const homeProducts = document.getElementById("homeProducts");

const homepageProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 2, name: "Body Oil", img: "images_brown/bodyOil.png" }, // ✅ fixed id (was 4 in your code)
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" }, // ✅ fixed id (was 5 in your code)
 { id: 4, name: "Hair Oil",img: "images_brown/hairOil.png"  },
  { id: 5, name: "Baby Body Butter", img: "images_brown/BabyBodyButter.png"},
];

if (homeProducts) {
  homepageProducts.forEach((p) => {
    const card = document.createElement("div");
    card.className = "home-card";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}" loading="lazy" class="clickable-img">
      <h4>${p.name}</h4>
    `;

    // ✅ make whole card clickable
    card.style.cursor = "pointer";
    card.addEventListener("click", () => goToProduct(p.id));

    // ✅ also ensure image itself is clickable (even if you change card behavior later)
    const img = card.querySelector("img");
    if (img) {
      img.style.cursor = "pointer";
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        goToProduct(p.id);
      });
    }

    homeProducts.appendChild(card);
  });
}

/* ================= LATEST PRODUCTS =================
   IMPORTANT:
   These items MUST have valid product IDs that exist in localStorage(allProducts).
   I added ids based on your defaultProducts list.
*/
const latestProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 3, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { id: 2, name: "Body Oil", img: "images_brown/bodyOil.png" },
  { id: 6, name: "Body Butter (Fruity)", img: "images_brown/bodyButter(Fruity).png" },
];

const latestGrid = document.getElementById("latestProducts");

if (latestGrid) {
  latestProducts.forEach((p) => {
    const card = document.createElement("div");
    card.className = "latest-card";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}" loading="lazy" class="clickable-img">
      <h4>${p.name}</h4>
    `;

    // ✅ clickable latest card
    card.style.cursor = "pointer";
    card.addEventListener("click", () => goToProduct(p.id));

    // ✅ clickable image
    const img = card.querySelector("img");
    if (img) {
      img.style.cursor = "pointer";
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        goToProduct(p.id);
      });
    }

    latestGrid.appendChild(card);
  });
}

/* ================= USER GREETING ================= */
const user = JSON.parse(localStorage.getItem("loggedInUser"));

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
