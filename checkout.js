/* ===================== CHECKOUT.JS (NECESSAIRE-STYLE UI + YOUR COLORS + YOUR LOGIC) ===================== */

/* ================= API (BACKEND) ================= */
const API_BASE = "https://kikelara.onrender.com"; // ✅ your Render backend

/* ================= NIGERIA STATES + LGAs (FALLBACK SOURCE) ================= */
const NIGERIA_LGA_SOURCE =
  "https://gist.githubusercontent.com/chrisidakwo/4ba3a4f03afc442305021be4ca67738e/raw/a8276ee3a756ae47ee853c4be5a82a11d6c8a313/nigerian-states.json";

/* ================= STORAGE KEYS ================= */
const CART_KEY = "cart";
const PRICING_BACKUP_KEY = "deliveryPricing_backup_v1";
const LOCAL_ORDERS_KEY = "orders_backup";

/* ================= SETTINGS ================= */
const PICKUP_FEE = 0;
const FALLBACK_DEFAULT_DELIVERY_FEE = 2000;

/* ================= ELEMENTS ================= */
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

/* Segment indicator */
const shipSegment = document.querySelector("[data-ship]");
const segIndicator = shipSegment ? shipSegment.querySelector(".seg-indicator") : null;

/* ================= LOAD CART ================= */
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem(CART_KEY)) || [];
} catch {
  cart = [];
}

/* ================= PRICING ================= */
let pricing = { defaultFee: FALLBACK_DEFAULT_DELIVERY_FEE, states: [] };

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
        ? s.cities
            .map(c => ({
              name: String(c?.name || "").trim(),
              fee: Math.max(0, Math.round(Number(c?.fee) || 0))
            }))
            .filter(c => c.name)
        : []
    }))
    .filter(s => s.name);

  out.states.sort((a, b) => a.name.localeCompare(b.name));
  out.states.forEach(s => s.cities.sort((a, b) => a.name.localeCompare(b.name)));

  return out;
}

async function fetchPricingFromServer() {
  const res = await fetch(`${API_BASE}/delivery-pricing`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Pricing fetch failed: ${res.status}`);
  const data = await res.json();
  return normalizePricing(data);
}

function loadPricingBackup() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRICING_BACKUP_KEY));
    return normalizePricing(raw);
  } catch {
    return { defaultFee: FALLBACK_DEFAULT_DELIVERY_FEE, states: [] };
  }
}

function savePricingBackup(p) {
  try { localStorage.setItem(PRICING_BACKUP_KEY, JSON.stringify(p)); } catch {}
}

/* Nigeria dataset fallback -> build pricing format */
function buildPricingFromNigeriaDataset(data, defaultFee) {
  const fee = Number.isFinite(Number(defaultFee))
    ? Math.max(0, Math.round(Number(defaultFee)))
    : FALLBACK_DEFAULT_DELIVERY_FEE;

  const states = Object.keys(data || {})
    .map(stateName => {
      const lgas = Array.isArray(data[stateName]) ? data[stateName] : [];
      return {
        name: String(stateName || "").trim(),
        cities: lgas.map(lga => ({ name: String(lga || "").trim(), fee })).filter(c => c.name)
      };
    })
    .filter(s => s.name);

  return normalizePricing({
    defaultFee: fee,
    updatedAt: new Date().toISOString(),
    states
  });
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

function formatNaira(n) {
  return Number(n || 0).toLocaleString();
}

function calcSubtotal() {
  return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 0)), 0);
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

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  const cleaned = String(phone || "").replace(/\s+/g, "");
  return /^[+]?(\d{10,15})$/.test(cleaned);
}

function setBtnLoading(isLoading) {
  if (!payNowBtn) return;

  payNowBtn.disabled = isLoading;
  payNowBtn.style.opacity = isLoading ? "0.6" : "1";
  payNowBtn.style.cursor = isLoading ? "not-allowed" : "pointer";

  if (isLoading) {
    payNowBtn.textContent = "PROCESSING…";
  } else {
    payNowBtn.innerHTML = `Pay ₦<span id="payBtnAmount">${formatNaira(getGrandTotal())}</span>`;
  }
}

/* ✅ Segment indicator */
function updateShippingIndicator() {
  if (!shipSegment || !segIndicator) return;
  const type = getSelectedShippingType();
  segIndicator.style.transform = type === "delivery"
    ? "translateX(calc(100% + 10px))"
    : "translateX(0)";
}

/* ================= UI: SHIPPING SHOW/HIDE ================= */
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

/* ================= POPULATE STATES/LGAs ================= */
function populateStates() {
  if (!stateEl) return;

  const states = (pricing.states || [])
    .map(s => s.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

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
  const cities = (st?.cities || [])
    .map(c => c.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const current = cityEl.value || "";

  cityEl.innerHTML =
    `<option value="">Select LGA</option>` +
    cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  if (current && cities.includes(current)) cityEl.value = current;

  cityEl.disabled = cities.length === 0;
}

/* ================= SUMMARY RENDER ================= */
function renderSummaryItems() {
  if (!summaryItemsEl) return;

  if (!Array.isArray(cart) || cart.length === 0) {
    summaryItemsEl.innerHTML = `<p style="opacity:.8">Your cart is empty.</p>`;
    return;
  }

  summaryItemsEl.innerHTML = cart.map(item => {
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const line = price * qty;

    return `
      <div class="summary-item">
        <img src="${item.image}" alt="${escapeHtml(item.name)}" draggable="false">
        <div>
          <div class="summary-name">${escapeHtml(item.name)}</div>
          <div class="summary-meta">Qty: ${qty} • ₦${formatNaira(price)}</div>
        </div>
        <div class="summary-line">₦${formatNaira(line)}</div>
      </div>
    `;
  }).join("");
}

/* ================= TOTALS ================= */
function getGrandTotal() {
  return calcSubtotal() + getDeliveryFee();
}

function updateTotals() {
  const fee = getDeliveryFee();
  const total = getGrandTotal();

  if (deliveryFeeEl) deliveryFeeEl.textContent = formatNaira(fee);
  if (deliveryFeeChipEl) deliveryFeeChipEl.textContent = formatNaira(fee);
  if (totalAmountEl) totalAmountEl.textContent = formatNaira(total);

  const paySpan = document.getElementById("payBtnAmount");
  if (paySpan) paySpan.textContent = formatNaira(total);

  if (payNowBtn) {
    const disabled = cart.length === 0;
    payNowBtn.disabled = disabled;
    payNowBtn.style.opacity = disabled ? "0.6" : "1";
    payNowBtn.style.cursor = disabled ? "not-allowed" : "pointer";
  }
}

/* ================= VALIDATION ================= */
function validateCheckout() {
  const name = nameEl?.value?.trim() || "";
  const email = emailEl?.value?.trim() || "";
  const phone = phoneEl?.value?.trim() || "";

  if (!name) return { ok: false, msg: "Please enter your full name." };
  if (!email || !validateEmail(email)) return { ok: false, msg: "Please enter a valid email address." };
  if (!phone || !validatePhone(phone)) return { ok: false, msg: "Please enter a valid phone number." };
  if (cart.length === 0) return { ok: false, msg: "Your cart is empty." };

  const type = getSelectedShippingType();
  if (type === "delivery") {
    const state = stateEl?.value || "";
    const city = cityEl?.value || "";
    const address = addressEl?.value?.trim() || "";

    if (!state) return { ok: false, msg: "Please select your State for delivery." };
    if (!city) return { ok: false, msg: "Please select your LGA for delivery." };
    if (!address) return { ok: false, msg: "Please enter your delivery address." };
  }

  return { ok: true };
}

/* ================= ORDER SHAPE ================= */
function buildBackendOrder(paystackRef) {
  const name = nameEl.value.trim();
  const email = emailEl.value.trim();
  const phone = phoneEl.value.trim();

  const shippingType = getSelectedShippingType();
  const state = stateEl?.value || "";
  const city = cityEl?.value || "";
  const address = addressEl?.value?.trim() || "";

  const subtotal = calcSubtotal();
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;

  const reference = "KIKELARA_" + Date.now();

  const cartRows = cart.map(i => ({
    id: i.id,
    name: i.name,
    price: Number(i.price || 0),
    qty: Number(i.qty || 0),
    image: i.image,
    total: Number(i.price || 0) * Number(i.qty || 0)
  }));

  return {
    reference,
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
    paystackRef: paystackRef || "",
    createdAt: new Date().toISOString()
  };
}

function saveOrderFallbackLocal(order) {
  try {
    const arr = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY)) || [];
    arr.push(order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(arr));
  } catch {}
}

async function sendOrderToBackend(order) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Backend error: ${res.status} ${txt}`);
  }

  return res.json().catch(() => ({}));
}

/* ================= PAYSTACK ================= */
const PAYSTACK_PUBLIC_KEY = "pk_test_0e491cfbb7461a0ba9a0d58419cdfd6722ad5dee"; // your key

function payWithPaystack() {
  const check = validateCheckout();
  if (!check.ok) {
    alert(check.msg);
    return;
  }

  const email = emailEl.value.trim();
  const total = getGrandTotal();
  const reference = "KIKELARA_" + Date.now();

  setBtnLoading(true);

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: Math.round(total * 100),
    currency: "NGN",
    ref: reference,

    callback: function (response) {
      (async () => {
        try {
          const order = buildBackendOrder(response.reference);

          try {
            await sendOrderToBackend(order);
          } catch (err) {
            console.warn("Backend failed, saving local backup:", err);
            saveOrderFallbackLocal(order);
          }

          localStorage.removeItem(CART_KEY);

          alert("✅ Payment successful! Your order has been placed.");
          window.location.href = "index.html";
        } catch (err) {
          console.error(err);
          alert("Payment succeeded, but saving the order failed. Contact support with reference: " + reference);
        } finally {
          setBtnLoading(false);
        }
      })();
    },

    onClose: function () {
      setBtnLoading(false);
      alert("Payment cancelled.");
    }
  });

  handler.openIframe();
}

/* ================= UTILS ================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

/* ================= INIT ================= */
(async function init() {
  renderSummaryItems();
  updateShippingUI();

  // pricing fallback chain
  try {
    pricing = await fetchPricingFromServer();
    savePricingBackup(pricing);
  } catch (e1) {
    console.warn("Pricing server failed, trying local backup:", e1);

    const backup = loadPricingBackup();
    if (backup?.states?.length) {
      pricing = backup;
    } else {
      console.warn("No usable backup pricing, fetching Nigeria LGA dataset...");
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
})();
