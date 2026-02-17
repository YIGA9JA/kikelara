/* ================= cart.js (USES store.js) =================
   ✅ Renders cart from KStore
   ✅ Qty +/- remove
   ✅ Checkout button totals
   ✅ Sticky mobile bar
=========================================================== */

(() => {
  const cartItems = document.getElementById("cartItems");
  const subtotalEl = document.getElementById("subtotal");
  const totalEl = document.getElementById("total");

  const checkoutBtn = document.getElementById("checkoutBtn");
  const checkoutBtnTotal = document.getElementById("checkoutBtnTotal");

  const mobileCheckout = document.getElementById("mobileCheckout");
  const mobileCheckoutBtn = document.getElementById("mobileCheckoutBtn");
  const mobileCheckoutTotal = document.getElementById("mobileCheckoutTotal");

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNaira(n) {
    return `₦${Number(n || 0).toLocaleString()}`;
  }

  function calcSubtotal(cart) {
    return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty || 0)), 0);
  }

  function updateSummary(cart) {
    const sub = calcSubtotal(cart);
    const total = sub;

    if (subtotalEl) subtotalEl.textContent = formatNaira(sub);
    if (totalEl) totalEl.textContent = formatNaira(total);
    if (checkoutBtnTotal) checkoutBtnTotal.textContent = formatNaira(total);
    if (mobileCheckoutTotal) mobileCheckoutTotal.textContent = formatNaira(total);

    const empty = cart.length === 0;
    if (checkoutBtn) checkoutBtn.disabled = empty;
    if (mobileCheckoutBtn) mobileCheckoutBtn.disabled = empty;
    if (checkoutBtn) checkoutBtn.style.opacity = empty ? "0.55" : "1";
    if (mobileCheckoutBtn) mobileCheckoutBtn.style.opacity = empty ? "0.55" : "1";
  }

  function render(cart) {
    if (!cartItems) return;

    cartItems.innerHTML = "";

    if (!cart.length) {
      cartItems.innerHTML = `
        <div class="empty">
          <div class="empty-title">Your cart is empty.</div>
          <div class="empty-sub">Go to the shop and add something you love.</div>
          <a class="empty-btn" href="products.html">Back to Shop</a>
        </div>
      `;
      updateSummary([]);
      return;
    }

    cart.forEach(item => {
      const id = String(item.id);
      const qty = Number(item.qty || 1);
      const price = Number(item.price || 0);

      const nameSafe = escapeHtml(item.name);
      const imgSrc = escapeHtml(item.image || "images_brown/bodyButter.png");

      const row = document.createElement("div");
      row.className = "cart-item";

      row.innerHTML = `
        <img class="cart-img" src="${imgSrc}" alt="${nameSafe}" draggable="false">
        <div class="cart-info">
          <div class="cart-name">${nameSafe}</div>

          <div class="cart-meta">
            <span class="cart-price">${formatNaira(price)}</span>
            <span class="cart-dot">•</span>
            <span class="cart-line">${formatNaira(price * qty)}</span>
          </div>

          <div class="qty">
            <button class="qty-btn" data-action="decrease" data-id="${id}" aria-label="Decrease quantity">−</button>
            <span class="qty-num">${qty}</span>
            <button class="qty-btn" data-action="increase" data-id="${id}" aria-label="Increase quantity">+</button>
          </div>
        </div>

        <button class="remove" data-action="remove" data-id="${id}" type="button" aria-label="Remove item">
          Remove
        </button>
      `;

      cartItems.appendChild(row);
    });

    updateSummary(cart);
  }

  function updateMobileBar() {
    const isMobile = window.matchMedia("(max-width: 980px)").matches;
    if (!mobileCheckout) return;
    mobileCheckout.style.display = isMobile ? "block" : "none";
  }

  function goCheckout() {
    const cart = window.KStore?.getCart?.() || [];
    if (!cart.length) return;
    window.location.href = "checkout.html";
  }

  cartItems?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "increase") window.KStore.incQty(id);
    if (action === "decrease") window.KStore.decQty(id);
    if (action === "remove") window.KStore.removeFromCart(id);
  });

  checkoutBtn?.addEventListener("click", goCheckout);
  mobileCheckoutBtn?.addEventListener("click", goCheckout);

  document.addEventListener("DOMContentLoaded", () => {
    updateMobileBar();
    window.addEventListener("resize", updateMobileBar);

    // initial render
    render(window.KStore.getCart());
    window.KStore.syncBadges();

    // live updates from any page/tab
    window.KStore.subscribe((evt) => {
      if (evt.type === "CART_CHANGED" || evt.type === "INIT") {
        render(evt.cart || window.KStore.getCart());
      }
    });
  });
})();
