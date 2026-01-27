/* ================= PRODUCT-DETAILS.JS (FULL UPDATED) =================
   Fixes:
   - Works even if header loads later (waits until header injected)
   - No crashes when counters/menu elements are missing
   - Graceful "No products" and "Product not found" messages
   - Updates wishlist/cart counters correctly
====================================================================== */

const PRODUCTS_KEY = "allProducts";
const WISHLIST_KEY = "wishlist";
const CART_KEY = "cart";

/* ================= SAFE JSON ================= */
function safeJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/* ================= GET PRODUCT ID ================= */
function getProductId() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  return Number.isFinite(id) ? id : NaN;
}

/* ================= ELEMENT GETTERS (SAFE) ================= */
function el(id) {
  return document.getElementById(id);
}

/* ================= COUNTS (SAFE) ================= */
function updateCounts(wishlist, cart) {
  const wishlistCount = el("wishlistCount");
  const cartCount = el("cartCount");

  const wishNum = Array.isArray(wishlist) ? wishlist.length : 0;
  const cartNum = Array.isArray(cart)
    ? cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
    : 0;

  if (wishlistCount) wishlistCount.textContent = wishNum;
  if (cartCount) cartCount.textContent = cartNum;
}

/* ================= HEADER MENU (SAFE) ================= */
function bindHamburger() {
  const menuToggle = el("menu-toggle");
  const navbarLinks = el("navbarLinks");

  if (!menuToggle || !navbarLinks) return;

  // prevent double binding if init runs twice
  if (menuToggle.dataset.bound === "1") return;
  menuToggle.dataset.bound = "1";

  menuToggle.addEventListener("click", () => {
    navbarLinks.classList.toggle("show");
  });
}

/* ================= RENDER HELPERS ================= */
function showMessage(msg) {
  const container = document.querySelector(".product-details");
  if (!container) {
    document.body.innerHTML = `<h2 style="padding:50px">${msg}</h2>`;
    return;
  }
  container.innerHTML = `<h2 style="padding:30px">${msg}</h2>`;
}

function renderProduct(product, wishlist) {
  const img = el("productImage");
  const nameEl = el("productName");
  const priceEl = el("productPrice");
  const descEl = el("productDescription");
  const featuresEl = el("productFeatures");
  const wishlistBtn = el("wishlistBtn");

  if (!img || !nameEl || !priceEl || !descEl || !featuresEl || !wishlistBtn) {
    // If your HTML IDs changed, you’ll see this message.
    showMessage("Page layout error: missing product detail elements.");
    return;
  }

  img.src = product.image;
  img.alt = product.name;
  nameEl.textContent = product.name;
  priceEl.textContent = `₦${Number(product.price).toLocaleString()}`;
  descEl.textContent = product.description || "";

  if (Array.isArray(product.features) && product.features.length > 0) {
    featuresEl.innerHTML = product.features.map(f => `<li>${f}</li>`).join("");
  } else {
    featuresEl.innerHTML = "";
  }

  wishlistBtn.style.color = wishlist.includes(product.id) ? "red" : "black";
}

/* ================= MAIN INIT ================= */
function init() {
  // Load data
  const products = safeJSON(PRODUCTS_KEY, []);
  let wishlist = safeJSON(WISHLIST_KEY, []);
  let cart = safeJSON(CART_KEY, []);

  if (!Array.isArray(wishlist)) wishlist = [];
  if (!Array.isArray(cart)) cart = [];

  // Update counts even before product renders
  updateCounts(wishlist, cart);

  // Hamburger (if header exists)
  bindHamburger();

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

  // Render product
  renderProduct(product, wishlist);

  // Buttons
  const wishlistBtn = el("wishlistBtn");
  const cartBtn = el("cartBtn");

  if (wishlistBtn) {
    wishlistBtn.onclick = () => {
      if (wishlist.includes(product.id)) {
        wishlist = wishlist.filter(id => id !== product.id);
      } else {
        wishlist.push(product.id);
      }
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
      wishlistBtn.style.color = wishlist.includes(product.id) ? "red" : "black";
      updateCounts(wishlist, cart);
    };
  }

  if (cartBtn) {
    cartBtn.onclick = () => {
      const item = cart.find(c => Number(c.id) === Number(product.id));
      if (item) item.qty = (Number(item.qty) || 0) + 1;
      else cart.push({ ...product, qty: 1 });

      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      updateCounts(wishlist, cart);
    };
  }
}

/**
 * Because header.js injects HTML, some header elements may not exist immediately.
 * We init once DOM is ready, then retry a few times to bind hamburger + counts after header injection.
 */
document.addEventListener("DOMContentLoaded", () => {
  init();

  // Re-bind header-related elements shortly after injection
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    bindHamburger();
    // update counts again in case header counters appeared after injection
    const wishlist = safeJSON(WISHLIST_KEY, []);
    const cart = safeJSON(CART_KEY, []);
    updateCounts(Array.isArray(wishlist) ? wishlist : [], Array.isArray(cart) ? cart : []);
    if (tries >= 10) clearInterval(t);
  }, 150);
});
