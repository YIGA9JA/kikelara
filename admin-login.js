// admin-login.js (COOKIE SESSION + CSRF STORE - Option A)
// ✅ Saves csrfToken from /admin/login response into localStorage
// ✅ Keeps credentials: "include" so cookies are set

(() => {
  const API_BASE = (window.API_BASE || "").replace(/\/$/, "");

  const pin = document.getElementById("pin");
  const loginBtn = document.getElementById("loginBtn");
  const errEl = document.getElementById("error");

  const CSRF_STORAGE_KEY = "admin_csrf";

  function setErr(msg = "") {
    if (errEl) errEl.textContent = msg;
  }

  function setCsrfToken(token) {
    const t = String(token || "").trim();
    if (t) localStorage.setItem(CSRF_STORAGE_KEY, t);
  }

  function clearCsrfToken() {
    localStorage.removeItem(CSRF_STORAGE_KEY);
  }

  async function login() {
    setErr("");
    loginBtn.disabled = true;

    try {
      const password = String(pin.value || "").trim();
      if (!password) throw new Error("Enter admin code.");

      // Clear old csrf just to avoid mismatches
      clearCsrfToken();

      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include", // ✅ allow Set-Cookie
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Login failed");

      // ✅ store CSRF token for future write requests
      if (data?.csrfToken) setCsrfToken(data.csrfToken);

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
