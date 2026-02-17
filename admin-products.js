/* ================= admin-products.js (AUTHED — FIXED CLICK + FIXED UPLOAD)
   ✅ Uses cookie session from admin-login.html (credentials: include)
   ✅ Checks /admin/me ONCE on page load
   ✅ Uses window.apiFetch (adds CSRF header automatically for non-GET)
   ✅ CRUD:
      GET    /admin/products
      POST   /admin/products
      PUT    /admin/products/:id
      DELETE /admin/products/:id

   FIXES:
   ✅ Edit/Delete always clickable (bind handlers directly per card)
   ✅ Supabase upload fixed (pickedFile stored and appended to FormData)
=============================================================================== */

(async function () {
  "use strict";

  // ✅ Must be authed (cookie session created on admin-login.html)
  const ok = await window.checkAuth?.();
  if (!ok) return;

  const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
  const apiFetch = window.apiFetch;
  if (typeof apiFetch !== "function") {
    console.error("apiFetch missing. Make sure auth.js is loaded before admin-products.js");
    return;
  }

  const $ = (id) => document.getElementById(id);

  /* ================= ELEMENTS ================= */
  const editModal = $("editModal");

  const newBtn = $("newBtn");
  const refreshBtn = $("refreshBtn");
  const logoutBtn = $("logoutBtn");

  const clearSearchBtn = $("clearSearchBtn");
  const emptyAddBtn = $("emptyAddBtn");

  const editClose = $("editClose");
  const cancelEdit = $("cancelEdit");
  const editForm = $("editForm");
  const saveBtn = $("saveBtn");

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

  /* ================= STATE ================= */
  let lastFocus = null;
  let products = [];
  let activeFilter = "all"; // all | active | inactive
  let previewObjectUrl = ""; // revoke on change
  let pickedFile = null; // ✅ FIX: always upload what user picked/dropped

  /* ================= NETWORK (AUTHED) ================= */
  async function api(path, options = {}) {
    return apiFetch(path, options);
  }

  /* ================= HELPERS ================= */
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(type, title, body) {
    if (!toastWrap) return;
    const el = document.createElement("div");
    el.className = `toast ${type || "ok"}`;
    el.innerHTML = `
      <div class="t-row">
        <div class="t-title">${escapeHtml(title || "Notice")}</div>
        <button class="t-close" type="button" aria-label="Close">Close</button>
      </div>
      <div class="t-body">${escapeHtml(body || "")}</div>
    `;
    el.querySelector(".t-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      el.remove();
    });
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

    lockBody(false);

    if (lastFocus && typeof lastFocus.focus === "function") {
      window.requestAnimationFrame(() => lastFocus?.focus?.());
    }
    lastFocus = null;
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
    }
  });
  document.addEventListener("keydown", (e) => {
    if (isOpen(editModal)) trapFocus(editModal, e);
  });
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
  segBtns.forEach((b) => b.addEventListener("click", () => {
    setActiveUI(b.getAttribute("data-seg") === "true");
  }));
  setActiveUI(true);

  function revokePreviewUrl() {
    if (previewObjectUrl) {
      try { URL.revokeObjectURL(previewObjectUrl); } catch {}
      previewObjectUrl = "";
    }
  }

  function showPreview(src) {
    if (!previewImg) return;
    previewImg.src = src || "";
    previewImg.style.display = src ? "block" : "none";
    if (imgDropOverlay) imgDropOverlay.style.display = src ? "none" : "grid";
  }

  function resetImage() {
    revokePreviewUrl();
    pickedFile = null;                 // ✅ FIX
    if (imageIpt) imageIpt.value = "";
    if (removeImage) removeImage.value = "true";
    showPreview("");
  }

  function isValidImageFile(f) {
    if (!f) return false;
    return /^image\/(png|jpeg|webp)$/.test(f.type) && f.size <= 8 * 1024 * 1024;
  }

  imageIpt?.addEventListener("change", () => {
    const f = imageIpt.files && imageIpt.files[0];
    if (!f) return;

    if (!isValidImageFile(f)) {
      toast("err", "Invalid image", "Please select PNG/JPG/WEBP (max 8MB).");
      imageIpt.value = "";
      pickedFile = null;
      return;
    }

    pickedFile = f; // ✅ FIX: store file reliably

    revokePreviewUrl();
    previewObjectUrl = URL.createObjectURL(f);

    if (removeImage) removeImage.value = "false";
    showPreview(previewObjectUrl);
  });

  clearImgBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetImage();
    toast("warn", "Removed", "Image cleared.");
  });

  // Click drop box to open file picker
  dropBox?.addEventListener("click", (e) => {
    e.preventDefault();
    imageIpt?.click();
  });

  // Keyboard access for dropBox
  dropBox?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      imageIpt?.click();
    }
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

      if (!isValidImageFile(file)) {
        toast("err", "Invalid image", "Please drop PNG/JPG/WEBP (max 8MB).");
        return;
      }

      pickedFile = file; // ✅ FIX: store file (don’t rely on input.files assignment)

      revokePreviewUrl();
      previewObjectUrl = URL.createObjectURL(file);

      if (removeImage) removeImage.value = "false";
      showPreview(previewObjectUrl);
      toast("ok", "Image added", "Preview updated.");
    });
  }

  function resetEditForm() {
    revokePreviewUrl();
    pickedFile = null;               // ✅
    if (imageIpt) imageIpt.value = "";

    if (pid) pid.value = "";
    if (nameIpt) nameIpt.value = "";
    if (priceIpt) priceIpt.value = "";
    if (desc) desc.value = "";
    updateDescCount();
    setActiveUI(true);

    if (removeImage) removeImage.value = "false";
    showPreview("");

    const help = $("editHelp");
    if (help) {
      help.textContent = "";
      help.removeAttribute("data-type");
    }
  }

  function resolveImage(url) {
    const u = String(url || "");
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/uploads/")) return `${API_BASE}${u}`;
    return u; // could be signed url already
  }

  function fillEditForm(p) {
    revokePreviewUrl();
    pickedFile = null;                // ✅ don’t accidentally re-upload old selection
    if (imageIpt) imageIpt.value = "";

    if (pid) pid.value = String(p.id);
    if (nameIpt) nameIpt.value = String(p.name || "");
    if (priceIpt) priceIpt.value = String(Number(p.price || 0));
    if (desc) desc.value = String(p.description || "");
    updateDescCount();
    setActiveUI(Boolean(p.is_active));

    if (removeImage) removeImage.value = "false";
    showPreview(p.image_url ? resolveImage(p.image_url) : "");
  }

  function setBusy(on) {
    if (saveBtn) saveBtn.disabled = !!on;
    if (newBtn) newBtn.disabled = !!on;
    if (refreshBtn) refreshBtn.disabled = !!on;
    if (logoutBtn) logoutBtn.disabled = !!on;
  }

  /* ================= PRODUCTS API (AUTHED) ================= */
  async function fetchAdminProducts() {
    const r = await api("/admin/products", { method: "GET" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Failed to load products");
    return Array.isArray(data.products) ? data.products : [];
  }

  function buildFormData({ isUpdate }) {
    const fd = new FormData();
    fd.append("name", String(nameIpt?.value || "").trim());
    fd.append("price", String(Number(priceIpt?.value || 0)));
    fd.append("description", String(desc?.value || "").trim());
    fd.append("is_active", String(activeSel?.value || "true"));

    if (isUpdate) fd.append("remove_image", String(removeImage?.value || "false"));

    // ✅ FIX: always append stored file (works for drag-drop reliably)
    const file = pickedFile || imageIpt?.files?.[0];
    if (file) fd.append("image", file);

    return fd;
  }

  async function createProduct() {
    const fd = buildFormData({ isUpdate: false });
    const r = await api("/admin/products", { method: "POST", body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Create failed");
    return data.product;
  }

  async function updateProduct(id) {
    const fd = buildFormData({ isUpdate: true });
    const r = await api(`/admin/products/${encodeURIComponent(id)}`, { method: "PUT", body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Update failed");
    return data.product;
  }

  async function deleteProduct(id) {
    const r = await api(`/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Delete failed");
    return true;
  }

  /* ================= RENDER ================= */
  function applyFilterSortSearch(list) {
    const term = String(q?.value || "").trim().toLowerCase();
    let out = [...list];

    if (activeFilter === "active") out = out.filter((p) => Boolean(p.is_active));
    if (activeFilter === "inactive") out = out.filter((p) => !Boolean(p.is_active));

    if (term) {
      out = out.filter((p) => {
        const t = `${p.name || ""} ${p.description || ""} ${p.price || ""}`.toLowerCase();
        return t.includes(term);
      });
    }

    const mode = String(sort?.value || "new");
    if (mode === "old") out.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (mode === "new") out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (mode === "name") out.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (mode === "priceHigh") out.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (mode === "priceLow") out.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));

    return out;
  }

  function fallbackImg() {
    return "images_brown/bodyButter.png";
  }

  function openEditById(id) {
    const p = products.find((x) => String(x.id) === String(id));
    if (!p) return;
    fillEditForm(p);
    if (editTitle) editTitle.textContent = `Edit Product #${id}`;
    openModal(editModal, nameIpt);
  }

  async function confirmDeleteById(id) {
    if (!confirm(`Delete product #${id}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteProduct(id);
      toast("ok", "Deleted", "Product removed.");
      await loadProducts();
    } catch (err) {
      toast("err", "Delete failed", String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  function render() {
    if (!grid) return;
    grid.innerHTML = "";

    const list = applyFilterSortSearch(products);

    if (!list.length) {
      if (empty) empty.style.display = "grid";
      return;
    }
    if (empty) empty.style.display = "none";

    list.forEach((p) => {
      const img = resolveImage(p.image_url) || fallbackImg();
      const isOn = Boolean(p.is_active);
      const idStr = String(p.id);

      const card = document.createElement("article");
      card.className = "ad-item";
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Edit ${String(p.name || "product")}`);
      card.setAttribute("data-card-edit", idStr);

      card.innerHTML = `
        <div class="ad-item-img">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name || "")}" draggable="false" loading="lazy">
          <span class="ad-pill-mini ${isOn ? "on" : "off"}">${isOn ? "ACTIVE" : "HIDDEN"}</span>
        </div>

        <div class="ad-item-body">
          <div class="ad-item-name">${escapeHtml(p.name || "")}</div>
          <div class="ad-item-meta">₦${Number(p.price || 0).toLocaleString()}</div>
          <div class="ad-item-desc">${
            escapeHtml(String(p.description || "").slice(0, 120)) +
            (String(p.description || "").length > 120 ? "…" : "")
          }</div>

          <div class="ad-item-actions" aria-label="Actions">
            <button type="button" class="ad-mini" data-edit="${escapeHtml(idStr)}">Edit</button>
            <button type="button" class="ad-mini danger" data-del="${escapeHtml(idStr)}">Delete</button>
          </div>
        </div>
      `;

      // ✅ FIX: bind clicks directly (works even if CSS overlays break delegation)
      const editBtn = card.querySelector("[data-edit]");
      const delBtn = card.querySelector("[data-del]");

      editBtn?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openEditById(idStr);
      });

      delBtn?.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        confirmDeleteById(idStr);
      });

      // Card click opens edit (but not when clicking the action buttons)
      card.addEventListener("click", (ev) => {
        const insideActions = ev.target.closest(".ad-item-actions");
        if (insideActions) return;
        openEditById(idStr);
      });

      // Keyboard: Enter/Space opens edit
      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          openEditById(idStr);
        }
      });

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

      // helpful for storefront pages
      try { sessionStorage.setItem("allProducts", JSON.stringify(products)); } catch {}
    } catch (e) {
      console.warn(e);
      setStatus(String(e.message || e), "err");
      toast("err", "Load failed", String(e.message || e));
    }
  }

  /* ================= EVENTS ================= */
  logoutBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    window.adminLogout?.();
  });

  newBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetEditForm();
    if (editTitle) editTitle.textContent = "Add Product";
    openModal(editModal, nameIpt);
  });

  emptyAddBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    newBtn?.click();
  });

  refreshBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    loadProducts();
  });

  editClose?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal(editModal);
  });

  cancelEdit?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal(editModal);
  });

  clearSearchBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (q) q.value = "";
    render();
    q?.focus?.();
  });

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = String(pid?.value || "");
    const name = String(nameIpt?.value || "").trim();
    const price = Number(priceIpt?.value || 0);

    if (!name) return toast("err", "Missing", "Product name is required.");
    if (!Number.isFinite(price) || price < 0) return toast("err", "Invalid", "Price must be 0 or more.");

    setBusy(true);
    try {
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
      setBusy(false);
    }
  });

  q?.addEventListener("input", render);
  sort?.addEventListener("change", render);

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      filterBtns.forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      activeFilter = String(btn.getAttribute("data-filter") || "all");
      render();
    });
  });

  /* ================= INIT ================= */
  (function init() {
    updateDescCount();
    loadProducts();
  })();
})();
