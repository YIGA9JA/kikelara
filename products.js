/* ================= PRODUCTS.JS (FRONTEND) =================
   ✅ GET /api/products
   ✅ For each product: GET /api/products/:id/reviews/summary
   ✅ Resolves /uploads/... using API_BASE
   ✅ Safe rendering (no unsafe innerHTML from user content)
=========================================================== */

const API_BASE = (window.API_BASE || "https://kikelara1.onrender.com").replace(/\/+$/, "");
const PRODUCTS_KEY = "allProducts";
const CART_KEY = "cart";

function el(id) { return document.getElementById(id); }

function safeJSONSession(key, fallback) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key));
    return v ?? fallback;
  } catch { return fallback; }
}
function saveJSONSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function resolveImage(url) {
  const u = String(url || "").trim();
  if (!u) return "images_brown/bodyButter.png";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/uploads/")) return `${API_BASE}${u}`;
  return u; // e.g. local images/...
}

function starsText(rating) {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
}

function formatNaira(n) {
  const v = Number(n || 0);
  return `₦${v.toLocaleString()}`;
}

async function fetchProducts() {
  const r = await fetch(`${API_BASE}/api/products`, { cache: "no-store" });
  const data = await r.json().catch(() => []);
  if (!r.ok) throw new Error("Failed to load products");
  return Array.isArray(data) ? data : [];
}

async function fetchReviewSummary(productId) {
  const r = await fetch(`${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews/summary`, { cache: "no-store" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) return { avg: 0, count: 0 };
  return { avg: Number(data.summary?.avg || 0), count: Number(data.summary?.count || 0) };
}

/* --- small concurrency limiter so you don't spam the server --- */
async function mapLimit(list, limit, mapper) {
  const out = new Array(list.length);
  let i = 0;

  async function worker() {
    while (i < list.length) {
      const idx = i++;
      try { out[idx] = await mapper(list[idx], idx); }
      catch { out[idx] = null; }
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
  await Promise.all(workers);
  return out;
}

/* --- cart helpers (optional) --- */
function loadCart() {
  const c = safeJSONSession(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCart(cart) { try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} }
function isInCart(cart, id) { return cart.some(i => String(i.id) === String(id)); }

function addToCartOnce(p) {
  const cart = loadCart();
  if (isInCart(cart, p.id)) return;
  cart.push({ id: p.id, name: p.name, price: p.price, image: p.image_url || "", qty: 1 });
  saveCart(cart);
}

/* --- UI --- */
function renderProducts(list, summariesById) {
  const grid = el("productsGrid");
  if (!grid) return;

  grid.innerHTML = ""; // safe because we control all nodes we append

  list.forEach(p => {
    const id = p.id;
    const img = resolveImage(p.image_url || (Array.isArray(p.images) ? p.images[0] : ""));

    const sum = summariesById.get(String(id)) || { avg: 0, count: 0 };
    const avgRounded = Math.round(sum.avg || 0);

    const card = document.createElement("article");
    card.className = "p-card";

    const imgWrap = document.createElement("a");
    imgWrap.className = "p-img";
    imgWrap.href = `product-details.html?id=${encodeURIComponent(id)}`;

    const image = document.createElement("img");
    image.src = img;
    image.alt = String(p.name || "Product");
    image.loading = "lazy";
    image.decoding = "async";
    imgWrap.appendChild(image);

    const body = document.createElement("div");
    body.className = "p-body";

    const name = document.createElement("h3");
    name.className = "p-name";
    name.textContent = String(p.name || "");

    const price = document.createElement("div");
    price.className = "p-price";
    price.textContent = formatNaira(p.price);

    const rating = document.createElement("div");
    rating.className = "p-rating";
    rating.textContent = `${starsText(avgRounded)}  (${sum.count || 0})`;

    const actions = document.createElement("div");
    actions.className = "p-actions";

    const viewBtn = document.createElement("a");
    viewBtn.className = "p-btn p-btn-ghost";
    viewBtn.href = `product-details.html?id=${encodeURIComponent(id)}`;
    viewBtn.textContent = "View";

    const cartBtn = document.createElement("button");
    cartBtn.type = "button";
    cartBtn.className = "p-btn";
    cartBtn.textContent = "Add to cart";
    cartBtn.addEventListener("click", () => {
      addToCartOnce(p);
      cartBtn.textContent = "Added";
      cartBtn.disabled = true;
    });

    actions.appendChild(viewBtn);
    actions.appendChild(cartBtn);

    body.appendChild(name);
    body.appendChild(price);
    body.appendChild(rating);
    body.appendChild(actions);

    card.appendChild(imgWrap);
    card.appendChild(body);

    grid.appendChild(card);
  });
}

async function init() {
  const grid = el("productsGrid");
  if (grid) grid.innerHTML = `<div style="padding:18px">Loading products…</div>`;

  const products = await fetchProducts();

  // cache like you already do
  saveJSONSession(PRODUCTS_KEY, products);

  // fetch summaries (limit concurrency)
  const sums = await mapLimit(products, 6, async (p) => {
    const s = await fetchReviewSummary(p.id);
    return { id: String(p.id), s };
  });

  const map = new Map();
  sums.forEach(x => { if (x && x.id) map.set(x.id, x.s); });

  renderProducts(products, map);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => {
    const grid = el("productsGrid");
    if (grid) grid.innerHTML = `<div style="padding:18px">Failed to load products.</div>`;
    console.error(e);
  });
});
