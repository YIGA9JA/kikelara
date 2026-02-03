/* ================= PRODUCT-DETAILS.JS (GALLERY + CART + JUMLA-LIKE REVIEWS) ================= */

const PRODUCTS_KEY = "allProducts";
const CART_KEY = "cart";
const REVIEWS_KEY = "productReviews_v1"; // same key you already used
const DEVICE_ID_KEY = "reviewDeviceId_v1";

/* ---------- SAFE JSON ---------- */
function safeJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function el(id) { return document.getElementById(id); }

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id"));
  return Number.isFinite(id) ? id : NaN;
}

/* ---------- Device id (for helpful votes) ---------- */
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/* ---------- Product images ---------- */
function getProductImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (typeof p.image === "string" && p.image.trim()) return [p.image];
  return [];
}

/* ================= CART ================= */
function loadCart() {
  const c = safeJSON(CART_KEY, []);
  return Array.isArray(c) ? c : [];
}
function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
function isInCart(cart, id) { return cart.some(i => Number(i.id) === Number(id)); }
function addToCartOnce(product) {
  const cart = loadCart();
  if (isInCart(cart, product.id)) return;
  cart.push({ ...product, qty: 1 });
  saveCart(cart);
}
function updateHeaderCartCount() {
  const cartCount = el("cartCount");
  if (!cartCount) return;

  const cart = loadCart();
  const total = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  cartCount.textContent = total;

  const wishlistCount = el("wishlistCount");
  if (wishlistCount) wishlistCount.textContent = "0";
}

/* ================= UI HELPERS ================= */
function showMessage(msg) {
  const container = document.querySelector(".pd");
  if (!container) {
    document.body.innerHTML = `<h2 style="padding:50px">${msg}</h2>`;
    return;
  }
  container.innerHTML = `<h2 style="padding:30px">${msg}</h2>`;
}

function guessIngredientsText(product) {
  const d = (product.description || "").trim();
  return d || "—";
}

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

/* ================= GALLERY ================= */
function renderGallery(images, activeIndex = 0) {
  const mainImg = el("productImage");
  const thumbsWrap = el("productThumbs");
  if (!mainImg || !images || images.length === 0) return;

  mainImg.src = images[activeIndex] || images[0];
  mainImg.alt = "Product image";

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

/* ================= REVIEWS DATA ================= */
function loadAllReviews() {
  const obj = safeJSON(REVIEWS_KEY, {});
  return obj && typeof obj === "object" ? obj : {};
}
function saveAllReviews(obj) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(obj));
}
function loadReviewsForProduct(productId) {
  const all = loadAllReviews();
  const list = all[String(productId)];
  return Array.isArray(list) ? list : [];
}
function saveReviewsForProduct(productId, list) {
  const all = loadAllReviews();
  all[String(productId)] = list;
  saveAllReviews(all);
}

/* Backward compatible normalize (old reviews -> new fields) */
function normalizeReview(r) {
  return {
    id: r.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: (r.name || "Anonymous").toString(),
    title: (r.title || "").toString(),
    text: (r.text || "").toString(),
    rating: Number(r.rating) || 0,
    createdAt: r.createdAt || new Date().toISOString(),
    verified: Boolean(r.verified),
    votes: r.votes && typeof r.votes === "object"
      ? r.votes
      : { up: 0, down: 0, by: {} }
  };
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function starsText(rating) {
  const r = clamp(Number(rating) || 0, 0, 5);
  return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
}

function calcAverage(list) {
  if (!list.length) return 0;
  const sum = list.reduce((a, r) => a + (Number(r.rating) || 0), 0);
  return sum / list.length;
}

function breakdownCounts(list) {
  const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  list.forEach(r => {
    const k = clamp(Number(r.rating) || 0, 1, 5);
    counts[k] += 1;
  });
  return counts;
}

/* ================= VERIFIED PURCHASE (simple local check) =================
   If you have an orders system later, we can make this 100% accurate.
   For now: verified if product exists in cart OR in any saved orders keys.
*/
function isVerifiedPurchase(productId) {
  // cart check
  const cart = loadCart();
  if (cart.some(i => Number(i.id) === Number(productId))) return true;

  // optional order keys (if you already store orders anywhere)
  const possibleOrderKeys = ["orders", "orders_backup", "orders_backup_v1", "orders_backup_v2", "localOrders"];
  for (const k of possibleOrderKeys) {
    const orders = safeJSON(k, []);
    if (Array.isArray(orders)) {
      // accept both {items:[{id}]} or flat arrays
      const found = orders.some(o => {
        if (Array.isArray(o?.items)) return o.items.some(it => Number(it.id) === Number(productId));
        return Number(o?.id) === Number(productId);
      });
      if (found) return true;
    }
  }

  return false;
}

/* ================= REVIEWS UI STATE ================= */
let rvAll = [];
let rvFilteredStar = 0;     // 0 = all
let rvSortMode = "recent";  // recent/helpful/high/low
let rvShown = 5;            // pagination
const RV_PAGE_SIZE = 5;

function setStarUI(value) {
  const stars = document.querySelectorAll("#starInput .star");
  stars.forEach(btn => {
    const v = Number(btn.dataset.value);
    if (v <= value) btn.classList.add("is-on");
    else btn.classList.remove("is-on");
  });

  const hint = el("rvHint");
  if (hint) hint.textContent = value ? `${value} star${value === 1 ? "" : "s"}` : "Select a rating";
}

function renderSummary(list) {
  const avgEl = el("rvAvg");
  const avgStarsEl = el("rvAvgStars");
  const countEl = el("rvCount");
  const breakdownEl = el("rvBreakdown");

  const total = list.length;
  const avg = total ? calcAverage(list) : 0;
  const avg1 = Math.round(avg * 10) / 10;

  if (avgEl) avgEl.textContent = avg1.toFixed(1);
  if (avgStarsEl) avgStarsEl.textContent = starsText(Math.round(avg));
  if (countEl) countEl.textContent = `${total} rating${total === 1 ? "" : "s"}`;

  if (!breakdownEl) return;
  breakdownEl.innerHTML = "";

  const counts = breakdownCounts(list);
  for (let star = 5; star >= 1; star--) {
    const c = counts[star];
    const pct = total ? Math.round((c / total) * 100) : 0;

    const row = document.createElement("div");
    row.className = "rv-bar-row";
    row.innerHTML = `
      <div class="rv-bar-label">${star}★</div>
      <div class="rv-bar-track">
        <div class="rv-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="rv-bar-count">${c}</div>
    `;
    breakdownEl.appendChild(row);
  }
}

function helpfulScore(r) {
  const up = Number(r?.votes?.up) || 0;
  const down = Number(r?.votes?.down) || 0;
  return up - down;
}

function getDisplayList() {
  let list = [...rvAll];

  if (rvFilteredStar) {
    list = list.filter(r => Number(r.rating) === Number(rvFilteredStar));
  }

  if (rvSortMode === "recent") {
    list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (rvSortMode === "high") {
    list.sort((a,b) => (b.rating - a.rating) || (new Date(b.createdAt) - new Date(a.createdAt)));
  } else if (rvSortMode === "low") {
    list.sort((a,b) => (a.rating - b.rating) || (new Date(b.createdAt) - new Date(a.createdAt)));
  } else if (rvSortMode === "helpful") {
    list.sort((a,b) => (helpfulScore(b) - helpfulScore(a)) || (new Date(b.createdAt) - new Date(a.createdAt)));
  }

  return list;
}

function renderListUI(productId) {
  const wrap = el("reviewsList");
  const moreBtn = el("rvMoreBtn");
  if (!wrap) return;

  const list = getDisplayList();
  const visible = list.slice(0, rvShown);

  if (!visible.length) {
    wrap.innerHTML = `<div class="rv-empty">No reviews for this filter yet.</div>`;
    if (moreBtn) moreBtn.hidden = true;
    return;
  }

  wrap.innerHTML = "";
  visible.forEach(r => {
    const up = Number(r?.votes?.up) || 0;
    const down = Number(r?.votes?.down) || 0;

    const item = document.createElement("div");
    item.className = "rv-item";
    item.dataset.id = r.id;

    item.innerHTML = `
      <div class="rv-item-top">
        <div class="rv-item-left">
          <div class="rv-item-stars">${starsText(r.rating)}</div>
          ${r.title ? `<div class="rv-item-title">${escapeHtml(r.title)}</div>` : ``}
        </div>

        <div class="rv-item-meta">
          <span class="rv-item-name">${escapeHtml(r.name || "Anonymous")}</span>
          ${r.verified ? `<span class="rv-badge">Verified purchase</span>` : ``}
          <span class="rv-item-date">${formatDate(r.createdAt)}</span>
        </div>
      </div>

      <div class="rv-item-text">${escapeHtml(r.text || "")}</div>

      <div class="rv-item-actions">
        <button type="button" class="rv-vote" data-vote="up">
          Helpful <span class="rv-vnum">(${up})</span>
        </button>
        <button type="button" class="rv-vote" data-vote="down">
          Not helpful <span class="rv-vnum">(${down})</span>
        </button>
      </div>
    `;

    item.querySelectorAll(".rv-vote").forEach(btn => {
      btn.addEventListener("click", () => {
        voteReview(productId, r.id, btn.dataset.vote);
      });
    });

    wrap.appendChild(item);
  });

  if (moreBtn) {
    moreBtn.hidden = rvShown >= list.length;
  }
}

function voteReview(productId, reviewId, voteType) {
  const deviceId = getDeviceId();
  voteType = (voteType === "up" || voteType === "down") ? voteType : "up";

  let list = loadReviewsForProduct(productId).map(normalizeReview);

  const idx = list.findIndex(r => r.id === reviewId);
  if (idx === -1) return;

  const r = list[idx];
  r.votes = r.votes || { up: 0, down: 0, by: {} };
  r.votes.by = r.votes.by || {};

  const prev = r.votes.by[deviceId];

  // If same vote again, ignore
  if (prev === voteType) return;

  // If switching vote, undo previous
  if (prev === "up") r.votes.up = Math.max(0, (Number(r.votes.up) || 0) - 1);
  if (prev === "down") r.votes.down = Math.max(0, (Number(r.votes.down) || 0) - 1);

  // Apply new vote
  if (voteType === "up") r.votes.up = (Number(r.votes.up) || 0) + 1;
  if (voteType === "down") r.votes.down = (Number(r.votes.down) || 0) + 1;

  r.votes.by[deviceId] = voteType;

  list[idx] = r;

  // Save + re-render
  saveReviewsForProduct(productId, list);
  rvAll = list;
  renderSummary(rvAll);
  renderListUI(productId);
}

/* ================= REVIEWS INIT ================= */
function initReviews(productId) {
  rvAll = loadReviewsForProduct(productId).map(normalizeReview);

  renderSummary(rvAll);
  rvShown = RV_PAGE_SIZE;
  renderListUI(productId);

  // Toggle form
  const toggle = el("rvToggleForm");
  const formWrap = el("rvFormWrap");
  if (toggle && formWrap) {
    toggle.addEventListener("click", () => {
      formWrap.hidden = !formWrap.hidden;
      toggle.textContent = formWrap.hidden ? "Write a review" : "Close";
    });
  }

  // Star input
  const starsWrap = el("starInput");
  const ratingInput = el("reviewRating");
  if (starsWrap && ratingInput) {
    starsWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".star");
      if (!btn) return;
      const val = clamp(Number(btn.dataset.value) || 0, 0, 5);
      ratingInput.value = String(val);
      setStarUI(val);
    });
  }

  // Filters
  const filters = el("rvStarFilters");
  if (filters) {
    filters.addEventListener("click", (e) => {
      const b = e.target.closest(".rv-filter");
      if (!b) return;
      rvFilteredStar = Number(b.dataset.star) || 0;

      filters.querySelectorAll(".rv-filter").forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active");

      rvShown = RV_PAGE_SIZE;
      renderListUI(productId);
    });
  }

  // Sort
  const sort = el("rvSort");
  if (sort) {
    sort.addEventListener("change", () => {
      rvSortMode = sort.value || "recent";
      rvShown = RV_PAGE_SIZE;
      renderListUI(productId);
    });
  }

  // Show more
  const moreBtn = el("rvMoreBtn");
  if (moreBtn) {
    moreBtn.addEventListener("click", () => {
      rvShown += RV_PAGE_SIZE;
      renderListUI(productId);
    });
  }

  // Submit review
  const form = el("reviewForm");
  const nameEl = el("reviewName");
  const titleEl = el("reviewTitle");
  const textEl = el("reviewText");
  const err = el("reviewError");

  if (form && ratingInput && textEl) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const rating = clamp(Number(ratingInput.value) || 0, 0, 5);
      const name = (nameEl?.value || "").trim();
      const title = (titleEl?.value || "").trim();
      const text = (textEl.value || "").trim();

      if (err) err.textContent = "";

      if (rating < 1) {
        if (err) err.textContent = "Please select a star rating.";
        return;
      }
      if (title.length < 3) {
        if (err) err.textContent = "Please add a short review title (min 3 characters).";
        return;
      }
      if (text.length < 10) {
        if (err) err.textContent = "Please write a fuller review (min 10 characters).";
        return;
      }

      const review = normalizeReview({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: name || "Anonymous",
        title: title.slice(0, 60),
        text: text.slice(0, 500),
        rating,
        createdAt: new Date().toISOString(),
        verified: isVerifiedPurchase(productId),
        votes: { up: 0, down: 0, by: {} }
      });

      rvAll.unshift(review);
      rvAll = rvAll.slice(0, 80); // keep clean

      saveReviewsForProduct(productId, rvAll);

      renderSummary(rvAll);
      rvShown = RV_PAGE_SIZE;
      renderListUI(productId);

      // reset
      ratingInput.value = "0";
      setStarUI(0);
      if (nameEl) nameEl.value = "";
      if (titleEl) titleEl.value = "";
      textEl.value = "";
    });
  }
}

/* ================= INIT PAGE ================= */
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

  // gallery (ensure 4)
  const images = getProductImages(product);
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

  // cart state
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

  // reviews
  initReviews(product.id);
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
