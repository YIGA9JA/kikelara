// contact.js (WORKS WITH YOUR CURRENT server.js)
(() => {
  const API_BASE = (window.API_BASE || "https://kikelara.onrender.com").replace(/\/$/, "");

  const form = document.getElementById("contactForm");
  const statusEl = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");

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

    // Put topic + phone inside message so server can store it without changing server.js
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
        body: JSON.stringify({ name, email, message: packedMessage })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.msg || "Failed to send");
      }

      form.reset();
      setStatus("✅ Message sent successfully. We’ll reply within 24–48 hours.", true);
    } catch (err) {
      console.error(err);
      setStatus("❌ Message not sent. Please try again.", false);
    } finally {
      setLoading(false);
    }
  });
})();
