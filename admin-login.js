// admin-login.js (ONLY for admin-login.html)
const API_BASE = "http://localhost:4000";
const TOKEN_KEY = "admin-token";

// If already logged in, skip login page
(function redirectIfLoggedIn() {
  // ✅ run only on login page
  const isLoginPage =
    location.pathname.endsWith("admin-login.html") ||
    document.getElementById("loginBtn");

  if (!isLoginPage) return;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  fetch(`${API_BASE}/admin/me`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(() => (window.location.href = "admin-dashboard.html"))
    .catch(() => localStorage.removeItem(TOKEN_KEY));
})();

async function adminLogin() {
  const inputEl = document.getElementById("pin");
  const errorBox = document.getElementById("error");
  const btn = document.getElementById("loginBtn");

  const code = (inputEl?.value || "").trim();
  if (errorBox) errorBox.textContent = "";

  if (!code) {
    if (errorBox) errorBox.textContent = "Enter admin code";
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Signing in...";
  }

  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success || !data.token) {
      if (errorBox) errorBox.textContent = data.message || "Incorrect code";
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Login";
      }
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    window.location.href = "admin-dashboard.html";
  } catch (err) {
    console.error(err);
    if (errorBox) errorBox.textContent = "Server not reachable. Start backend first.";
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Login";
    }
  }
}

// UX: Enter key submits
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const pin = document.getElementById("pin");
    if (pin && document.activeElement === pin) adminLogin();
  }
});
