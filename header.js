// header.js — Liquid Glass + 3D + scroll pulse + centered capsule nav + SVG cart
document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("siteHeader");
  if (!mount) return;

  const ICON_CART = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 18a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4ZM6.2 6h15.1l-1.6 8.1a2 2 0 0 1-2 1.6H8a2 2 0 0 1-2-1.6L4.3 2H2V0h3.9l.3 2H22v2H6.2Z"/>
    </svg>
  `;

  mount.innerHTML = `
    <a class="k-skip" href="#shopPanels">Skip to content</a>

    <header class="k-header" id="kHeader">
      <div class="k-header-inner">

        <a class="k-brand" href="index.html" aria-label="KÍKÉLÁRÁ Home">
          <img src="images/logo.jpg" alt="KÍKÉLÁRÁ logo" />
          <span>KÍKÉLÁRÁ</span>
        </a>

        <nav class="k-nav" aria-label="Primary navigation">
          <a href="index.html" data-nav="index.html">Home</a>
          <a href="products.html" data-nav="products.html">Products</a>
          <a href="about.html" data-nav="about.html">About</a>
          <a href="contact.html" data-nav="contact.html">Contact</a>
        </nav>

        <div class="k-actions">
          <a class="k-icon" href="cart.html" aria-label="Cart">${ICON_CART}</a>

          <button id="kMenuBtn" class="k-menu" aria-label="Open menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>

    <div class="k-overlay" id="kOverlay"></div>

    <nav id="kDrawer" class="k-drawer" aria-label="Mobile navigation">
      <div class="k-drawer-top">
        <div class="k-drawer-brand">
          <img src="images/logo.jpg" alt="KÍKÉLÁRÁ logo" />
          <span>KÍKÉLÁRÁ</span>
        </div>
        <button class="k-drawer-close" id="kDrawerClose" aria-label="Close menu">✕</button>
      </div>

      <div class="k-drawer-links">
        <a href="index.html" data-nav="index.html">Home</a>
        <a href="products.html" data-nav="products.html">Products</a>
        <a href="cart.html" data-nav="cart.html">Cart</a>
        <a href="about.html" data-nav="about.html">About</a>
        <a href="contact.html" data-nav="contact.html">Contact</a>
      </div>

      <div class="k-drawer-bottom">
        <div class="k-drawer-note">Luxury skincare inspired by nature.</div>
        <a class="k-drawer-cta" href="products.html">Shop Now</a>
      </div>
    </nav>
  `;

  const header = document.getElementById("kHeader");
  const menuBtn = document.getElementById("kMenuBtn");
  const drawer = document.getElementById("kDrawer");
  const overlay = document.getElementById("kOverlay");
  const closeBtn = document.getElementById("kDrawerClose");

  // Active link
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  mount.querySelectorAll("[data-nav]").forEach(a => {
    const href = (a.getAttribute("data-nav") || "").toLowerCase();
    if (href === current) a.classList.add("active");
  });

  // Drawer
  const openDrawer = () => {
    menuBtn.classList.add("active");
    drawer.classList.add("show");
    overlay.classList.add("show");
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeDrawer = () => {
    menuBtn.classList.remove("active");
    drawer.classList.remove("show");
    overlay.classList.remove("show");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  menuBtn.addEventListener("click", () => {
    if (drawer.classList.contains("show")) closeDrawer();
    else openDrawer();
  });

  overlay.addEventListener("click", closeDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  drawer.addEventListener("click", (e) => { if (e.target.closest("a")) closeDrawer(); });

  // Scroll state + pulse
  let pulseTimer = null;
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 12);

    // pulse while user is scrolling
    header.classList.add("pulse");
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => header.classList.remove("pulse"), 220);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Close drawer when switching to desktop
  window.addEventListener("resize", () => { if (window.innerWidth > 900) closeDrawer(); });

  // ================= LIQUID + 3D PARALLAX =================
  const isTouch = matchMedia?.("(pointer: coarse)")?.matches;
  const reduceMotion = matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  if (!isTouch && !reduceMotion && header) {
    const MAX_TILT = 8; // more 3D
    let raf = null;
    let lastX = 0, lastY = 0;

    const apply = () => {
      raf = null;
      const r = header.getBoundingClientRect();

      const x = lastX - r.left;
      const y = lastY - r.top;

      const px = Math.max(0, Math.min(r.width, x)) / r.width;   // 0..1
      const py = Math.max(0, Math.min(r.height, y)) / r.height; // 0..1

      header.style.setProperty("--mx", `${px * 100}%`);
      header.style.setProperty("--my", `${py * 100}%`);

      const dx = (px - 0.5) * 2; // -1..1
      const dy = (py - 0.5) * 2; // -1..1

      const ry = dx * MAX_TILT;
      const rx = -dy * MAX_TILT;

      header.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      header.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    };

    header.addEventListener("mousemove", (ev) => {
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });

    header.addEventListener("mouseleave", () => {
      header.style.setProperty("--mx", "50%");
      header.style.setProperty("--my", "50%");
      header.style.setProperty("--rx", "0deg");
      header.style.setProperty("--ry", "0deg");
    }, { passive: true });
  }
});
