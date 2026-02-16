// admin-login.js (COOKIE SESSION + CSRF STORE)
// ✅ Stores csrfToken returned by /admin/login into localStorage as fallback
// ✅ Uses credentials: "include" so cookies are set
// Requires config.js

(() => {
  const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");

  const pin = document.getElementById("pin");
  const loginBtn = document.getElementById("loginBtn");
  const errEl = document.getElementById("error");

  const CSRF_STORAGE_KEY = window.ADMIN_CSRF_STORAGE_KEY || "admin_csrf_ls";

  function setErr(msg = "") {
    if (errEl) errEl.textContent = msg;
  }

  function setCsrfToken(token) {
    const t = String(token || "").trim();
    if (!t) return;
    try { localStorage.setItem(CSRF_STORAGE_KEY, t); } catch {}
  }

  function clearCsrfToken() {
    try { localStorage.removeItem(CSRF_STORAGE_KEY); } catch {}
  }

  async function login() {
    setErr("");
    if (loginBtn) loginBtn.disabled = true;

    try {
      const password = String(pin?.value || "").trim();
      if (!password) throw new Error("Enter admin code.");

      clearCsrfToken();

      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ password }),
        credentials: "include", // ✅ allow Set-Cookie (session + csrf cookie)
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Login failed");

      // ✅ store CSRF token fallback (important if cookie is HttpOnly)
      if (data?.csrfToken) setCsrfToken(data.csrfToken);

      location.replace("admin-products.html");
    } catch (e) {
      setErr(`❌ ${String(e.message || e)}`);
    } finally {
      if (loginBtn) loginBtn.disabled = false;
    }
  }

  loginBtn?.addEventListener("click", login);
  pin?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
})();
