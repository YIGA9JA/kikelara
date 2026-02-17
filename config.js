// config.js (FRONTEND - SAFE + NO DOUBLE SLASH + FIX localhost/127 cookie loop)
(() => {
  const host = location.hostname;

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "";

  // ✅ IMPORTANT: match API host to the same host you're using in the browser
  // If you opened the site with 127.0.0.1, use 127.0.0.1 for API too.
  const LOCAL_API = host === "127.0.0.1"
    ? "http://127.0.0.1:4000"
    : "http://localhost:4000";

  const PROD_API = "https://kikelara1.onrender.com";

  let base = isLocal ? LOCAL_API : PROD_API;

  // ✅ allow override ONLY locally
  if (isLocal) {
    const params = new URLSearchParams(location.search);
    const apiFromQuery = params.get("api");
    const apiFromStorage = localStorage.getItem("API_BASE_OVERRIDE");
    base = apiFromQuery || apiFromStorage || base;
  }

  // remove trailing slashes
  base = String(base).replace(/\/+$/, "");

  // ✅ safety: force https in prod
  if (!isLocal && !base.startsWith("https://")) {
    console.warn("Blocked insecure API_BASE in production:", base);
    base = PROD_API;
  }

  window.API_BASE = base;

  // ✅ hCaptcha Site Key (public)
  window.HCAPTCHA_SITE_KEY = "5c9c8e20-ad86-49b6-9b6a-c5b805b4d812";

  // must match server.js
  window.ADMIN_CSRF_COOKIE = "admin_csrf";
  window.ADMIN_CSRF_STORAGE_KEY = "admin_csrf_ls";
  window.ADMIN_LOGIN_URL = "admin-login.html";
  window.ADMIN_AUTH_MODE = "redirect";

  // (You can remove this if you're not using public bucket URLs)
  // window.SUPABASE_PUBLIC_BUCKET_URL = "https://YOURPROJECT.supabase.co/storage/v1/object/public/YOURBUCKET";
})();
