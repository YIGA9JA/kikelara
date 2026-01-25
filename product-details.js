// ================= LOAD PRODUCTS =================
let products = JSON.parse(localStorage.getItem("allProducts")) || [];

if (!products.length) {
  document.body.innerHTML = "<h2 style='padding:50px'>No products found</h2>";
  throw new Error("No products stored");
}

let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// ================= ELEMENTS =================
const wishlistCount = document.getElementById("wishlistCount");
const cartCount = document.getElementById("cartCount");
const img = document.getElementById("productImage");
const nameEl = document.getElementById("productName");
const priceEl = document.getElementById("productPrice");
const descEl = document.getElementById("productDescription");
const featuresEl = document.getElementById("productFeatures");
const wishlistBtn = document.getElementById("wishlistBtn");
const cartBtn = document.getElementById("cartBtn");
const menuToggle = document.getElementById("menu-toggle");
const navbarLinks = document.getElementById("navbarLinks");

// ================= GET PRODUCT ID =================
const params = new URLSearchParams(window.location.search);
const productId = Number(params.get("id"));
const product = products.find(p => p.id === productId);

if (!product) {
  document.body.innerHTML = "<h2 style='padding:50px'>Product not found</h2>";
  throw new Error("Product not found");
}

// ================= RENDER PRODUCT =================
function renderProduct() {
  img.src = product.image;
  img.alt = product.name;
  nameEl.textContent = product.name;
  priceEl.textContent = `₦${product.price.toLocaleString()}`;
  descEl.textContent = product.description;

  if (product.features && product.features.length > 0) {
    featuresEl.innerHTML = product.features.map(f => `<li>${f}</li>`).join("");
  } else {
    featuresEl.innerHTML = "";
  }

  // Wishlist button color
  wishlistBtn.style.color = wishlist.includes(product.id) ? "red" : "black";
}

// ================= WISHLIST =================
wishlistBtn.onclick = () => {
  if (wishlist.includes(product.id)) {
    wishlist = wishlist.filter(id => id !== product.id);
    wishlistBtn.style.color = "black";
  } else {
    wishlist.push(product.id);
    wishlistBtn.style.color = "red";
  }
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  updateCounts();
};

// ================= CART =================
cartBtn.onclick = () => {
  const item = cart.find(c => c.id === product.id);
  if (item) item.qty++;
  else cart.push({ ...product, qty: 1 });
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCounts();
};

// ================= COUNTS =================
function updateCounts() {
  wishlistCount.textContent = wishlist.length;
  cartCount.textContent = cart.reduce((sum, item) => sum + item.qty, 0);
}

// ================= HAMBURGER TOGGLE =================
menuToggle.addEventListener("click", () => {
  navbarLinks.classList.toggle("show");
});

// ================= INIT =================
renderProduct();
updateCounts();
