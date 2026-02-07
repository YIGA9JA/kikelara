/* ===========================
   admin-messages.js (UPDATED FOR YOUR HTML)
   =========================== */

(() => {
  /* ================= CONFIG ================= */
  // If you have config.js exporting window.API_BASE, we use it.
  // Otherwise fallback to localhost.
  const API_BASE = (window.API_BASE || "http://localhost:4000").replace(/\/$/, "");
  const TOKEN_KEY = "admin-token";

  // Front-end PIN gate (server should still enforce admin auth)
  const DELETE_PIN = window.ADMIN_DELETE_PIN || "1234"; // you can set in config.js

  /* ================= ELEMENTS ================= */
  const apiLabel = document.getElementById("apiLabel");

  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const exportBtn = document.getElementById("exportBtn");

  const searchBox = document.getElementById("searchBox");

  const statsRow = document.getElementById("statsRow");
  const countLabel = document.getElementById("countLabel");

  const tbody = document.getElementById("tbody");

  // Modal
  const modal = document.getElementById("modal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalMeta = document.getElementById("modalMeta");
  const mName = document.getElementById("mName");
  const mEmailLink = document.getElementById("mEmailLink");
  const copyEmailBtn = document.getElementById("copyEmailBtn");
  const mMessage = document.getElementById("mMessage");
  const replyBtn = document.getElementById("replyBtn");
  const deleteBtn = document.getElementById("deleteBtn");

  const toastEl = document.getElementById("toast");

  /* ================= STATE ================= */
  let allMessages = [];
  let activeMessage = null;

  /* ================= INIT UI ================= */
  if (apiLabel) apiLabel.textContent = API_BASE;

  /* ================= AUTH HELPERS ================= */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchWithAuth(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...authHeaders(),
      },
    });

    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      location.replace("admin-login.html");
      return null;
    }
    return res;
  }

  /* ================= UTIL ================= */
  function toast(msg) {
    if (!toastEl) return alert(msg);
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2300);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return "—";
    }
  }

  function getId(m) {
    return m?._id || m?.id || m?.messageId || m?.ref || "";
  }

  function getEmail(m) {
    return (m?.email || "").trim();
  }

  function getName(m) {
    return (m?.name || "Unknown").trim();
  }

  function getText(m) {
    return (m?.message || m?.text || m?.content || "").trim();
  }

  // "replied" can vary depending on how your backend stores it
  function isReplied(m) {
    return Boolean(m?.replied) || Boolean(m?.reply) || (Array.isArray(m?.replies) && m.replies.length > 0);
  }

  function getReplyText(m) {
    if (typeof m?.reply === "string" && m.reply.trim()) return m.reply.trim();
    if (Array.isArray(m?.replies) && m.replies.length) {
      const last = m.replies[m.replies.length - 1];
      return (last?.text || last?.message || "").trim();
    }
    return "";
  }

  function makePreview(text, n = 90) {
    if (!text) return "—";
    return text.length > n ? text.slice(0, n) + "…" : text;
  }

  /* ================= API ================= */
  async function apiLoadMessages() {
    const res = await fetchWithAuth(`${API_BASE}/admin/messages`, { cache: "no-store" });
    if (!res) return [];

    if (!res.ok) throw new Error("Failed to load messages");
    const data = await res.json().catch(() => ({}));

    // Accept {messages:[...]} or [...]
    return Array.isArray(data) ? data : Array.isArray(data.messages) ? data.messages : [];
  }

  async function apiDeleteMessage(id) {
    const res = await fetchWithAuth(`${API_BASE}/admin/messages/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res) return null;
    if (!res.ok) throw new Error("Delete failed");
    return res.json().catch(() => ({}));
  }

  async function apiReplyMessage(id, reply) {
    const res = await fetchWithAuth(`${API_BASE}/admin/messages/${encodeURIComponent(id)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    });
    if (!res) return null;
    if (!res.ok) throw new Error("Reply failed");
    return res.json().catch(() => ({}));
  }

  /* ================= FILTER ================= */
  function filteredMessages() {
    const q = String(searchBox?.value || "").trim().toLowerCase();
    let arr = [...allMessages];

    if (q) {
      arr = arr.filter((m) => {
        const blob = [
          getName(m),
          getEmail(m),
          getText(m),
          getReplyText(m),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }

    // newest first
    arr.sort((a, b) => new Date(b.createdAt || b.date || b.time || 0) - new Date(a.createdAt || a.date || a.time || 0));
    return arr;
  }

  /* ================= RENDER STATS ================= */
  function renderStats() {
    if (!statsRow) return;

    const total = allMessages.length;
    const replied = allMessages.filter(isReplied).length;
    const unreplied = total - replied;

    statsRow.innerHTML = `
      <div class="stat">
        <div class="k">Total Messages</div>
        <div class="v">${total}</div>
      </div>
      <div class="stat">
        <div class="k">Replied</div>
        <div class="v">${replied}</div>
      </div>
      <div class="stat">
        <div class="k">Unreplied</div>
        <div class="v">${unreplied}</div>
      </div>
    `;
  }

  /* ================= RENDER TABLE ================= */
  function renderTable() {
    if (!tbody) return;

    const list = filteredMessages();
    if (countLabel) countLabel.textContent = `${list.length} message${list.length === 1 ? "" : "s"}`;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">No messages found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((m) => {
        const id = getId(m);
        const name = escapeHtml(getName(m));
        const email = escapeHtml(getEmail(m) || "—");
        const msg = escapeHtml(makePreview(getText(m), 120));
        const date = escapeHtml(formatDate(m.createdAt || m.date || m.time));
        const replied = isReplied(m);

        return `
          <tr data-id="${escapeHtml(id)}">
            <td><b>${name}</b> ${replied ? `<span style="opacity:.75;">(replied)</span>` : ""}</td>
            <td class="email">${email}</td>
            <td><div class="preview">${msg}</div></td>
            <td class="date">${date}</td>
            <td>
              <div class="actions">
                <button class="btn" data-action="view" data-id="${escapeHtml(id)}">View</button>
                <button class="danger-btn" data-action="delete" data-id="${escapeHtml(id)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  /* ================= MODAL ================= */
  function openModal(m) {
    activeMessage = m;

    const email = getEmail(m);
    const name = getName(m);
    const message = getText(m);

    if (mName) mName.textContent = name || "—";

    if (mEmailLink) {
      mEmailLink.textContent = email || "—";
      if (email) {
        mEmailLink.href = `mailto:${email}`;
        mEmailLink.style.pointerEvents = "auto";
        mEmailLink.style.opacity = "1";
      } else {
        mEmailLink.href = "#";
        mEmailLink.style.pointerEvents = "none";
        mEmailLink.style.opacity = ".75";
      }
    }

    if (mMessage) mMessage.textContent = message || "—";

    const created = formatDate(m.createdAt || m.date || m.time);
    const replied = isReplied(m) ? "Replied" : "Not replied";
    if (modalMeta) modalMeta.textContent = `${replied} • ${created}`;

    if (modal) modal.classList.add("show");
    if (modal) modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    activeMessage = null;
    if (modal) modal.classList.remove("show");
    if (modal) modal.setAttribute("aria-hidden", "true");
  }

  /* ================= ACTIONS ================= */
  async function handleDelete(id) {
    const pin = prompt("Enter delete PIN:");
    if (pin !== DELETE_PIN) return toast("❌ Wrong PIN");

    const ok = confirm("Delete this message permanently?");
    if (!ok) return;

    try {
      await apiDeleteMessage(id);
      allMessages = allMessages.filter((m) => getId(m) !== id);
      renderStats();
      renderTable();
      closeModal();
      toast("✅ Message deleted");
    } catch (e) {
      console.error(e);
      toast("❌ Delete failed (check backend)");
    }
  }

  async function handleReply() {
    if (!activeMessage) return;

    const id = getId(activeMessage);
    const email = getEmail(activeMessage);

    const reply = prompt(
      `Type your reply${email ? ` (will be saved to backend)` : ""}:`
    );
    if (!reply || !reply.trim()) return;

    try {
      await apiReplyMessage(id, reply.trim());

      // Update local state
      activeMessage.replied = true;
      activeMessage.reply = reply.trim();
      activeMessage.repliedAt = new Date().toISOString();

      renderStats();
      renderTable();
      openModal(activeMessage); // refresh modal meta
      toast("✅ Reply saved");
    } catch (e) {
      console.error(e);
      toast("❌ Reply failed (check backend)");
    }
  }

  function exportCSV() {
    const rows = filteredMessages().map((m) => ({
      name: getName(m),
      email: getEmail(m),
      message: getText(m),
      replied: isReplied(m) ? "Yes" : "No",
      reply: getReplyText(m),
      date: formatDate(m.createdAt || m.date || m.time),
    }));

    const headers = ["name", "email", "message", "replied", "reply", "date"];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `messages_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    toast("✅ Exported CSV");
  }

  /* ================= EVENTS ================= */
  refreshBtn?.addEventListener("click", () => reload());

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    location.replace("admin-login.html");
  });

  exportBtn?.addEventListener("click", exportCSV);

  searchBox?.addEventListener("input", () => renderTable());

  closeModalBtn?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  copyEmailBtn?.addEventListener("click", async () => {
    if (!activeMessage) return;
    const email = getEmail(activeMessage);
    if (!email) return toast("No email to copy");
    try {
      await navigator.clipboard.writeText(email);
      toast("✅ Email copied");
    } catch {
      toast("❌ Copy failed");
    }
  });

  replyBtn?.addEventListener("click", handleReply);

  deleteBtn?.addEventListener("click", () => {
    if (!activeMessage) return;
    handleDelete(getId(activeMessage));
  });

  // Table action buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    const msg = allMessages.find((m) => getId(m) === id);
    if (!msg) return toast("Message not found");

    if (action === "view") openModal(msg);
    if (action === "delete") handleDelete(id);
  });

  /* ================= LOAD ================= */
  async function reload() {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty">Loading…</td></tr>`;

    try {
      const arr = await apiLoadMessages();
      allMessages = Array.isArray(arr) ? arr : [];
      renderStats();
      renderTable();
    } catch (e) {
      console.error(e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="empty">❌ Failed to load messages.</td></tr>`;
      toast("❌ Failed to load messages");
    }
  }

  // Boot
  if (!getToken()) {
    location.replace("admin-login.html");
    return;
  }

  reload();
})();
