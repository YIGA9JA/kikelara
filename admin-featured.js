(async function () {
  "use strict";

  const $ = (q) => document.querySelector(q);
  const list = $("#list");
  const createForm = $("#createForm");
  const msg = $("#createMsg");

  $("#logoutBtn").addEventListener("click", () => window.adminLogout());

  const ok = await window.checkAuth();
  if (!ok) return;

  async function json(res) {
    return res.json().catch(() => ({}));
  }

  async function load() {
    list.innerHTML = "Loading...";
    const res = await window.apiFetch("/admin/featured");
    const data = await json(res);
    if (!res.ok || !data.success) {
      list.innerHTML = "Failed to load.";
      return;
    }

    list.innerHTML = "";
    for (const it of data.items || []) {
      const card = document.createElement("div");
      card.className = "item";
      card.innerHTML = `
        <div class="thumb">${it.image_url ? `<img src="${it.image_url}" alt="">` : ""}</div>
        <div class="meta">
          <div class="t">${escapeHtml(it.title || "—")}</div>
          <div class="l">${escapeHtml(it.link_url || "")}</div>
          <div class="l">sort: ${Number(it.sort_order || 0)} • active: ${it.is_active ? "yes" : "no"}</div>
          <div class="b">
            <button class="small danger" data-del="${it.id}">Delete</button>
          </div>
        </div>
      `;
      list.appendChild(card);
    }

    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("Delete this featured item?")) return;
        const r = await window.apiFetch(`/admin/featured/${id}`, { method: "DELETE" });
        const d = await json(r);
        if (!r.ok || !d.success) return alert(d.message || "Delete failed");
        load();
      });
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const fd = new FormData(createForm);
    // checkbox: if unchecked, it won’t exist
    if (!createForm.is_active.checked) fd.set("is_active", "false");
    else fd.set("is_active", "true");

    const res = await window.apiFetch("/admin/featured", { method: "POST", body: fd });
    const data = await json(res);

    if (!res.ok || !data.success) {
      msg.textContent = data.message || "Upload failed";
      return;
    }

    createForm.reset();
    createForm.is_active.checked = true;
    msg.textContent = "✅ Uploaded";
    load();
  });

  load();
})();
