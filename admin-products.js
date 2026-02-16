/* admin-products.js — HARDENED + REAL CRUD (KÍKÉLÁRÁ)
   ✅ Cookie session + CSRF header (cookie OR localStorage fallback)
   ✅ Uses apiFetch() from auth.js
   ✅ Fixes aria-hidden focus warning (blur before hide + inert)
   ✅ Refresh works: re-fetches backend products
   ✅ After save, products show immediately + sessionStorage(allProducts) sync
   ✅ Extra hardening:
      - blocks dangerous image_url schemes
      - upload size/type limits
      - double-submit prevention
      - basic client-side login lockout (doesn’t replace backend rate-limit)
*/

(function () {
  const $ = (id) => document.getElementById(id);

  // Elements
  const loginModal = $("loginModal");
  const editModal = $("editModal");

  const newBtn = $("newBtn");
  const refreshBtn = $("refreshBtn");
  const logoutBtn = $("logoutBtn");

  const loginClose = $("loginClose");
  const loginCancel = $("loginCancel");
  const loginForm = $("loginForm");
  const adminPass = $("adminPass");
  const loginHelp = $("loginHelp");

  const editClose = $("editClose");
  const cancelEdit = $("cancelEdit");
  const editForm = $("editForm");

  const editTitle = $("editTitle");
  const pid = $("pid");
  const nameIpt = $("name");
  const priceIpt = $("price");
  const desc = $("desc");
  const descCount = $("descCount");
  const activeSel = $("active");
  const segBtns = Array.from(document.querySelectorAll(".segBtn"));

  const imageIpt = $("image");
  const previewImg = $("previewImg");
  const clearImgBtn = $("clearImgBtn");
  const removeImage = $("removeImage");
  const imgDropOverlay = $("imgDropOverlay");
  const dropBox = $("dropBox");

  const toastWrap = $("toastWrap");

  const grid = $("grid");
  const empty = $("empty");
  const status = $("status");
  const q = $("q");
  const sort = $("sort");
  const filterBtns = Array.from(document.querySelectorAll("[data-filter]"));

  let lastFocus = null;

  let products = [];
  let activeFilter = "all"; // all | active | inactive

  // ✅ Upload hardening (frontend only; backend must also enforce)
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
  const ALLOWED_IMG_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

  // ✅ basic client-side login lockout (backend still must rate limit)
  const LOCK_KEY = "admin_login_lock_v1";
  const FAIL_KEY = "admin_login_fail_v1";

  function nowMs() { return Date.now(); }
  function getNumLS(k) { try { return Number(localStorage.getItem(k) || 0); } catch { return 0; } }
  function setNumLS(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }
  function clearLS(k) { try { localStorage.removeItem(k); } catch {} }

  /* ================= HELPERS ================= */
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ blocks javascript: and unsafe data:
  function safeImgSrc(src) {
    const s = String(src || "").trim();
    if (!s) return "";
    const low = s.toLowerCase();

    if (low.startsWith("javascript:")) return "";
    if (low.startsWith("data:") && !low.startsWith("data:image/")) return "";
    return s;
  }

  function toast(type, title, body) {
    if (!toastWrap) return;
    const el = document.createElement("div");
    el.className = `toast ${type || "ok"}`;
    el.innerHTML = `
      <div class="t-row">
        <div class="t-title">${escapeHtml(title || "Notice")}</div>
        <button class="t-close" type="button">Close</button>
      </div>
      <div class="t-body">${escapeHtml(body || "")}</div>
    `;
    el.querySelector(".t-close")?.addEventListener("click", () => el.remove());
    toastWrap.appendChild(el);
    setTimeout(() => { if (el.isConnected) el.remove(); }, 4500);
  }

  function setStatus(text, type) {
    if (!status) return;
    status.textContent = text || "";
    status.dataset.type = type || "";
  }

  function isOpen(modal) {
    return modal && modal.classList.contains("show");
  }

  function setAria(modal, open) {
    if (!modal) return;
    modal.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) modal.removeAttribute("inert");
    else modal.setAttribute("inert", "");
  }

  function lockBody(open) {
    document.body.classList.toggle("modal-open", open);
  }

  function getFocusable(container) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
  }

  function trapFocus(modal, e) {
    if (!isOpen(modal)) return;
    if (e.key !== "Tab") return;

    const card = modal.querySelector(".modal-card");
    const focusables = getFocusable(card);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openModal(modal, focusEl) {
    if (!modal) return;

    lastFocus = document.activeElement;

    modal.classList.add("show");
    setAria(modal, true);
    lockBody(true);

    const card = modal.querySelector(".modal-card");
    if (card) card.scrollTop = 0;

    window.requestAnimationFrame(() => {
      if (focusEl && typeof focusEl.focus === "function") {
        focusEl.focus();
        return;
      }
      const focusables = getFocusable(card);
      focusables[0]?.focus?.();
    });
  }

  function closeModal(modal) {
    if (!modal) return;

    try {
      if (document.activeElement && modal.contains(document.activeElement)) {
        document.activeElement.blur?.();
      }
    } catch {}

    modal.classList.remove("show");
    setAria(modal, false);

    if (!isOpen(loginModal) && !isOpen(editModal)) lockBody(false);

    if (lastFocus && typeof lastFocus.focus === "function") {
      window.requestAnimationFrame(() => lastFocus?.focus?.());
    }
    lastFocus = null;

    // ✅ clear password field on close (reduces accidental leaks)
    if (modal === loginModal && adminPass) adminPass.value = "";
  }

  function bindOutsideClose(modal) {
    if (!modal) return;
    modal.addEventListener("mousedown", (e) => {
      const card = modal.querySelector(".modal-card");
      if (!card) return;
      if (!card.contains(e.target)) closeModal(modal);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (isOpen(editModal)) closeModal(editModal);
      else if (isOpen(loginModal)) closeModal(loginModal);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (isOpen(editModal)) trapFocus(editModal, e);
    else if (isOpen(loginModal)) trapFocus(loginModal, e);
  });

  bindOutsideClose(loginModal);
  bindOutsideClose(editModal);

  /* ================= UI SMALLS ================= */
  function updateDescCount() {
    if (!desc || !descCount) return;
    const v = desc.value || "";
    if (v.length > 600) desc.value = v.slice(0, 600);
    descCount.textContent = `${desc.value.length} / 600`;
  }
  desc?.addEventListener("input", updateDescCount);

  function setActiveUI(valBool) {
    if (activeSel) activeSel.value = valBool ? "true" : "false";
    segBtns.forEach((b) => {
      const isOn = (b.getAttribute("data-seg") === (valBool ? "true" : "false"));
      b.classList.toggle("is-on", isOn);
    });
  }
  segBtns.forEach((b) => b.addEventListener("click", () => setActiveUI(b.getAttribute("data-seg") === "true")));
  setActiveUI(true);

  function showPreview(src) {
    if (!previewImg) return;
    previewImg.src = src || "";
    const has = !!src;
    if (imgDropOverlay) imgDropOverlay.style.display = has ? "none" : "grid";
  }

  function resetImage() {
    if (imageIpt) imageIpt.value = "";
    if (removeImage) removeImage.value = "true";
    showPreview("");
  }

  function validateImageFile(file) {
    if (!file) return { ok: true };
    if (!ALLOWED_IMG_TYPES.has(file.type)) {
      return { ok: false, msg: "Please select a PNG, JPG or WEBP." };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, msg: `Image too large. Max ${(MAX_IMAGE_BYTES / (1024*1024)).toFixed(0)}MB.` };
    }
    return { ok: true };
  }

  imageIpt?.addEventListener("change", () => {
    const f = imageIpt.files && imageIpt.files[0];
    if (!f) return;

    const v = validateImageFile(f);
    if (!v.ok) {
      toast("err", "Invalid image", v.msg);
      imageIpt.value = "";
      return;
    }

    if (removeImage) removeImage.value = "false";
    showPreview(URL.createObjectURL(f));
  });

  clearImgBtn?.addEventListener("click", () => {
    resetImage();
    toast("warn", "Removed", "Image cleared.");
  });

  if (dropBox) {
    ["dragenter", "dragover"].forEach((evt) => {
      dropBox.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (imgDropOverlay) imgDropOverlay.style.display = "grid";
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      dropBox.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    dropBox.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      const v = validateImageFile(file);
      if (!v.ok) return toast("err", "Invalid image", v.msg);

      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        imageIpt.files = dt.files;
      } catch {}

      if (removeImage) removeImage.value = "false";
      showPreview(URL.createObjectURL(file));
      toast("ok", "Image added", "Preview updated.");
    });
  }

  function resetEditForm() {
    if (pid) pid.value = "";
    if (nameIpt) nameIpt.value = "";
    if (priceIpt) priceIpt.value = "";
    if (desc) desc.value = "";
    updateDescCount();
    setActiveUI(true);
    if (removeImage) removeImage.value = "false";
    showPreview("");
    const help = $("editHelp");
    if (help) { help.textContent = ""; help.removeAttribute("data-type"); }
  }

  function resolveImage(url) {
    const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
    const u = String(url || "");
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/uploads/")) return API_BASE ? `${API_BASE}${u}` : u;
    return u;
  }

  function fillEditForm(p) {
    if (pid) pid.value = String(p.id);
    if (nameIpt) nameIpt.value = String(p.name || "");
    if (priceIpt) priceIpt.value = String(Math.max(0, Math.round(Number(p.price || 0))));
    if (desc) desc.value = String(p.description || "");
    updateDescCount();
    setActiveUI(Boolean(p.is_active));
    if (removeImage) removeImage.value = "false";

    const img = safeImgSrc(resolveImage(p.image_url));
    showPreview(img);
  }

  /* ================= AUTH ================= */
  async function checkMe() {
    const r = await apiFetch("/admin/me", { method: "GET" });
    if (!r.ok) return false;
    const data = await r.json().catch(() => ({}));
    return !!data?.success;
  }

  function isLockedOut() {
    const until = getNumLS(LOCK_KEY);
    return until && nowMs() < until;
  }

  function lockoutSecondsLeft() {
    const until = getNumLS(LOCK_KEY);
    if (!until) return 0;
    return Math.max(0, Math.ceil((until - nowMs()) / 1000));
  }

  function registerLoginFail() {
    const fails = getNumLS(FAIL_KEY) + 1;
    setNumLS(FAIL_KEY, fails);

    // 5 fails => 60s lock
    if (fails >= 5) {
      setNumLS(LOCK_KEY, nowMs() + 60_000);
      setNumLS(FAIL_KEY, 0);
    }
  }

  function registerLoginSuccess() {
    clearLS(LOCK_KEY);
    setNumLS(FAIL_KEY, 0);
  }

  async function login(password) {
    if (isLockedOut()) {
      throw new Error(`Too many attempts. Try again in ${lockoutSecondsLeft()}s.`);
    }

    const r = await apiFetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ password })
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data?.success) {
      registerLoginFail();
      throw new Error(data?.message || "Login failed");
    }

    // store CSRF fallback token if server provides it
    if (data?.csrfToken) {
      try { localStorage.setItem((window.ADMIN_CSRF_STORAGE_KEY || "admin_csrf_ls"), String(data.csrfToken)); } catch {}
    }

    registerLoginSuccess();
    return true;
  }

  async function logout() {
    const r = await apiFetch("/admin/logout", { method: "POST" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Logout failed");
    try { localStorage.removeItem((window.ADMIN_CSRF_STORAGE_KEY || "admin_csrf_ls")); } catch {}
    return true;
  }

  /* ================= PRODUCTS API ================= */
  async function fetchAdminProducts() {
    const r = await apiFetch("/admin/products", { method: "GET" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Failed to load products");
    return Array.isArray(data.products) ? data.products : [];
  }

  function buildFormData({ isUpdate }) {
    const fd = new FormData();
    const nm = String(nameIpt?.value || "").trim();
    const pr = Math.max(0, Math.round(Number(priceIpt?.value || 0)));
    const ds = String(desc?.value || "").trim().slice(0, 600);

    fd.append("name", nm);
    fd.append("price", String(pr));
    fd.append("description", ds);
    fd.append("is_active", String(activeSel?.value || "true"));
    if (isUpdate) fd.append("remove_image", String(removeImage?.value || "false"));

    const file = imageIpt?.files?.[0];
    if (file) {
      const v = validateImageFile(file);
      if (!v.ok) throw new Error(v.msg);
      fd.append("image", file);
    }
    return fd;
  }

  async function createProduct() {
    const fd = buildFormData({ isUpdate: false });
    const r = await apiFetch("/admin/products", { method: "POST", body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Create failed");
    return data.product;
  }

  async function updateProduct(id) {
    const fd = buildFormData({ isUpdate: true });
    const r = await apiFetch(`/admin/products/${encodeURIComponent(id)}`, { method: "PUT", body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Update failed");
    return data.product;
  }

  async function deleteProduct(id) {
    const r = await apiFetch(`/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Delete failed");
    return true;
  }

  /* ================= RENDER ================= */
  function applyFilterSortSearch(list) {
    const term = String(q?.value || "").trim().toLowerCase();
    let out = [...list];

    if (activeFilter === "active") out = out.filter(p => Boolean(p.is_active));
    if (activeFilter === "inactive") out = out.filter(p => !Boolean(p.is_active));

    if (term) {
      out = out.filter(p => {
        const t = `${p.name || ""} ${p.description || ""} ${p.price || ""}`.toLowerCase();
        return t.includes(term);
      });
    }

    const mode = String(sort?.value || "new");
    if (mode === "old") out.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    if (mode === "new") out.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if (mode === "name") out.sort((a,b) => String(a.name||"").localeCompare(String(b.name||"")));
    if (mode === "priceHigh") out.sort((a,b) => Number(b.price||0) - Number(a.price||0));
    if (mode === "priceLow") out.sort((a,b) => Number(a.price||0) - Number(b.price||0));

    return out;
  }

  function render() {
    if (!grid) return;
    grid.innerHTML = "";

    const list = applyFilterSortSearch(products);

    if (!list.length) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    list.forEach(p => {
      const card = document.createElement("div");
      card.className = "ad-item";

      const img = safeImgSrc(resolveImage(p.image_url));
      const isOn = Boolean(p.is_active);

      card.innerHTML = `
        <div class="ad-item-img">
          <img
            src="${escapeHtml(img || "images_brown/bodyButter.png")}"
            alt="${escapeHtml(p.name || "")}"
            draggable="false"
            referrerpolicy="no-referrer"
          >
          <span class="ad-pill-mini ${isOn ? "on" : "off"}">${isOn ? "ACTIVE" : "HIDDEN"}</span>
        </div>

        <div class="ad-item-body">
          <div class="ad-item-name">${escapeHtml(p.name || "")}</div>
          <div class="ad-item-meta">₦${Number(p.price || 0).toLocaleString()}</div>
          <div class="ad-item-desc">${escapeHtml(String(p.description || "").slice(0, 120))}${String(p.description||"").length>120?"…":""}</div>

          <div class="ad-item-actions">
            <button type="button" class="ad-mini" data-edit="${escapeHtml(p.id)}">Edit</button>
            <button type="button" class="ad-mini danger" data-del="${escapeHtml(p.id)}">Delete</button>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });
  }

  /* ================= LOAD/REFRESH ================= */
  async function loadProducts() {
    setStatus("Loading products…", "info");
    try {
      products = await fetchAdminProducts();
      setStatus(`Loaded ${products.length} product(s).`, "ok");
      render();

      // ✅ keep session cache in sync
      try { sessionStorage.setItem("allProducts", JSON.stringify(products)); } catch {}
    } catch (e) {
      console.warn(e);
      setStatus(String(e.message || e), "err");

      const msg = String(e.message || "").toLowerCase();
      if (msg.includes("unauthorized") || msg.includes("not authed") || msg.includes("401") || msg.includes("403")) {
        openModal(loginModal, adminPass);
      }
    }
  }

  /* ================= EVENTS ================= */
  newBtn?.addEventListener("click", () => {
    resetEditForm();
    if (editTitle) editTitle.textContent = "Add Product";
    openModal(editModal, nameIpt);
  });

  refreshBtn?.addEventListener("click", loadProducts);

  logoutBtn?.addEventListener("click", async () => {
    try {
      await logout();
      toast("warn", "Logged out", "Session cleared.");
      openModal(loginModal, adminPass);
    } catch (e) {
      toast("err", "Logout failed", String(e.message || e));
    }
  });

  loginClose?.addEventListener("click", () => closeModal(loginModal));
  loginCancel?.addEventListener("click", () => closeModal(loginModal));

  editClose?.addEventListener("click", () => closeModal(editModal));
  cancelEdit?.addEventListener("click", () => closeModal(editModal));

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = String(adminPass?.value || "").trim();
    if (!pass) return;

    if (isLockedOut()) {
      const left = lockoutSecondsLeft();
      const m = `Too many attempts. Try again in ${left}s.`;
      if (loginHelp) { loginHelp.textContent = m; loginHelp.dataset.type = "err"; }
      return toast("err", "Locked", m);
    }

    try {
      await login(pass);
      toast("ok", "Signed in", "Admin session active.");
      closeModal(loginModal);
      await loadProducts();
    } catch (err) {
      if (loginHelp) {
        loginHelp.textContent = String(err.message || err);
        loginHelp.dataset.type = "err";
      }
      toast("err", "Login failed", String(err.message || err));
    }
  });

  function setSaveBusy(busy) {
    if (!editForm) return;
    editForm.dataset.busy = busy ? "1" : "0";
    const saveBtn = $("saveBtn");
    if (saveBtn) saveBtn.disabled = !!busy;
  }

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ✅ double-submit protection
    if (editForm?.dataset.busy === "1") return;

    const id = String(pid?.value || "");
    const nm = String(nameIpt?.value || "").trim();
    const pr = Number(priceIpt?.value || 0);

    if (nm.length < 2) return toast("err", "Missing", "Product name is required (min 2 chars).");
    if (!Number.isFinite(pr) || pr < 0) return toast("err", "Invalid", "Price must be 0 or more.");

    try {
      setSaveBusy(true);

      if (id) {
        await updateProduct(id);
        toast("ok", "Updated", "✅ Product updated successfully!");
      } else {
        await createProduct();
        toast("ok", "Created", "✅ Product added successfully!");
      }

      closeModal(editModal);
      await loadProducts();
    } catch (err) {
      toast("err", "Save failed", String(err.message || err));
    } finally {
      setSaveBusy(false);
    }
  });

  // grid edit/delete
  grid?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");

    if (editBtn) {
      const id = String(editBtn.getAttribute("data-edit") || "");
      const p = products.find(x => String(x.id) === id);
      if (!p) return;
      fillEditForm(p);
      if (editTitle) editTitle.textContent = `Edit Product #${id}`;
      openModal(editModal, nameIpt);
      return;
    }

    if (delBtn) {
      const id = String(delBtn.getAttribute("data-del") || "");
      if (!confirm(`Delete product #${id}? This cannot be undone.`)) return;

      try {
        await deleteProduct(id);
        toast("ok", "Deleted", "Product removed.");
        await loadProducts();
      } catch (err) {
        toast("err", "Delete failed", String(err.message || err));
      }
    }
  });

  // filters/search/sort
  q?.addEventListener("input", render);
  sort?.addEventListener("change", render);

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeFilter = String(btn.getAttribute("data-filter") || "all");
      render();
    });
  });

  /* ================= INIT ================= */
  (async function init() {
    updateDescCount();

    const ok = await checkMe().catch(() => false);
    if (!ok) openModal(loginModal, adminPass);
    else loadProducts();
  })();
})();
