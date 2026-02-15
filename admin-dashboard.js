(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const API_BASE = (window.API_BASE || "").replace(/\/$/, "");
  const apiPill = document.getElementById("apiPill");
  if (apiPill) apiPill.textContent = `API: ${API_BASE}`;

  document.getElementById("logoutBtn")?.addEventListener("click", adminLogout);

  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-go]");
    if (!card) return;
    location.href = card.getAttribute("data-go");
  });

  const statusLine = document.getElementById("statusLine");
  const kOrders = document.getElementById("kOrders");
  const kPending = document.getElementById("kPending");
  const kProducts = document.getElementById("kProducts");
  const kMessages = document.getElementById("kMessages");

  function setStatus(t){ if (statusLine) statusLine.textContent = t; }
  function setNum(el, n){ if (el) el.textContent = (n === null || n === undefined) ? "—" : String(n); }

  // Light KPI fetchers (safe + non-blocking)
  async function loadKpis() {
    setStatus("Loading…");

    try {
      // orders
      const r1 = await apiFetch("/orders", { method:"GET", cache:"no-store" });
      const orders = r1.ok ? await r1.json().catch(() => []) : [];
      const arr = Array.isArray(orders) ? orders : [];
      const pending = arr.filter(o => String(o.status||"") === "Pending").length;

      setNum(kOrders, arr.length);
      setNum(kPending, pending);
    } catch {
      setNum(kOrders, "—"); setNum(kPending, "—");
    }

    try {
      // products admin endpoint (cookie auth)
      const r2 = await apiFetch("/admin/products", { method:"GET", cache:"no-store" });
      const data = r2.ok ? await r2.json().catch(()=>({})) : {};
      const products = Array.isArray(data.products) ? data.products : [];
      setNum(kProducts, products.length);
    } catch {
      setNum(kProducts, "—");
    }

    try {
      // messages
      const r3 = await apiFetch("/admin/messages", { method:"GET", cache:"no-store" });
      const msgs = r3.ok ? await r3.json().catch(()=>[]) : [];
      setNum(kMessages, Array.isArray(msgs) ? msgs.length : "—");
    } catch {
      setNum(kMessages, "—");
    }

    setStatus("Ready.");
  }

  await loadKpis();
})();
