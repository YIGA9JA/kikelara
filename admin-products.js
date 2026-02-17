/* ================= admin-products.js (Vercel ↔ Render cookie auth + working upload)
   ✅ Uses cookie session (credentials: include) via apiFetch/auth.js
   ✅ Upload click FIX: real file input overlay (no blocked clicks)
   ✅ Uses FormData correctly (no JSON content-type here)
=============================================================================== */

(async function () {
  "use strict";

  const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
  const apiFetch = window.apiFetch;

  if (typeof apiFetch !== "function") {
    alert("auth.js not loaded (apiFetch missing). Include auth.js before admin-products.js");
    return;
  }

  // must be authed
  const ok = await window.checkAuth?.();
  if (!ok) return;

  const $ = (id) => document.getElementById(id);

  const apiPill = $("apiPill");
  const status = $("status");

  const newBtn = $("newBtn");
  const refreshBtn = $("refreshBtn");
  const logoutBtn = $("logoutBtn");

  const clearSearchBtn = $("clearSearchBtn");
  const emptyAddBtn = $("emptyAddBtn");

  const grid = $("grid");
  const empty = $("empty");
  const q = $("q");
  const sort = $("sort");
  const filterBtns = Array.from(document.querySelectorAll("[data-filter]"));

  const editModal = $("editModal");
  const editTitle = $("editTitle");
  const editClose = $("editClose");
  const cancelEdit = $("cancelEdit");
  const editForm = $("editForm");
  const saveBtn = $("saveBtn");

  const pid = $("pid");
  const nameIpt = $("name");
  const priceIpt = $("price");
  const desc = $("desc");
  const descCount = $("descCount");

  const activeSel = $("active");
  const segBtns = Array.from(document.querySelectorAll(".segBtn"));

  const imageIpt = $("image");           // ✅ real overlay input
  const previewImg = $("previewImg");
  const imgDropOverlay = $("imgDropOverlay");
  const clearImgBtn = $("clearImgBtn");
  const removeImage = $("removeImage");
  const dropBox = $("dropBox");

  const toastWrap = $("toastWrap");
  const editHelp = $("editHelp");

  if (apiPill) apiPill.textContent = `API: ${API_BASE || "—"}`;

  let products = [];
  let activeFilter = "all";
  let lastFocus = null;

  let pickedFile = null;
  let previewObjectUrl = "";

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
    el.querySelector(".t-close")?.addEventListener("click", () => el.remove());
    toastWrap.appendChild(el);
    setTimeout(() => { if (el.isConnected) el.remove(); }, 4500);
  }

  function setStatus(text, type) {
    if (!status) return;
    status.textContent = text || "";
    status.dataset.type = type || "info";
  }

  function setHelp(text, type) {
    if (!editHelp) return;
    editHelp.textContent = text || "";
    if (!text) editHelp.removeAttribute("data-type");
    else editHelp.dataset.type = type || "info";
  }

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

  function isValidImageFile(f) {
    if (!f) return false;
    const okType = /^image\/(png|jpeg|webp)$/.test(f.type);
    const okSize = f.size <= 8 * 1024 * 1024;
    return okType && okSize;
  }

  function resetImage({ markRemove } = { markRemove: true }) {
    revokePreviewUrl();
    pickedFile = null;
    try { if (imageIpt) imageIpt.value = ""; } catch {}
    if (removeImage && markRemove) removeImage.value = "true";
    showPreview("");
  }

  function updateDescCount() {
    if (!desc || !descCount) return;
    const v = desc.value || "";
    if (v.length > 600) desc.value = v.slice(0, 600);
    descCount.textContent = `${desc.value.length} / 600`;
  }

  function setActiveUI(valBool) {
    if (activeSel) activeSel.value = valBool ? "true" : "false";
    segBtns.forEach((b) => {
      const isOn = (b.getAttribute("data-seg") === (valBool ? "true" : "false"));
      b.classList.toggle("is-on", isOn);
    });
  }

  function resolveImage(url) {
    const u = String(url || "");
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/uploads/")) return `${API_BASE}${u}`;
    return u;
  }

  function fallbackImg() {
    return "images_brown/bodyButter.png";
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

  function openModal(modal, focusEl) {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.classList.add("show");
    setAria(modal, true);
    document.body.classList.add("modal-open");
    const card = modal.querySelector(".modal-card");
    if (card) card.scrollTop = 0;

    requestAnimationFrame(() => (focusEl || card?.querySelector("input,textarea,button,select"))?.focus?.());
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("show");
    setAria(modal, false);
    document.body.classList.remove("modal-open");
    requestAnimationFrame(() => lastFocus?.focus?.());
    lastFocus = null;
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
    if (!isOpen(modal) || e.key !== "Tab") return;
    const card = modal.querySelector(".modal-card");
    const focusables = getFocusable(card);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen(editModal)) closeModal(editModal);
  });
  document.addEventListener("keydown", (e) => trapFocus(editModal, e));

  editClose?.addEventListener("click", () => closeModal(editModal));
  cancelEdit?.addEventListener("click", () => closeModal(editModal));

  desc?.addEventListener("input", updateDescCount);

  segBtns.forEach((b) =>
    b.addEventListener("click", () => setActiveUI(b.getAttribute("data-seg") === "true"))
  );

  clearImgBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetImage({ markRemove: true });
    toast("warn", "Removed", "Image cleared.");
  });

  // ✅ change handler for REAL overlay input
  imageIpt?.addEventListener("change", () => {
    const f = imageIpt.files && imageIpt.files[0];
    if (!f) return;

    if (!isValidImageFile(f)) {
      toast("err", "Invalid image", "Use PNG/JPG/WEBP (max 8MB).");
      try { imageIpt.value = ""; } catch {}
      pickedFile = null;
      return;
    }

    pickedFile = f;
    if (removeImage) removeImage.value = "false";

    revokePreviewUrl();
    previewObjectUrl = URL.createObjectURL(f);
    showPreview(previewObjectUrl);
  });

  // ✅ Drag & drop support
  if (dropBox) {
    ["dragenter", "dragover"].forEach((evt) => {
      dropBox.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropBox.classList.add("drag");
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      dropBox.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropBox.classList.remove("drag");
      });
    });

    dropBox.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      if (!isValidImageFile(file)) {
        toast("err", "Invalid image", "Use PNG/JPG/WEBP (max 8MB).");
        return;
      }

      pickedFile = file;
      if (removeImage) removeImage.value = "false";

      revokePreviewUrl();
      previewObjectUrl = URL.createObjectURL(file);
      showPreview(previewObjectUrl);
      toast("ok", "Image added", "Preview updated.");
    });
  }

  function setBusy(on) {
    if (saveBtn) saveBtn.disabled = !!on;
    if (newBtn) newBtn.disabled = !!on;
    if (refreshBtn) refreshBtn.disabled = !!on;
    if (logoutBtn) logoutBtn.disabled = !!on;
  }

  async function fetchAdminProducts() {
    const r = await apiFetch("/admin/products", { method: "GET" });
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

    const file = pickedFile || (imageIpt?.files?.[0] || null);
    if (file) fd.append("image", file);

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

  function fillEditForm(p) {
    revokePreviewUrl();
    pickedFile = null;
    try { if (imageIpt) imageIpt.value = ""; } catch {}

    if (pid) pid.value = String(p.id);
    if (nameIpt) nameIpt.value = String(p.name || "");
    if (priceIpt) priceIpt.value = String(Number(p.price || 0));
    if (desc) desc.value = String(p.description || "");
    updateDescCount();

    setActiveUI(Boolean(p.is_active));
    if (removeImage) removeImage.value = "false";
    showPreview(p.image_url ? resolveImage(p.image_url) : "");
    setHelp("");
  }

  function resetEditForm() {
    revokePreviewUrl();
    pickedFile = null;
    try { if (imageIpt) imageIpt.value = ""; } catch {}

    if (pid) pid.value = "";
    if (nameIpt) nameIpt.value = "";
    if (priceIpt) priceIpt.value = "";
    if (desc) desc.value = "";
    updateDescCount();

    setActiveUI(true);
    if (removeImage) removeImage.value = "false";
    showPreview("");
    setHelp("");
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

      const imgEl = card.querySelector("img");
      imgEl?.addEventListener("error", () => { if (imgEl) imgEl.src = fallbackImg(); });

      card.querySelector("[data-edit]")?.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        openEditById(idStr);
      });

      card.querySelector("[data-del]")?.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        confirmDeleteById(idStr);
      });

      card.addEventListener("click", (ev) => {
        if (ev.target.closest(".ad-item-actions")) return;
        openEditById(idStr);
      });

      card.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          openEditById(idStr);
        }
      });

      grid.appendChild(card);
    });
  }

  async function loadProducts() {
    setStatus("Loading products…", "info");
    try {
      products = await fetchAdminProducts();
      setStatus(`Loaded ${products.length} product(s).`, "ok");
      render();
    } catch (e) {
      setStatus(String(e.message || e), "err");
      toast("err", "Load failed", String(e.message || e));
    }
  }

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

  clearSearchBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (q) q.value = "";
    render();
    q?.focus?.();
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

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = String(pid?.value || "");
    const name = String(nameIpt?.value || "").trim();
    const price = Number(priceIpt?.value || 0);

    if (!name) return toast("err", "Missing", "Product name is required.");
    if (!Number.isFinite(price) || price < 0) return toast("err", "Invalid", "Price must be 0 or more.");

    setBusy(true);
    setHelp("");

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
      const msg = String(err.message || err);
      setHelp(msg, "err");
      toast("err", "Save failed", msg);
    } finally {
      setBusy(false);
    }
  });

  setActiveUI(true);
  updateDescCount();
  loadProducts();
})();
