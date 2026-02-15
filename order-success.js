/* ===================== ORDER-SUCCESS.JS (FULL UPDATED + ROBUST CONFIRM) ===================== */

const API_BASE = (window.API_BASE || "").replace(/\/$/, ""); // from config.js
const LAST_ORDER_KEY = "kikelara_last_order_v1";
const LOCAL_ORDERS_KEY = "orders_backup";

/* ===================== SETTINGS ===================== */
const POLL_INTERVAL_MS = 2500;     // how often we re-check backend
const POLL_TIMEOUT_MS  = 120_000;  // stop polling after 120s

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
   Expected endpoint:
   GET /orders/public/:reference
   - 200 + { ok:true, order:{...} } => returns normalized payload
   - 404 => treat as "Pending" (order not created yet or webhook delayed)
*/
async function fetchReceiptFromBackend(ref) {
  if (!API_BASE || !ref) return { kind: "error", order: null };

  try {
    const res = await fetch(`${API_BASE}/orders/public/${encodeURIComponent(ref)}`, {
      method: "GET",
      cache: "no-store"
    });

    // ✅ IMPORTANT: 404 is NOT a fatal error here — it just means "not created yet"
    if (res.status === 404) {
      return { kind: "pending", order: { reference: ref, status: "Pending" } };
    }

    if (!res.ok) {
      return { kind: "error", order: null };
    }

    const data = await res.json().catch(() => null);
    if (!data) return { kind: "error", order: null };

    const ord = data.order || data?.data?.order || null;
    if (!ord) return { kind: "error", order: null };

    const payload = (ord.payload && typeof ord.payload === "object") ? ord.payload : ord;

    // Ensure reference exists
    payload.reference = payload.reference || ref;

    return { kind: "ok", order: payload };
  } catch {
    return { kind: "error", order: null };
  }
}

/* ===================== OPTIONAL FALLBACK VERIFY =====================
   If webhook is slow/blocked, we can try verify endpoint (if your backend has it):
   POST /payments/paystack/verify { reference }
   - If it returns Paid, your backend should mark order Paid.
*/
async function tryFallbackVerify(ref) {
  if (!API_BASE || !ref) return false;

  try {
    const res = await fetch(`${API_BASE}/payments/paystack/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ reference: ref })
    });

    if (!res.ok) return false;
    const data = await res.json().catch(() => null);

    // If backend returns { success:true, verified:true, order:{...} }
    const ord = data?.order?.payload || data?.order || null;
    if (ord && isPaidStatus(ord.status || data?.order?.status)) return true;

    // If backend returns some other shape but verified is true
    if (data?.verified === true || data?.success === true) return true;

    return false;
  } catch {
    return false;
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

/* ===================== POLL UNTIL CONFIRMED ===================== */
async function pollUntilConfirmed(ref, timeoutMs = POLL_TIMEOUT_MS) {
  const start = Date.now();
  let tries = 0;

  while (Date.now() - start < timeoutMs) {
    tries++;

    const { kind, order } = await fetchReceiptFromBackend(ref);

    if (order && isPaidStatus(order.status)) {
      try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch {}
      return order;
    }

    // ✅ After a few tries, attempt fallback verify once in a while
    // This helps when webhook is not coming through.
    if (tries === 4 || tries === 10 || tries === 18) {
      await tryFallbackVerify(ref);
    }

    await sleep(POLL_INTERVAL_MS);
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
    setText("receiptRef", local.reference);
  }

  // ✅ Poll backend until "Paid"
  if (ref) {
    const confirmed = await pollUntilConfirmed(ref);

    if (confirmed) {
      setHeroState("confirmed", confirmed.reference);
      renderReceipt(confirmed);
      return;
    }
  }

  // Not confirmed after timeout:
  const heroNote = document.getElementById("heroNote");
  if (heroNote) {
    heroNote.textContent =
      "Still confirming payment. If this persists, please contact support with your reference.";
  }

  // stay in confirming mode; invoice/actions remain hidden
  setHeroState("confirming", ref);
});
