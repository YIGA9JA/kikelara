// config.js (FRONTEND - UPDATED)
(() => {
  const host = location.hostname;

  // Local if running from localhost/127.0.0.1 OR opened directly as file:// (hostname will be "")
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "";

  // ✅ Local backend (your Node server)
  const LOCAL_API = "http://localhost:4000";

  // ✅ Production backend (Render)
  const PROD_API = "https://kikelara.onrender.com";

  // Set API base for every frontend page to use
  window.API_BASE = isLocal ? LOCAL_API : PROD_API;

  // Token storage key for admin login
  window.ADMIN_TOKEN_KEY = "admin-token";
})();
