// auth.js
const API_BASE = window.API_BASE;
const TOKEN_KEY = window.ADMIN_TOKEN_KEY || "admin-token";

function adminLogout() {
  localStorage.removeItem(TOKEN_KEY);
  location.replace("admin-login.html");
}

async function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    location.replace("admin-login.html");
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Not ok");
    return true;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    location.replace("admin-login.html");
    return false;
  }
}
