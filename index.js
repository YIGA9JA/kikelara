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
  { name: "", img: "images/ad4.JPG" },
  { name: "", img: "images/ad7.png" },
 { name: "", img: "images/ad8.png" },
  { name: "", img: "images/ad9.png" },
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
  { id: 1, name: "Body Butter", img: "images/bodyButter.JPG" },
  { id: 4, name: "Body Oil", img: "images/bodyOil.JPG" },
  { id: 5, name: "Hair Butter", img: "images/hairButterfeat.JPG" },
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
  { name: "Body Butter", img: "images/bodyButter.JPG" },
    { name: "Hair Butter", img: "images/hairButterfeat.JPG" },
  { name: "Body Oil", img: "images/bodyOil.JPG" },
  { name: "Body Butter (Fruity)", img: "images/bodyButter(Fruity).png" },

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
  document.getElementById("userGreeting").textContent =
    `Hi, ${user.username || "Guest"}`;
  document.getElementById("logoutBtn").classList.remove("hidden");
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
