// admin-login.js (COOKIE SESSION)
(() => {
  const API_BASE = (window.API_BASE || "").replace(/\/$/, "");

  const pin = document.getElementById("pin");
  const loginBtn = document.getElementById("loginBtn");
  const errEl = document.getElementById("error");

  function setErr(msg = "") {
    if (errEl) errEl.textContent = msg;
  }

  async function login() {
    setErr("");
    loginBtn.disabled = true;

    try {
      const password = String(pin.value || "").trim();
      if (!password) throw new Error("Enter admin code.");

      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include", // ✅ allow Set-Cookie
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Login failed");

      location.replace("admin-dashboard.html");
    } catch (e) {
      setErr(`❌ ${String(e.message || e)}`);
    } finally {
      loginBtn.disabled = false;
    }
  }

  loginBtn?.addEventListener("click", login);
  pin?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
})();
