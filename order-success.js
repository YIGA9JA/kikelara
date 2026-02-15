/* ===================== ORDER-SUCCESS.JS (FULL UPDATED + WAIT FOR WEBHOOK CONFIRM) ===================== */

const API_BASE = window.API_BASE || ""; // from config.js
const LAST_ORDER_KEY = "kikelara_last_order_v1";
const LOCAL_ORDERS_KEY = "orders_backup";

/* ===================== SETTINGS ===================== */
const POLL_INTERVAL_MS = 2500;     // how often we re-check backend
const POLL_TIMEOUT_MS  = 90_000;   // stop polling after 90s

/* ===================== HELPERS ===================== */
function formatNaira(n) {
  return "₦" + Number(n || 0).toLocaleString();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function getRefFromURL() {
  const params = new URLSearchParams(location.search);
  return params.get("ref") || "";
}

function findOrderByRefInBackup(ref) {
  if (!ref) return null;
  const arr = safeJSON(LOCAL_ORDERS_KEY, []);
  if (!Array.isArray(arr)) return null;

  for (let i = arr.length - 1; i >= 0; i--) {
    const o = arr[i];
    if (o && String(o.reference || "") === String(ref)) return o;
  }
  return null;
}

function safeGetLocalReceiptOrder() {
  const last = safeJSON(LAST_ORDER_KEY, null);
  if (last && Array.isArray(last.cart)) return last;

  const ref = getRefFromURL();
  const found = findOrderByRefInBackup(ref);
  if (found && Array.isArray(found.cart)) return found;

  return null;
}

function isPaidStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  return s === "paid" || s.includes("paid");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ===================== HERO STATE (CONFIRMING -> CONFIRMED) ===================== */
function setHeroActionsVisible(show) {
  const box = document.getElementById("heroActions");
  if (!box) return;
  box.style.display = show ? "flex" : "none";
}

function setInvoiceVisible(show) {
  const wrap = document.getElementById("receiptWrap");
  if (!wrap) return;
  wrap.style.display = show ? "block" : "none";
}

function setHeroState(state, ref) {
  const confirmText = document.getElementById("confirmText");
  const heroTitle = document.getElementById("heroTitle");
  const heroRef = document.getElementById("heroRef");
  const progressBar = document.getElementById("progressBar");
  const orbIcon = document.getElementById("orbIcon");
  const heroNote = document.getElementById("heroNote");

  if (heroRef) heroRef.textContent = ref || "—";

  if (state === "confirmed") {
    if (confirmText) confirmText.textContent = "Payment confirmed";
    if (heroTitle) heroTitle.textContent = "Payment confirmed";
    if (progressBar) progressBar.style.width = "100%";
    if (orbIcon) orbIcon.textContent = "✓";
    if (heroNote) heroNote.textContent = "Your payment is confirmed. Your invoice is now available below.";

    setHeroActionsVisible(true);
    setInvoiceVisible(true);
    return;
  }

  // confirming
  if (confirmText) confirmText.textContent = "Confirming payment…";
  if (heroTitle) heroTitle.textContent = "Confirming payment…";
  if (progressBar) progressBar.style.width = "55%";
  if (orbIcon) orbIcon.textContent = "⏳";
  if (heroNote) heroNote.textContent =
    "We’re waiting for confirmation from Paystack. This usually takes a few seconds.";

  setHeroActionsVisible(false);
  setInvoiceVisible(false);
}

/* ===================== STATUS PILL (INVOICE) ===================== */
function statusToPill(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();

  // default to pending unless confirmed
  let label = "CONFIRMING";
  let tone = "verifying";

  if (s.includes("failed")) { label = "PENDING CONFIRMATION"; tone = "warning"; }
  else if (s.includes("pending")) { label = "PENDING"; tone = "pending"; }
  else if (s.includes("paid")) { label = "PAID"; tone = "paid"; }

  return { label, tone };
}

function applyPillTone(tone) {
  const el = document.getElementById("receiptStatus");
  if (!el) return;

  el.classList.remove("pill--paid", "pill--pending", "pill--verifying", "pill--warning");
  el.classList.add(
    tone === "verifying" ? "pill--verifying"
    : tone === "warning" ? "pill--warning"
    : tone === "pending" ? "pill--pending"
    : "pill--paid"
  );
}

/* ===================== BACKEND FETCH (PUBLIC ORDER) =====================
   Requires endpoint:
   GET /orders/public/:reference
   response: { ok:true, order:{ payload or row } }
   If your backend returns { order: { payload: {...} } }, we normalize below.
*/
async function fetchReceiptFromBackend(ref) {
  if (!API_BASE || !ref) return null;

  try {
    const res = await fetch(`${API_BASE}/orders/public/${encodeURIComponent(ref)}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    if (!data) return null;

    // Normalize possible shapes:
    // 1) { ok:true, order: { ...payloadFields } }
    // 2) { success:true, order: { payload: {...} } }
    // 3) { order: { payload: {...} } }
    const ord = data.order || data?.data?.order || null;
    if (!ord) return null;

    const payload = (ord.payload && typeof ord.payload === "object") ? ord.payload : ord;

    if (payload && Array.isArray(payload.cart)) return payload;
    return null;
  } catch {
    return null;
  }
}

/* ===================== RENDER RECEIPT (ONLY WHEN CONFIRMED) ===================== */
function renderReceipt(order) {
  const noBox = document.getElementById("noReceiptBox");

  if (!order || !Array.isArray(order.cart)) {
    if (noBox) noBox.style.display = "block";
    return;
  }
  if (noBox) noBox.style.display = "none";

  setText("receiptRef", order.reference || "—");

  const pill = statusToPill(order.status);
  setText("receiptStatus", pill.label);
  applyPillTone(pill.tone);

  const when = order.paidAt || order.createdAt || new Date().toISOString();
  const prefix = isPaidStatus(order.status) ? "Paid at: " : "Received at: ";
  setText("receiptDate", prefix + new Date(when).toLocaleString());

  setText("rName", order.name || "—");
  setText("rEmail", order.email || "—");
  setText("rPhone", order.phone || "—");

  setText("rShipType", order.shippingType || "—");
  setText("rState", order.state || "—");
  setText("rCity", order.city || "—");
  setText("rAddress", order.address || "—");

  const tbody = document.getElementById("receiptItems");
  if (tbody) {
    tbody.innerHTML = "";

    order.cart.forEach((it) => {
      const qty = Number(it.qty || 0);
      const price = Number(it.price || 0);
      const line = price * qty;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.name)}</td>
        <td class="right">${qty}</td>
        <td class="right">${formatNaira(price)}</td>
        <td class="right">${formatNaira(line)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  setText("rSubtotal", formatNaira(order.subtotal));
  setText("rDelivery", formatNaira(order.deliveryFee));
  setText("rTotal", formatNaira(order.total));
}

/* ===================== INVOICE BUILDER (DOWNLOAD) ===================== */
function buildInvoiceHTML(order) {
  const rows = (order.cart || []).map((it) => {
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    const line = qty * price;

    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;">${escapeHtml(it.name)}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">${qty}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">${formatNaira(price)}</td>
        <td style="padding:12px;border-bottom:1px solid #eee;text-align:right;">${formatNaira(line)}</td>
      </tr>
    `;
  }).join("");

  const when = order.paidAt || order.createdAt || new Date().toISOString();
  const statusLabel = isPaidStatus(order.status) ? "PAID" : "CONFIRMING";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice - ${escapeHtml(order.reference || "KIKELARA")}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial,sans-serif;color:#111;max-width:920px;margin:24px auto;padding:0 14px;">
  <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">
    <div>
      <h2 style="margin:0;">KÍKÉ LÁRÁ</h2>
      <div style="opacity:.75;">Receipt / Invoice</div>
      <div style="opacity:.75;margin-top:6px;">Paid at: ${new Date(when).toLocaleString()}</div>
    </div>
    <div style="text-align:right;">
      <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#f2f2f2;font-size:12px;font-weight:800;">
        ${escapeHtml(statusLabel)}
      </div>
      <div style="opacity:.75;margin-top:6px;">Reference: <b>${escapeHtml(order.reference || "—")}</b></div>
    </div>
  </div>

  <h3 style="margin:18px 0 8px;">Items</h3>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;padding:12px;border-bottom:1px solid #eee;">Item</th>
        <th style="text-align:right;padding:12px;border-bottom:1px solid #eee;">Qty</th>
        <th style="text-align:right;padding:12px;border-bottom:1px solid #eee;">Price</th>
        <th style="text-align:right;padding:12px;border-bottom:1px solid #eee;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="margin-top:14px;">
    <div style="display:flex;justify-content:space-between;padding:6px 0;">
      <span style="opacity:.75;">Subtotal</span><span>${formatNaira(order.subtotal)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;">
      <span style="opacity:.75;">Delivery</span><span>${formatNaira(order.deliveryFee)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:800;">
      <span>Total Paid</span><span>${formatNaira(order.total)}</span>
    </div>
  </div>

  <h3 style="margin:18px 0 8px;">Customer & Delivery</h3>
  <div style="line-height:1.7;opacity:.9;">
    <div><b>Name:</b> ${escapeHtml(order.name || "")}</div>
    <div><b>Email:</b> ${escapeHtml(order.email || "")}</div>
    <div><b>Phone:</b> ${escapeHtml(order.phone || "")}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:12px 0;">
    <div><b>Shipping:</b> ${escapeHtml(order.shippingType || "")}</div>
    <div><b>State:</b> ${escapeHtml(order.state || "")}</div>
    <div><b>LGA/City:</b> ${escapeHtml(order.city || "")}</div>
    <div><b>Address:</b> ${escapeHtml(order.address || "")}</div>
  </div>
</body>
</html>
  `.trim();
}

function downloadTextFile(filename, content, mime = "text/html") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ===================== POLL UNTIL WEBHOOK CONFIRMS ===================== */
async function pollUntilConfirmed(ref, timeoutMs = POLL_TIMEOUT_MS) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const fresh = await fetchReceiptFromBackend(ref);

    if (fresh && isPaidStatus(fresh.status)) {
      try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(fresh)); } catch {}
      return fresh;
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  return null;
}

/* ===================== INIT ===================== */
document.addEventListener("DOMContentLoaded", async () => {
  const ref = getRefFromURL();

  // Default UI: confirming
  setHeroState("confirming", ref);

  // Hide invoice/buttons until confirmed
  setInvoiceVisible(false);
  setHeroActionsVisible(false);

  // Attach buttons (but they won't be visible until confirmed)
  document.getElementById("printBtn")?.addEventListener("click", () => window.print());

  document.getElementById("downloadBtn")?.addEventListener("click", () => {
    const o = safeJSON(LAST_ORDER_KEY, null);
    if (!o || !isPaidStatus(o.status)) return;

    const html = buildInvoiceHTML(o);
    const refSafe = (o.reference || "KIKELARA").replace(/[^a-z0-9_-]/gi, "_");
    downloadTextFile(`KIKELARA-INVOICE-${refSafe}.html`, html, "text/html");
  });

  // If we have local data, keep it, but DO NOT show invoice/buttons until confirmed
  const local = safeGetLocalReceiptOrder();
  if (local && local.reference) {
    // keep reference on UI
    setText("receiptRef", local.reference);
  }

  // ✅ Poll backend until webhook sets Paid
  if (ref) {
    const confirmed = await pollUntilConfirmed(ref);

    if (confirmed) {
      // show confirmed hero + show invoice/actions
      setHeroState("confirmed", confirmed.reference);
      renderReceipt(confirmed);
      return;
    }
  }

  // If not confirmed after timeout:
  // keep user on confirming page; invoice stays hidden.
  const heroNote = document.getElementById("heroNote");
  if (heroNote) {
    heroNote.textContent =
      "Still confirming payment. If this persists, please contact support with your reference.";
  }

  // keep it in confirming state
  setHeroState("confirming", ref);
});
