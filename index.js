/* PRELOADER */
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


/* FEATURED SLIDER */
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
  featuredName.style.opacity = "0";

  const next = featuredProducts[featuredIndex];

  preloadImage(next.img, () => {
    setTimeout(() => {
      featuredImg.src = next.img;
      featuredName.textContent = next.name;

      featuredImg.style.opacity = "1";
      featuredName.style.opacity = "1";

      featuredIndex = (featuredIndex + 1) % featuredProducts.length;
    }, 400);
  });
}

/* Initial load */
switchFeatured();

/* Auto switch */
setInterval(switchFeatured, 4500);


/* HOMEPAGE PRODUCTS */
const homeProducts = document.getElementById("homeProducts");

const homepageProducts = [
  { id: 1, name: "Body Butter", img: "images_brown/bodyButter.png" },
  { id: 4, name: "Body Oil", img: "images_brown/bodyOil.png" },
  { id: 5, name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
];

if (homeProducts) {
  homepageProducts.forEach(p => {
    const card = document.createElement("div");
    card.className = "home-card";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      <h4>${p.name}</h4>
    `;
    card.onclick = () => {
      localStorage.setItem("selectedProduct", p.id);
      location.href = "product-details.html";
    };
    homeProducts.appendChild(card);
  });
}


/* LATEST PRODUCTS */
const latestProducts = [
  { name: "Body Butter", img: "images_brown/bodyButter.png" },
  { name: "Hair Butter", img: "images_brown/hairButterfeat.png" },
  { name: "Body Oil", img: "images_brown/bodyOil.png" },
  { name: "Body Butter (Fruity)", img: "images_brown/bodyButter(Fruity).png" },
];

const latestGrid = document.getElementById("latestProducts");

if (latestGrid) {
  latestProducts.forEach(p => {
    const card = document.createElement("div");
    card.className = "latest-card";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      <h4>${p.name}</h4>
    `;
    latestGrid.appendChild(card);
  });
}

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
