// auth.js (shared by all admin pages)

const API_BASE = "http://localhost:4000";
const TOKEN_KEY = "admin-token";

async function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "admin-login.html";
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "admin-login.html";
      return false;
    }

    return true;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "admin-login.html";
    return false;
  }
}

function adminLogout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "admin-login.html";
}
