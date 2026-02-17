// header.js — Premium capsule header (Osmo/Jeton/Gufram-inspired)
// - Injects into <div id="siteHeader"></div>
// - Center pill nav with sliding active indicator
// - Sticky glass header, better scroll behavior
// - Mobile drawer with overlay + scroll lock
// - Cart badge reads sessionStorage("cart")

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("siteHeader");
  if (!mount) return;

  mount.innerHTML = `
    <header class="cap-header" id="capHeader">
      <div class="cap-inner">
        <a class="cap-brand" href="index.html" aria-label="KÍKÉLÁRÁ home">
          <img src="images/logo.jpg" alt="KÍKÉLÁRÁ logo" />
          <span>KÍKÉLÁRÁ</span>
        </a>

        <nav class="cap-nav" id="capNav" aria-label="Primary navigation">
          <span class="cap-indicator" id="capIndicator" aria-hidden="true"></span>
          <a href="index.html" data-nav="index.html">Home</a>
          <a href="products.html" data-nav="products.html">Products</a>
          <a href="about.html" data-nav="about.html">About</a>
          <a href="contact.html" data-nav="contact.html">Contact</a>
        </nav>

        <div class="cap-actions">
          <a class="cap-cta" href="products.html">Shop</a>

          <a class="cap-icon" href="cart.html" aria-label="Cart">
            <span class="cap-ico">🛒</span>
            <span class="cap-badge" id="cartCountBadge">0</span>
          </a>

          <button class="cap-menu" id="menuToggle"
            type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileDrawer">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>

    <div class="cap-overlay" id="capOverlay" aria-hidden="true"></div>

    <aside class="cap-drawer" id="mobileDrawer" aria-label="Mobile navigation" aria-hidden="true">
      <div class="drawer-top">
        <a class="drawer-brand" href="index.html" data-nav="index.html">
          <img src="images/logo.jpg" alt="KÍKÉLÁRÁ logo" />
          <span>KÍKÉLÁRÁ</span>
        </a>
        <button class="drawer-close" id="drawerClose" type="button" aria-label="Close menu">✕</button>
      </div>

      <div class="drawer-links">
        <a href="index.html" data-nav="index.html">Home</a>
        <a href="products.html" data-nav="products.html">Products</a>
        <a href="cart.html" data-nav="cart.html">Cart</a>
        <a href="about.html" data-nav="about.html">About</a>
        <a href="contact.html" data-nav="contact.html">Contact</a>
      </div>

      <div class="drawer-bottom">
        <div class="drawer-note">Luxury skincare inspired by nature.</div>
        <a class="drawer-cta" href="products.html">Shop Collection</a>
      </div>
    </aside>
  `;

  const header = document.getElementById("capHeader");
  const nav = document.getElementById("capNav");
  const indicator = document.getElementById("capIndicator");

  const toggleBtn = document.getElementById("menuToggle");
  const overlay = document.getElementById("capOverlay");
  const drawer = document.getElementById("mobileDrawer");
  const closeBtn = document.getElementById("drawerClose");

  const cartBadge = document.getElementById("cartCountBadge");

  // ---- Active link
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  mount.querySelectorAll("[data-nav]").forEach(a => {
    const href = String(a.getAttribute("data-nav") || "").toLowerCase();
    if (href === current) a.classList.add("active");
  });

  // ---- Sliding indicator (Osmo-style pill)
  function positionIndicator() {
    if (!nav || !indicator) return;
    const active = nav.querySelector("a.active") || nav.querySelector("a");
    if (!active) return;

    const navRect = nav.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();

    const x = Math.round(aRect.left - navRect.left);
    const w = Math.round(aRect.width);

    indicator.style.transform = `translateX(${x}px)`;
    indicator.style.width = `${w}px`;
  }

  positionIndicator();
  window.addEventListener("resize", positionIndicator, { passive: true });

  // Update indicator on hover/focus (feels premium)
  nav?.addEventListener("mouseover", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const navRect = nav.getBoundingClientRect();
    const aRect = a.getBoundingClientRect();
    indicator.style.transform = `translateX(${Math.round(aRect.left - navRect.left)}px)`;
    indicator.style.width = `${Math.round(aRect.width)}px`;
  });

  nav?.addEventListener("mouseleave", positionIndicator);

  // ---- Scroll polish (shadow + slight tighten)
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---- Cart badge
  function safeParse(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function getCartCount() {
    const cart = safeParse("cart", []);
    if (!Array.isArray(cart)) return 0;

    let total = 0;
    for (const item of cart) {
      const q = Number(item?.qty ?? item?.quantity ?? 1);
      total += Number.isFinite(q) ? q : 1;
    }
    return total;
  }

  function renderCart() {
    if (!cartBadge) return;
    const n = getCartCount();
    cartBadge.textContent = String(n);
    cartBadge.classList.toggle("show", n > 0);
  }

  renderCart();
  window.addEventListener("storage", renderCart);
  window.addEventListener("focus", renderCart);

  // ---- Drawer controls
  function openDrawer() {
    toggleBtn.classList.add("active");
    drawer.classList.add("show");
    overlay.classList.add("show");

    toggleBtn.setAttribute("aria-expanded", "true");
    drawer.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-hidden", "false");

    document.documentElement.classList.add("cap-no-scroll");
    closeBtn?.focus?.();
  }

  function closeDrawer() {
    toggleBtn.classList.remove("active");
    drawer.classList.remove("show");
    overlay.classList.remove("show");

    toggleBtn.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");

    document.documentElement.classList.remove("cap-no-scroll");
    toggleBtn?.focus?.();
  }

  toggleBtn.addEventListener("click", () => {
    if (drawer.classList.contains("show")) closeDrawer();
    else openDrawer();
  });

  overlay.addEventListener("click", closeDrawer);
  closeBtn.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("show")) closeDrawer();
  });

  drawer.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link) closeDrawer();
  });

  // Close drawer automatically on desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && drawer.classList.contains("show")) closeDrawer();
  });
});
