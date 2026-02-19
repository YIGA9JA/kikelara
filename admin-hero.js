/* ================= admin-hero.js (AUTHED)
   ✅ CRUD hero slides: /admin/hero
   ✅ Upload image: /admin/hero/upload
   ✅ Public uses: /api/hero (homepage slider)
   ✅ Safe rendering (textContent only)
   ✅ FIX: sends is_active as "true"/"false" (prevents backend Zod validation failed)
   ✅ FIX: supports backend that returns image_key/key + signedUrl/image_url
   ✅ FIX: better error messages (shows validation details)
================================================ */

(async function () {
  "use strict";

  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  const apiFetch = window.apiFetch;

  const apiPill = document.getElementById("apiPill");
  const logoutBtn = document.getElementById("logoutBtn");

  const chipTotal = document.getElementById("chipTotal");
  const chipActive = document.getElementById("chipActive");

  const statusLine = document.getElementById("statusLine");
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");

  const searchEl = document.getElementById("search");
  const refreshBtn = document.getElementById("refreshBtn");

  // Create form
  const titleEl = document.getElementById("title");
  const descEl = document.getElementById("description");
  const linkEl = document.getElementById("link_url");
  const sortEl = document.getElementById("sort_order");
  const imageUrlEl = document.getElementById("image_url");
  const fileEl = document.getElementById("image_file");
  const activeEl = document.getElementById("is_active");
  const createBtn = document.getElementById("createBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Modal
  const modalOverlay = document.getElementById("modalOverlay");
  const modalClose = document.getElementById("modalClose");
  const modalCancel = document.getElementById("modalCancel");
  const modalSave = document.getElementById("modalSave");
  const mTitle = document.getElementById("mTitle");
  const mDesc = document.getElementById("mDesc");
  const mLink = document.getElementById("mLink");
  const mSort = document.getElementById("mSort");
  const mImage = document.getElementById("mImage");
  const mFile = document.getElementById("mFile");
  const mActive = document.getElementById("mActive");

  const toastWrap = document.getElementById("toastWrap");

  let allItems = [];
  let editing = null;

  function hostLabel(url) {
    try { return new URL(url).host; } catch { return url || "—"; }
  }
  if (apiPill) apiPill.textContent = `API: ${hostLabel(API_BASE)}`;

  if (typeof apiFetch !== "function") {
    setStatus("auth.js missing. Ensure auth.js loads before admin-hero.js", "err");
    return;
  }

  // Require login
  const ok = await window.checkAuth?.();
  if (!ok) return;

  logoutBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    window.adminLogout?.();
  });

  function setStatus(text, type) {
    if (!statusLine) return;
    statusLine.textContent = text || "";
    if (type) statusLine.setAttribute("data-type", type);
    else statusLine.removeAttribute("data-type");
  }

  function toast(type, title, body) {
    if (!toastWrap) return;
    const t = document.createElement("div");
    t.className = `toast ${type || ""}`.trim();

    const row = document.createElement("div");
    row.className = "t-row";

    const tt = document.createElement("div");
    tt.className = "t-title";
    tt.textContent = title || "Notice";

    const close = document.createElement("button");
    close.className = "t-close";
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => t.remove());

    row.appendChild(tt);
    row.appendChild(close);

    const bd = document.createElement("div");
    bd.className = "t-body";
    bd.textContent = body || "";

    t.appendChild(row);
    t.appendChild(bd);

    toastWrap.appendChild(t);
    setTimeout(() => { try { t.remove(); } catch {} }, 4500);
  }

  function resolveImageUrl(img) {
    const val = String(img || "").trim();
    if (!val) return "";
    if (/^https?:\/\//i.test(val)) return val;
    if (val.startsWith("/uploads/") && API_BASE) return `${API_BASE}${val}`;
    if (val.startsWith("uploads/") && API_BASE) return `${API_BASE}/${val}`;
    return val;
  }

  function looksLikeStorageKey(v) {
    const s = String(v || "").trim();
    if (!s) return false;
    if (/^https?:\/\//i.test(s)) return false;
    if (s.startsWith("/uploads/") || s.startsWith("uploads/")) return false;
    return true;
  }

  function setImageDraft(inputEl, { displayUrl = "", key = "" } = {}) {
    if (!inputEl) return;
    const u = String(displayUrl || "").trim();
    const k = String(key || "").trim();

    // show something in the input (prefer a URL for preview, else key)
    inputEl.value = u || k || "";

    // store key for backend that needs image_key
    if (k) inputEl.dataset.key = k;
    else delete inputEl.dataset.key;
  }

  function getImageKeyFromInput(inputEl) {
    if (!inputEl) return "";
    const dsKey = String(inputEl.dataset?.key || "").trim();
    if (dsKey) return dsKey;

    const v = String(inputEl.value || "").trim();
    return looksLikeStorageKey(v) ? v : "";
  }

  function getImageUrlFromInput(inputEl) {
    return String(inputEl?.value || "").trim();
  }

  function boolToStr(v) {
    return v ? "true" : "false";
  }

  function formatApiError(data, fallbackMsg) {
    const msg = String(data?.message || data?.msg || fallbackMsg || "Request failed");
    const details = Array.isArray(data?.details) ? data.details : [];
    if (!details.length) return msg;

    // details may be: [{field,message}] or Zod issues
    const lines = details
      .map((d) => {
        const field = d?.field ?? (Array.isArray(d?.path) ? d.path.join(".") : d?.path);
        const m = d?.message || d?.msg || "";
        if (field && m) return `${field}: ${m}`;
        return m || field || "";
      })
      .filter(Boolean);

    return lines.length ? `${msg} — ${lines.join(" | ")}` : msg;
  }

  async function getJson(path) {
    const res = await apiFetch(path, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatApiError(data, `Request failed: ${res.status}`));
    return data;
  }

  async function postJson(path, payload) {
    const res = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatApiError(data, `Request failed: ${res.status}`));
    return data;
  }

  async function putJson(path, payload) {
    const res = await apiFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatApiError(data, `Request failed: ${res.status}`));
    return data;
  }

  async function del(path) {
    const res = await apiFetch(path, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(formatApiError(data, `Request failed: ${res.status}`));
    return data;
  }

  function normalizeItem(it) {
    return {
      id: it?.id,
      title: String(it?.title || "").trim(),
      description: String(it?.description || "").trim(),
      link_url: String(it?.link_url || it?.linkUrl || "").trim(),
      // admin list may return signed URL here:
      image_url: String(it?.image_url || it?.imageUrl || "").trim(),
      // some backends also provide the storage key:
      image_key: String(it?.image_key || it?.imageKey || it?.key || "").trim(),
      sort_order: Number(it?.sort_order ?? it?.sortOrder ?? 0),
      is_active: it?.is_active === undefined ? true : Boolean(it.is_active),
      created_at: it?.created_at || null,
    };
  }

  function updateChips(items) {
    const total = items.length;
    const active = items.filter(x => x.is_active).length;
    if (chipTotal) chipTotal.textContent = `Total: ${total.toLocaleString()}`;
    if (chipActive) chipActive.textContent = `Active: ${active.toLocaleString()}`;
  }

  function openModal(item) {
    editing = item;

    if (mTitle) mTitle.value = item.title || "";
    if (mDesc) mDesc.value = item.description || "";
    if (mLink) mLink.value = item.link_url || "";
    if (mSort) mSort.value = String(item.sort_order ?? 0);

    // show URL (for preview) but keep key in dataset if we have it
    if (mImage) {
      mImage.value = item.image_url || item.image_key || "";
      if (item.image_key) mImage.dataset.key = item.image_key;
      else delete mImage.dataset.key;
    }

    if (mActive) mActive.checked = !!item.is_active;
    if (mFile) mFile.value = "";

    if (modalOverlay) {
      modalOverlay.classList.add("open");
      modalOverlay.setAttribute("aria-hidden", "false");
    }
  }

  function closeModal() {
    editing = null;
    if (modalOverlay) {
      modalOverlay.classList.remove("open");
      modalOverlay.setAttribute("aria-hidden", "true");
    }
  }

  modalClose?.addEventListener("click", closeModal);
  modalCancel?.addEventListener("click", closeModal);
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  async function uploadFile(file) {
    if (!file) throw new Error("No file selected");

    async function tryUpload(fieldName) {
      const fd = new FormData();
      fd.append(fieldName, file);

      const res = await apiFetch("/admin/hero/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    }

    // Try common field name(s) without breaking multer.single("..."):
    // - most setups: "file"
    // - other setups: "image"
    let out = await tryUpload("file");
    if (!out.res.ok) {
      const msg = String(out.data?.message || out.data?.msg || "");
      const unexpected = /unexpected field/i.test(msg);
      if (unexpected || out.res.status === 400) {
        // retry with "image" if backend expects multer.single("image")
        out = await tryUpload("image");
      }
    }

    if (!out.res.ok) {
      if (out.res.status === 404) throw new Error("Upload route not found: POST /admin/hero/upload");
      throw new Error(formatApiError(out.data, `Upload failed: ${out.res.status}`));
    }

    // Prefer returning a storage key if available
    const key =
      out.data?.image_key ||
      out.data?.key ||
      out.data?.path_key ||
      "";

    const url =
      out.data?.signedUrl ||
      out.data?.signed_url ||
      out.data?.url ||
      out.data?.image_url ||
      out.data?.path ||
      "";

    const displayUrl = String(url || "").trim();
    const k = String(key || "").trim();

    // If backend returns only a key, we still return it
    if (!displayUrl && !k) throw new Error("Upload succeeded but no key/url returned");

    return { displayUrl: displayUrl || k, key: k };
  }

  function el(tag, cls, txt) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt !== undefined) d.textContent = txt;
    return d;
  }

  async function swapSort(a, b) {
    // swap sort_order of 2 items (simple + reliable)
    const aOrder = Number(a.sort_order || 0);
    const bOrder = Number(b.sort_order || 0);

    await putJson(`/admin/hero/${encodeURIComponent(a.id)}`, { sort_order: bOrder });
    await putJson(`/admin/hero/${encodeURIComponent(b.id)}`, { sort_order: aOrder });
  }

  function render(items) {
    if (!listEl) return;
    listEl.innerHTML = "";

    const q = String(searchEl?.value || "").trim().toLowerCase();
    const filtered = q
      ? items.filter(x =>
          (x.title || "").toLowerCase().includes(q) ||
          (x.description || "").toLowerCase().includes(q) ||
          (x.link_url || "").toLowerCase().includes(q)
        )
      : items;

    updateChips(filtered);

    if (emptyEl) emptyEl.style.display = filtered.length ? "none" : "block";

    filtered.forEach((it, idx) => {
      const row = el("div", "hero-row");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "88px 1fr auto";
      row.style.gap = "12px";
      row.style.alignItems = "center";
      row.style.padding = "12px 0";
      row.style.borderBottom = "1px solid rgba(95,75,0,0.10)";

      const thumb = el("div", "hero-thumb");
      thumb.style.width = "88px";
      thumb.style.height = "58px";
      thumb.style.borderRadius = "14px";
      thumb.style.overflow = "hidden";
      thumb.style.border = "1px solid rgba(95,75,0,0.14)";
      thumb.style.background = "rgba(255,255,255,0.65)";
      thumb.style.boxShadow = "0 12px 22px rgba(15,10,0,0.08)";

      const img = document.createElement("img");
      img.alt = it.title || "Hero slide";
      img.src = resolveImageUrl(it.image_url) || "";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.display = "block";
      thumb.appendChild(img);

      const meta = el("div", "hero-meta");
      const top = el("div", "hero-topline");
      top.style.display = "flex";
      top.style.gap = "10px";
      top.style.alignItems = "center";
      top.style.flexWrap = "wrap";

      const name = el("div", "hero-title", it.title || "(Untitled)");
      name.style.fontWeight = "1000";

      const badge = el("span", "state-badge", it.is_active ? "Active" : "Hidden");
      badge.style.background = it.is_active ? "rgba(25,135,84,0.12)" : "rgba(220,20,60,0.10)";
      badge.style.borderColor = it.is_active ? "rgba(25,135,84,0.22)" : "rgba(220,20,60,0.22)";
      badge.style.color = it.is_active ? "rgba(25,135,84,1)" : "rgba(220,20,60,1)";

      const order = el("span", "pill", `Order: ${Number(it.sort_order || 0)}`);

      top.appendChild(name);
      top.appendChild(badge);
      top.appendChild(order);

      const desc = el("div", "muted small", it.description || "");
      desc.style.marginTop = "6px";
      desc.style.maxWidth = "70ch";

      const link = el("div", "small muted", it.link_url ? `Link: ${it.link_url}` : "");
      link.style.marginTop = "6px";

      meta.appendChild(top);
      if (it.description) meta.appendChild(desc);
      if (it.link_url) meta.appendChild(link);

      const actions = el("div", "hero-actions");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.flexWrap = "wrap";
      actions.style.justifyContent = "flex-end";

      const up = el("button", "small-btn", "↑");
      up.type = "button";
      up.title = "Move up";
      up.disabled = idx === 0;

      const down = el("button", "small-btn", "↓");
      down.type = "button";
      down.title = "Move down";
      down.disabled = idx === filtered.length - 1;

      const edit = el("button", "small-btn", "Edit");
      edit.type = "button";

      const toggle = el("button", "small-btn", it.is_active ? "Disable" : "Enable");
      toggle.type = "button";

      const delBtn = el("button", "small-btn danger", "Delete");
      delBtn.type = "button";

      up.addEventListener("click", async () => {
        try {
          const prev = filtered[idx - 1];
          await swapSort(it, prev);
          toast("ok", "Updated", "Sort order changed.");
          await load();
        } catch (e) {
          toast("err", "Failed", String(e?.message || e));
        }
      });

      down.addEventListener("click", async () => {
        try {
          const next = filtered[idx + 1];
          await swapSort(it, next);
          toast("ok", "Updated", "Sort order changed.");
          await load();
        } catch (e) {
          toast("err", "Failed", String(e?.message || e));
        }
      });

      edit.addEventListener("click", () => openModal(it));

      toggle.addEventListener("click", async () => {
        try {
          // ✅ send as string to satisfy backend zod schema that expects string
          await putJson(`/admin/hero/${encodeURIComponent(it.id)}`, { is_active: boolToStr(!it.is_active) });
          toast("ok", "Saved", it.is_active ? "Slide disabled." : "Slide enabled.");
          await load();
        } catch (e) {
          toast("err", "Failed", String(e?.message || e));
        }
      });

      delBtn.addEventListener("click", async () => {
        const yes = confirm("Delete this hero slide? This cannot be undone.");
        if (!yes) return;

        try {
          await del(`/admin/hero/${encodeURIComponent(it.id)}`);
          toast("ok", "Deleted", "Slide removed.");
          await load();
        } catch (e) {
          toast("err", "Failed", String(e?.message || e));
        }
      });

      actions.appendChild(up);
      actions.appendChild(down);
      actions.appendChild(edit);
      actions.appendChild(toggle);
      actions.appendChild(delBtn);

      row.appendChild(thumb);
      row.appendChild(meta);
      row.appendChild(actions);

      listEl.appendChild(row);
    });
  }

  async function load() {
    setStatus("Loading slides…", "info");
    try {
      const d = await getJson("/admin/hero");
      const items = Array.isArray(d?.items) ? d.items : [];
      allItems = items.map(normalizeItem).sort((a, b) => {
        const ao = Number(a.sort_order || 0);
        const bo = Number(b.sort_order || 0);
        if (ao !== bo) return ao - bo;
        // newest last to keep stable ordering by sort
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });
      render(allItems);
      setStatus("Ready ✅", "ok");
    } catch (e) {
      setStatus(String(e?.message || e), "err");
      toast("err", "Error", String(e?.message || e));
    }
  }

  function resetForm() {
    if (titleEl) titleEl.value = "";
    if (descEl) descEl.value = "";
    if (linkEl) linkEl.value = "";
    if (sortEl) sortEl.value = "0";
    if (imageUrlEl) {
      imageUrlEl.value = "";
      delete imageUrlEl.dataset.key;
    }
    if (fileEl) fileEl.value = "";
    if (activeEl) activeEl.checked = true;
  }

  fileEl?.addEventListener("change", async () => {
    try {
      const f = fileEl.files?.[0];
      if (!f) return;
      setStatus("Uploading image…", "info");
      const up = await uploadFile(f);
      setImageDraft(imageUrlEl, up);
      toast("ok", "Uploaded", "Image uploaded successfully.");
      setStatus("Ready ✅", "ok");
    } catch (e) {
      toast("err", "Upload failed", String(e?.message || e));
      setStatus("Upload failed", "err");
    }
  });

  mFile?.addEventListener("change", async () => {
    try {
      const f = mFile.files?.[0];
      if (!f) return;
      setStatus("Uploading image…", "info");
      const up = await uploadFile(f);
      setImageDraft(mImage, up);
      toast("ok", "Uploaded", "New image uploaded.");
      setStatus("Ready ✅", "ok");
    } catch (e) {
      toast("err", "Upload failed", String(e?.message || e));
      setStatus("Upload failed", "err");
    }
  });

  createBtn?.addEventListener("click", async () => {
    try {
      const image_url = getImageUrlFromInput(imageUrlEl);
      const image_key = getImageKeyFromInput(imageUrlEl);

      const payload = {
        title: String(titleEl?.value || "").trim(),
        description: String(descEl?.value || "").trim(),
        link_url: String(linkEl?.value || "").trim(),
        sort_order: Number(sortEl?.value || 0),

        // send BOTH for compatibility (backend can pick what it needs)
        image_url,
        image_key: image_key || undefined,

        // ✅ IMPORTANT: send string not boolean (fixes "validation failed")
        is_active: boolToStr(!!activeEl?.checked),
      };

      if (!payload.image_url && !payload.image_key) {
        toast("warn", "Missing image", "Please provide an image URL or upload an image.");
        return;
      }

      setStatus("Saving…", "info");
      await postJson("/admin/hero", payload);
      toast("ok", "Saved", "Hero slide added.");
      resetForm();
      await load();
    } catch (e) {
      toast("err", "Failed", String(e?.message || e));
      setStatus("Save failed", "err");
    }
  });

  resetBtn?.addEventListener("click", resetForm);
  refreshBtn?.addEventListener("click", load);
  searchEl?.addEventListener("input", () => render(allItems));

  modalSave?.addEventListener("click", async () => {
    if (!editing) return;
    try {
      const image_url = getImageUrlFromInput(mImage);
      const image_key = getImageKeyFromInput(mImage) || String(editing.image_key || "").trim();

      const payload = {
        title: String(mTitle?.value || "").trim(),
        description: String(mDesc?.value || "").trim(),
        link_url: String(mLink?.value || "").trim(),
        sort_order: Number(mSort?.value || 0),

        // send BOTH for compatibility
        image_url,
        image_key: image_key || undefined,

        // ✅ IMPORTANT: send string not boolean
        is_active: boolToStr(!!mActive?.checked),
      };

      if (!payload.image_url && !payload.image_key) {
        toast("warn", "Missing image", "Image URL cannot be empty.");
        return;
      }

      setStatus("Saving…", "info");
      await putJson(`/admin/hero/${encodeURIComponent(editing.id)}`, payload);
      toast("ok", "Saved", "Slide updated.");
      closeModal();
      await load();
    } catch (e) {
      toast("err", "Failed", String(e?.message || e));
      setStatus("Update failed", "err");
    }
  });

  await load();
})();
