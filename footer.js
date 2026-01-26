// footer.js — Injects one premium footer into every page automatically
(() => {
  const mount = document.getElementById("siteFooter");
  if (!mount) return;

  const year = new Date().getFullYear();

  // User-facing pages (NOT admin pages)
  const links = {
    shop: [
      ["products.html", "All Products"],
      ["product-details.html", "Product Details"],
      ["wishlist.html", "Wishlist"],
      ["cart.html", "Cart"],
    ],
    company: [
      ["about.html", "About Us"],
      ["contact.html", "Contact"],
      ["privacy.html", "Privacy Policy"],
    ],
    support: [
      ["checkout.html", "Checkout"],
      ["order-success.html", "Order Success"],
      ["messages.html", "Messages"],
    ],
  };

  mount.innerHTML = `
    <footer class="main-footer">
      <div class="footer-wrap">

        <div class="footer-top">
          <div class="footer-brand">
            <a href="index.html" class="footer-logo" aria-label="Kíke Lárá Home">
              <img src="/images/logo.jpg" alt="Kíke Lárá Logo">
            </a>

            <h3>KÍKE LÁRÁ</h3>
            <p>Luxury skincare inspired by nature. Crafted to nourish, glow and restore confidence.</p>

            <div class="footer-socials" aria-label="Social links">
              <a class="social-btn" href="https://instagram.com/_kikelara" target="_blank" rel="noopener">
                Instagram <span>@_kikelara</span>
              </a>
              <a class="social-btn" href="https://t.me/_kikelara" target="_blank" rel="noopener">
                Telegram <span>@_kikelara</span>
              </a>
            </div>
          </div>

          <div class="footer-links">
            <h4>Shop</h4>
            ${links.shop.map(([href, text]) => `<a href="${href}">${text}</a>`).join("")}
          </div>

          <div class="footer-links">
            <h4>Company</h4>
            ${links.company.map(([href, text]) => `<a href="${href}">${text}</a>`).join("")}
          </div>

          <div class="footer-links">
            <h4>Support</h4>
            ${links.support.map(([href, text]) => `<a href="${href}">${text}</a>`).join("")}
          </div>
        </div>

        <div class="footer-bottom">
          <span>© ${year} KÍKE LÁRÁ Skincare. All Rights Reserved.</span>

          <div class="footer-mini">
            <a href="privacy.html">Privacy</a>
            <span class="dot">•</span>
            <a href="contact.html">Help</a>
          </div>
        </div>

      </div>
    </footer>
  `;
})();
