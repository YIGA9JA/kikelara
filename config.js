// config.js (FRONTEND - SAFE + OVERRIDES + NO DOUBLE SLASH)
(() => {
  const host = location.hostname;

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "";

  const LOCAL_API = "http://localhost:4000";
  const PROD_API = "https://kikelara1.onrender.com";

  // ✅ Allow override for testing:
  // 1) ?api=https://your-backend.com
  // 2) localStorage.setItem("API_BASE_OVERRIDE", "https://your-backend.com")
  const params = new URLSearchParams(location.search);
  const apiFromQuery = params.get("api");
  const apiFromStorage = localStorage.getItem("API_BASE_OVERRIDE");

  let base = apiFromQuery || apiFromStorage || (isLocal ? LOCAL_API : PROD_API);

  // Remove trailing slash to avoid "https://...//orders"
  base = String(base).replace(/\/$/, "");

  window.API_BASE = base;

  // Token storage key for admin login
  window.ADMIN_TOKEN_KEY = "admin-token";
})();
