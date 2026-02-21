/* ================= PRODUCT-DETAILS.JS (FAST + PRIVATE BUCKET OPTION A) =================
   ✅ Fast paint from session cache (instant UI)
   ✅ Parallel fetch: product + reviews
   ✅ Signed URLs expected from backend (/api/products/:id gives image_url + images)
   ✅ Gallery uses LAST 4 images
   ✅ Votes updated using server.js response { ok:true, votes:{up,down} }
======================================================================================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "") || "https://kikelara1.onrender.com";
const CART_KEY = "cart";

/* ---------- DOM helpers ---------- */
function el(id) { return document.getElementById(id); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function safeJSON(storage, key, fallback) {
  try { const v = JSON.parse(storage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
}
function saveJSON(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch {}
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(msg) {
  const container = document.querySelector(".pd");
  const safe = escapeHtml(msg);
  if (!container) {
    document.body.innerHTML = `<h2 style="padding:50px">${safe}</h2>`;
    return;
  }
  container.innerHTML = `<h2 style="padding:30px">${safe}</h2>`;
}

/* ---------- fast fetch with timeout ---------- */
async function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(t);
  }
}

/* ✅ Private bucket: frontend MUST receive signed URLs from backend */
function resolveImage(url) {
  const u = String(url || "").trim();
  if (!u) return "images_brown/bodyButter.png";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (u.startsWith("/uploads/")) return `${API_BASE}${u}`;
  if (u.startsWith("images/") || u.startsWith("images_brown/")) return u;
  return "images_brown/bodyButter.png";
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

function starsText(rating) {
  const r = clamp(Number(rating) || 0, 0, 5);
  return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
}

function getProductId() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("id");
  return raw ? String(raw).trim() : "";
}

/* ---------- cart ---------- */
function loadCart() {
  let c = safeJSON(localStorage, CART_KEY, null);
  if (Array.isArray(c)) return c;

  const old = safeJSON(sessionStorage, CART_KEY, null);
  if (Array.isArray(old)) {
    saveJSON(localStorage, CART_KEY, old);
    try { sessionStorage.removeItem(CART_KEY); } catch {}
    return old;
  }
  return [];
}
function saveCart(cart) { saveJSON(localStorage, CART_KEY, cart); }
function isInCart(cart, id) { return cart.some(i => String(i.id) === String(id)); }

function addToCartOnce(product) {
  const cart = loadCart();
  if (isInCart(cart, product.id)) return;

  cart.push({
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image, // already signed URL
    qty: 1
  });
  saveCart(cart);
}

function updateHeaderCartCount() {
  const cartCount = el("cartCount");
  if (!cartCount) return;
  const cart = loadCart();
  cartCount.textContent = cart.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  const wishlistCount = el("wishlistCount");
  if (wishlistCount) wishlistCount.textContent = "0";
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

/* ---------- product normalize + cache ---------- */
const PRODUCT_CACHE_PREFIX = "pd_product_v1_"; // sessionStorage only (fast, safe for signed URLs)

function normalizeProduct(p) {
  const image = resolveImage(
    p?.detail_image_url || p?.image_url || p?.image || (Array.isArray(p?.all_images) ? p.all_images[0] : "") || ""
  );

  // Prefer backend “all_images” if you return it, else p.images, else fallback to image
  let images = [];
  const rawArr =
    Array.isArray(p?.all_images) ? p.all_images :
    Array.isArray(p?.images) ? p.images :
    [];

  images = rawArr.map(resolveImage).filter(Boolean);
  if (!images.length) images = [image];

  return {
    id: p?.id,
    name: String(p?.name || "").trim(),
    price: Number(p?.price || 0),
    category: String(p?.category || p?.payload?.category || "Product"),
    description: String(p?.description || p?.payload?.description || ""),
    image,
    images
  };
}

function getCachedProduct(productId) {
  const key = PRODUCT_CACHE_PREFIX + String(productId);
  const cached = safeJSON(sessionStorage, key, null);
  // keep it short-lived (signed urls can expire). If no ts, ignore.
  const ts = Number(cached?.ts || 0);
  if (!ts) return null;
  // 30 mins cache for product details page
  if (Date.now() - ts > 1000 * 60 * 30) return null;
  return cached?.product || null;
}

function setCachedProduct(productId, product) {
  const key = PRODUCT_CACHE_PREFIX + String(productId);
  saveJSON(sessionStorage, key, { ts: Date.now(), product });
}

/* ---------- product fetch ---------- */
async function fetchProduct(productId) {
  const r = await fetchWithTimeout(`${API_BASE}/api/products/${encodeURIComponent(productId)}`, {}, 12000);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.success) throw new Error(data?.message || "Product not found");
  return normalizeProduct(data.product);
}

/* ---------- 5D tilt (desktop only) ---------- */
const CAN_TILT = window.matchMedia?.("(hover:hover) and (pointer:fine)")?.matches;

function bindTilt(node) {
  if (!CAN_TILT || !node) return;

  node.addEventListener("pointermove", (e) => {
    const r = node.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;

    const ry = (x - 0.5) * 10;
    const rx = (0.5 - y) * 8;

    node.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    node.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    node.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    node.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    node.classList.add("tilting");
  });

  node.addEventListener("pointerleave", () => {
    node.classList.remove("tilting");
    node.style.setProperty("--ry", "0deg");
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--mx", "50%");
    node.style.setProperty("--my", "50%");
  });
}

/* ---------- gallery (LATEST = LAST 4) ---------- */
function pickLastFour(images) {
  const list = (Array.isArray(images) ? images : []).filter(Boolean);
  if (!list.length) {
    return ["images_brown/bodyButter.png","images_brown/bodyButter.png","images_brown/bodyButter.png","images_brown/bodyButter.png"];
  }
  const last = list.length >= 4 ? list.slice(-4) : list.slice(0);
  while (last.length < 4) last.push(last[last.length - 1] || list[0]);
  return last;
}

function preloadImg(src) {
  return new Promise((resolve) => {
    if (!src) return resolve();
    const i = new Image();
    i.onload = () => resolve();
    i.onerror = () => resolve();
    i.src = src;
  });
}

function renderGallery(images, activeIndex = 0) {
  const mainImg = el("productImage");
  const thumbsWrap = el("productThumbs");
  if (!mainImg || !Array.isArray(images) || !images.length) return;

  const src = images[activeIndex] || images[0];
  mainImg.src = src;
  mainImg.alt = "Product image";
  mainImg.loading = "eager";
  mainImg.decoding = "async";
  mainImg.onerror = () => { mainImg.src = "images_brown/bodyButter.png"; };

  if (!thumbsWrap) return;
  thumbsWrap.innerHTML = "";

  // thumbs = lazy, async
  images.forEach((imgSrc, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pd-thumb" + (idx === activeIndex ? " active" : "");
    b.innerHTML = `<img src="${escapeHtml(imgSrc)}" alt="thumbnail ${idx + 1}" draggable="false" loading="lazy" decoding="async">`;
    b.addEventListener("click", () => renderGallery(images, idx));
    thumbsWrap.appendChild(b);
  });
}

/* ---------- reviews backend ---------- */
const DEVICE_ID_KEY = "reviewDeviceId_v2";
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getCookie(name) {
  const v = `; ${document.cookie}`;
  const parts = v.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return "";
}
function csrfToken() { return getCookie("admin_csrf") || ""; }

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const method = (opts.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const c = csrfToken();
    if (c) headers["X-CSRF-Token"] = c;
  }
  return fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: "include" });
}

/* admin detection */
let isAdmin = false;
async function detectAdminSession() {
  try {
    const r = await api("/admin/me", { method: "GET" });
    const data = await r.json().catch(() => ({}));
    isAdmin = Boolean(r.ok && data?.success);
  } catch {
    isAdmin = false;
  }
}

/* Reviews state */
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
  return list.reduce((a, r) => a + (Number(r.rating) || 0), 0) / list.length;
}
function breakdownCounts(list) {
  const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  list.forEach(r => { counts[clamp(Number(r.rating)||1,1,5)] += 1; });
  return counts;
}

function setStarUI(value) {
  const stars = document.querySelectorAll("#starInput .star");
  stars.forEach(btn => {
    const v = Number(btn.dataset.value);
    btn.classList.toggle("is-on", v <= value);
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
      <div class="rv-bar-track"><div class="rv-bar-fill" style="width:${pct}%"></div></div>
      <div class="rv-bar-count">${c}</div>
    `;
    breakdownEl.appendChild(row);
  }
}

function getDisplayList() {
  let list = [...rvAll];

  if (rvFilteredStar) list = list.filter(r => Number(r.rating) === Number(rvFilteredStar));

  if (rvSortMode === "recent") list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  else if (rvSortMode === "high") list.sort((a,b) => (b.rating - a.rating) || (new Date(b.created_at) - new Date(a.created_at)));
  else if (rvSortMode === "low") list.sort((a,b) => (a.rating - b.rating) || (new Date(b.created_at) - new Date(a.created_at)));
  else if (rvSortMode === "helpful") list.sort((a,b) => (helpfulScore(b) - helpfulScore(a)) || (new Date(b.created_at) - new Date(a.created_at)));

  return list;
}

async function loadReviews(productId) {
  const r = await fetchWithTimeout(`${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews`, {}, 12000);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) return [];
  return Array.isArray(data.reviews) ? data.reviews : [];
}

async function submitReview(productId, payload) {
  const deviceId = getDeviceId();
  const r = await fetchWithTimeout(`${API_BASE}/api/products/${encodeURIComponent(productId)}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, deviceId }),
  }, 12000);

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) throw new Error(data?.message || "Failed to submit review");
  return data.review;
}

// ✅ server.js vote route returns { ok:true, votes:{up,down} }
async function voteReview(reviewId, voteType) {
  const deviceId = getDeviceId();
  voteType = (voteType === "up" || voteType === "down") ? voteType : "up";

  const r = await fetchWithTimeout(`${API_BASE}/api/reviews/${encodeURIComponent(reviewId)}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voteType, deviceId }),
  }, 12000);

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok || !data?.votes) throw new Error(data?.message || "Vote failed");
  return data.votes; // {up,down}
}

async function adminDeleteReview(reviewId) {
  const r = await api(`/admin/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.success) {
    if (r.status === 401) throw new Error("Unauthorized. Please login as admin.");
    if (r.status === 403) throw new Error("Blocked (CSRF). Please refresh + login again.");
    throw new Error(data?.message || "Delete failed");
  }
  return true;
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
          <span class="rv-item-date">${escapeHtml(formatDate(r.created_at))}</span>
        </div>
      </div>

      <div class="rv-item-text">${escapeHtml(r.text || "")}</div>

      <div class="rv-item-actions">
        <button type="button" class="rv-vote" data-vote="up">Helpful <span class="rv-vnum">(${up})</span></button>
        <button type="button" class="rv-vote" data-vote="down">Not helpful <span class="rv-vnum">(${down})</span></button>
        ${isAdmin ? `<button type="button" class="rv-del-btn" data-del="${r.id}">Delete</button>` : ``}
      </div>
    `;

    item.querySelectorAll(".rv-vote").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          const votes = await voteReview(r.id, btn.dataset.vote);
          // update ONLY votes for that review
          rvAll = rvAll.map(x => {
            if (String(x.id) !== String(r.id)) return x;
            return { ...x, votes: { up: Number(votes.up || 0), down: Number(votes.down || 0) } };
          });
          renderSummary(rvAll);
          renderListUI(productId);
        } catch (e) {
          alert(String(e.message || e));
        }
      });
    });

    const delBtn = item.querySelector(".rv-del-btn");
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (!confirm("Delete this review permanently?")) return;
        try {
          await adminDeleteReview(delBtn.dataset.del);
          rvAll = rvAll.filter(x => String(x.id) !== String(delBtn.dataset.del));
          renderSummary(rvAll);
          rvShown = Math.min(rvShown, rvAll.length || RV_PAGE_SIZE);
          renderListUI(productId);
        } catch (e) {
          alert(String(e.message || e));
        }
      });
    }

    wrap.appendChild(item);
  });

  if (moreBtn) moreBtn.hidden = rvShown >= list.length;
}

async function initReviews(productId) {
  // reviews should not block product view
  await detectAdminSession();

  rvAll = await loadReviews(productId);

  renderSummary(rvAll);
  rvShown = RV_PAGE_SIZE;
  renderListUI(productId);

  const toggle = el("rvToggleForm");
  const formWrap = el("rvFormWrap");
  if (toggle && formWrap) {
    toggle.addEventListener("click", () => {
      formWrap.hidden = !formWrap.hidden;
      toggle.textContent = formWrap.hidden ? "Write a review" : "Close";
    });
  }

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

  const sort = el("rvSort");
  if (sort) {
    sort.addEventListener("change", () => {
      rvSortMode = sort.value || "recent";
      rvShown = RV_PAGE_SIZE;
      renderListUI(productId);
    });
  }

  const moreBtn = el("rvMoreBtn");
  if (moreBtn) {
    moreBtn.addEventListener("click", () => {
      rvShown += RV_PAGE_SIZE;
      renderListUI(productId);
    });
  }

  const form = el("reviewForm");
  const nameEl = el("reviewName");
  const titleEl = el("reviewTitle");
  const textEl = el("reviewText");
  const err = el("reviewError");

  if (form && ratingInput && textEl) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const rating = clamp(Number(ratingInput.value) || 0, 0, 5);
      const name = (nameEl?.value || "").trim();
      const title = (titleEl?.value || "").trim();
      const text = (textEl.value || "").trim();

      if (err) err.textContent = "";

      if (rating < 1) return (err ? (err.textContent = "Please select a star rating.") : alert("Select rating"));
      if (title.length < 3) return (err ? (err.textContent = "Please add a short review title (min 3 characters).") : alert("Title too short"));
      if (text.length < 10) return (err ? (err.textContent = "Please write a fuller review (min 10 characters).") : alert("Text too short"));

      try {
        const newReview = await submitReview(productId, {
          name: name || "Anonymous",
          title: title.slice(0, 60),
          text: text.slice(0, 500),
          rating
        });

        rvAll.unshift(newReview);
        rvAll = rvAll.slice(0, 200);

        renderSummary(rvAll);
        rvShown = RV_PAGE_SIZE;
        renderListUI(productId);

        ratingInput.value = "0";
        setStarUI(0);
        if (nameEl) nameEl.value = "";
        if (titleEl) titleEl.value = "";
        textEl.value = "";
      } catch (e2) {
        if (err) err.textContent = String(e2.message || e2);
        else alert(String(e2.message || e2));
      }
    });
  }
}

/* ---------- paint product UI (fast) ---------- */
function paintProduct(product) {
  if (!product) return;

  el("productName") && (el("productName").textContent = product.name || "");
  el("productPrice") && (el("productPrice").textContent = `₦${Number(product.price || 0).toLocaleString()}`);
  el("productDescription") && (el("productDescription").textContent = product.description || "");
  el("productCategory") && (el("productCategory").textContent = String(product.category || "Product").toUpperCase());

  const gallery = pickLastFour(product.images?.length ? product.images : [product.image]);

  // load main image FIRST (fast perceived performance)
  const mainSrc = gallery[0];
  const rest = gallery.slice(1);

  renderGallery(gallery, 0);

  // preload rest in background (no blocking)
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => rest.forEach(preloadImg), { timeout: 2000 });
  } else {
    setTimeout(() => rest.forEach(preloadImg), 300);
  }

  // tilt deferred
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => bindTilt(el("tiltMain")), { timeout: 1500 });
  } else {
    setTimeout(() => bindTilt(el("tiltMain")), 300);
  }

  const cart = loadCart();
  setCartButtonState(isInCart(cart, product.id));
  updateHeaderCartCount();

  const btn = el("cartBtn");
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      addToCartOnce(product);
      setCartButtonState(true);
      updateHeaderCartCount();
    });
  }

  // Also update document title (nice feel)
  try { document.title = `${product.name} — KÍKÉLÁRÁ`; } catch {}
}

/* ---------- init page ---------- */
async function init() {
  const productId = getProductId();
  if (!productId) return showMessage("Invalid product link.");

  // ✅ 1) Fast paint from cache
  const cached = getCachedProduct(productId);
  if (cached) paintProduct(cached);

  // ✅ 2) Fetch product + reviews in parallel (reviews doesn’t block product)
  const productPromise = fetchProduct(productId)
    .then((p) => {
      setCachedProduct(productId, p);
      paintProduct(p);
      return p;
    })
    .catch(() => null);

  // Start reviews after we at least know product id (same id)
  const reviewsPromise = initReviews(productId).catch(() => {});

  const p = await productPromise;
  if (!p && !cached) return showMessage("Product not found.");

  // Don’t await reviews to show product. But if you want to ensure errors don't spam:
  await Promise.race([reviewsPromise, new Promise(r => setTimeout(r, 10))]);
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  // header cart count sync (header injected)
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    updateHeaderCartCount();
    if (tries >= 12) clearInterval(t);
  }, 150);
});