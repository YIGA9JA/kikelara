// admin-dashboard.js
(async () => {
  // ✅ block page if not logged in
  const ok = await checkAuth();
  if (!ok) return;

  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", adminLogout);

  // ✅ click cards
  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-go]");
    if (!card) return;
    window.location.href = card.getAttribute("data-go");
  });
})();
