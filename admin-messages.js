// admin-messages.js (FULL) - Token-auth admin messages page
(async () => {
  const ok = await checkAuth(); // from admin-login.js
  if (!ok) return;

  const API_BASE = "http://localhost:4000";
  const TOKEN_KEY = "admin-token";

  const apiLabel = document.getElementById("apiLabel");
  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const exportBtn = document.getElementById("exportBtn");

  const searchBox = document.getElementById("searchBox");
  const statsRow = document.getElementById("statsRow");
  const tbody = document.getElementById("tbody");
  const countLabel = document.getElementById("countLabel");

  const toastEl = document.getElementById("toast");

  // Modal
  const modal = document.getElementById("modal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const mName = document.getElementById("mName");
  const mEmailLink = document.getElementById("mEmailLink");
  const mMessage = document.getElementById("mMessage");
  const modalMeta = document.getElementById("modalMeta");
  const copyEmailBtn = document.getElementById("copyEmailBtn");
  const replyBtn = document.getElementById("replyBtn");
  const deleteBtn = document.getElementById("deleteBtn");

  if (apiLabel) apiLabel.textContent = API_BASE;

  logoutBtn?.addEventListener("click", adminLogout);
  refreshBtn?.addEventListener("click", () => loadMessages());
  exportBtn?.addEventListener("click", () => exportCSV());

  let allMessages = [];
  let filteredMessages = [];
  let selectedIndex = null;

  function authHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1600);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeText(v) {
    return String(v ?? "").trim() || "-";
  }

  function niceDate(d) {
    try {
      return d ? new Date(d).toLocaleString() : "-";
    } catch {
      return "-";
    }
  }

  function renderStats(list) {
    if (!statsRow) return;

    const total = list.length;
    const today = new Date();
    const isToday = (iso) => {
      if (!iso) return false;
      const dt = new Date(iso);
      return dt.toDateString() === today.toDateString();
    };
    const todayCount = list.filter(m => isToday(m.date)).length;

    const uniqueEmails = new Set(list.map(m => String(m.email || "").toLowerCase()).filter(Boolean)).size;

    statsRow.innerHTML = `
      <div class="stat"><div class="k">Total Messages</div><div class="v">${total.toLocaleString()}</div></div>
      <div class="stat"><div class="k">Today</div><div class="v">${todayCount.toLocaleString()}</div></div>
      <div class="stat"><div class="k">Unique Emails</div><div class="v">${uniqueEmails.toLocaleString()}</div></div>
    `;
  }

  function applySearch() {
    const q = String(searchBox?.value || "").trim().toLowerCase();

    if (!q) {
      filteredMessages = [...allMessages];
    } else {
      filteredMessages = allMessages.filter(m => {
        const name = String(m.name || "").toLowerCase();
        const email = String(m.email || "").toLowerCase();
        const msg = String(m.message || "").toLowerCase();
        return name.includes(q) || email.includes(q) || msg.includes(q);
      });
    }

    // newest first
    filteredMessages.sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return db - da;
    });

    renderTable(filteredMessages);
    renderStats(filteredMessages);

    if (countLabel) countLabel.textContent = `${filteredMessages.length} message${filteredMessages.length === 1 ? "" : "s"}`;
  }

  function renderTable(list) {
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">No messages found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((m) => {
      // IMPORTANT: we need original index for delete
      const originalIndex = allMessages.indexOf(m);

      const preview = safeText(m.message).slice(0, 140);
      const email = safeText(m.email);

      return `
        <tr>
          <td><b>${escapeHtml(safeText(m.name))}</b></td>
          <td class="email">${escapeHtml(email)}</td>
          <td><div class="preview">${escapeHtml(preview)}</div></td>
          <td class="date">${escapeHtml(niceDate(m.date))}</td>
          <td>
            <div class="actions">
              <button class="btn" type="button" data-view="${originalIndex}">View</button>
              <button class="danger-btn" type="button" data-del="${originalIndex}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function fetchMessages() {
    // your backend: GET /admin/messages
    const res = await fetch(`${API_BASE}/admin/messages`, {
      headers: {
        ...authHeaders()
      },
      cache: "no-store"
    });

    if (!res.ok) throw new Error("Failed to fetch messages");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadMessages() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Loading…</td></tr>`;

    try {
      allMessages = await fetchMessages();
      applySearch();
      toast("✅ Messages loaded");
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="5" class="empty">Failed to load messages. Start backend first.</td></tr>`;
      toast("❌ Failed to load");
    }
  }

  function openModal(index) {
    selectedIndex = index;

    const m = allMessages[index];
    if (!m) return;

    const email = safeText(m.email);

    mName.textContent = safeText(m.name);
    mMessage.textContent = safeText(m.message);

    mEmailLink.textContent = email;
    mEmailLink.href = email !== "-" ? `mailto:${email}` : "#";

    modalMeta.textContent = `Received: ${niceDate(m.date)}`;

    // Reply button opens mail client
    replyBtn.onclick = () => {
      if (email === "-") return;
      const subject = encodeURIComponent("KÍKE LÁRÁ — Reply to your message");
      const body = encodeURIComponent(`Hi ${safeText(m.name)},\n\n`);
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    };

    // Delete in modal
    deleteBtn.onclick = async () => {
      if (selectedIndex == null) return;
      const ok = confirm("Delete this message?");
      if (!ok) return;
      await deleteMessage(selectedIndex);
      closeModal();
    };

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    selectedIndex = null;
  }

  async function deleteMessage(index) {
    // Try recommended endpoint first: DELETE /admin/messages/:index
    // Fallback to your old endpoint: DELETE /admin/delete/:index
    const tryUrls = [
      `${API_BASE}/admin/messages/${index}`,
      `${API_BASE}/admin/delete/${index}`
    ];

    for (const url of tryUrls) {
      try {
        const res = await fetch(url, {
          method: "DELETE",
          headers: {
            ...authHeaders()
          }
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && (data.success !== false)) {
          toast("🗑️ Deleted");
          await loadMessages();
          return;
        }
      } catch (e) {
        // keep trying fallback
      }
    }

    toast("❌ Delete failed");
    alert("Delete failed. Your backend needs a DELETE endpoint for messages.");
  }

  function exportCSV() {
    const rows = filteredMessages.map(m => ({
      name: safeText(m.name),
      email: safeText(m.email),
      message: safeText(m.message).replaceAll("\n", " "),
      date: safeText(m.date)
    }));

    if (!rows.length) {
      toast("No messages to export");
      return;
    }

    const header = ["name","email","message","date"];
    const csv = [
      header.join(","),
      ...rows.map(r =>
        header.map(k => `"${String(r[k]).replaceAll('"','""')}"`).join(",")
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "messages.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();

    toast("✅ Exported CSV");
  }

  // EVENTS
  searchBox?.addEventListener("input", applySearch);

  document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest("[data-view]");
    if (viewBtn) {
      const idx = Number(viewBtn.getAttribute("data-view"));
      if (Number.isFinite(idx)) openModal(idx);
    }

    const delBtn = e.target.closest("[data-del]");
    if (delBtn) {
      const idx = Number(delBtn.getAttribute("data-del"));
      if (!Number.isFinite(idx)) return;
      const ok = confirm("Delete this message?");
      if (!ok) return;
      deleteMessage(idx);
    }
  });

  closeModalBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  copyEmailBtn?.addEventListener("click", async () => {
    const m = selectedIndex != null ? allMessages[selectedIndex] : null;
    const email = m?.email || "";
    if (!email) return;

    try {
      await navigator.clipboard.writeText(email);
      toast("✅ Email copied");
    } catch {
      toast("❌ Copy failed");
    }
  });

  // INIT
  await loadMessages();
})();
