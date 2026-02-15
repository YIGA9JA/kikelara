/* ===================== ORDER-SUCCESS.JS (SHOW INVOICE ONLY WHEN CONFIRMED) ===================== */

const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
const LAST_ORDER_KEY = "kikelara_last_order_v1";
const LOCAL_ORDERS_KEY = "orders_backup";

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_TRIES = 30;

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

function safeGetReceiptOrder() {
  const ref = getRefFromURL();

  const last = safeJSON(LAST_ORDER_KEY, null);
  if (last && Array.isArray(last.cart) && (!ref || String(last.reference || "") === String(ref))) return last;

  const found = findOrderByRefInBackup(ref);
  if (found && Array.isArray(found.cart)) return found;

  if (last && Array.isArray(last.cart)) return last;
  return null;
}

async function fetchReceiptFromBackend(ref) {
  if (!API_BASE || !ref) return null;

  try {
    const res = await fetch(`${API_BASE}/orders/public/${encodeURIComponent(ref)}`, {
      method: "GET",
      cache: "no-store"
    });
    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    const order = data?.order || null;
    if (order && Array.isArray(order.cart)) return order;
    return null;
  } catch {
    return null;
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function isPaidStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  return s === "paid" || s.includes("paid");
}

function toggleInvoiceActions(canShow) {
  const actions = document.getElementById("actionsBox");
  const warn = document.getElementById("notConfirmedBox");

  if (actions) actions.style.display = canShow ? "flex" : "none";
  if (warn) warn.style.display = canShow ? "none" : "block";
}

function setHero(ref, statusRaw) {
  const heroRef = document.getElementById("heroRef");
  if (heroRef) heroRef.textContent = ref || "—";

  const heroTitle = document.getElementById("heroTitle");
  const confirmText = document.getElementById("confirmText");
  const progress = document.getElementById("progressBar");

  const paid = isPaidStatus(statusRaw);

  if (paid) {
    if (heroTitle) heroTitle.textContent = "Payment confirmed";
    if (confirmText) confirmText.textContent = "Confirmed ✅";
    if (progress) progress.style.width = "100%";
  } else {
    if (heroTitle) heroTitle.textContent = "Payment received";
    if (confirmText) confirmText.textContent = "Confirming payment…";
    if (progress && !progress.style.width) progress.style.width = "55%";
  }
}

function statusToPill(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();

  let label = "CONFIRMING";
  let tone = "pending";

  if (s.includes("failed")) { label = "PENDING CONFIRMATION"; tone = "warning"; }
  else if (s.includes("verif")) { label = "VERIFYING"; tone = "verifying"; }
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

function renderReceipt(order) {
  const noBox = document.getElementById("noReceiptBox");

  if (!order || !Array.isArray(order.cart)) {
    if (noBox) noBox.style.display = "block";
    toggleInvoiceActions(false);
    return;
  }
  if (noBox) noBox.style.display = "none";

  const ref = order.reference || order.paystackRef || "—";
  setText("receiptRef", ref);

  const pill = statusToPill(order.status);
  setText("receiptStatus", pill.label);
  applyPillTone(pill.tone);

  setHero(ref, order.status);

  // ✅ only show print/download when truly PAID
  toggleInvoiceActions(isPaidStatus(order.status));

  const when = order.paidAt || order.createdAt || new Date().toISOString();
  const prefix = isPaidStatus(order.status) ? "Paid at: " : "Updated at: ";
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

function buildInvoiceHTML(order) {
  const rows = (order.cart || []).map((it) => {
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    const line = qty * price;

    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(it.name)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${qty}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${formatNaira(price)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${formatNaira(line)}</td>
      </tr>
    `;
  }).join("");

  const when = order.paidAt || order.createdAt || new Date().toISOString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice - ${escapeHtml(order.reference || "KIKELARA")}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial,sans-serif;color:#111;max-width:900px;margin:24px auto;padding:0 14px;">
  <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
    <div>
      <h2 style="margin:0;">KÍKÉ LÁRÁ</h2>
      <div style="opacity:.75;">Receipt / Invoice</div>
      <div style="opacity:.75;margin-top:6px;">Paid at: ${new Date(when).toLocaleString()}</div>
    </div>
    <div style="text-align:right;">
      <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#e8f7ee;color:#116b34;font-size:12px;font-weight:800;">
        PAID
      </div>
      <div style="opacity:.75;margin-top:6px;">Reference: <b>${escapeHtml(order.reference || "—")}</b></div>
    </div>
  </div>

  <h3 style="margin:18px 0 8px;">Items</h3>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;padding:10px;border-bottom:1px solid #eee;">Item</th>
        <th style="text-align:right;padding:10px;border-bottom:1px solid #eee;">Qty</th>
        <th style="text-align:right;padding:10px;border-bottom:1px solid #eee;">Price</th>
        <th style="text-align:right;padding:10px;border-bottom:1px solid #eee;">Total</th>
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
      <span>Total</span><span>${formatNaira(order.total)}</span>
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

async function pollUntilPaid(ref) {
  if (!ref) return;
  if (!API_BASE) return; // cannot poll without backend

  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    const fresh = await fetchReceiptFromBackend(ref);
    if (fresh) {
      try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(fresh)); } catch {}
      renderReceipt(fresh);

      if (isPaidStatus(fresh.status)) return;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Hide invoice actions initially (until paid)
  toggleInvoiceActions(false);

  // First paint from local storage
  let order = safeGetReceiptOrder();
  renderReceipt(order);

  const ref = getRefFromURL() || order?.reference || order?.paystackRef || "";
  setHero(ref, order?.status);

  // Copy ref
  document.getElementById("copyRefBtn")?.addEventListener("click", async () => {
    const r = getRefFromURL() || safeGetReceiptOrder()?.reference || "";
    if (!r) return alert("No reference to copy.");
    try {
      await navigator.clipboard.writeText(r);
      alert("Reference copied ✅");
    } catch {
      alert("Copy failed. You can manually copy the reference.");
    }
  });

  // Print (guard: only allow if paid)
  document.getElementById("printBtn")?.addEventListener("click", () => {
    const o = safeGetReceiptOrder();
    if (!o || !isPaidStatus(o.status)) {
      alert("Invoice will be available after payment is confirmed.");
      return;
    }
    window.print();
  });

  // Download invoice (guard: only allow if paid)
  document.getElementById("downloadBtn")?.addEventListener("click", () => {
    const o = safeGetReceiptOrder();
    if (!o || !isPaidStatus(o.status)) {
      alert("Invoice will be available after payment is confirmed.");
      return;
    }

    const html = buildInvoiceHTML(o);
    const refSafe = (o.reference || "KIKELARA").replace(/[^a-z0-9_-]/gi, "_");
    downloadTextFile(`KIKELARA-INVOICE-${refSafe}.html`, html, "text/html");
  });

  // Poll server until webhook marks Paid
  await pollUntilPaid(ref);
});
