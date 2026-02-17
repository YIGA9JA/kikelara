// footer.js — BUTTER CREAM LIQUID GLASS footer (newsletter + hCaptcha + uses window.API_BASE)
// Requires:
// 1) <div id="siteFooter"></div>
// 2) hCaptcha script using: render=explicit&onload=hcaptchaOnload (dispatches "hcaptcha:ready")
// 3) config.js sets: window.API_BASE and window.HCAPTCHA_SITE_KEY

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("siteFooter");
  if (!mount) return;

  const year = new Date().getFullYear();
  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  const SUBSCRIBE_ENDPOINT = API_BASE ? `${API_BASE}/api/newsletter/subscribe` : "";
  const SITE_KEY = String(window.HCAPTCHA_SITE_KEY || "").trim();

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
      ],
    },
    {
      title: "Company",
      items: [
        { href: "about.html", label: "About", icon: ICONS.info },
        { href: "contact.html", label: "Contact", icon: ICONS.mail },
        { href: "privacy.html", label: "Privacy", icon: ICONS.lock },
      ],
    },
  ];

  mount.innerHTML = `
    <footer class="bc-footer" role="contentinfo">
      <div class="bc-bg" aria-hidden="true"></div>

      <div class="bc-wrap">
        <div class="bc-panel" id="bcPanel">
          <div class="bc-top">
            <div class="bc-copy">
              <div class="bc-eyebrow">KÍKÉLÁRÁ</div>
              <h2 class="bc-headline">Glow, Nourish, Restore.</h2>
              <p class="bc-sub">
                Premium skincare inspired by nature — crafted to nourish, glow and restore confidence.
              </p>

              <div class="bc-chips">
                <span class="bc-chip">🌿 Natural</span>
                <span class="bc-chip">✨ Luxury feel</span>
                <span class="bc-chip">💛 Made with care</span>
              </div>
            </div>

            <div class="bc-news">
              <div class="bc-card">
                <div class="bc-card-title">Get drops & restocks</div>
                <div class="bc-card-copy">Skincare tips + product releases. No spam.</div>

                <form class="bc-form" id="footerNewsletter" autocomplete="on">
                  <label class="sr-only" for="footerEmail">Email address</label>

                  <div class="bc-pill">
                    <input id="footerEmail" name="email" type="email" placeholder="Email address" required />
                    <button type="submit" id="footerSubmitBtn">Subscribe</button>
                  </div>

                  <div class="bc-captcha">
                    <div id="footerHcaptcha" class="h-captcha"></div>
                  </div>

                  <div class="bc-status" id="footerFormStatus" aria-live="polite"></div>
                </form>
              </div>
            </div>
          </div>

          <div class="bc-mid">
            <div class="bc-brand">
              <a href="index.html" class="bc-logo" aria-label="KÍKÉLÁRÁ Home">
                <img src="images/logo.jpg" alt="KÍKÉLÁRÁ Logo" />
              </a>

              <div class="bc-brand-name">KÍKÉLÁRÁ</div>

              <div class="bc-socials">
                <a class="bc-social" href="https://instagram.com/_kikelara" target="_blank" rel="noopener" aria-label="Instagram @_kikelara">
                  <span class="bc-ico">${ICONS.instagram}</span>
                  <span>@_kikelara</span>
                </a>
                <a class="bc-social" href="https://www.tiktok.com/@_kikelara" target="_blank" rel="noopener" aria-label="TikTok @_kikelara">
                  <span class="bc-ico">${ICONS.tiktok}</span>
                  <span>@_kikelara</span>
                </a>
              </div>
            </div>

            <div class="bc-cols">
              ${sections.map((sec) => `
                <details class="bc-col" open>
                  <summary>${sec.title}</summary>
                  <div class="bc-links">
                    ${sec.items.map(i => `
                      <a href="${i.href}" class="bc-link">
                        <span class="bc-link-ico">${i.icon}</span>
                        <span>${i.label}</span>
                      </a>
                    `).join("")}
                  </div>
                </details>
              `).join("")}
            </div>
          </div>

          <div class="bc-bottom">
            <span>© ${year} KÍKÉLÁRÁ. All Rights Reserved.</span>
            <span class="bc-dot">•</span>
            <span>Made with care.</span>
          </div>
        </div>
      </div>
    </footer>
  `;

  // ===== STATUS
  const statusEl = document.getElementById("footerFormStatus");
  const setStatus = (msg, type = "") => {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.setAttribute("data-type", type);
  };

  const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(String(email || "").trim());

  // ===== hCaptcha (wait for explicit onload)
  const captchaEl = document.getElementById("footerHcaptcha");
  let footerWidgetId = null;

  function renderCaptcha() {
    if (!captchaEl) return;
    if (!SITE_KEY) {
      setStatus("Missing HCAPTCHA_SITE_KEY in config.js", "error");
      return;
    }
    if (!window.hcaptcha) return;

    if (footerWidgetId === null) {
      try {
        footerWidgetId = window.hcaptcha.render(captchaEl, { sitekey: SITE_KEY });
      } catch {}
    }
  }

  function captchaToken() {
    if (!window.hcaptcha) return "";
    try {
      return footerWidgetId !== null ? window.hcaptcha.getResponse(footerWidgetId) : "";
    } catch {
      return "";
    }
  }

  function resetCaptcha() {
    if (!window.hcaptcha) return;
    try {
      if (footerWidgetId !== null) window.hcaptcha.reset(footerWidgetId);
    } catch {}
  }

  document.addEventListener("hcaptcha:ready", renderCaptcha);
  if (window.__HCAPTCHA_READY__ === true) renderCaptcha();

  // ===== SUBMIT
  const form = document.getElementById("footerNewsletter");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const input = document.getElementById("footerEmail");
    const btn = document.getElementById("footerSubmitBtn");
    const email = input?.value?.trim();

    if (!SUBSCRIBE_ENDPOINT) {
      setStatus("API_BASE missing in config.js (newsletter disabled).", "error");
      return;
    }
    if (!email) return;

    if (!isValidEmail(email)) {
      setStatus("Please enter a valid email address.", "error");
      input?.focus?.();
      return;
    }

    const token = captchaToken();
    if (!token) {
      setStatus("❌ Please complete the captcha.", "error");
      return;
    }

    setStatus("Subscribing…", "loading");
    if (btn) {
      btn.disabled = true;
      btn.dataset.prevText = btn.textContent || "Subscribe";
      btn.textContent = "Submitting…";
    }

    try {
      const res = await fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken: token }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        resetCaptcha();
        setStatus(data.message || "Subscription failed. Please try again.", "error");
        return;
      }

      localStorage.setItem("newsletterEmail", email);
      form.reset();
      resetCaptcha();

      setStatus(
        data.already
          ? "✅ You’re already subscribed. We sent a confirmation email."
          : "✅ Subscribed! Check your inbox for a welcome message.",
        "success"
      );
    } catch {
      resetCaptcha();
      setStatus("Network error. Please try again.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.prevText || "Subscribe";
        delete btn.dataset.prevText;
      }
    }
  });

  // ===== MOBILE ACCORDION
  const mq = window.matchMedia("(max-width: 720px)");
  const applyAccordion = () => {
    document.querySelectorAll(".bc-col").forEach((d) => {
      if (!(d instanceof HTMLDetailsElement)) return;
      if (mq.matches) d.removeAttribute("open");
      else d.setAttribute("open", "");
    });
  };
  applyAccordion();
  mq.addEventListener?.("change", applyAccordion);

  // ===== 3D LIQUID TILT (desktop only, respects reduced motion)
  const panel = document.getElementById("bcPanel");
  const canHover = window.matchMedia("(hover: hover)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (panel && canHover && !reduce) {
    let raf = 0;
    let tx = 0, ty = 0;

    const onMove = (e) => {
      const r = panel.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;

      // subtle premium tilt
      tx = (py - 0.5) * -6; // rotateX
      ty = (px - 0.5) * 8;  // rotateY

      if (!raf) {
        raf = requestAnimationFrame(() => {
          panel.style.setProperty("--rx", tx.toFixed(2) + "deg");
          panel.style.setProperty("--ry", ty.toFixed(2) + "deg");
          raf = 0;
        });
      }
    };

    const onLeave = () => {
      panel.style.setProperty("--rx", "0deg");
      panel.style.setProperty("--ry", "0deg");
    };

    panel.addEventListener("mousemove", onMove);
    panel.addEventListener("mouseleave", onLeave);
  }
});
