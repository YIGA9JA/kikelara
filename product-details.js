/* ================= PRODUCT-DETAILS.JS (PREMIUM + MULTI IMAGE GALLERY + CART STATE) ================= */

const PRODUCTS_KEY = "allProducts";
const CART_KEY = "cart";

/* SAFE JSON */
function safeJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  return Number.isFinite(id) ? id : NaN;
}

function el(id) {
  return document.getElementById(id);
}

/* MULTI-IMAGE SUPPORT (still supports old `image:`) */
function getProductImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (typeof p.image === "string" && p.image.trim()) return [p.image];
  return [];
}

/* CART */
function loadCart() {
  const c = safeJSON(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function isInCart(cart, id) {
  return cart.some(i => Number(i.id) === Number(id));
}

function addToCartOnce(product) {
  const cart = loadCart();
  if (isInCart(cart, product.id)) return;
  cart.push({ ...product, qty: 1 });
  saveCart(cart);
}

/* HEADER COUNTS (SAFE) */
function updateHeaderCartCount() {
  const cartCount = el("cartCount");
  if (!cartCount) return;

  const cart = loadCart();
  const total = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  cartCount.textContent = total;

  const wishlistCount = el("wishlistCount");
  if (wishlistCount) wishlistCount.textContent = "0";
}

/* UI HELPERS */
function showMessage(msg) {
  const container = document.querySelector(".pd");
  if (!container) {
    document.body.innerHTML = `<h2 style="padding:50px">${msg}</h2>`;
    return;
  }
  container.innerHTML = `<h2 style="padding:30px">${msg}</h2>`;
}

/* Ingredients fallback */
function guessIngredientsText(product) {
  const d = (product.description || "").trim();
  if (!d) return "—";
  return d;
}

/* Benefits + How-to presets */
function getPresetDetails(category) {
  const c = (category || "").toLowerCase();

  if (c.includes("oil")) {
    return {
      benefits: [
        "Boosts glow and improves the look of dull skin",
        "Helps lock in moisture for a softer feel",
        "Supports an even-looking skin tone"
      ],
      howto: [
        "Warm 2–4 drops between palms",
        "Press onto slightly damp skin after bath",
        "Use daily (morning or night) for best results"
      ]
    };
  }

  if (c.includes("serum") || c.includes("hair")) {
    return {
      benefits: [
        "Softens and conditions for a healthy look",
        "Helps reduce dryness and rough texture",
        "Leaves a smooth, luxurious finish"
      ],
      howto: [
        "Apply a small amount to palms",
        "Massage into hair or targeted dry areas",
        "Use 3–5 times weekly or as needed"
      ]
    };
  }

  return {
    benefits: [
      "Deep moisture for supple, radiant-looking skin",
      "Rich texture that absorbs with a luxe feel",
      "Helps smooth the look of dry, flaky areas"
    ],
    howto: [
      "Apply generously to clean skin",
      "Focus on elbows, knees, and dry patches",
      "Use daily for best results"
    ]
  };
}

function renderList(listEl, items) {
  if (!listEl) return;
  listEl.innerHTML = "";
  (items || []).forEach(text => {
    const li = document.createElement("li");
    li.textContent = text;
    listEl.appendChild(li);
  });
}

/* Same cart button style behavior */
function setCartButtonState(inCart) {
  const btn = el("cartBtn");
  const flag = el("productInCart");
  const viewCart = el("viewCartLink");

  if (!btn) return;

  if (inCart) {
    btn.textContent = "ADDED";
    btn.classList.add("is-added");
    if (flag) flag.style.display = "inline-flex";
    if (viewCart) viewCart.style.display = "inline-flex";
  } else {
    btn.textContent = "ADD TO CART";
    btn.classList.remove("is-added");
    if (flag) flag.style.display = "none";
    if (viewCart) viewCart.style.display = "none";
  }
}

/* GALLERY */
function renderGallery(images, activeIndex = 0) {
  const mainImg = el("productImage");
  const thumbsWrap = el("productThumbs");
  if (!mainImg || !images || images.length === 0) return;

  // main image
  mainImg.src = images[activeIndex] || images[0];
  mainImg.alt = "Product image";

  // thumbs
  if (!thumbsWrap) return;
  thumbsWrap.innerHTML = "";

  images.forEach((src, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pd-thumb" + (idx === activeIndex ? " active" : "");
    b.innerHTML = `<img src="${src}" alt="thumbnail ${idx + 1}" draggable="false">`;
    b.addEventListener("click", () => renderGallery(images, idx));
    thumbsWrap.appendChild(b);
  });
}

/* INIT */
function init() {
  const products = safeJSON(PRODUCTS_KEY, []);
  if (!Array.isArray(products) || products.length === 0) {
    showMessage("No products found.");
    return;
  }

  const productId = getProductId();
  if (!Number.isFinite(productId)) {
    showMessage("Invalid product link.");
    return;
  }

  const product = products.find(p => Number(p.id) === productId);
  if (!product) {
    showMessage("Product not found.");
    return;
  }

  // basics
  const nameEl = el("productName");
  const priceEl = el("productPrice");
  const descEl = el("productDescription");
  const catEl = el("productCategory");

  if (nameEl) nameEl.textContent = product.name || "";
  if (priceEl) priceEl.textContent = `₦${Number(product.price || 0).toLocaleString()}`;
  if (descEl) descEl.textContent = product.description || "";
  if (catEl) catEl.textContent = String(product.category || "Product").toUpperCase();

  // gallery
  const images = getProductImages(product);

  // ✅ Ensure 4 pics even if only 1 exists (uses same one repeated)
  const gallery = (images.length >= 4)
    ? images.slice(0, 4)
    : Array.from({ length: 4 }, (_, i) => images[i] || images[0] || product.image);

  renderGallery(gallery, 0);

  // panels
  const ingredientsEl = el("productIngredients");
  if (ingredientsEl) ingredientsEl.textContent = product.ingredients || guessIngredientsText(product);

  const preset = getPresetDetails(product.category);
  renderList(el("productBenefits"), product.benefits || preset.benefits);
  renderList(el("productHowToUse"), product.howToUse || preset.howto);

  // cart
  const cart = loadCart();
  setCartButtonState(isInCart(cart, product.id));
  updateHeaderCartCount();

  const btn = el("cartBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      addToCartOnce(product);
      setCartButtonState(true);
      updateHeaderCartCount();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  // header inject safety
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    updateHeaderCartCount();
    if (tries >= 10) clearInterval(t);
  }, 150);
});
