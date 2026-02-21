/* ===================== CHECKOUT.JS (UPDATED + MEDIA KEY SUPPORT) ===================== */

const API_BASE2 = (window.API_BASE || "").replace(/\/+$/, "");

const NIGERIA_LGA_SOURCE =
  "https://gist.githubusercontent.com/chrisidakwo/4ba3a4f03afc442305021be4ca67738e/raw/a8276ee3a756ae47ee853c4be5a82a11d6c8a313/nigerian-states.json";

const CART_KEY2 = "cart";
const PRICING_BACKUP_KEY = "deliveryPricing_backup_v1";
const LOCAL_ORDERS_KEY = "orders_backup";
const LAST_ORDER_KEY = "kikelara_last_order_v1";

const PICKUP_FEE = 0;
const FALLBACK_DEFAULT_DELIVERY_FEE = 2000;

const FALLBACK_IMG = "images_brown/bodyButter.png";

const nameEl = document.getElementById("name");
const emailEl = document.getElementById("email");
const phoneEl = document.getElementById("phone");

const deliveryFields = document.getElementById("deliveryFields");
const pickupInfo = document.getElementById("pickupInfo");
const shippingRadios = document.querySelectorAll('input[name="shippingType"]');

const stateEl = document.getElementById("deliveryState");
const cityEl = document.getElementById("deliveryCity");
const addressEl = document.getElementById("address");

const summaryItemsEl = document.getElementById("summaryItems");
const deliveryFeeEl = document.getElementById("deliveryFee");
const deliveryFeeChipEl = document.getElementById("deliveryFeeChip");
const totalAmountEl = document.getElementById("totalAmount");
const payNowBtn = document.getElementById("payNowBtn");

const mobilePay = document.getElementById("mobilePay");
const mobilePayBtn = document.getElementById("mobilePayBtn");
const mobilePayAmount = document.getElementById("mobilePayAmount");

const shipSegment = document.querySelector("[data-ship]");
const segIndicator = shipSegment ? shipSegment.querySelector(".seg-indicator") : null;

const PAYSTACK_PUBLIC_KEY =
  window.PAYSTACK_PUBLIC_KEY ||
  "pk_test_0e491cfbb7461a0ba9a0d58419cdfd6722ad5dee";

/* ================= MEDIA KEY SUPPORT (Cloudinary + Supabase keys in cart) ================= */
const IMG_URL_CACHE_KEY = "kkl_img_url_cache_v1";
const IMG_URL_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const MAX_IMAGE_REQUESTS = 6;

function safeJSONSession(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJSONSession(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} }

function loadImgCache() {
  const obj = safeJSONSession(IMG_URL_CACHE_KEY, {});
  return obj && typeof obj === "object" ? obj : {};
}
function getImgCached(key) {
  const cache = loadImgCache();
  const item = cache[String(key)];
  if (!item || typeof item !== "object") return null;
  const ts = Number(item.ts || 0);
  if (!ts || Date.now() - ts > IMG_URL_TTL_MS) return null;
  const url = String(item.url || "");
  return url ? url : null;
}
function setImgCached(key, url) {
  const cache = loadImgCache();
  cache[String(key)] = { url: String(url || ""), ts: Date.now() };
  saveJSONSession(IMG_URL_CACHE_KEY, cache);
}

function isHttpUrl(u) { return /^https?:\/\//i.test(String(u || "")); }
function isBlobOrData(u) { return /^(blob:|data:)/i.test(String(u || "")); }

function looksLikeMediaKey(u) {
  const s = String(u || "").trim();
  if (!s) return false;
  if (isHttpUrl(s) || isBlobOrData(s)) return false;
  if (s.startsWith("/uploads/")) return false;
  if (s.startsWith("uploads/")) return false;
  if (s.startsWith("images/") || s.startsWith("images_brown/")) return false;

  if (s.startsWith("cld:")) return true;
  if (s.startsWith("products/")) return true;
  if (s.startsWith("featured/")) return true;
  if (s.startsWith("hero/")) return true;
  return false;
}

function cloudinaryUrlFromKey(key) {
  const k = String(key || "").trim();
  if (!k.startsWith("cld:")) return "";
  const cloud = String(window.CLOUDINARY_CLOUD_NAME || "").trim();
  if (!cloud) return "";
  const publicId = k.slice(4).trim();
  if (!publicId) return "";
  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloud)}/image/upload/f_auto,q_auto/${encodedPublicId}`;
}

async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { cache: "no-store", signal: controller.signal }); }
  finally { clearTimeout(t); }
}

async function resolveMediaKeyToUrl(key) {
  const k = String(key || "").trim();
  if (!k) return "";

  const cached = getImgCached(k);
  if (cached) return cached;

  const cld = cloudinaryUrlFromKey(k);
  if (cld) { setImgCached(k, cld); return cld; }

  if (!API_BASE2) return "";
  try {
    const res = await fetchWithTimeout(`${API_BASE2}/api/media/sign?key=${encodeURIComponent(k)}`, 12000);
    if (!res.ok) return "";
    const data = await res.json().catch(() => null);
    const url = String(data?.url || data?.signedUrl || "");
    if (url) { setImgCached(k, url); return url; }
    return "";
  } catch {
    return "";
  }
}

let imgInFlight = 0;
const imgQueue = [];
function runImgQueue() {
  while (imgInFlight < MAX_IMAGE_REQUESTS && imgQueue.length) {
    const job = imgQueue.shift();
    if (!job) break;
    imgInFlight++;
    job().finally(() => { imgInFlight--; runImgQueue(); });
  }
}
function enqueueImg(job) { imgQueue.push(job); runImgQueue(); }

function resolveImageUrlImmediate(val) {
  const s = String(val || "").trim();
  if (!s) return FALLBACK_IMG;

  if (isHttpUrl(s) || isBlobOrData(s)) return s;

  if (s.startsWith("/uploads/") && API_BASE2) return `${API_BASE2}${s}`;
  if (s.startsWith("uploads/") && API_BASE2) return `${API_BASE2}/${s}`;

  if (s.startsWith("images/") || s.startsWith("images_brown/")) return s;

  // keys: return fallback immediately, resolve async
  return FALLBACK_IMG;
}

function setImgEl(img, raw) {
  const v = String(raw || "").trim();
  img.src = resolveImageUrlImmediate(v);
  img.loading = "lazy";
  img.decoding = "async";
  img.draggable = false;
  img.style.objectFit = "cover";
  img.style.display = "block";

  img.addEventListener("error", () => {
    if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
  });

  if (!looksLikeMediaKey(v)) return;

  const cached = getImgCached(v);
  if (cached) { img.src = cached; return; }

  enqueueImg(async () => {
    const url = await resolveMediaKeyToUrl(v);
    if (url) img.src = url;
  });
}

// used when saving orders: try best effort to store a usable URL, else keep original key
function resolveCartImageForStorage(val) {
  const s = String(val || "").trim();
  if (!s) return FALLBACK_IMG;

  const immediate = resolveImageUrlImmediate(s);
  if (immediate && immediate !== FALLBACK_IMG) return immediate;

  if (looksLikeMediaKey(s)) {
    const cached = getImgCached(s);
    if (cached) return cached;
    const cld = cloudinaryUrlFromKey(s);
    if (cld) return cld;
    return s; // supabase key stays as key
  }

  return immediate || FALLBACK_IMG;
}

/* ================= CART: prefer localStorage (canonical), fallback sessionStorage ================= */
function safeReadCart(storage) {
  try {
    const raw = storage.getItem(CART_KEY2);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function normalizeCart(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .map(i => {
      const id = String(i?.id ?? "").trim();
      if (!id) return null;

      const price = Number(i?.price || 0);
      const qty = Math.max(1, Math.floor(Number(i?.qty || 1)));
      const img = i?.image_url || i?.image || i?.img || "";

      return {
        id,
        name: String(i?.name || "Product").trim() || "Product",
        price: Number.isFinite(price) ? price : 0,
        qty: Number.isFinite(qty) ? qty : 1,
        image: img
      };
    })
    .filter(Boolean);
}

function loadCart() {
  const local = normalizeCart(safeReadCart(localStorage));
  if (local.length) return local;
  const sess = normalizeCart(safeReadCart(sessionStorage));
  return sess;
}

function clearCartEverywhere() {
  try { sessionStorage.removeItem(CART_KEY2); } catch {}
  try { localStorage.removeItem(CART_KEY2); } catch {}
  try { window.KStore?.setCart?.([]); } catch {}
  try { window.KStore?.syncBadges?.(); } catch {}
}

let cart2 = loadCart();

let pricing = { defaultFee: FALLBACK_DEFAULT_DELIVERY_FEE, states: [] };

/* ================= PRICING ================= */
function normalizePricing(raw) {
  const out = { defaultFee: FALLBACK_DEFAULT_DELIVERY_FEE, states: [] };
  if (!raw || typeof raw !== "object") return out;

  const def = Number(raw.defaultFee);
  out.defaultFee = Number.isFinite(def) && def >= 0 ? Math.round(def) : FALLBACK_DEFAULT_DELIVERY_FEE;

  const states = Array.isArray(raw.states) ? raw.states : [];
  out.states = states
    .map(s => ({
      name: String(s?.name || "").trim(),
      cities: Array.isArray(s?.cities)
        ? s.cities.map(c => ({
            name: String(c?.name || "").trim(),
            fee: Math.max(0, Math.round(Number(c?.fee) || 0))
          })).filter(c => c.name)
        : []
    }))
    .filter(s => s.name);

  out.states.sort((a, b) => a.name.localeCompare(b.name));
  out.states.forEach(s => s.cities.sort((a, b) => a.name.localeCompare(b.name)));
  return out;
}

async function fetchPricingFromServer() {
  if (!API_BASE2) throw new Error("API_BASE missing");
  const res = await fetch(`${API_BASE2}/delivery-pricing`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Pricing fetch failed: ${res.status}`);
  const data = await res.json();
  return normalizePricing(data);
}

function loadPricingBackup() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(PRICING_BACKUP_KEY));
    return normalizePricing(raw);
  } catch {
    return { defaultFee: FALLBACK_DEFAULT_DELIVERY_FEE, states: [] };
  }
}
function savePricingBackup(p) { try { sessionStorage.setItem(PRICING_BACKUP_KEY, JSON.stringify(p)); } catch {} }

function buildPricingFromNigeriaDataset(data, defaultFee) {
  const fee = Number.isFinite(Number(defaultFee))
    ? Math.max(0, Math.round(Number(defaultFee)))
    : FALLBACK_DEFAULT_DELIVERY_FEE;

  const states = Object.keys(data || {})
    .map(stateName => {
      const lgas = Array.isArray(data[stateName]) ? data[stateName] : [];
      return { name: String(stateName || "").trim(), cities: lgas.map(lga => ({ name: String(lga || "").trim(), fee })).filter(c => c.name) };
    })
    .filter(s => s.name);

  return normalizePricing({ defaultFee: fee, updatedAt: new Date().toISOString(), states });
}

async function fetchNigeriaStatesLgasPricingFallback() {
  const res = await fetch(NIGERIA_LGA_SOURCE, { cache: "no-store" });
  if (!res.ok) throw new Error(`Nigeria LGA dataset fetch failed: ${res.status}`);
  const data = await res.json();
  const def = Number(pricing?.defaultFee);
  const fee = Number.isFinite(def) ? def : FALLBACK_DEFAULT_DELIVERY_FEE;
  return buildPricingFromNigeriaDataset(data, fee);
}

/* ================= HELPERS ================= */
function getSelectedShippingType() {
  return document.querySelector('input[name="shippingType"]:checked')?.value || "pickup";
}
function formatNaira2(n) { return Number(n || 0).toLocaleString(); }

function calcSubtotal2(cart) {
  const list = Array.isArray(cart) ? cart : [];
  return list.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 0)), 0);
}

function findState(stateName) {
  const name = String(stateName || "").trim().toLowerCase();
  return (pricing.states || []).find(s => String(s.name || "").trim().toLowerCase() === name);
}
function findCity(stateObj, cityName) {
  if (!stateObj || !Array.isArray(stateObj.cities)) return null;
  const name = String(cityName || "").trim().toLowerCase();
  return stateObj.cities.find(c => String(c.name || "").trim().toLowerCase() === name) || null;
}

function getDeliveryFee() {
  const type = getSelectedShippingType();
  if (type === "pickup") return PICKUP_FEE;

  const state = stateEl?.value || "";
  const city = cityEl?.value || "";

  const st = findState(state);
  const ct = findCity(st, city);

  if (ct && Number.isFinite(Number(ct.fee))) return Number(ct.fee);

  const def = Number(pricing.defaultFee);
  return Number.isFinite(def) ? def : FALLBACK_DEFAULT_DELIVERY_FEE;
}

function getGrandTotal(cart) {
  return calcSubtotal2(cart) + getDeliveryFee();
}

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validatePhone(phone) {
  const cleaned = String(phone || "").replace(/\s+/g, "");
  return /^[+]?(\d{10,15})$/.test(cleaned);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ================= UI BUTTON LOADING (desktop + mobile) ================= */
function setBtnLoading(isLoading, label) {
  if (payNowBtn) {
    payNowBtn.disabled = isLoading;
    payNowBtn.style.opacity = isLoading ? "0.6" : "1";
    payNowBtn.style.cursor = isLoading ? "not-allowed" : "pointer";
    payNowBtn.textContent = isLoading ? (label || "PROCESSING…") : "Pay";
  }

  if (mobilePayBtn) {
    mobilePayBtn.disabled = isLoading;
    mobilePayBtn.style.opacity = isLoading ? "0.6" : "1";
    mobilePayBtn.style.cursor = isLoading ? "not-allowed" : "pointer";
    mobilePayBtn.textContent = isLoading ? (label || "PROCESSING…") : "Pay";
  }

  if (!isLoading) {
    const cart = loadCart();
    const total = getGrandTotal(cart);

    if (payNowBtn) {
      payNowBtn.innerHTML = `Pay ₦<span id="payBtnAmount">${formatNaira2(total)}</span>`;
    }
    if (mobilePayBtn && mobilePayAmount) {
      mobilePayAmount.textContent = formatNaira2(total);
      mobilePayBtn.innerHTML = `Pay ₦<span id="mobilePayAmount">${formatNaira2(total)}</span>`;
    }
  }
}

function updateShippingIndicator() {
  if (!shipSegment || !segIndicator) return;
  const type = getSelectedShippingType();
  segIndicator.style.transform = type === "delivery"
    ? "translateX(calc(100% + 10px))"
    : "translateX(0)";
}

function updateShippingUI() {
  const type = getSelectedShippingType();
  updateShippingIndicator();

  if (type === "delivery") {
    deliveryFields?.classList.remove("is-hidden");
    pickupInfo?.classList.add("is-hidden");
  } else {
    deliveryFields?.classList.add("is-hidden");
    pickupInfo?.classList.remove("is-hidden");
  }
  updateTotals();
}

function updateTotals() {
  cart2 = loadCart();

  const fee = getDeliveryFee();
  const total = getGrandTotal(cart2);

  if (deliveryFeeEl) deliveryFeeEl.textContent = formatNaira2(fee);
  if (deliveryFeeChipEl) deliveryFeeChipEl.textContent = formatNaira2(fee);
  if (totalAmountEl) totalAmountEl.textContent = formatNaira2(total);

  const paySpan = document.getElementById("payBtnAmount");
  if (paySpan) paySpan.textContent = formatNaira2(total);

  if (mobilePayAmount) mobilePayAmount.textContent = formatNaira2(total);

  const disabled = cart2.length === 0;
  if (payNowBtn) {
    payNowBtn.disabled = disabled;
    payNowBtn.style.opacity = disabled ? "0.6" : "1";
    payNowBtn.style.cursor = disabled ? "not-allowed" : "pointer";
  }
  if (mobilePayBtn) {
    mobilePayBtn.disabled = disabled;
    mobilePayBtn.style.opacity = disabled ? "0.6" : "1";
    mobilePayBtn.style.cursor = disabled ? "not-allowed" : "pointer";
  }
  if (mobilePay) {
    mobilePay.setAttribute("aria-hidden", disabled ? "true" : "false");
    mobilePay.style.opacity = disabled ? "0.65" : "1";
  }
}

/* ================= DROPDOWNS ================= */
function populateStates() {
  if (!stateEl) return;
  const states = (pricing.states || []).map(s => s.name).filter(Boolean).sort((a, b) => a.localeCompare(b.name));
  const current = stateEl.value || "";

  stateEl.innerHTML =
    `<option value="">Select State</option>` +
    states.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  if (current && states.includes(current)) stateEl.value = current;

  if (cityEl) {
    cityEl.innerHTML = `<option value="">Select LGA</option>`;
    cityEl.disabled = true;
  }
}

function populateCitiesForState(stateName) {
  if (!cityEl) return;
  const st = findState(stateName);
  const cities = (st?.cities || []).map(c => c.name).filter(Boolean).sort((a, b) => a.localeCompare(b.name));
  const current = cityEl.value || "";

  cityEl.innerHTML =
    `<option value="">Select LGA</option>` +
    cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  if (current && cities.includes(current)) cityEl.value = current;
  cityEl.disabled = cities.length === 0;
}

/* ================= SAFE SUMMARY RENDER (NOW RESOLVES cld:/products/ keys) ================= */
function renderSummaryItems() {
  if (!summaryItemsEl) return;

  cart2 = loadCart();
  summaryItemsEl.replaceChildren();

  if (!Array.isArray(cart2) || cart2.length === 0) {
    const p = document.createElement("p");
    p.style.opacity = ".85";
    p.textContent = "Your cart is empty.";
    summaryItemsEl.appendChild(p);
    return;
  }

  for (const item of cart2) {
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const line = price * qty;

    const row = document.createElement("div");
    row.className = "summary-item";

    const img = document.createElement("img");
    img.alt = item.name || "Product";
    setImgEl(img, item.image);

    const mid = document.createElement("div");

    const nm = document.createElement("div");
    nm.className = "summary-name";
    nm.textContent = item.name || "Product";

    const meta = document.createElement("div");
    meta.className = "summary-meta";
    meta.textContent = `Qty: ${qty} • ₦${formatNaira2(price)}`;

    mid.appendChild(nm);
    mid.appendChild(meta);

    const right = document.createElement("div");
    right.className = "summary-line";
    right.textContent = `₦${formatNaira2(line)}`;

    row.appendChild(img);
    row.appendChild(mid);
    row.appendChild(right);

    summaryItemsEl.appendChild(row);
  }
}

/* ================= VALIDATION ================= */
function validateCheckout() {
  cart2 = loadCart();

  const name = nameEl?.value?.trim() || "";
  const email = emailEl?.value?.trim() || "";
  const phone = phoneEl?.value?.trim() || "";

  if (!name) return { ok: false, msg: "Please enter your full name." };
  if (!email || !validateEmail(email)) return { ok: false, msg: "Please enter a valid email address." };
  if (!phone || !validatePhone(phone)) return { ok: false, msg: "Please enter a valid phone number." };
  if (cart2.length === 0) return { ok: false, msg: "Your cart is empty." };

  const type = getSelectedShippingType();
  if (type === "delivery") {
    const state = stateEl?.value || "";
    const city = cityEl?.value || "";
    const address = addressEl?.value?.trim() || "";

    if (!state) return { ok: false, msg: "Please select your State for delivery." };
    if (!city) return { ok: false, msg: "Please select your LGA for delivery." };
    if (!address) return { ok: false, msg: "Please enter your delivery address." };
  }

  if (!API_BASE2) return { ok: false, msg: "Checkout not configured (API_BASE missing)." };
  if (!PAYSTACK_PUBLIC_KEY) return { ok: false, msg: "Checkout not configured (Paystack key missing)." };

  return { ok: true };
}

/* ================= ORDER DRAFT ================= */
function buildBackendOrderDraft(reference) {
  cart2 = loadCart();

  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const phone = phoneEl.value.trim();

  const shippingType = getSelectedShippingType();
  const state = stateEl?.value || "";
  const city = cityEl?.value || "";
  const address = addressEl?.value?.trim() || "";

  const subtotal = calcSubtotal2(cart2);
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;

  const cartRows = cart2.map(i => ({
    id: i.id,
    name: i.name,
    price: Number(i.price || 0),
    qty: Number(i.qty || 0),
    // ✅ store best usable URL if we have it, else keep original key
    image: resolveCartImageForStorage(i.image),
    image_raw: String(i.image || ""),
    total: Number(i.price || 0) * Number(i.qty || 0)
  }));

  return {
    reference: reference || "",
    name,
    email,
    phone,
    shippingType,
    state,
    city,
    address,
    cart: cartRows,
    subtotal,
    deliveryFee,
    total,
    status: "Pending",
    paystackRef: reference || "",
    createdAt: new Date().toISOString()
  };
}

function saveOrderFallbackEverywhere(order) {
  try {
    const arr1 = JSON.parse(sessionStorage.getItem(LOCAL_ORDERS_KEY)) || [];
    arr1.push(order);
    sessionStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(arr1));
  } catch {}

  try {
    const arr2 = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY)) || [];
    arr2.push(order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(arr2));
  } catch {}
}

function saveLastOrderForReceipt(order) {
  try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch {}
  try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch {}
}

async function savePendingOrderToServer(draftOrder) {
  const res = await fetch(`${API_BASE2}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draftOrder)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Save pending failed: ${res.status} ${txt}`);
  }

  return res.json().catch(() => ({}));
}

/* ================= PAYSTACK ================= */
function payWithPaystack() {
  cart2 = loadCart();

  const check = validateCheckout();
  if (!check.ok) return alert(check.msg);

  if (typeof PaystackPop === "undefined") {
    alert("Paystack failed to load. Please refresh and try again.");
    return;
  }

  const email = emailEl.value.trim();
  const total = getGrandTotal(cart2);

  const reference = `KIKELARA_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

  setBtnLoading(true, "SAVING ORDER…");

  const draft = buildBackendOrderDraft(reference);
  saveLastOrderForReceipt({ ...draft, status: "Pending (Awaiting Payment)" });

  (async () => {
    try { await savePendingOrderToServer(draft); }
    catch (err) {
      console.warn(err);
      saveOrderFallbackEverywhere({ ...draft, status: "Pending (Server Save Failed)" });
    }

    setBtnLoading(true, "OPENING PAYSTACK…");

    const handler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: Math.round(total * 100),
      currency: "NGN",
      ref: reference,

      callback: function (response) {
        const payRef = response?.reference || reference;

        const receipt = {
          ...draft,
          reference: payRef,
          paystackRef: payRef,
          status: "Payment Received (Awaiting Confirmation)"
        };

        saveLastOrderForReceipt(receipt);

        // ✅ Clear cart everywhere
        clearCartEverywhere();

        window.location.href = `order-success.html?ref=${encodeURIComponent(payRef)}`;
      },

      onClose: function () {
        setBtnLoading(false);
        updateTotals();
        alert("Payment cancelled.");
      }
    });

    handler.openIframe();
  })().catch((e) => {
    console.error(e);
    setBtnLoading(false);
    updateTotals();
    alert("Could not start checkout. Please try again.");
  });
}

/* ================= EVENTS ================= */
shippingRadios.forEach(r => r.addEventListener("change", updateShippingUI));

stateEl?.addEventListener("change", () => {
  populateCitiesForState(stateEl.value);
  if (cityEl) cityEl.value = "";
  updateTotals();
});

cityEl?.addEventListener("change", updateTotals);

payNowBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  payWithPaystack();
});

mobilePayBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  payWithPaystack();
});

/* ================= INIT ================= */
(async function init() {
  renderSummaryItems();
  updateShippingUI();

  try {
    pricing = await fetchPricingFromServer();
    savePricingBackup(pricing);
  } catch (e1) {
    console.warn("Pricing server failed, trying session backup:", e1);

    const backup = loadPricingBackup();
    if (backup?.states?.length) {
      pricing = backup;
    } else {
      try {
        pricing = await fetchNigeriaStatesLgasPricingFallback();
        savePricingBackup(pricing);
      } catch (e2) {
        console.warn("Nigeria dataset fallback failed:", e2);
        pricing = { defaultFee: FALLBACK_DEFAULT_DELIVERY_FEE, states: [] };
      }
    }
  }

  populateStates();
  populateCitiesForState(stateEl?.value || "");

  updateTotals();

  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY2) {
      renderSummaryItems();
      updateTotals();
    }
  });
})();