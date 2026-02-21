// header.js — Modern Butter-Glass Header (NO wishlist) + cart badge sync (KStore/sessionStorage)
document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("siteHeader");
  if (!mount) return;

  const ICON_CART = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M7 18a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4ZM6.2 6h15.1l-1.6 8.1a2 2 0 0 1-2 1.6H8a2 2 0 0 1-2-1.6L4.3 2H2V0h3.9l.3 2H22v2H6.2Z"/>
    </svg>
  `;

  // Make sure you add: <main id="mainContent">...</main> in your pages
  const SKIP_TARGET = "mainContent";

  mount.innerHTML = `
    <a class="k-skip" href="#${SKIP_TARGET}">Skip to content</a>

    <header class="k-header" id="kHeader">
      <div class="k-header-inner">

        <a class="k-brand" href="index.html" aria-label="KÍKÉLÁRÁ">
          <img class="k-logo" src="images/logo.jpg" alt="KÍKÉLÁRÁ" />
          <div class="k-brand-text">
            <span class="k-brand-name">KÍKÉLÁRÁ</span>
          </div>
        </a>

        <nav class="k-nav" aria-label="Primary navigation">
          <a href="index.html" data-nav="index.html">Home</a>
          <a href="products.html" data-nav="products.html">Products</a>
          <a href="about.html" data-nav="about.html">About</a>
          <a href="contact.html" data-nav="contact.html">Contact</a>
        </nav>

        <div class="k-actions">
          <a class="k-icon k-cart" href="cart.html" aria-label="Cart">
            ${ICON_CART}
            <span class="k-badge" id="cartCount" aria-label="Cart items" hidden>0</span>
          </a>

          <button id="kMenuBtn" class="k-menu" aria-label="Open menu" aria-expanded="false" type="button">
            <span></span><span></span><span></span>
          </button>
        </div>

      </div>
    </header>

    <div class="k-overlay" id="kOverlay" aria-hidden="true"></div>

    <nav id="kDrawer" class="k-drawer" aria-label="Mobile navigation" aria-hidden="true">
      <div class="k-drawer-top">
        <div class="k-drawer-brand">
          <img src="images/logo.jpg" alt="KÍKÉLÁRÁ logo" />
          <div class="k-drawer-brand-text">
            <div class="k-drawer-title">KÍKÉLÁRÁ</div>
            <div class="k-drawer-sub">Luxury Skincare</div>
          </div>
        </div>

        <button class="k-drawer-close" id="kDrawerClose" aria-label="Close menu" type="button">✕</button>
      </div>

      <div class="k-drawer-links">
        <a href="index.html" data-nav="index.html">Home</a>
        <a href="products.html" data-nav="products.html">Products</a>
        <a href="cart.html" data-nav="cart.html">
          Cart <span class="k-mini-badge" id="cartCountMobile">0</span>
        </a>
        <a href="about.html" data-nav="about.html">About</a>
        <a href="contact.html" data-nav="contact.html">Contact</a>
      </div>

      <div class="k-drawer-bottom">
        <div class="k-drawer-note">
          Premium butters & oils crafted to nourish, soften, and glow.
        </div>
        <a class="k-drawer-cta" href="products.html">Shop Now</a>
      </div>
    </nav>
  `;

  const header = document.getElementById("kHeader");
  const menuBtn = document.getElementById("kMenuBtn");
  const drawer = document.getElementById("kDrawer");
  const overlay = document.getElementById("kOverlay");
  const closeBtn = document.getElementById("kDrawerClose");

  /* ---------------- ACTIVE LINK ---------------- */
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  mount.querySelectorAll("[data-nav]").forEach((a) => {
    const href = String(a.getAttribute("data-nav") || "").toLowerCase();
    if (href === current) a.classList.add("active");
  });

  /* ---------------- CART BADGE SYNC ---------------- */
  const CART_KEY = "cart";

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw) ?? fallback; } catch { return fallback; }
  }

  function getCartArray() {
    if (window.KStore && typeof window.KStore.getCart === "function") {
      const v = window.KStore.getCart();
      return Array.isArray(v) ? v : [];
    }
    const ss = safeParse(sessionStorage.getItem(CART_KEY), []);
    if (Array.isArray(ss)) return ss;
    const ls = safeParse(localStorage.getItem(CART_KEY), []);
    return Array.isArray(ls) ? ls : [];
  }

  function cartQtyTotal() {
    const cart = getCartArray();
    return cart.reduce((sum, it) => sum + (Number(it?.qty) || 0), 0);
  }

  function updateCounts() {
    const n = cartQtyTotal();
    const desktop = document.getElementById("cartCount");
    const mobile = document.getElementById("cartCountMobile");

    if (desktop) {
      desktop.textContent = String(n);
      desktop.hidden = n <= 0;
      desktop.setAttribute("aria-label", `${n} items in cart`);
    }
    if (mobile) mobile.textContent = String(n);
  }

  updateCounts();
  document.addEventListener("cart:updated", updateCounts);

  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) updateCounts();
  });

  // quick retry (header inject + store.js order)
  let tries = 0;
  const retry = setInterval(() => {
    updateCounts();
    tries += 1;
    if (tries >= 12) clearInterval(retry);
  }, 140);

  /* ---------------- DRAWER (better mobile UX) ---------------- */
  let lastFocus = null;

  const openDrawer = () => {
    lastFocus = document.activeElement;

    menuBtn.classList.add("active");
    drawer.classList.add("show");
    overlay.classList.add("show");

    drawer.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-hidden", "false");
    menuBtn.setAttribute("aria-expanded", "true");

    document.body.classList.add("k-lock");

    const first = drawer.querySelector("a,button");
    if (first) first.focus({ preventScroll: true });
  };

  const closeDrawer = () => {
    menuBtn.classList.remove("active");
    drawer.classList.remove("show");
    overlay.classList.remove("show");

    drawer.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");
    menuBtn.setAttribute("aria-expanded", "false");

    document.body.classList.remove("k-lock");

    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  };

  menuBtn.addEventListener("click", () => {
    if (drawer.classList.contains("show")) closeDrawer();
    else openDrawer();
  });

  overlay.addEventListener("click", closeDrawer);
  closeBtn.addEventListener("click", closeDrawer);

  drawer.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeDrawer();
  });

  document.addEventListener("keydown", (e) => {
    if (!drawer.classList.contains("show")) return;

    if (e.key === "Escape") closeDrawer();

    // focus trap
    if (e.key === "Tab") {
      const focusables = drawer.querySelectorAll('a,button,[tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && drawer.classList.contains("show")) closeDrawer();
  });

  /* ---------------- SCROLL STATE (clean, subtle) ---------------- */
  let pulseTimer = null;
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 10);

    header.classList.add("pulse");
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => header.classList.remove("pulse"), 170);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------- LIQUID SHEEN + SOFT TILT (desktop only) ---------------- */
  const isTouch = matchMedia?.("(pointer: coarse)")?.matches;
  const reduceMotion = matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  if (!isTouch && !reduceMotion && header) {
    const MAX_TILT = 6.5;
    let raf = null;
    let lastX = 0, lastY = 0;

    const apply = () => {
      raf = null;
      const r = header.getBoundingClientRect();
      const x = lastX - r.left;
      const y = lastY - r.top;

      const px = Math.max(0, Math.min(r.width, x)) / r.width;
      const py = Math.max(0, Math.min(r.height, y)) / r.height;

      header.style.setProperty("--mx", `${px * 100}%`);
      header.style.setProperty("--my", `${py * 100}%`);

      const dx = (px - 0.5) * 2;
      const dy = (py - 0.5) * 2;

      header.style.setProperty("--ry", `${(dx * MAX_TILT).toFixed(2)}deg`);
      header.style.setProperty("--rx", `${(-dy * MAX_TILT).toFixed(2)}deg`);
    };

    header.addEventListener("pointermove", (ev) => {
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });

    header.addEventListener("pointerleave", () => {
      header.style.setProperty("--mx", "50%");
      header.style.setProperty("--my", "50%");
      header.style.setProperty("--rx", "0deg");
      header.style.setProperty("--ry", "0deg");
    }, { passive: true });
  }
});
