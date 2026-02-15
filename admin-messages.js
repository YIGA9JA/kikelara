// admin-messages.js (COOKIE AUTH + CSRF FIX - Option A)
// ✅ Uses cookie auth (admin_session) + CSRF from localStorage ("admin_csrf")
// ✅ No frontend PIN stored. Delete PIN is requested at delete time.
// ✅ Sends credentials: "include" always.

(() => {
  const API_BASE = (window.API_BASE || "").replace(/\/$/, "");

  const apiLabel = document.getElementById("apiLabel");
  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const exportBtn = document.getElementById("exportBtn");
  const searchBox = document.getElementById("searchBox");
  const statsRow = document.getElementById("statsRow");
  const countLabel = document.getElementById("countLabel");
  const tbody = document.getElementById("tbody");
  const toastEl = document.getElementById("toast");

  // Modal
  const modal = document.getElementById("modal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalMeta = document.getElementById("modalMeta");
  const mName = document.getElementById("mName");
  const mEmailLink = document.getElementById("mEmailLink");
  const copyEmailBtn = document.getElementById("copyEmailBtn");
  const mMessage = document.getElementById("mMessage");
  const deleteBtn = document.getElementById("deleteBtn");
  const replyBtn = document.getElementById("replyBtn");

  if (apiLabel) apiLabel.textContent = API_BASE;

  let allMessages = [];
  let activeMessage = null;

  /* ===================== CSRF (Option A) ===================== */
  const CSRF_STORAGE_KEY = "admin_csrf";

  function getCsrfToken() {
    return localStorage.getItem(CSRF_STORAGE_KEY) || "";
  }
  function setCsrfToken(token) {
    const t = String(token || "").trim();
    if (t) localStorage.setItem(CSRF_STORAGE_KEY, t);
  }
  function clearCsrfToken() {
    localStorage.removeItem(CSRF_STORAGE_KEY);
  }

  /* ===================== FETCH HELPERS ===================== */

  async function apiFetch(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

    const method = String(opts.method || "GET").toUpperCase();
    const headers = new Headers(opts.headers || {});
    if (!headers.has("Accept")) headers.set("Accept", "application/json");

    // send CSRF on mutating methods
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) headers.set("X-CSRF-Token", csrf);
    }

    const res = await fetch(url, {
      ...opts,
      method,
      headers,
      credentials: "include", // ✅ cookies
      cache: opts.cache || "no-store",
    });

    // If session expired or CSRF blocked -> go login
    if (res.status === 401) {
      clearCsrfToken();
      location.replace("admin-login.html");
      return null;
    }

    if (res.status === 403) {
      // could be CSRF blocked or your "delete pin" middleware
      // if it's CSRF blocked, usually message is "CSRF blocked"
      // treat as needing login if csrf missing
      const csrf = getCsrfToken();
      if (!csrf) {
        location.replace("admin-login.html");
        return null;
      }
    }

    return res;
  }

  /* ===================== UI HELPERS ===================== */

  function toast(msg) {
    if (!toastEl) return alert(msg);
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 1800);
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
    try { return new Date(ts).toLocaleString(); } catch { return "—"; }
  }

  function getId(m) { return m?.id ?? m?._id ?? ""; }
  function getName(m) { return String(m?.name || "Unknown").trim(); }
  function getEmail(m) { return String(m?.email || "").trim(); }
  function getMsg(m) { return String(m?.message || "").trim(); }
  function getDate(m) { return m?.createdAt || m?.created_at || m?.date || m?.time || ""; }

  function makePreview(text, n = 110) {
    if (!text) return "—";
    return text.length > n ? text.slice(0, n) + "…" : text;
  }

  /* ===================== API ===================== */

  async function apiLoadMessages() {
    const res = await apiFetch(`/admin/messages`, { cache: "no-store" });
    if (!res) return [];
    if (!res.ok) throw new Error("Failed to load messages");
    const data = await res.json().catch(() => ([]));
    return Array.isArray(data) ? data : [];
  }

  async function apiDeleteMessage(id) {
    const pin = prompt("Enter delete PIN:");
    if (!pin) throw new Error("Cancelled");

    const res = await apiFetch(`/admin/messages/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        "X-Admin-Delete-Pin": String(pin).trim(),
      }
    });

    if (!res) return null;

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || "Delete failed");
    }

    return res.json().catch(() => ({}));
  }

  async function apiLogout() {
    // best effort logout - if csrf missing, backend may block.
    const res = await apiFetch(`/admin/logout`, { method: "POST" });
    clearCsrfToken();
    return res;
  }

  /* ===================== RENDER ===================== */

  function filteredMessages() {
    const q = String(searchBox?.value || "").trim().toLowerCase();
    let arr = [...allMessages];

    if (q) {
      arr = arr.filter(m => {
        const blob = `${getName(m)} ${getEmail(m)} ${getMsg(m)}`.toLowerCase();
        return blob.includes(q);
      });
    }

    arr.sort((a, b) => new Date(getDate(b) || 0) - new Date(getDate(a) || 0));
    return arr;
  }

  function renderStats() {
    if (!statsRow) return;
    const total = allMessages.length;
    statsRow.innerHTML = `
      <div class="stat">
        <div class="k">Total Messages</div>
        <div class="v">${total}</div>
      </div>
    `;
  }

  function renderTable() {
    if (!tbody) return;

    const list = filteredMessages();
    if (countLabel) countLabel.textContent = `${list.length} message${list.length === 1 ? "" : "s"}`;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">No messages found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(m => {
      const id = getId(m);
      const name = escapeHtml(getName(m));
      const email = escapeHtml(getEmail(m) || "—");
      const msg = escapeHtml(makePreview(getMsg(m), 140));
      const date = escapeHtml(formatDate(getDate(m)));

      return `
        <tr data-id="${escapeHtml(id)}">
          <td><b>${name}</b></td>
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
    }).join("");
  }

  function openModal(m) {
    activeMessage = m;

    if (mName) mName.textContent = getName(m) || "—";

    const email = getEmail(m);
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

    if (mMessage) mMessage.textContent = getMsg(m) || "—";
    if (modalMeta) modalMeta.textContent = formatDate(getDate(m));

    if (modal) {
      modal.classList.add("show");
      modal.setAttribute("aria-hidden", "false");
    }
  }

  function closeModal() {
    activeMessage = null;
    if (modal) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  /* ===================== ACTIONS ===================== */

  async function handleDelete(id) {
    const ok = confirm("Delete this message permanently?\nThis cannot be undone.");
    if (!ok) return;

    try {
      await apiDeleteMessage(id);
      allMessages = allMessages.filter(m => String(getId(m)) !== String(id));
      renderStats();
      renderTable();
      closeModal();
      toast("✅ Message deleted");
    } catch (e) {
      console.error(e);
      toast(`❌ ${String(e.message || e)}`);
    }
  }

  function exportCSV() {
    const rows = filteredMessages().map(m => ({
      name: getName(m),
      email: getEmail(m),
      message: getMsg(m),
      date: formatDate(getDate(m))
    }));

    const headers = ["name", "email", "message", "date"];
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(","))
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

  /* ===================== EVENTS ===================== */

  refreshBtn?.addEventListener("click", reload);

  logoutBtn?.addEventListener("click", async () => {
    try { await apiLogout(); } catch {}
    location.replace("admin-login.html");
  });

  exportBtn?.addEventListener("click", exportCSV);

  searchBox?.addEventListener("input", renderTable);

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

  replyBtn?.addEventListener("click", () => {
    if (!activeMessage) return;
    const email = getEmail(activeMessage);
    if (!email) return toast("No email available");
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Reply from KÍKÉLÁRÁ")}`;
  });

  deleteBtn?.addEventListener("click", () => {
    if (!activeMessage) return;
    handleDelete(getId(activeMessage));
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    const msg = allMessages.find(m => String(getId(m)) === String(id));
    if (!msg) return toast("Message not found");

    if (action === "view") openModal(msg);
    if (action === "delete") handleDelete(id);
  });

  /* ===================== BOOT ===================== */

  // ✅ Cookie auth is the source of truth.
  // But CSRF token must exist for delete/logout etc.
  // If user came here without logging in properly, CSRF will be missing.
  if (!getCsrfToken()) {
    // still try loading (GET works), but if your /admin/messages requires cookie, it will redirect anyway.
  }

  reload();
})();
