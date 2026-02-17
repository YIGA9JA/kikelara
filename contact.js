// contact.js — Apple-clean + stable explicit hCaptcha render + safe UX
(() => {
  const API_BASE = String(window.API_BASE || "https://kikelara1.onrender.com").replace(/\/+$/, "");
  const SITE_KEY = String(window.HCAPTCHA_SITE_KEY || "").trim();

  const form = document.getElementById("contactForm");
  if (!form) return;

  const statusEl = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");
  const widgetEl = document.getElementById("hcaptchaWidget");

  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phone");
  const topicEl = document.getElementById("topic");
  const messageEl = document.getElementById("message");

  const emailOk = (v) => /^\S+@\S+\.\S+$/.test(String(v || "").trim());

  function setStatus(msg, type = "") {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.setAttribute("data-type", type); // success | error | loading
  }

  function setLoading(on) {
    if (!submitBtn) return;
    submitBtn.disabled = !!on;
    submitBtn.setAttribute("aria-busy", on ? "true" : "false");
    submitBtn.style.opacity = on ? "0.75" : "1";
    submitBtn.style.cursor = on ? "not-allowed" : "pointer";
    submitBtn.querySelector("span") && (submitBtn.querySelector("span").textContent = on ? "Sending..." : "Submit");
  }

  // ---------- hCaptcha ----------
  let widgetId = null;

  function renderCaptcha() {
    if (!widgetEl) return;
    if (!SITE_KEY) {
      setStatus("Missing HCAPTCHA_SITE_KEY in config.js", "error");
      return;
    }
    if (!window.hcaptcha) return;
    if (widgetId !== null) return;

    try {
      widgetId = window.hcaptcha.render(widgetEl, {
        sitekey: SITE_KEY
      });
    } catch (e) {
      // ignore double-render races
    }
  }

  function captchaToken() {
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

  // wait for explicit onload event (shared with footer.js)
  document.addEventListener("hcaptcha:ready", renderCaptcha);
  if (window.__HCAPTCHA_READY__ === true) renderCaptcha();

  // ---------- submit ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();
    const topic = (topicEl?.value || "").trim();
    const message = (messageEl?.value || "").trim();

    setStatus("");

    if (!name || !email || !topic || !message) {
      setStatus("Please fill all required fields.", "error");
      return;
    }
    if (!emailOk(email)) {
      setStatus("Please enter a valid email address.", "error");
      emailEl?.focus?.();
      return;
    }

    const token = captchaToken();
    if (!token) {
      setStatus("Please complete the captcha before submitting.", "error");
      return;
    }

    const packedMessage =
      `Topic: ${topic}\n` +
      `Phone: ${phone || "-"}\n\n` +
      `${message}`;

    setLoading(true);
    setStatus("Sending…", "loading");

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message: packedMessage,
          captchaToken: token
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        resetCaptcha();
        throw new Error(data.msg || data.message || "Failed to send");
      }

      form.reset();
      resetCaptcha();
      setStatus("✅ Message sent successfully. We’ll reply within 24–48 hours.", "success");
    } catch (err) {
      console.error(err);
      setStatus(err?.message ? `❌ ${err.message}` : "❌ Message not sent. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  });
})();
