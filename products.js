/* ================= LOAD / SEED PRODUCTS ================= */
const defaultProducts = [
  {
    id: 1,
    name: "Body Butter",
    category: "Body",
    price: 10000,
    discount: 15,
    image: "images/bodyButter.JPG",
    description: "Shea Butter, Almond Oil, Mango Butter, Cocoa Butter, Glycerin."
  },
  {
    id: 2,
    name: "Bright Aura Oil",
    category: "Oil",
    price: 10000,
    discount: 0,
    image: "images/bodyOil.JPG",
    description: "Jojoba Oil, Carrot Oil, Palm Kernel Oil, Almond Oil, Vitamin E."
  },
  {
    id: 3,
    name: "Hair Butter",
    category: "Serum",
    price: 5500,
    discount: 0,
    image: "images/hairButter.png",
    description: "Strengthens and moisturizes hair deeply."
  },
  {
    id: 4,
    name: "Hair Oil",
    category: "Serum",
    price: 7500,
    discount: 0,
    image: "images/hairOil1.JPG",
    description: "Locks in moisture. Jojoba Oil, Castor Oil, Argan Oil, Vitamin E."
  },
  {
    id: 5,
    name: "Baby Body Butter",
    category: "Body",
    price: 10000,
    discount: 0,
    image: "images/BabyBodyButter.png",
    description: "Gentle care, naturally."
  },
  {
    id: 6,
    name: "Fruity Body Butter",
    category: "Body",
    price: 10000,
    discount: 0,
    image: "images/BabyBodyButter.png",
    description: "Whisper of fruity freshness. Gentle care, naturally."
  },
  {
    id: 7,
    name: "Glow Elixir Oil",
    category: "Oil",
    price: 8500,
    discount: 0,
    image: "images/bodyOil.JPG",
    description: "Jojoba Oil, Carrot Oil, Palm Kernel Oil, Almond Oil, Vitamin E."
  }
];

// Load from localStorage if exists, else seed
let products = JSON.parse(localStorage.getItem("allProducts"));
if (!products || products.length === 0) {
  products = defaultProducts;
  localStorage.setItem("allProducts", JSON.stringify(products));
}

/* ================= STATE ================= */
let wishlist = JSON.parse(localStorage.getItem("wishlist")) || []; // IDs only
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentList = products; // used for sorting filtered results

/* ================= ELEMENTS ================= */
const grid = document.getElementById("productsGrid");
const wishlistCount = document.getElementById("wishlistCount");
const cartCount = document.getElementById("cartCount");
const categorySelect = document.getElementById("categorySelect");
const sortSelect = document.getElementById("sortSelect");

/* ================= POPULATE CATEGORIES (DIRECT FROM PRODUCTS) ================= */
function populateCategories() {
  // Reset to only "All"
  categorySelect.innerHTML = `<option value="all">All</option>`;

  const categories = [...new Set(products.map(p => p.category))]; // ["Body","Oil","Serum"]
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;        // MUST match exactly
    opt.textContent = cat;  // display
    categorySelect.appendChild(opt);
  });
}

/* ================= RENDER PRODUCTS ================= */
function renderProducts(list = products) {
  currentList = list; // keep track of what user is viewing
  grid.innerHTML = "";

  list.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";

    const isWishlisted = wishlist.includes(p.id);

    card.innerHTML = `
      ${p.discount ? `<span class="discount">-${p.discount}%</span>` : ""}

      <div class="product-image-wrapper">
        <img src="${p.image}" alt="${p.name}" class="clickable-image">
      </div>

      <h4>${p.name}</h4>
      <p class="price">₦${p.price.toLocaleString()}</p>

      <div class="product-actions-row">
        <button class="wishlist-btn" aria-label="Add to wishlist">
          ${isWishlisted ? "♥" : "♡"}
        </button>
        <button class="cart-btn" aria-label="Add to cart">🛒</button>
      </div>
    `;

    // Navigate only on image tap
    card.querySelector("img").onclick = () => {
      window.location.href = `product-details.html?id=${p.id}`;
    };

    // Wishlist
    card.querySelector(".wishlist-btn").onclick = e => {
      e.stopPropagation();
      toggleWishlist(p.id);
    };

    // Cart
    card.querySelector(".cart-btn").onclick = e => {
      e.stopPropagation();
      addToCart(p.id, e.target);
    };

    grid.appendChild(card);
  });

  updateCounts();
}

/* ================= FILTERS ================= */
categorySelect.addEventListener("change", () => {
  const val = categorySelect.value;

  const filtered = val === "all"
    ? products
    : products.filter(p => p.category === val);

  renderProducts(filtered);

  // Reset sort to default whenever category changes (optional but clean)
  sortSelect.value = "default";
});

sortSelect.addEventListener("change", () => {
  if (sortSelect.value === "default") {
    // re-render current category selection without sorting
    const val = categorySelect.value;
    const filtered = val === "all"
      ? products
      : products.filter(p => p.category === val);

    renderProducts(filtered);
    return;
  }

  let sorted = [...currentList];

  if (sortSelect.value === "priceLow") sorted.sort((a, b) => a.price - b.price);
  if (sortSelect.value === "priceHigh") sorted.sort((a, b) => b.price - a.price);
  if (sortSelect.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));

  renderProducts(sorted);
});

/* ================= WISHLIST ================= */
function toggleWishlist(id) {
  wishlist = wishlist.includes(id)
    ? wishlist.filter(w => w !== id)
    : [...wishlist, id];

  localStorage.setItem("wishlist", JSON.stringify(wishlist));

  // Re-render current list so hearts update without losing filter
  renderProducts(currentList);
}

/* ================= CART ================= */
function addToCart(id, btn) {
  const product = products.find(p => p.id === id);
  const item = cart.find(c => c.id === id);

  item ? item.qty++ : cart.push({ ...product, qty: 1 });

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCounts();

  // Mobile-friendly feedback
  const old = btn.textContent;
  btn.textContent = "✓";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 700);
}

/* ================= COUNTS ================= */
function updateCounts() {
  wishlistCount.textContent = wishlist.length;
  cartCount.textContent = cart.reduce((t, i) => t + i.qty, 0);
}

/* ================= INIT ================= */
populateCategories();
renderProducts();
updateCounts();
