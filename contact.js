// contact.js (hCaptcha enabled + stable explicit render)
(() => {
  const API_BASE = (window.API_BASE || "https://kikelara1.onrender.com").replace(/\/$/, "");
  const SITE_KEY = String(window.HCAPTCHA_SITE_KEY || "").trim();

  const form = document.getElementById("contactForm");
  const statusEl = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");
  const widgetEl = document.getElementById("hcaptchaWidget");

  if (!form) return;

  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phone");
  const topicEl = document.getElementById("topic");
  const messageEl = document.getElementById("message");

  function setStatus(msg, ok = true) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.opacity = "1";
    statusEl.style.color = ok ? "inherit" : "#b00020";
  }

  function setLoading(on) {
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.style.opacity = on ? "0.7" : "1";
    submitBtn.textContent = on ? "Sending..." : "Submit";
  }

  // ---- hCaptcha helpers ----
  let widgetId = null;

  function renderCaptchaIfReady() {
    if (!widgetEl) return;
    if (!SITE_KEY) {
      setStatus("❌ Missing hCaptcha site key. Add window.HCAPTCHA_SITE_KEY in config.js", false);
      return;
    }
    if (!window.hcaptcha) return;

    if (widgetId === null) {
      try {
        widgetId = window.hcaptcha.render(widgetEl, {
          sitekey: SITE_KEY
        });
      } catch (e) {
        // If already rendered by some race condition, ignore
      }
    }
  }

  function getCaptchaToken() {
    if (!window.hcaptcha) return "";
    try {
      return widgetId !== null ? window.hcaptcha.getResponse(widgetId) : window.hcaptcha.getResponse();
    } catch {
      return "";
    }
  }

  function resetCaptcha() {
    if (!window.hcaptcha) return;
    try {
      if (widgetId !== null) window.hcaptcha.reset(widgetId);
      else window.hcaptcha.reset();
    } catch {}
  }

  // Try render quickly + retry until script loads
  renderCaptchaIfReady();
  let tries = 0;
  const t = setInterval(() => {
    renderCaptchaIfReady();
    tries += 1;
    if (window.hcaptcha || tries > 30) clearInterval(t); // ~15s max
  }, 500);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();
    const topic = (topicEl?.value || "").trim();
    const message = (messageEl?.value || "").trim();

    if (!name || !email || !topic || !message) {
      setStatus("Please fill all required fields.", false);
      return;
    }

    // ✅ Require captcha token
    const captchaToken = getCaptchaToken();
    if (!captchaToken) {
      setStatus("❌ Please complete the captcha before submitting.", false);
      return;
    }

    // Pack topic + phone into message (keeps backend compatible)
    const packedMessage =
      `Topic: ${topic}\n` +
      `Phone: ${phone || "-"}\n\n` +
      `${message}`;

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message: packedMessage,
          captchaToken
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        resetCaptcha();
        throw new Error(data.msg || data.message || "Failed to send");
      }

      form.reset();
      resetCaptcha();
      setStatus("✅ Message sent successfully. We’ll reply within 24–48 hours.", true);
    } catch (err) {
      console.error(err);
      setStatus(err?.message ? `❌ ${err.message}` : "❌ Message not sent. Please try again.", false);
    } finally {
      setLoading(false);
    }
  });
})();
