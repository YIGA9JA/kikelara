/* ===================== CHECKOUT.JS (WEBHOOK CREATES/UPDATES PAID ORDERS ✅) ===================== */
/**
 * ✅ Uses your existing backend exactly:
 *   GET  /delivery-pricing
 *   POST /orders        (idempotent pending upsert)
 *   POST /order         (alias)
 *   (NO client verify)
 *
 * ✅ Paystack webhook on backend is the source of truth:
 *   POST /payments/paystack/webhook
 *
 * ✅ No "PIN delete" / no pin logic here at all.
 */

/* ================= API (BACKEND) ================= */
const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");

/* ================= NIGERIA STATES + LGAs (FALLBACK SOURCE) ================= */
const NIGERIA_LGA_SOURCE =
  "https://gist.githubusercontent.com/chrisidakwo/4ba3a4f03afc442305021be4ca67738e/raw/a8276ee3a756ae47ee853c4be5a82a11d6c8a313/nigerian-states.json";

/* ================= STORAGE KEYS ================= */
const CART_KEY = "cart";
const PRICING_BACKUP_KEY = "deliveryPricing_backup_v1";
const LOCAL_ORDERS_KEY = "orders_backup";
const LAST_ORDER_KEY = "kikelara_last_order_v1";

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

/* ================= PAYSTACK ================= */
const PAYSTACK_PUBLIC_KEY =
  window.PAYSTACK_PUBLIC_KEY ||
  "pk_test_0e491cfbb7461a0ba9a0d58419cdfd6722ad5dee";

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
  if (!API_BASE) throw new Error("API_BASE missing");
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

function getGrandTotal() {
  return calcSubtotal() + getDeliveryFee();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

function setBtnLoading(isLoading, label) {
  if (!payNowBtn) return;
  payNowBtn.disabled = isLoading;
  payNowBtn.style.opacity = isLoading ? "0.6" : "1";
  payNowBtn.style.cursor = isLoading ? "not-allowed" : "pointer";

  if (isLoading) payNowBtn.textContent = label || "PROCESSING…";
  else payNowBtn.innerHTML = `Pay ₦<span id="payBtnAmount">${formatNaira(getGrandTotal())}</span>`;
}

/* ✅ Segment indicator */
function updateShippingIndicator() {
  if (!shipSegment || !segIndicator) return;
  const type = getSelectedShippingType();
  segIndicator.style.transform = type === "delivery"
    ? "translateX(calc(100% + 10px))"
    : "translateX(0)";
}

/* ================= UI ================= */
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

/* ================= POPULATE STATES/LGAs ================= */
function populateStates() {
  if (!stateEl) return;

  const states = (pricing.states || []).map(s => s.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
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
  const cities = (st?.cities || []).map(c => c.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const current = cityEl.value || "";

  cityEl.innerHTML =
    `<option value="">Select LGA</option>` +
    cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  if (current && cities.includes(current)) cityEl.value = current;
  cityEl.disabled = cities.length === 0;
}

/* ================= SUMMARY ================= */
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

  if (!API_BASE) return { ok: false, msg: "Checkout not configured (API_BASE missing)." };
  if (!PAYSTACK_PUBLIC_KEY) return { ok: false, msg: "Checkout not configured (Paystack key missing)." };

  return { ok: true };
}

/* ================= ORDER DRAFT ================= */
function buildBackendOrderDraft(reference) {
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

  const cartRows = cart.map(i => ({
    id: i.id,
    name: i.name,
    price: Number(i.price || 0),
    qty: Number(i.qty || 0),
    image: i.image,
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

function saveOrderFallbackLocal(order) {
  try {
    const arr = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY)) || [];
    arr.push(order);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(arr));
  } catch {}
}

function saveLastOrderForReceipt(order) {
  try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch {}
}

/* ================= BACKEND: SAVE PENDING ORDER (IDEMPOTENT) ================= */
async function savePendingOrderToServer(draftOrder) {
  const res = await fetch(`${API_BASE}/orders`, {
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

/* ================= PAYSTACK FLOW ================= */
function payWithPaystack() {
  const check = validateCheckout();
  if (!check.ok) return alert(check.msg);

  const email = emailEl.value.trim();
  const total = getGrandTotal();

  // ✅ Use a strong unique reference (matches backend max 200)
  const reference = `KIKELARA_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

  setBtnLoading(true, "SAVING ORDER…");

  const draft = buildBackendOrderDraft(reference);

  // local receipt immediately
  saveLastOrderForReceipt({ ...draft, status: "Pending (Awaiting Payment)" });

  // ✅ Save pending order FIRST so webhook can update it to Paid
  (async () => {
    try {
      await savePendingOrderToServer(draft);
    } catch (err) {
      console.warn(err);

      // Not fatal: webhook can still create Paid order even if this failed,
      // but we keep a local backup so you can reconcile.
      saveOrderFallbackLocal({ ...draft, status: "Pending (Server Save Failed)" });
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

        // ✅ Do NOT call /payments/paystack/verify here.
        // Webhook will verify + mark Paid.
        const receipt = {
          ...draft,
          reference: payRef,
          paystackRef: payRef,
          status: "Payment Received (Awaiting Confirmation)"
        };

        saveLastOrderForReceipt(receipt);

        // clear cart so user doesn't pay twice
        localStorage.removeItem(CART_KEY);

        window.location.href = `order-success.html?ref=${encodeURIComponent(payRef)}`;
      },

      onClose: function () {
        setBtnLoading(false);
        alert("Payment cancelled.");
      }
    });

    handler.openIframe();
  })().catch((e) => {
    console.error(e);
    setBtnLoading(false);
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

/* ================= INIT ================= */
(async function init() {
  renderSummaryItems();
  updateShippingUI();

  try {
    pricing = await fetchPricingFromServer();
    savePricingBackup(pricing);
  } catch (e1) {
    console.warn("Pricing server failed, trying local backup:", e1);

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
})();
