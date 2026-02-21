/* ================= admin-featured.js (AUTHED + CLOUDINARY/SUPABASE KEY SUPPORT)
   ✅ Lists featured items: GET /admin/featured
   ✅ Create: POST /admin/featured (FormData)
   ✅ Delete: DELETE /admin/featured/:id
   ✅ Handles:
      - direct URLs
      - /uploads/... (Render local uploads)
      - storage keys (Supabase keys like "featured/..", Cloudinary refs "cld:...")
      by calling: GET /admin/media/sign?key=...
   ✅ Thumbs use object-fit: cover (no outer space look)
========================================================== */

(async function () {
  "use strict";

  const $ = (q) => document.querySelector(q);
  const list = $("#list");
  const createForm = $("#createForm");
  const msg = $("#createMsg");
  const logoutBtn = $("#logoutBtn");

  const API_BASE = String(window.API_BASE || "").replace(/\/+$/, "");
  const apiFetch = window.apiFetch;

  if (logoutBtn) logoutBtn.addEventListener("click", () => window.adminLogout?.());

  const ok = await window.checkAuth?.();
  if (!ok) return;

  if (typeof apiFetch !== "function") {
    if (list) list.textContent = "auth.js missing (apiFetch not found).";
    return;
  }

  async function json(res) {
    return res.json().catch(() => ({}));
  }

  function fallbackImg() {
    return "images_brown/bodyButter.png";
  }

  function looksLikeStorageKey(val) {
    const s = String(val || "").trim();
    if (!s) return false;
    if (/^https?:\/\//i.test(s)) return false;
    if (s.startsWith("/uploads/")) return false;
    if (s.startsWith("cld:")) return true;       // ✅ Cloudinary ref
    if (s.startsWith("uploads/")) return true;   // legacy relative
    return s.includes("/") && !s.startsWith("/"); // e.g. products/... featured/...
  }

  function resolveDirectUrl(val) {
    const s = String(val || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/uploads/") && API_BASE) return `${API_BASE}${s}`;
    if (s.startsWith("uploads/") && API_BASE) return `${API_BASE}/${s}`;
    return s;
  }

  // ---- signer cache
  const signedCache = new Map();
  const inflight = new Map();
  const SIGN_CONCURRENCY = 6;

  async function signStorageKey(key) {
    const k = String(key || "").trim();
    if (!k) return "";

    if (signedCache.has(k)) return signedCache.get(k);
    if (inflight.has(k)) return inflight.get(k);

    const p = (async () => {
      const r = await apiFetch(`/admin/media/sign?key=${encodeURIComponent(k)}`, { method: "GET" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.success || !data?.url) throw new Error(data?.message || "Could not resolve image");
      signedCache.set(k, data.url);
      return data.url;
    })();

    inflight.set(k, p);
    try {
      return await p;
    } finally {
      inflight.delete(k);
    }
  }

  async function hydrateSignedImages() {
    const imgs = Array.from((list || document).querySelectorAll("img[data-sbkey]"));
    if (!imgs.length) return;

    let idx = 0;
    async function worker() {
      while (idx < imgs.length) {
        const img = imgs[idx++];
        const key = img.getAttribute("data-sbkey");
        if (!key) continue;
        if (img.getAttribute("data-signed") === "1") continue;

        try {
          const url = await signStorageKey(key);
          img.src = url || fallbackImg();
        } catch {
          img.src = fallbackImg();
        } finally {
          img.setAttribute("data-signed", "1");
        }
      }
    }

    await Promise.all(Array.from({ length: SIGN_CONCURRENCY }, worker));
  }

  function el(tag, cls, txt) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (txt !== undefined) d.textContent = txt;
    return d;
  }

  function renderItem(it) {
    const card = el("div", "item");

    const thumb = el("div", "thumb");
    const raw = String(it?.image_url || "").trim();

    if (raw) {
      const img = document.createElement("img");
      img.alt = it?.title ? String(it.title) : "";
      img.loading = "lazy";
      img.decoding = "async";

      // ✅ force “no padding look”
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.display = "block";

      if (looksLikeStorageKey(raw)) {
        img.src = fallbackImg();
        img.setAttribute("data-sbkey", raw);
      } else {
        img.src = resolveDirectUrl(raw) || fallbackImg();
      }

      img.addEventListener("error", () => (img.src = fallbackImg()));
      thumb.appendChild(img);
    }

    const meta = el("div", "meta");
    const t = el("div", "t", it?.title ? String(it.title) : "—");
    const l1 = el("div", "l", it?.link_url ? String(it.link_url) : "");
    const l2 = el(
      "div",
      "l",
      `sort: ${Number(it?.sort_order || 0)} • active: ${it?.is_active ? "yes" : "no"}`
    );

    const b = el("div", "b");
    const del = el("button", "small danger", "Delete");
    del.type = "button";
    del.setAttribute("data-del", String(it?.id || ""));
    b.appendChild(del);

    meta.appendChild(t);
    if (it?.link_url) meta.appendChild(l1);
    meta.appendChild(l2);
    meta.appendChild(b);

    card.appendChild(thumb);
    card.appendChild(meta);

    return card;
  }

  async function load() {
    if (!list) return;
    list.textContent = "Loading...";

    const res = await apiFetch("/admin/featured");
    const data = await json(res);

    if (!res.ok || !data.success) {
      list.textContent = "Failed to load.";
      return;
    }

    list.innerHTML = "";
    for (const it of data.items || []) list.appendChild(renderItem(it));

    // delete wiring
    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!id) return;
        if (!confirm("Delete this featured item?")) return;

        const r = await apiFetch(`/admin/featured/${encodeURIComponent(id)}`, { method: "DELETE" });
        const d = await json(r);
        if (!r.ok || !d.success) return alert(d.message || "Delete failed");
        load();
      });
    });

    // ✅ sign any storage keys after render
    hydrateSignedImages();
  }

  createForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";

    const fd = new FormData(createForm);

    // checkbox: if unchecked, it won’t exist
    if (!createForm.is_active.checked) fd.set("is_active", "false");
    else fd.set("is_active", "true");

    const res = await apiFetch("/admin/featured", { method: "POST", body: fd });
    const data = await json(res);

    if (!res.ok || !data.success) {
      if (msg) msg.textContent = data.message || "Upload failed";
      return;
    }

    createForm.reset();
    createForm.is_active.checked = true;
    if (msg) msg.textContent = "✅ Uploaded";
    load();
  });

  load();
})();