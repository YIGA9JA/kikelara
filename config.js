// config.js (FRONTEND - SECURE + NO TOKEN LEAK + NO DOUBLE SLASH)
(() => {
  const host = location.hostname;

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "";

  const LOCAL_API = "http://localhost:4000";
  const PROD_API = "https://kikelara1.onrender.com";

  let base = isLocal ? LOCAL_API : PROD_API;

  // ✅ Allow override ONLY in local dev (prevents token exfiltration via ?api=... in production)
  if (isLocal) {
    const params = new URLSearchParams(location.search);
    const apiFromQuery = params.get("api");
    const apiFromStorage = localStorage.getItem("API_BASE_OVERRIDE");
    base = apiFromQuery || apiFromStorage || base;
  }

  // Remove trailing slash to avoid "https://...//orders"
  base = String(base).replace(/\/$/, "");

  // ✅ Hard safety: block non-https API in production
  if (!isLocal && !base.startsWith("https://")) {
    console.warn("Blocked insecure API_BASE in production:", base);
    base = PROD_API;
  }

  window.API_BASE = base;

  // ✅ hCaptcha Site Key (PUBLIC)
  window.HCAPTCHA_SITE_KEY = "5c9c8e20-ad86-49b6-9b6a-c5b805b4d812";

  // ✅ This is NOT a password. It's only the storage key name.
  // Use a real name (your "4567" is confusing and easy to misuse)
  window.ADMIN_TOKEN_KEY = "kikelara_admin_token_v1";

  // If your backend uses a different CSRF cookie name, set it here.
// Must match what server sets.
window.ADMIN_CSRF_COOKIE = "admin_csrf";

// Optional localStorage fallback key (only used if you decide to store csrf token there)
window.ADMIN_CSRF_STORAGE_KEY = "admin_csrf_ls";
})();



