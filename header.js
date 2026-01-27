// header.js (Permanent header injector + active link + mobile drawer)

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("siteHeader");
  if (!mount) return;

  // Inject header HTML once
  mount.innerHTML = `
    <header class="main-header" id="navbar">
      <a class="brand" href="index.html">
        <img src="images/logo.jpg" alt="Kíke Lárá logo" />
        <span>KÍKE LÁRÁ</span>
      </a>

      <nav class="nav-links" aria-label="Primary navigation">
        <a href="index.html" data-nav="index.html">Home</a>
        <a href="products.html" data-nav="products.html">Products</a>
        <a href="about.html" data-nav="about.html">About</a>
        <a href="contact.html" data-nav="contact.html">Contact</a>
        <a href="privacy.html" data-nav="privacy.html">Privacy</a>
      </nav>

      <div class="header-actions">
        <a class="icon-link" href="wishlist.html" aria-label="Wishlist">♥</a>
        <a class="icon-link" href="cart.html" aria-label="Cart">🛒</a>

        <button id="menu-toggle" class="menu-btn" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>

    <div class="nav-overlay" id="navOverlay"></div>

    <nav id="mobileNav" class="mobile-drawer" aria-label="Mobile navigation">
      <div class="drawer-top">
        <div class="drawer-brand">
          <img src="images/logo.jpg" alt="Kíke Lárá logo" />
          <span>KÍKE LÁRÁ</span>
        </div>
        <button class="drawer-close" id="drawerClose" aria-label="Close menu">✕</button>
      </div>

      <div class="drawer-links">
        <a href="index.html" data-nav="index.html">Home</a>
        <a href="products.html" data-nav="products.html">Products</a>
        <a href="about.html" data-nav="about.html">About</a>
        <a href="contact.html" data-nav="contact.html">Contact</a>
        <a href="privacy.html" data-nav="privacy.html">Privacy Policy</a>
        <a href="wishlist.html" data-nav="wishlist.html">Wishlist</a>
        <a href="cart.html" data-nav="cart.html">Cart</a>
      </div>

      <div class="drawer-bottom">
        <div class="drawer-note">Luxury skincare inspired by nature.</div>
        <a class="drawer-cta" href="products.html">Shop Now</a>
      </div>
    </nav>
  `;

  // Active link
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  mount.querySelectorAll('[data-nav]').forEach(a => {
    const href = (a.getAttribute("data-nav") || "").toLowerCase();
    if (href === current) a.classList.add("active");
  });

  // Drawer logic
  const toggleBtn = document.getElementById("menu-toggle");
  const drawer = document.getElementById("mobileNav");
  const overlay = document.getElementById("navOverlay");
  const closeBtn = document.getElementById("drawerClose");

  function openDrawer(){
    toggleBtn.classList.add("active");
    drawer.classList.add("show");
    overlay.classList.add("show");
    toggleBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer(){
    toggleBtn.classList.remove("active");
    drawer.classList.remove("show");
    overlay.classList.remove("show");
    toggleBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  toggleBtn.addEventListener("click", () => {
    if (drawer.classList.contains("show")) closeDrawer();
    else openDrawer();
  });

  overlay.addEventListener("click", closeDrawer);
  closeBtn.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // Close drawer when link clicked
  drawer.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link) closeDrawer();
  });
});
