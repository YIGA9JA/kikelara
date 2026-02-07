(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  document.getElementById("logoutBtn")?.addEventListener("click", adminLogout);

  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-go]");
    if (!card) return;
    location.href = card.getAttribute("data-go");
  });
})();
