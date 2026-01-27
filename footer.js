// footer.js — Nécessaire-style premium footer (newsletter + icons + mobile accordion)
(() => {
  const mount = document.getElementById("siteFooter");
  if (!mount) return;

  const year = new Date().getFullYear();

  // Small inline SVG icons (minimal style)
  const ICONS = {
    bag: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 7V6a5 5 0 0 1 10 0v1h3v14H4V7h3Zm2 0h6V6a3 3 0 0 0-6 0v1Zm-3 2v10h14V9H6Zm4 3h2v5h-2v-5Zm4 0h2v5h-2v-5Z"/></svg>`,
    heart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.2-4.6-9.5-8.6C.6 9.1 2.5 5.9 6 5.5c1.7-.2 3.4.6 4.4 2c1-1.4 2.7-2.2 4.4-2c3.5.4 5.4 3.6 3.5 6.9C19.2 16.4 12 21 12 21Z"/></svg>`,
    cart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 18a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4ZM6.2 6h15.1l-1.6 8.1a2 2 0 0 1-2 1.6H8a2 2 0 0 1-2-1.6L4.3 2H2V0h3.9l.3 2H22v2H6.2Z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm0 4a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 12 6Zm1.4 13h-2.8v-2h.9v-4h-.9v-2h2.8v6h.9v2Z"/></svg>`,
    mail: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5L4 8V6l8 5 8-5v2Z"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V7Zm2 11a2 2 0 1 1 0-4a2 2 0 0 1 0 4Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-5 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm5.2-2.6a1 1 0 1 1 0 2a1 1 0 0 1 0-2Z"/></svg>`,
    tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15 3c.5 2.9 2.8 5.1 5.7 5.3v3c-2 0-3.8-.6-5.3-1.6V16c0 3.6-2.9 6.5-6.5 6.5S2.4 19.6 2.4 16S5.3 9.5 8.9 9.5c.3 0 .6 0 .9.1v3.2c-.3-.1-.6-.2-.9-.2c-1.8 0-3.3 1.5-3.3 3.3c0 1.8 1.5 3.3 3.3 3.3c1.9 0 3.4-1.5 3.4-3.4V3h2.7Z"/></svg>`
  };

  const sections = [
    {
      title: "Shop",
      items: [
        { href: "products.html", label: "All Products", icon: ICONS.bag },
        { href: "wishlist.html", label: "Wishlist", icon: ICONS.heart },
        { href: "cart.html", label: "Cart", icon: ICONS.cart },
        { href: "product-details.html", label: "Product Details", icon: ICONS.bag }
      ]
    },
    {
      title: "Company",
      items: [
        { href: "about.html", label: "About Us", icon: ICONS.info },
        { href: "contact.html", label: "Contact", icon: ICONS.mail },
        { href: "privacy.html", label: "Privacy Policy", icon: ICONS.lock }
      ]
    }
  ];

  mount.innerHTML = `
    <footer class="main-footer">
      <div class="footer-wrap">

        <!-- Newsletter (Nécessaire-like) -->
        <div class="footer-newsletter">
          <div class="footer-newsletter-text">
            <h3>Sign up to subscribe</h3>
            <p>Get product drops, restocks and skincare tips — no spam.</p>
          </div>

          <form class="footer-form" id="footerNewsletter" autocomplete="on">
            <label class="sr-only" for="footerEmail">Email address</label>
            <input id="footerEmail" name="email" type="email" placeholder="Email address" required />
            <button type="submit">Submit</button>
          </form>
        </div>

        <div class="footer-divider"></div>

        <div class="footer-grid">
          <!-- Brand + Follow Us -->
          <div class="footer-brand">
            <a href="index.html" class="footer-logo" aria-label="Kíke Lárá Home">
              <img src="/images/logo.jpg" alt="Kíke Lárá Logo">
            </a>

            <h4 class="footer-brand-name">KÍKÉLÁRÁ </h4>
            <p class="footer-brand-desc">
              Luxury skincare inspired by nature. Crafted to nourish, glow and restore confidence.
            </p>

            <div class="footer-follow">
              <div class="footer-follow-title">Follow us</div>
              <div class="footer-socials">
                <a class="social-icon-btn" href="https://instagram.com/_kikelara" target="_blank" rel="noopener" aria-label="Instagram @_kikelara">
                  <span class="ico">${ICONS.instagram}</span>
                  <span class="handle">@_kikelara</span>
                </a>
                <a class="social-icon-btn" href="https://www.tiktok.com/@_kikelara" target="_blank" rel="noopener" aria-label="TikTok @_kikelara">
                  <span class="ico">${ICONS.tiktok}</span>
                  <span class="handle">@_kikelara</span>
                </a>
              </div>
            </div>
          </div>

          <!-- Link columns (accordion on mobile) -->
          <div class="footer-columns">
            ${sections.map((sec) => `
              <details class="footer-col" open>
                <summary>${sec.title}</summary>
                <div class="footer-links">
                  ${sec.items.map(i => `
                    <a href="${i.href}" class="footer-link">
                      <span class="link-ico">${i.icon}</span>
                      <span class="link-text">${i.label}</span>
                    </a>
                  `).join("")}
                </div>
              </details>
            `).join("")}
          </div>
        </div>

        <div class="footer-bottom">
          <span>© ${year} KÍKE LÁRÁ Skincare. All Rights Reserved.</span>
        </div>

      </div>
    </footer>
  `;

  // Newsletter behavior (simple + clean)
  const form = document.getElementById("footerNewsletter");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("footerEmail")?.value?.trim();
    if (!email) return;

    // store locally for now (you can wire backend later)
    localStorage.setItem("newsletterEmail", email);

    form.reset();
    alert("✅ Subscribed! You'll hear from KÍKE LÁRÁ soon.");
  });

  // Mobile: make the link columns behave like Nécessaire (accordion)
  const mq = window.matchMedia("(max-width: 600px)");
  const applyAccordion = () => {
    document.querySelectorAll(".footer-col").forEach((d) => {
      if (!(d instanceof HTMLDetailsElement)) return;
      if (mq.matches) d.removeAttribute("open");
      else d.setAttribute("open", "");
    });
  };
  applyAccordion();
  mq.addEventListener?.("change", applyAccordion);
})();
