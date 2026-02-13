/* ================= PRODUCT-DETAILS.JS (FULL)
   - Gallery + cart state
   - Jumia-like reviews
   - Admin delete reviews (PIN)
   - Seed reviews per product (different, mostly female)
================================================ */

const PRODUCTS_KEY = "allProducts";
const CART_KEY = "cart";

/* Reviews */
const REVIEWS_KEY = "productReviews_v1";
const DEVICE_ID_KEY = "reviewDeviceId_v1";
const REVIEWS_SEEDED_KEY = "productReviews_seeded_v1";

/* ✅ Admin PIN for deleting reviews */
const REVIEWS_ADMIN_PIN = "4567";
const REVIEWS_ADMIN_AUTH_KEY = "reviews-admin-auth-v1";

/* ================= HELPERS ================= */
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

/* ---------- device id for helpful votes ---------- */
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
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

/* ================= PAGE UI HELPERS ================= */
function showMessage(msg) {
  const container = document.querySelector(".pd");
  if (!container) {
    document.body.innerHTML = `<h2 style="padding:50px">${msg}</h2>`;
    return;
  }
  container.innerHTML = `<h2 style="padding:30px">${msg}</h2>`;
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

/* ================= GALLERY ================= */
function getProductImages(p) {
  if (Array.isArray(p.images) && p.images.length) return p.images;
  if (typeof p.image === "string" && p.image.trim()) return [p.image];
  return [];
}

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

/* ================= REVIEWS STORAGE ================= */
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

/* ================= VERIFIED PURCHASE (simple) ================= */
function isVerifiedPurchase(productId) {
  const cart = loadCart();
  if (cart.some(i => Number(i.id) === Number(productId))) return true;

  const possibleOrderKeys = ["orders", "orders_backup", "orders_backup_v1", "orders_backup_v2", "localOrders"];
  for (const k of possibleOrderKeys) {
    const orders = safeJSON(k, []);
    if (Array.isArray(orders)) {
      const found = orders.some(o => {
        if (Array.isArray(o?.items)) return o.items.some(it => Number(it.id) === Number(productId));
        return Number(o?.id) === Number(productId);
      });
      if (found) return true;
    }
  }

  return false;
}

/* ================= ADMIN AUTH ================= */
function isReviewAdmin() {
  return localStorage.getItem(REVIEWS_ADMIN_AUTH_KEY) === "yes";
}
function setReviewAdminAuth(on) {
  localStorage.setItem(REVIEWS_ADMIN_AUTH_KEY, on ? "yes" : "no");
}

/* ================= SEEDED REVIEWS (DIFFERENT PER PRODUCT) ================= */
function seededAlreadyFor(productId) {
  const seeded = safeJSON(REVIEWS_SEEDED_KEY, {});
  return Boolean(seeded[String(productId)]);
}
function markSeeded(productId) {
  const seeded = safeJSON(REVIEWS_SEEDED_KEY, {});
  seeded[String(productId)] = true;
  localStorage.setItem(REVIEWS_SEEDED_KEY, JSON.stringify(seeded));
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUnique(rng, arr, count) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

function seedReviewsIfEmpty(productId, product) {
  const current = loadReviewsForProduct(productId);
  if (current.length > 0) return;
  if (seededAlreadyFor(productId)) return;

  const rng = mulberry32((Number(productId) || 1) * 99991);

  const femaleNames = [
    "Amina","Hauwa","Zainab","Fatima","Rahma","Safiya","Hadiza","Maryam","Asiya","Khadija",
    "Sade","Temilade","Damilola","Tolani","Yetunde","Funke","Bimpe","Bukola","Kemi","Tomiwa",
    "Oluwatoyin","Ayomide","Simisola","Ireoluwa","Abisola","Omotola",
    "Chioma","Chidinma","Adaeze","Amaka","Ifunanya","Ngozi","Nneka","Uchechi","Oluchi","Chiamaka",
    "Blessing","Peace","Joy","Mercy","Grace","Rita","Esther","Deborah","Sarah","Mary","Jennifer","Victoria"
  ];

  const maleNames = ["Tunde","Sani","Ifeanyi","Chinedu","Musa","Abdul","Segun","Emeka","Kunle","Ibrahim"];

  // mostly female
  const namePool = [];
  namePool.push(...pickUnique(rng, femaleNames, 16));
  namePool.push(...pickUnique(rng, maleNames, 3));

  const cat = String(product?.category || "").toLowerCase();

  const templatesBody = [
    { title: "Super soft skin", text: "My skin felt softer from the first use. It absorbs well and doesn’t feel greasy." },
    { title: "Perfect after shower", text: "I apply it after shower and my skin stays moisturized till night. Texture is rich." },
    { title: "Dryness reduced", text: "My elbows and knees were very dry before, now they look smoother. I’m impressed." },
    { title: "Luxury feel", text: "It feels premium and the scent is not too loud. My skin feels pampered." },
    { title: "Nice for harmattan", text: "This is now my go-to for harmattan season. Skin stays calm and moisturized." },
    { title: "Good but small", text: "Quality is great and it works well, I just wish the size was bigger." }
  ];

  const templatesOil = [
    { title: "Glowing finish", text: "Gives a clean glow without looking oily. I use it on damp skin and it seals in moisture." },
    { title: "Lightweight and effective", text: "It’s lightweight but works well. My skin looks healthier after a few days." },
    { title: "Smooth texture", text: "It spreads easily and absorbs fast. No stains on clothes after a few minutes." },
    { title: "Good for dull skin", text: "My skin looked dull before, but now I see a brighter look especially on my legs." },
    { title: "Night routine favourite", text: "The scent is classy and not overwhelming. I love using it at night." }
  ];

  const templatesHair = [
    { title: "Hair feels softer", text: "My hair feels softer and easier to comb. A little goes a long way." },
    { title: "Reduced dryness", text: "Helps with dry scalp and dryness on hair ends. I like the finish." },
    { title: "Good for sealing", text: "I use it to seal moisture and my hair looks healthier. No heavy build-up." },
    { title: "Nice shine", text: "Gives a nice shine and keeps my hair looking neat for longer." }
  ];

  let templates = templatesBody;
  if (cat.includes("oil")) templates = templatesOil;
  if (cat.includes("serum") || cat.includes("hair")) templates = templatesHair;

  const ratingsBag = [5,5,5,5,5,5,5,4,4,4,3]; // mostly 5
  const count = 6 + Math.floor(rng() * 4);      // 6–9

  const now = Date.now();
  const pickedNames = pickUnique(rng, namePool, count);
  const pickedTemplates = pickUnique(rng, templates, count);

  const seeded = pickedNames.map((nm, idx) => {
    const rating = ratingsBag[Math.floor(rng() * ratingsBag.length)];
    const t = pickedTemplates[idx] || templates[Math.floor(rng() * templates.length)];

    const daysAgo = 2 + Math.floor(rng() * 28);
    const createdAt = new Date(now - 86400000 * daysAgo).toISOString();

    return normalizeReview({
      id: `${now}_${productId}_${idx}_${Math.random().toString(16).slice(2)}`,
      name: nm,
      title: t.title,
      text: t.text,
      rating,
      createdAt,
      verified: false,
      votes: { up: Math.floor(rng() * 8), down: Math.floor(rng() * 2), by: {} }
    });
  });

  saveReviewsForProduct(productId, seeded);
  markSeeded(productId);
}

/* ================= REVIEWS UI STATE ================= */
let rvAll = [];
let rvFilteredStar = 0;
let rvSortMode = "recent";
let rvShown = 5;
const RV_PAGE_SIZE = 5;

function helpfulScore(r) {
  const up = Number(r?.votes?.up) || 0;
  const down = Number(r?.votes?.down) || 0;
  return up - down;
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

/* Admin buttons setup */
function setupAdminButtons(productId) {
  const adminBtn = el("rvAdminBtn");
  const logoutBtn = el("rvAdminLogoutBtn");
  if (!adminBtn || !logoutBtn) return;

  function refreshAdminUI() {
    const on = isReviewAdmin();
    logoutBtn.hidden = !on;
    adminBtn.textContent = on ? "Admin: ON" : "Admin";
  }

  adminBtn.addEventListener("click", () => {
    if (isReviewAdmin()) {
      refreshAdminUI();
      return;
    }
    const pin = prompt("Enter admin PIN to manage reviews:");
    if (pin === null) return;
    if (String(pin).trim() === REVIEWS_ADMIN_PIN) {
      setReviewAdminAuth(true);
      refreshAdminUI();
      renderSummary(rvAll);
      renderListUI(productId);
    } else {
      alert("Wrong PIN.");
    }
  });

  logoutBtn.addEventListener("click", () => {
    setReviewAdminAuth(false);
    refreshAdminUI();
    renderSummary(rvAll);
    renderListUI(productId);
  });

  refreshAdminUI();
}

/* Voting */
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
  if (prev === voteType) return;

  if (prev === "up") r.votes.up = Math.max(0, (Number(r.votes.up) || 0) - 1);
  if (prev === "down") r.votes.down = Math.max(0, (Number(r.votes.down) || 0) - 1);

  if (voteType === "up") r.votes.up = (Number(r.votes.up) || 0) + 1;
  if (voteType === "down") r.votes.down = (Number(r.votes.down) || 0) + 1;

  r.votes.by[deviceId] = voteType;
  list[idx] = r;

  saveReviewsForProduct(productId, list);
  rvAll = list;

  renderSummary(rvAll);
  renderListUI(productId);
}

/* Admin delete */
function deleteReview(productId, reviewId) {
  if (!isReviewAdmin()) return;

  const ok = confirm("Delete this review permanently?");
  if (!ok) return;

  let list = loadReviewsForProduct(productId).map(normalizeReview);
  list = list.filter(r => r.id !== reviewId);

  saveReviewsForProduct(productId, list);
  rvAll = list;

  renderSummary(rvAll);
  rvShown = Math.min(rvShown, rvAll.length || RV_PAGE_SIZE);
  renderListUI(productId);
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

  const adminOn = isReviewAdmin();

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
        <button type="button" class="rv-vote" data-vote="up">Helpful <span class="rv-vnum">(${up})</span></button>
        <button type="button" class="rv-vote" data-vote="down">Not helpful <span class="rv-vnum">(${down})</span></button>
        ${adminOn ? `<button type="button" class="rv-del-btn" data-del="${r.id}">Delete</button>` : ``}
      </div>
    `;

    item.querySelectorAll(".rv-vote").forEach(btn => {
      btn.addEventListener("click", () => voteReview(productId, r.id, btn.dataset.vote));
    });

    const delBtn = item.querySelector(".rv-del-btn");
    if (delBtn) {
      delBtn.addEventListener("click", () => deleteReview(productId, delBtn.dataset.del));
    }

    wrap.appendChild(item);
  });

  if (moreBtn) {
    moreBtn.hidden = rvShown >= list.length;
  }
}

/* ================= REVIEWS INIT ================= */
function initReviews(productId, product) {
  // Seed unique reviews if empty
  seedReviewsIfEmpty(productId, product);

  rvAll = loadReviewsForProduct(productId).map(normalizeReview);

  renderSummary(rvAll);
  rvShown = RV_PAGE_SIZE;
  renderListUI(productId);

  setupAdminButtons(productId);

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
      rvAll = rvAll.slice(0, 150);

      // ✅ Store new reviews in localStorage
      saveReviewsForProduct(productId, rvAll);

      renderSummary(rvAll);
      rvShown = RV_PAGE_SIZE;
      renderListUI(productId);

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

  // reviews (pass product so seed uses category)
  initReviews(product.id, product);
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
