const products = JSON.parse(localStorage.getItem("allProducts")) || [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];

const productsGrid = document.getElementById("productsGrid");
const wishlistCount = document.getElementById("wishlistCount");
const cartCount = document.getElementById("cartCount");
const categorySelect = document.getElementById("categorySelect");
const sortSelect = document.getElementById("sortSelect");

function renderProducts() {
  productsGrid.innerHTML = "";
  let filtered = [...products];

  // Filter
  const cat = categorySelect.value;
  if (cat !== "all") filtered = filtered.filter(p => p.category === cat);

  // Sort
  const sortVal = sortSelect.value;
  if (sortVal === "priceLow") filtered.sort((a,b)=>a.price-b.price);
  else if (sortVal === "priceHigh") filtered.sort((a,b)=>b.price-a.price);
  else if (sortVal === "name") filtered.sort((a,b)=>a.name.localeCompare(b.name));

  filtered.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
   <div class="product-image-wrapper">
  <img 
    src="${product.image}" 
    alt="${product.name}" 
    loading="lazy"
    class="clickable-image"
    onclick="goToProduct(${product.id})"
  >

      <!-- ICON ROW -->
      <div class="product-actions-row">

        <!-- WISHLIST -->
        <button class="wishlist-btn"
          onclick="toggleWishlist(${product.id}, this)">♥</button>

        <!-- QUANTITY -->
        <div class="quantity inline-qty">
          <button onclick="changeQty(this, -1)">-</button>
          <input type="number" value="1" min="1">
          <button onclick="changeQty(this, 1)">+</button>
        </div>

        <!-- CART -->
        <button class="cart-btn"
          onclick="addToCart(${product.id}, this)">🛒</button>

      </div>

      <h4>${product.name}</h4>
      <p class="price">₦${product.price.toLocaleString()}</p>
    `;

    productsGrid.appendChild(card);
  });

  updateCounts();
}

function changeQty(btn, delta){
  const input = btn.parentElement.querySelector("input");
  let val = parseInt(input.value) + delta;
  if (val < 1) val = 1;
  input.value = val;
}

function addToCart(id, btn){
  const card = btn.closest(".product-card");
  const qty = parseInt(card.querySelector("input").value) || 1;

  const existing = cart.find(p => p.id === id);
  if (existing) existing.qty += qty;
  else {
    const product = products.find(p => p.id === id);
    cart.push({ ...product, qty });
  }

  localStorage.setItem("cart", JSON.stringify(cart));

  // UI feedback only
  btn.textContent = "✓";
  btn.disabled = true;

  updateCounts();
}

function toggleWishlist(id, btn){
  const index = wishlist.findIndex(p => p.id === id);

  if (index > -1) {
    wishlist.splice(index, 1);
    btn.style.color = "black";
  } else {
    const product = products.find(p => p.id === id);
    wishlist.push(product);
    btn.style.color = "crimson";
  }

  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  updateCounts();
}

function updateCounts(){
  cartCount.textContent = cart.reduce((sum, i) => sum + i.qty, 0);
  wishlistCount.textContent = wishlist.length;
}

categorySelect.addEventListener("change", renderProducts);
sortSelect.addEventListener("change", renderProducts);

renderProducts();


function goToProduct(id) {
  window.location.href = `product-details.html?id=${id}`;
}
