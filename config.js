// config.js
(() => {
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  const LOCAL_API = "http://localhost:4000";
  const PROD_API  = "https://kikelara.onrender.com";

  window.API_BASE = isLocal ? LOCAL_API : PROD_API;
  window.ADMIN_TOKEN_KEY = "admin-token";
})();
window.API_BASE = "https://kikelara.onrender.com";
window.ADMIN_DELETE_PIN = "1234";
// config.js
window.API_BASE = "https://kikelara.onrender.com";
window.ADMIN_TOKEN_KEY = "admin-token";
