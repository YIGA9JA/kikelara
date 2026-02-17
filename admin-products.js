/* ================= admin-products.js (Supabase Storage library + signed URL support)
   ✅ Cookie session auth (credentials include) via apiFetch/auth.js
   ✅ Upload click FIX: real file input overlay
   ✅ Drag/drop + preview
   ✅ NEW: Supabase “Media Library” picker (lists bucket files via backend)
   ✅ NEW: Auto-sign storage keys (products/..webp) via /admin/media/sign + cache
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

  // edit modal
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

  // image
  const imageIpt = $("image");
  const previewImg = $("previewImg");
  const imgDropOverlay = $("imgDropOverlay");
  const clearImgBtn = $("clearImgBtn");
  const removeImage = $("removeImage");
  const dropBox = $("dropBox");

  // ✅ new hidden “selected existing key”
  const imageKeyIpt = $("imageKey");
  const imgPicked = $("imgPicked");

  // ✅ library modal
  const libModal = $("libModal");
  const libClose = $("libClose");
  const openLibBtn = $("openLibBtn");
  const libSearch = $("libSearch");
  const libPrefix = $("libPrefix");
  const libGrid = $("libGrid");
  const libStatus = $("libStatus");
  const libLoadMore = $("libLoadMore");

  const toastWrap = $("toastWrap");
  const editHelp = $("editHelp");

  if (apiPill) apiPill.textContent = `API: ${API_BASE || "—"}`;

  let products = [];
  let activeFilter = "all";
  let lastFocus = null;

  let pickedFile = null;
  let previewObjectUrl = "";

  // storage signing cache (key -> signed url)
  const signedCache = new Map();
  const inflightSigns = new Map(); // key -> promise
  const SIGN_CONCURRENCY = 6;

  // library pagination
  let libOffset = 0;
  let libHasMore = false;
  let libLoading = false;

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

  function setLibStatus(text, type) {
    if (!libStatus) return;
    libStatus.textContent = text || "";
    libStatus.dataset.type = type || "info";
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

  function setPickedLabel() {
    if (!imgPicked) return;
    const key = String(imageKeyIpt?.value || "");
    if (key) {
      imgPicked.textContent = `Selected from library: ${key}`;
      imgPicked.style.display = "block";
      return;
    }
    imgPicked.textContent = "";
    imgPicked.style.display = "none";
  }

  function resetImage({ markRemove } = { markRemove: true }) {
    revokePreviewUrl();
    pickedFile = null;
    try { if (imageIpt) imageIpt.value = ""; } catch {}
    if (imageKeyIpt) imageKeyIpt.value = "";
    setPickedLabel();

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

  function looksLikeStorageKey(u) {
    const s = String(u || "");
    if (!s) return false;
    if (s.startsWith("http://") || s.startsWith("https://")) return false;
    if (s.startsWith("/uploads/")) return false;
    // keys often look like "products/123/..webp"
    return s.includes("/") && !s.startsWith("/");
  }

  function resolveImage(url) {
    const u = String(url || "");
    if (!u) return "";
    if (u.startsWith("http://") || u.startsWith("https://")) return u;
    if (u.startsWith("/uploads/")) return `${API_BASE}${u}`;
    // could be a storage key (needs signing)
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
    if (e.key === "Escape") {
      if (isOpen(libModal)) closeModal(libModal);
      else if (isOpen(editModal)) closeModal(editModal);
    }
  });

  document.addEventListener("keydown", (e) => trapFocus(editModal, e));
  document.addEventListener("keydown", (e) => trapFocus(libModal, e));

  editClose?.addEventListener("click", () => closeModal(editModal));
  cancelEdit?.addEventListener("click", () => closeModal(editModal));
  libClose?.addEventListener("click", () => closeModal(libModal));

  desc?.addEventListener("input", updateDescCount);

  segBtns.forEach((b) =>
    b.addEventListener("click", () => setActiveUI(b.getAttribute("data-seg") === "true"))
  );

  clearImgBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetImage({ markRemove: true });
    toast("warn", "Removed", "Image cleared.");
  });

  // ✅ “Choose from library”
  openLibBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openLibrary();
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

    // if user picked a file, we’re NOT using library key
    if (imageKeyIpt) imageKeyIpt.value = "";
    setPickedLabel();

    pickedFile = f;
    if (removeImage) removeImage.value = "false";

    revokePreviewUrl();
    previewObjectUrl = URL.createObjectURL(f);
    showPreview(previewObjectUrl);
  });

  // ✅ make dropbox keyboard-openable
  dropBox?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      imageIpt?.click?.();
    }
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

      // file drop overrides library key
      if (imageKeyIpt) imageKeyIpt.value = "";
      setPickedLabel();

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

  /* ===================== SUPABASE KEY SIGNING (via backend) ===================== */
  async function signStorageKey(key) {
    const k = String(key || "").trim();
    if (!k) return "";

    if (signedCache.has(k)) return signedCache.get(k);

    if (inflightSigns.has(k)) return inflightSigns.get(k);

    const p = (async () => {
      const r = await apiFetch(`/admin/media/sign?key=${encodeURIComponent(k)}`, { method: "GET" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.success || !data?.url) {
        throw new Error(data?.message || "Could not sign image");
      }
      signedCache.set(k, data.url);
      return data.url;
    })();

    inflightSigns.set(k, p);
    try {
      const url = await p;
      return url;
    } finally {
      inflightSigns.delete(k);
    }
  }

  async function resolveToDisplayUrl(raw) {
    const r = resolveImage(raw);
    if (!r) return "";
    if (looksLikeStorageKey(r)) {
      try {
        return await signStorageKey(r);
      } catch {
        return "";
      }
    }
    return r;
  }

  async function hydrateSignedImages() {
    // find all images that still have storage keys
    const imgs = Array.from(document.querySelectorAll("img[data-sbkey]"));
    if (!imgs.length) return;

    let idx = 0;
    async function worker() {
      while (idx < imgs.length) {
        const el = imgs[idx++];
        const key = el.getAttribute("data-sbkey");
        if (!key) continue;

        // If already swapped, skip
        if (el.getAttribute("data-signed") === "1") continue;

        try {
          const url = await signStorageKey(key);
          el.src = url || fallbackImg();
          el.setAttribute("data-signed", "1");
        } catch {
          el.src = fallbackImg();
          el.setAttribute("data-signed", "1");
        }
      }
    }

    const workers = Array.from({ length: SIGN_CONCURRENCY }, worker);
    await Promise.all(workers);
  }

  function buildFormData({ isUpdate }) {
    const fd = new FormData();
    fd.append("name", String(nameIpt?.value || "").trim());
    fd.append("price", String(Number(priceIpt?.value || 0)));
    fd.append("description", String(desc?.value || "").trim());
    fd.append("is_active", String(activeSel?.value || "true"));

    if (isUpdate) fd.append("remove_image", String(removeImage?.value || "false"));

    const file = pickedFile || (imageIpt?.files?.[0] || null);
    const key = String(imageKeyIpt?.value || "").trim();

    if (file) {
      fd.append("image", file);
      // file overrides library key
      if (key && imageKeyIpt) imageKeyIpt.value = "";
    } else if (key) {
      // ✅ choose existing image without uploading
      fd.append("image_key", key);
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

  async function fillEditForm(p) {
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

    // key stored in payload.__image_key (from backend)
    const key =
      (p?.payload && typeof p.payload === "object" && String(p.payload.__image_key || "").trim()) ||
      (looksLikeStorageKey(p.image_url) ? String(p.image_url || "").trim() : "");

    if (imageKeyIpt) imageKeyIpt.value = key || "";
    setPickedLabel();

    const displayUrl = await resolveToDisplayUrl(p.image_url);
    showPreview(displayUrl || "");

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
    if (imageKeyIpt) imageKeyIpt.value = "";
    setPickedLabel();

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
      const raw = resolveImage(p.image_url);
      const isKey = looksLikeStorageKey(raw);
      const img = isKey ? fallbackImg() : (raw || fallbackImg());

      const isOn = Boolean(p.is_active);
      const idStr = String(p.id);

      const card = document.createElement("article");
      card.className = "ad-item";
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Edit ${String(p.name || "product")}`);

      card.innerHTML = `
        <div class="ad-item-img">
          <img
            src="${escapeHtml(img)}"
            alt="${escapeHtml(p.name || "")}"
            draggable="false"
            loading="lazy"
            ${isKey ? `data-sbkey="${escapeHtml(raw)}"` : ""}
          >
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

    // after render, sign any storage keys
    hydrateSignedImages();
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

  /* ===================== LIBRARY MODAL ===================== */
  function clearLibGrid() {
    if (libGrid) libGrid.innerHTML = "";
  }

  function libSkeleton(count = 12) {
    if (!libGrid) return;
    libGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const d = document.createElement("div");
      d.className = "libCard sk";
      d.innerHTML = `<div class="libThumb sk"></div><div class="libMeta"><div class="skLine"></div></div>`;
      libGrid.appendChild(d);
    }
  }

  async function fetchLibraryPage({ reset = false } = {}) {
    if (!libGrid) return;

    if (libLoading) return;
    libLoading = true;

    const prefix = String(libPrefix?.value || "products/").trim() || "products/";
    const term = String(libSearch?.value || "").trim();
    const limit = 60;

    if (reset) {
      libOffset = 0;
      libHasMore = false;
      clearLibGrid();
      libSkeleton(12);
    }

    setLibStatus("Loading media…", "info");
    libLoadMore && (libLoadMore.disabled = true);

    try {
      const url =
        `/admin/media/list?prefix=${encodeURIComponent(prefix)}&search=${encodeURIComponent(term)}&offset=${encodeURIComponent(
          libOffset
        )}&limit=${encodeURIComponent(limit)}`;

      const r = await apiFetch(url, { method: "GET" });
      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data?.success) {
        throw new Error(
          data?.message ||
            "Media list failed. Make sure backend has /admin/media/list and SUPABASE_SERVICE_ROLE_KEY set."
        );
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (reset) clearLibGrid();

      if (!items.length && libOffset === 0) {
        setLibStatus("No media found in this folder.", "warn");
      } else {
        setLibStatus(`Showing ${libOffset + items.length} file(s).`, "ok");
      }

      items.forEach((it) => {
        const key = String(it.key || "");
        const name = String(it.name || key.split("/").pop() || "");
        const url = String(it.url || "");

        const card = document.createElement("button");
        card.type = "button";
        card.className = "libCard";
        card.setAttribute("aria-label", `Select ${name}`);
        card.innerHTML = `
          <div class="libThumbWrap">
            <img class="libThumbImg" src="${escapeHtml(url || fallbackImg())}" alt="${escapeHtml(name)}" loading="lazy">
          </div>
          <div class="libMeta">
            <div class="libName" title="${escapeHtml(key)}">${escapeHtml(name)}</div>
            <div class="libKey">${escapeHtml(key)}</div>
          </div>
        `;

        card.addEventListener("click", async () => {
          // select without uploading
          pickedFile = null;
          try { if (imageIpt) imageIpt.value = ""; } catch {}

          if (removeImage) removeImage.value = "false";
          if (imageKeyIpt) imageKeyIpt.value = key;
          setPickedLabel();

          // show in preview
          showPreview(url || (await resolveToDisplayUrl(key)) || "");
          toast("ok", "Selected", "Image selected from Supabase library.");
          closeModal(libModal);
        });

        libGrid.appendChild(card);
      });

      libOffset += items.length;
      libHasMore = Boolean(data.nextOffset !== null && data.nextOffset !== undefined);
      if (data.nextOffset !== null && data.nextOffset !== undefined) {
        // if backend provides nextOffset, honor it
        libOffset = Number(data.nextOffset) || libOffset;
      }

      if (libLoadMore) {
        libLoadMore.style.display = libHasMore ? "inline-flex" : "none";
        libLoadMore.disabled = false;
      }
    } catch (e) {
      clearLibGrid();
      setLibStatus(String(e.message || e), "err");
      toast("err", "Library error", String(e.message || e));
      if (libLoadMore) libLoadMore.style.display = "none";
    } finally {
      libLoading = false;
    }
  }

  function openLibrary() {
    // open the modal and load
    openModal(libModal, libSearch || libClose);
    fetchLibraryPage({ reset: true });
  }

  libSearch?.addEventListener("input", () => {
    // debounce-ish
    window.clearTimeout(libSearch.__t);
    libSearch.__t = window.setTimeout(() => fetchLibraryPage({ reset: true }), 250);
  });

  libPrefix?.addEventListener("change", () => fetchLibraryPage({ reset: true }));
  libLoadMore?.addEventListener("click", (e) => {
    e.preventDefault();
    fetchLibraryPage({ reset: false });
  });

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
  setPickedLabel();
  loadProducts();
})();
