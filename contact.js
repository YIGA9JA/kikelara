// contact.js — Apple-clean + stable explicit hCaptcha render + MEDIA KEY SAFE + robust UX
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
    // type: success | error | loading
    if (type) statusEl.setAttribute("data-type", type);
    else statusEl.removeAttribute("data-type");
  }

  function setLoading(on) {
    if (!submitBtn) return;
    submitBtn.disabled = !!on;
    submitBtn.setAttribute("aria-busy", on ? "true" : "false");
    submitBtn.style.opacity = on ? "0.75" : "1";
    submitBtn.style.cursor = on ? "not-allowed" : "pointer";

    const span = submitBtn.querySelector("span");
    if (span) span.textContent = on ? "Sending..." : "Submit";
    else submitBtn.textContent = on ? "Sending..." : "Submit";
  }

  /* =================== hCaptcha (explicit render) =================== */
  let widgetId = null;

  function renderCaptcha() {
    if (!widgetEl) return;
    if (widgetId !== null) return; // already rendered
    if (!SITE_KEY) {
      setStatus("Missing HCAPTCHA_SITE_KEY in config.js", "error");
      return;
    }
    if (!window.hcaptcha) return;

    try {
      widgetId = window.hcaptcha.render(widgetEl, { sitekey: SITE_KEY });
    } catch {
      // ignore double-render race
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

  // ✅ render only when api truly ready (same pattern you used sitewide)
  document.addEventListener("hcaptcha:ready", renderCaptcha);
  if (window.__HCAPTCHA_READY__ === true) renderCaptcha();

  // If user navigates back (bfcache) and widget disappears, re-render
  window.addEventListener("pageshow", () => {
    if (widgetId === null && window.__HCAPTCHA_READY__ === true) renderCaptcha();
  });

  // Auto-clear error status while typing (nice UX)
  [nameEl, emailEl, topicEl, messageEl].forEach((el) => {
    el?.addEventListener("input", () => {
      if (statusEl?.getAttribute("data-type") === "error") setStatus("");
    });
  });

  /* =================== submit =================== */
  async function postJson(url, payload, ms = 12000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    } finally {
      clearTimeout(t);
    }
  }

  function packMessage({ topic, phone, message }) {
    const cleanTopic = String(topic || "").trim();
    const cleanPhone = String(phone || "").trim();
    const cleanMsg = String(message || "").trim();

    return (
      `Topic: ${cleanTopic}\n` +
      `Phone: ${cleanPhone || "-"}\n\n` +
      `${cleanMsg}`
    );
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();
    const topic = (topicEl?.value || "").trim();
    const message = (messageEl?.value || "").trim();

    setStatus("");

    // ✅ validation
    if (!name || !email || !topic || !message) {
      setStatus("Please fill all required fields.", "error");
      return;
    }
    if (!emailOk(email)) {
      setStatus("Please enter a valid email address.", "error");
      emailEl?.focus?.();
      return;
    }
    if (message.length < 5) {
      setStatus("Please type a fuller message.", "error");
      messageEl?.focus?.();
      return;
    }

    const token = captchaToken();
    if (!token) {
      setStatus("Please complete the captcha before submitting.", "error");
      return;
    }

    setLoading(true);
    setStatus("Sending…", "loading");

    try {
      const { res, data } = await postJson(`${API_BASE}/api/contact`, {
        name,
        email,
        message: packMessage({ topic, phone, message }),
        captchaToken: token,
      });

      // success support: {success:true} or {ok:true}
      const ok = Boolean(data?.success || data?.ok);

      if (!res.ok || !ok) {
        resetCaptcha();
        const msg =
          data?.msg ||
          data?.message ||
          (res.status === 429 ? "Too many requests. Please try again in a few minutes." : "") ||
          "Failed to send";
        throw new Error(msg);
      }

      form.reset();
      resetCaptcha();
      setStatus("✅ Message sent successfully. We’ll reply within 24–48 hours.", "success");
    } catch (err) {
      const isAbort = String(err?.name || "").toLowerCase().includes("abort");
      if (isAbort) setStatus("❌ Network timeout. Please check your connection and try again.", "error");
      else setStatus(err?.message ? `❌ ${err.message}` : "❌ Message not sent. Please try again.", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  });
})();