const API_BASE = window.API_BASE;
const TOKEN_KEY = window.ADMIN_TOKEN_KEY || "admin-token";

(async function redirectIfLoggedIn() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) location.href = "admin-dashboard.html";
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    localStorage.removeItem(TOKEN_KEY);
  }
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

  btn.disabled = true;
  btn.textContent = "Signing in...";

  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.token) {
      if (errorBox) errorBox.textContent = data.message || "Incorrect code";
      btn.disabled = false;
      btn.textContent = "Login";
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    location.href = "admin-dashboard.html";
  } catch (err) {
    if (errorBox) errorBox.textContent = "Server not reachable.";
    btn.disabled = false;
    btn.textContent = "Login";
  }
}

document.getElementById("loginBtn")?.addEventListener("click", adminLogin);

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const pin = document.getElementById("pin");
    if (pin && document.activeElement === pin) adminLogin();
  }
});
