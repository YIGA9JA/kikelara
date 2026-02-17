// header.js (Premium permanent header injector + active link + mobile drawer + cart badge)
// Requires: <div id="siteHeader"></div> in every page + <link rel="stylesheet" href="header.css">

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("siteHeader");
  if (!mount) return;

  // Inject header markup
  mount.innerHTML = `
    <header class="main-header" id="navbar">
      <div class="nav-inner">
        <a class="brand" href="index.html" aria-label="KÍKÉLÁRÁ home">
          <img src="images/logo.jpg" alt="KÍKÉLÁRÁ logo" />
          <span class="brand-text">KÍKÉLÁRÁ</span>
        </a>

        <nav class="nav-links" aria-label="Primary navigation">
          <a href="index.html" data-nav="index.html">Home</a>
          <a href="products.html" data-nav="products.html">Products</a>
          <a href="about.html" data-nav="about.html">About</a>
          <a href="contact.html" data-nav="contact.html">Contact</a>
        </nav>

        <div class="header-actions">
          <a class="icon-link" href="cart.html" aria-label="Cart">
            <span class="icon">🛒</span>
            <span class="count-badge" id="cartCountBadge" aria-label="Cart items">0</span>
          </a>

          <button id="menuToggle" class="menu-btn" type="button"
            aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>

    <div class="nav-overlay" id="navOverlay" aria-hidden="true"></div>

    <aside id="mobileNav" class="mobile-drawer" aria-label="Mobile navigation" aria-hidden="true">
      <div class="drawer-top">
        <a class="drawer-brand" href="index.html" data-nav="index.html">
          <img src="images/logo.jpg" alt="KÍKÉLÁRÁ logo" />
          <span>KÍKÉLÁRÁ</span>
        </a>

        <button class="drawer-close" id="drawerClose" type="button" aria-label="Close menu">✕</button>
      </div>

      <div class="drawer-links" role="navigation" aria-label="Mobile links">
        <a href="index.html" data-nav="index.html">Home</a>
        <a href="products.html" data-nav="products.html">Products</a>
        <a href="cart.html" data-nav="cart.html">Cart</a>
        <a href="about.html" data-nav="about.html">About</a>
        <a href="contact.html" data-nav="contact.html">Contact</a>
      </div>

      <div class="drawer-bottom">
        <div class="drawer-note">Luxury skincare inspired by nature.</div>
        <a class="drawer-cta" href="products.html">Shop Now</a>
      </div>
    </aside>
  `;

  const header = document.getElementById("navbar");
  const toggleBtn = document.getElementById("menuToggle");
  const drawer = document.getElementById("mobileNav");
  const overlay = document.getElementById("navOverlay");
  const closeBtn = document.getElementById("drawerClose");
  const cartBadge = document.getElementById("cartCountBadge");

  // --- Active link highlight (desktop + drawer)
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  mount.querySelectorAll("[data-nav]").forEach(a => {
    const href = String(a.getAttribute("data-nav") || "").toLowerCase();
    if (href === current) a.classList.add("active");
  });

  // --- Premium scroll shadow
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // --- Cart badge (reads sessionStorage cart)
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

    // supports [{qty:2},{quantity:3}] or plain array length
    let total = 0;
    for (const item of cart) {
      const q = Number(item?.qty ?? item?.quantity ?? 1);
      total += Number.isFinite(q) ? q : 1;
    }
    return total;
  }

  function renderCartCount() {
    if (!cartBadge) return;
    const n = getCartCount();
    cartBadge.textContent = String(n);
    cartBadge.classList.toggle("show", n > 0);
  }

  renderCartCount();
  window.addEventListener("storage", renderCartCount); // other tabs
  // (optional) refresh count after add-to-cart operations in same tab:
  window.addEventListener("focus", renderCartCount);

  // --- Drawer controls (with scroll lock)
  function openDrawer() {
    toggleBtn.classList.add("active");
    drawer.classList.add("show");
    overlay.classList.add("show");

    toggleBtn.setAttribute("aria-expanded", "true");
    drawer.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-hidden", "false");

    document.documentElement.classList.add("no-scroll");

    // focus close button for accessibility
    closeBtn?.focus?.();
  }

  function closeDrawer() {
    toggleBtn.classList.remove("active");
    drawer.classList.remove("show");
    overlay.classList.remove("show");

    toggleBtn.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");

    document.documentElement.classList.remove("no-scroll");

    // return focus to toggle
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

  // Close drawer when any link clicked
  drawer.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link) closeDrawer();
  });

  // ✅ Fix: resize logic INSIDE where variables exist (no crash)
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && drawer.classList.contains("show")) {
      closeDrawer();
    }
  });
});
