/* ================= admin-products.js (FULL - UPDATED for Cloudinary + Full Images)
   ✅ Cookie session auth (credentials include) via apiFetch/auth.js
   ✅ Upload DISPLAY + Gallery
   ✅ Media Library picker (backend handles Supabase OR Cloudinary)
   ✅ Signed/Resolved URLs via backend (/admin/media/sign)
   ✅ Image Manager:
      - Set DISPLAY
      - Set DETAIL
      - Remove gallery image
   ✅ Choose DETAIL from Library on save (detail_image_key)
   ✅ Cloudinary support:
      - keys like "cld:...." are treated as storage keys
      - /admin/media/list can return Cloudinary items (see backend patch)
   ✅ Visual: object-fit: cover everywhere so images always fill (no outer space look)
=============================================================================== */

(async function () {
  "use strict";

  const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
  const apiFetch = window.apiFetch;

  if (typeof apiFetch !== "function") {
    alert("auth.js not loaded (apiFetch missing). Include auth.js before admin-products.js");
    return;
  }

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

  // display image input
  const imageIpt = $("image");
  const previewImg = $("previewImg");
  const imgDropOverlay = $("imgDropOverlay");
  const clearImgBtn = $("clearImgBtn");
  const removeImage = $("removeImage");
  const dropBox = $("dropBox");

  // library keys
  const imageKeyIpt = $("imageKey");            // DISPLAY key
  const detailKeyIpt = $("detailImageKey");     // DETAIL key
  const imgPicked = $("imgPicked");
  const detailPicked = $("detailPicked");

  // gallery upload
  const galleryIpt = $("images");
  const addGalleryBtn = $("addGalleryBtn");
  const galleryPicked = $("galleryPicked");

  // image manager grid
  const galleryGrid = $("galleryGrid");
  const galleryHint = $("galleryHint");

  // library modal
  const libModal = $("libModal");
  const libClose = $("libClose");
  const libTitle = $("libTitle");
  const openLibBtn = $("openLibBtn");
  const openLibDetailBtn = $("openLibDetailBtn");
  const libSearch = $("libSearch");
  const libPrefix = $("libPrefix");
  const libGrid = $("libGrid");
  const libStatus = $("libStatus");
  const libLoadMore = $("libLoadMore");

  const toastWrap = $("toastWrap");
  const editHelp = $("editHelp");

  if (apiPill) apiPill.textContent = `API: ${API_BASE || "—"}`;

  // ✅ force preview image to fill (no padding look)
  if (previewImg) {
    previewImg.style.width = "100%";
    previewImg.style.height = "100%";
    previewImg.style.objectFit = "cover";
    previewImg.style.display = "block";
  }

  let products = [];
  let activeFilter = "all";
  let lastFocus = null;

  let pickedFile = null;              // display image file
  let previewObjectUrl = "";

  let pickedGalleryFiles = [];        // gallery files queued for upload

  // storage signing cache (key -> resolved url)
  const signedCache = new Map();
  const inflightSigns = new Map();
  const SIGN_CONCURRENCY = 6;

  // library pagination (supports cursor + offset)
  let libOffset = 0;          // for supabase style
  let libCursor = "";         // for cloudinary style
  let libHasMore = false;
  let libLoading = false;

  // library target: "display" | "detail"
  let libTarget = "display";

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
    if (imgPicked) {
      const k = String(imageKeyIpt?.value || "");
      if (k) {
        imgPicked.textContent = `Selected from library (DISPLAY on save): ${k}`;
        imgPicked.style.display = "block";
      } else {
        imgPicked.textContent = "";
        imgPicked.style.display = "none";
      }
    }
    if (detailPicked) {
      const dk = String(detailKeyIpt?.value || "");
      if (dk) {
        detailPicked.textContent = `Selected from library (DETAIL on save): ${dk}`;
        detailPicked.style.display = "block";
      } else {
        detailPicked.textContent = "";
        detailPicked.style.display = "none";
      }
    }
  }

  function setGalleryPickedLabel() {
    if (!galleryPicked) return;
    if (!pickedGalleryFiles.length) {
      galleryPicked.textContent = "";
      galleryPicked.style.display = "none";
      return;
    }
    const names = pickedGalleryFiles.map((f) => f.name).slice(0, 4);
    const extra = pickedGalleryFiles.length > 4 ? ` +${pickedGalleryFiles.length - 4} more` : "";
    galleryPicked.textContent = `Gallery queued: ${names.join(", ")}${extra}`;
    galleryPicked.style.display = "block";
  }

  function resetGalleryQueue() {
    pickedGalleryFiles = [];
    try { if (galleryIpt) galleryIpt.value = ""; } catch {}
    setGalleryPickedLabel();
  }

  function resetImage({ markRemove } = { markRemove: true }) {
    revokePreviewUrl();
    pickedFile = null;
    try { if (imageIpt) imageIpt.value = ""; } catch {}

    if (imageKeyIpt) imageKeyIpt.value = "";
    if (markRemove && removeImage) removeImage.value = "true";

    setPickedLabel();
    showPreview("");
  }

  function updateDescCount() {
    if (!desc || !descCount) return;
    const v = desc.value || "";
    if (v.length > 6000) desc.value = v.slice(0, 6000);
    descCount.textContent = `${desc.value.length} / 6000`;
  }

  function setActiveUI(valBool) {
    if (activeSel) activeSel.value = valBool ? "true" : "false";
    segBtns.forEach((b) => {
      const isOn = (b.getAttribute("data-seg") === (valBool ? "true" : "false"));
      b.classList.toggle("is-on", isOn);
    });
  }

  function looksLikeStorageKey(u) {
    const s = String(u || "").trim();
    if (!s) return false;
    if (s.startsWith("http://") || s.startsWith("https://")) return false;
    if (s.startsWith("/uploads/")) return false;
    if (s.startsWith("cld:")) return true;
    return s.includes("/") && !s.startsWith("/");
  }

  function resolveImage(url) {
    const u = String(url || "").trim();
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
    toast("warn", "Removed", "Display image cleared (will remove on save).");
  });

  openLibBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openLibrary("display");
  });

  openLibDetailBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openLibrary("detail");
  });

  imageIpt?.addEventListener("change", () => {
    const f = imageIpt.files && imageIpt.files[0];
    if (!f) return;

    if (!isValidImageFile(f)) {
      toast("err", "Invalid image", "Use PNG/JPG/WEBP (max 8MB).");
      try { imageIpt.value = ""; } catch {}
      pickedFile = null;
      return;
    }

    if (imageKeyIpt) imageKeyIpt.value = "";
    setPickedLabel();

    pickedFile = f;
    if (removeImage) removeImage.value = "false";

    revokePreviewUrl();
    previewObjectUrl = URL.createObjectURL(f);
    showPreview(previewObjectUrl);
  });

  dropBox?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      imageIpt?.click?.();
    }
  });

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

  // gallery upload
  addGalleryBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    galleryIpt?.click?.();
  });

  galleryIpt?.addEventListener("change", () => {
    const files = Array.from(galleryIpt.files || []);
    if (!files.length) return;

    const good = files.filter(isValidImageFile);
    const badCount = files.length - good.length;

    if (badCount) toast("warn", "Some files skipped", "Only PNG/JPG/WEBP (max 8MB).");

    const merged = pickedGalleryFiles.concat(good).slice(0, 12);
    if (merged.length < pickedGalleryFiles.concat(good).length) {
      toast("warn", "Limit reached", "Max 12 gallery images per save.");
    }
    pickedGalleryFiles = merged;
    setGalleryPickedLabel();

    try { galleryIpt.value = ""; } catch {}
  });

  function setBusy(on) {
    if (saveBtn) saveBtn.disabled = !!on;
    if (newBtn) newBtn.disabled = !!on;
    if (refreshBtn) refreshBtn.disabled = !!on;
    if (logoutBtn) logoutBtn.disabled = !!on;
    if (addGalleryBtn) addGalleryBtn.disabled = !!on;
  }

  async function fetchAdminProducts() {
    const r = await apiFetch("/admin/products", { method: "GET" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Failed to load products");
    return Array.isArray(data.products) ? data.products : [];
  }

  async function signStorageKey(key) {
    const k = String(key || "").trim();
    if (!k) return "";

    if (signedCache.has(k)) return signedCache.get(k);
    if (inflightSigns.has(k)) return inflightSigns.get(k);

    const p = (async () => {
      const r = await apiFetch(`/admin/media/sign?key=${encodeURIComponent(k)}`, { method: "GET" });
      if (r.status === 404) throw new Error("sign route missing");
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.success || !data?.url) throw new Error(data?.message || "Could not resolve image");
      signedCache.set(k, data.url);
      return data.url;
    })();

    inflightSigns.set(k, p);
    try { return await p; }
    finally { inflightSigns.delete(k); }
  }

  async function resolveToDisplayUrl(raw) {
    const r = resolveImage(raw);
    if (!r) return "";
    if (looksLikeStorageKey(r)) {
      try { return await signStorageKey(r); } catch { return ""; }
    }
    return r;
  }

  async function hydrateSignedImages() {
    const imgs = Array.from(document.querySelectorAll("img[data-sbkey]"));
    if (!imgs.length) return;

    let idx = 0;
    async function worker() {
      while (idx < imgs.length) {
        const el = imgs[idx++];
        const key = el.getAttribute("data-sbkey");
        if (!key) continue;
        if (el.getAttribute("data-signed") === "1") continue;

        try {
          const url = await signStorageKey(key);
          el.src = url || fallbackImg();
        } catch {
          el.src = fallbackImg();
        } finally {
          el.setAttribute("data-signed", "1");
        }
      }
    }

    const workers = Array.from({ length: SIGN_CONCURRENCY }, worker);
    await Promise.all(workers);
  }

  async function setDisplayImage(productId, key) {
    const r = await apiFetch(`/admin/products/${encodeURIComponent(productId)}/display-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Failed to set display image");
    return data.product;
  }

  async function setDetailImage(productId, key) {
    const r = await apiFetch(`/admin/products/${encodeURIComponent(productId)}/detail-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Failed to set detail image");
    return data.product;
  }

  async function removeGalleryImage(productId, key) {
    const r = await apiFetch(`/admin/products/${encodeURIComponent(productId)}/images/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.success) throw new Error(data?.message || "Failed to remove image");
    return data.product;
  }

  function updateLocalProduct(updated) {
    const idx = products.findIndex((x) => String(x.id) === String(updated.id));
    if (idx >= 0) products[idx] = updated;
  }

  function buildImageItems(p) {
    const displayKey = String(p.image_key || "").trim();
    const detailKey = String(p.detail_image_key || displayKey || "").trim();

    const galleryKeys = Array.isArray(p.images_keys)
      ? p.images_keys.map(String).map((s) => s.trim()).filter(Boolean)
      : [];

    const galleryUrls = Array.isArray(p.images) ? p.images : [];

    const map = new Map();
    function put(key, url, flags) {
      const k = String(key || "").trim();
      if (!k) return;
      const prev = map.get(k) || { key: k, url: "", isDisplay: false, isDetail: false };
      map.set(k, {
        ...prev,
        url: prev.url || (url || ""),
        isDisplay: prev.isDisplay || !!flags?.isDisplay,
        isDetail: prev.isDetail || !!flags?.isDetail,
      });
    }

    put(displayKey, String(p.image_url || ""), { isDisplay: true });
    put(detailKey, String(p.detail_image_url || ""), { isDetail: true });
    galleryKeys.forEach((k, i) => put(k, String(galleryUrls[i] || ""), {}));

    return Array.from(map.values());
  }

  async function ensureThumbUrl(item) {
    if (item.url && (item.url.startsWith("http://") || item.url.startsWith("https://"))) return item.url;
    const maybeKey = looksLikeStorageKey(item.url) ? item.url : item.key;
    if (looksLikeStorageKey(maybeKey)) {
      try { return await signStorageKey(maybeKey); } catch { return ""; }
    }
    return "";
  }

  async function renderImageManager(p) {
    if (!galleryGrid) return;

    const items = buildImageItems(p);
    const displayKey = String(p.image_key || "").trim();
    const detailKey = String(p.detail_image_key || displayKey || "").trim();

    if (galleryHint) {
      galleryHint.textContent = items.length
        ? "DISPLAY = products page image. DETAIL = product-details/delivery page hero. You can switch anytime."
        : "No images yet. Upload display image and optionally add gallery images.";
    }

    galleryGrid.innerHTML = "";

    for (const item of items) {
      const isDisplay = item.key === displayKey;
      const isDetail = item.key === detailKey;

      const url = (await ensureThumbUrl(item)) || fallbackImg();

      const card = document.createElement("div");
      card.className = "imgCard";

      card.innerHTML = `
        <div class="imgThumbWrap">
          <img class="imgThumb" src="${escapeHtml(url)}" alt="Product image" loading="lazy" decoding="async" fetchpriority="low"
               style="width:100%;height:100%;object-fit:cover;display:block;">
          <div class="imgBadges">
            ${isDisplay ? `<span class="imgBadge bDisplay">DISPLAY</span>` : ``}
            ${isDetail ? `<span class="imgBadge bDetail">DETAIL</span>` : ``}
          </div>
        </div>

        <div class="imgCardMeta">
          <div class="imgKey" title="${escapeHtml(item.key)}">${escapeHtml(item.key)}</div>
          <div class="imgCardBtns">
            <button type="button" class="imgMiniBtn" data-setdisplay ${isDisplay ? "disabled" : ""}>Set Display</button>
            <button type="button" class="imgMiniBtn" data-setdetail ${isDetail ? "disabled" : ""}>Set Detail</button>
            <button type="button" class="imgMiniBtn danger" data-remove ${isDisplay || isDetail ? "disabled" : ""}>Remove</button>
          </div>
        </div>
      `;

      const imgEl = card.querySelector("img");
      imgEl?.addEventListener("error", () => { if (imgEl) imgEl.src = fallbackImg(); });

      card.querySelector("[data-setdisplay]")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        try {
          setBusy(true);
          const updated = await setDisplayImage(String(p.id), item.key);
          updateLocalProduct(updated);

          if (imageKeyIpt) imageKeyIpt.value = String(updated.image_key || "");
          setPickedLabel();
          showPreview(String(updated.image_url || ""));
          toast("ok", "Updated", "DISPLAY image updated.");
          await renderImageManager(updated);
        } catch (e) {
          toast("err", "Failed", String(e.message || e));
        } finally {
          setBusy(false);
        }
      });

      card.querySelector("[data-setdetail]")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        try {
          setBusy(true);
          const updated = await setDetailImage(String(p.id), item.key);
          updateLocalProduct(updated);
          toast("ok", "Updated", "DETAIL image updated.");
          await renderImageManager(updated);
        } catch (e) {
          toast("err", "Failed", String(e.message || e));
        } finally {
          setBusy(false);
        }
      });

      card.querySelector("[data-remove]")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (isDisplay || isDetail) return;
        if (!confirm("Remove this image? (It will be deleted from storage)")) return;

        try {
          setBusy(true);
          const updated = await removeGalleryImage(String(p.id), item.key);
          updateLocalProduct(updated);
          toast("ok", "Removed", "Image removed.");
          await renderImageManager(updated);
        } catch (e) {
          toast("err", "Failed", String(e.message || e));
        } finally {
          setBusy(false);
        }
      });

      galleryGrid.appendChild(card);
    }
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
      if (key && imageKeyIpt) imageKeyIpt.value = "";
    } else if (key) {
      fd.append("image_key", key);
    }

    const dkey = String(detailKeyIpt?.value || "").trim();
    if (dkey) fd.append("detail_image_key", dkey);

    if (pickedGalleryFiles.length) {
      for (const gf of pickedGalleryFiles) fd.append("images", gf);
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

  function parseDateMs(x) {
    const t = new Date(String(x || "")).getTime();
    return Number.isFinite(t) ? t : 0;
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
    if (mode === "old") out.sort((a, b) => parseDateMs(a.created_at) - parseDateMs(b.created_at));
    if (mode === "new") out.sort((a, b) => parseDateMs(b.created_at) - parseDateMs(a.created_at));
    if (mode === "name") out.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (mode === "priceHigh") out.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (mode === "priceLow") out.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));

    return out;
  }

  async function fillEditForm(p) {
    revokePreviewUrl();
    pickedFile = null;
    resetGalleryQueue();
    try { if (imageIpt) imageIpt.value = ""; } catch {}

    if (pid) pid.value = String(p.id);
    if (nameIpt) nameIpt.value = String(p.name || "");
    if (priceIpt) priceIpt.value = String(Number(p.price || 0));
    if (desc) desc.value = String(p.description || "");
    updateDescCount();

    setActiveUI(Boolean(p.is_active));
    if (removeImage) removeImage.value = "false";

    if (imageKeyIpt) imageKeyIpt.value = String(p.image_key || "");
    if (detailKeyIpt) detailKeyIpt.value = String(p.detail_image_key || "");
    setPickedLabel();

    const displayUrl = await resolveToDisplayUrl(p.image_url);
    showPreview(displayUrl || "");

    await renderImageManager(p);
    setHelp("");
  }

  function resetEditForm() {
    revokePreviewUrl();
    pickedFile = null;
    resetGalleryQueue();
    try { if (imageIpt) imageIpt.value = ""; } catch {}

    if (pid) pid.value = "";
    if (nameIpt) nameIpt.value = "";
    if (priceIpt) priceIpt.value = "";
    if (desc) desc.value = "";
    updateDescCount();

    setActiveUI(true);
    if (removeImage) removeImage.value = "false";
    if (imageKeyIpt) imageKeyIpt.value = "";
    if (detailKeyIpt) detailKeyIpt.value = "";
    setPickedLabel();

    showPreview("");
    if (galleryGrid) galleryGrid.innerHTML = "";
    if (galleryHint) galleryHint.textContent = "Upload images to manage DISPLAY/DETAIL.";
    setHelp("");
  }

  async function openEditById(id) {
    const p = products.find((x) => String(x.id) === String(id));
    if (!p) return;

    setBusy(true);
    try {
      await fillEditForm(p);
      if (editTitle) editTitle.textContent = `Edit Product #${id}`;
      openModal(editModal, nameIpt);
    } catch (e) {
      toast("err", "Edit failed", String(e.message || e));
    } finally {
      setBusy(false);
    }
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

    list.forEach((p, index) => {
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
            loading="${index < 6 ? "eager" : "lazy"}"
            decoding="async"
            ${index < 2 ? `fetchpriority="high"` : `fetchpriority="low"`}
            style="width:100%;height:100%;object-fit:cover;display:block;"
            ${isKey ? `data-sbkey="${escapeHtml(raw)}"` : ""}>
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

      card.querySelector("[data-edit]")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        await openEditById(idStr);
      });

      card.querySelector("[data-del]")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        await confirmDeleteById(idStr);
      });

      card.addEventListener("click", async (ev) => {
        if (ev.target.closest(".ad-item-actions")) return;
        await openEditById(idStr);
      });

      card.addEventListener("keydown", async (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          await openEditById(idStr);
        }
      });

      grid.appendChild(card);
    });

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

  // ===================== LIBRARY =====================
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
      libCursor = "";
      libHasMore = false;
      clearLibGrid();
      libSkeleton(12);
    }

    setLibStatus("Loading media…", "info");
    if (libLoadMore) libLoadMore.disabled = true;

    try {
      const url =
        `/admin/media/list?prefix=${encodeURIComponent(prefix)}&search=${encodeURIComponent(term)}&offset=${encodeURIComponent(
          String(libOffset)
        )}&cursor=${encodeURIComponent(String(libCursor || ""))}&limit=${encodeURIComponent(limit)}`;

      const r = await apiFetch(url, { method: "GET" });
      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data?.success) {
        if (r.status === 404) throw new Error("Backend route /admin/media/list not found (404). Deploy server code.");
        throw new Error(data?.message || "Media list failed.");
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (reset) clearLibGrid();

      if (!items.length && libOffset === 0 && !libCursor) {
        setLibStatus("No media found in this folder.", "warn");
      } else {
        setLibStatus(`Loaded ${items.length} file(s).`, "ok");
      }

      items.forEach((it) => {
        const key = String(it.key || "");
        const name = String(it.name || key.split("/").pop() || "");
        const signedUrl = String(it.signedUrl || it.url || "");

        if (key && signedUrl) signedCache.set(key, signedUrl);

        const card = document.createElement("button");
        card.type = "button";
        card.className = "libCard";
        card.setAttribute("aria-label", `Select ${name}`);
        card.innerHTML = `
          <div class="libThumbWrap">
            <img class="libThumbImg" src="${escapeHtml(signedUrl || fallbackImg())}"
                 alt="${escapeHtml(name)}" loading="lazy" decoding="async" fetchpriority="low"
                 style="width:100%;height:100%;object-fit:cover;display:block;">
          </div>
          <div class="libMeta">
            <div class="libName" title="${escapeHtml(key)}">${escapeHtml(name)}</div>
            <div class="libKey">${escapeHtml(key)}</div>
          </div>
        `;

        card.addEventListener("click", async () => {
          if (libTarget === "display") {
            pickedFile = null;
            try { if (imageIpt) imageIpt.value = ""; } catch {}
            if (removeImage) removeImage.value = "false";
            if (imageKeyIpt) imageKeyIpt.value = key;

            showPreview(signedUrl || (await resolveToDisplayUrl(key)) || "");
            toast("ok", "Selected", "Library image selected as DISPLAY (save to apply).");
          } else {
            if (detailKeyIpt) detailKeyIpt.value = key;
            toast("ok", "Selected", "Library image selected as DETAIL (save to apply).");
          }

          setPickedLabel();
          closeModal(libModal);
        });

        libGrid.appendChild(card);
      });

      const nextCursor = String(data.nextCursor || data.next_cursor || "");
      const hasMore = Boolean(data.hasMore ?? data.has_more ?? !!nextCursor);

      if (nextCursor) libCursor = nextCursor;
      else libOffset = libOffset + items.length;

      libHasMore = hasMore || (items.length === limit);

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

  function openLibrary(target) {
    libTarget = target === "detail" ? "detail" : "display";
    if (libTitle) libTitle.textContent = libTarget === "detail"
      ? "Media Library (Pick DETAIL)"
      : "Media Library (Pick DISPLAY)";

    openModal(libModal, libSearch || libClose);
    fetchLibraryPage({ reset: true });
  }

  libSearch?.addEventListener("input", () => {
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
        const updated = await updateProduct(id);
        updateLocalProduct(updated);
        toast("ok", "Updated", "✅ Product updated successfully!");
      } else {
        await createProduct();
        toast("ok", "Created", "✅ Product added successfully!");
      }

      closeModal(editModal);
      resetGalleryQueue();
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
  setGalleryPickedLabel();
  loadProducts();
})();