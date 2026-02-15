(() => {
  const API_BASE = (window.API_BASE || "https://kikelara1.onrender.com").replace(/\/$/, "");

  const els = {
    grid: document.getElementById("grid"),
    empty: document.getElementById("empty"),
    status: document.getElementById("status"),
    q: document.getElementById("q"),
    sort: document.getElementById("sort"),
    refreshBtn: document.getElementById("refreshBtn"),
    newBtn: document.getElementById("newBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    pills: Array.from(document.querySelectorAll(".ad-pill")),

    toastWrap: document.getElementById("toastWrap"),

    // login modal
    loginModal: document.getElementById("loginModal"),
    loginForm: document.getElementById("loginForm"),
    adminPass: document.getElementById("adminPass"),
    loginBtn: document.getElementById("loginBtn"),
    loginHelp: document.getElementById("loginHelp"),
    loginClose: document.getElementById("loginClose"),
    loginCancel: document.getElementById("loginCancel"),

    // edit modal
    editModal: document.getElementById("editModal"),
    editTitle: document.getElementById("editTitle"),
    editClose: document.getElementById("editClose"),
    cancelEdit: document.getElementById("cancelEdit"),
    editForm: document.getElementById("editForm"),
    pid: document.getElementById("pid"),
    name: document.getElementById("name"),
    price: document.getElementById("price"),
    desc: document.getElementById("desc"),
    active: document.getElementById("active"),
    image: document.getElementById("image"),
    previewImg: document.getElementById("previewImg"),
    saveBtn: document.getElementById("saveBtn"),
    editHelp: document.getElementById("editHelp"),
  };

  let allProducts = [];
  let filterMode = "all";

  /* ================= TOAST ================= */
  function toast(type, title, body, ms = 3200) {
    if (!els.toastWrap) return;
    const el = document.createElement("div");
    el.className = `toast ${type || ""}`.trim();
    el.innerHTML = `
      <div class="t-row">
        <div class="t-title">${escapeHtml(title || "")}</div>
        <button class="t-close" type="button" aria-label="Close">✕</button>
      </div>
      ${body ? `<div class="t-body">${escapeHtml(body)}</div>` : ""}
    `;
    els.toastWrap.appendChild(el);

    const close = () => {
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(() => el.remove(), 180);
    };
    el.querySelector(".t-close")?.addEventListener("click", close);
    if (ms > 0) setTimeout(close, ms);
  }

  function setStatus(msg, type="") {
    if (!els.status) return;
    els.status.textContent = msg || "";
    els.status.setAttribute("data-type", type);
  }

  function setHelp(el, msg, type="") {
    if (!el) return;
    el.textContent = msg || "";
    el.setAttribute("data-type", type);
  }

  function openModal(modal) {
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(modal) {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  function money(n) {
    const v = Number(n || 0);
    try { return v.toLocaleString("en-NG"); } catch { return String(v); }
  }

  function imgUrl(image_url) {
    if (!image_url) return "";
    if (String(image_url).startsWith("/")) return `${API_BASE}${image_url}`;
    return image_url;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getCookie(name) {
    const v = `; ${document.cookie}`;
    const parts = v.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return "";
  }

  function csrfToken() {
    return getCookie("csrf_token") || "";
  }

  async function api(path, opts = {}) {
    const headers = opts.headers || {};
    // CSRF for state-changing requests
    const method = (opts.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      const c = csrfToken();
      if (c) headers["X-CSRF-Token"] = c;
    }

    return fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
      credentials: "include" // ✅ sends HttpOnly cookies
    });
  }

  async function ensureLoggedIn() {
    try {
      const r = await api("/admin/me");
      if (!r.ok) throw new Error("not authed");
      return true;
    } catch {
      openLogin();
      return false;
    }
  }

  function openLogin() {
    setHelp(els.loginHelp, "");
    els.adminPass.value = "";
    openModal(els.loginModal);
    setTimeout(() => els.adminPass.focus(), 50);
  }

  async function login(password) {
    setHelp(els.loginHelp, "Signing in…", "loading");
    els.loginBtn.disabled = true;

    try {
      const r = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }

      closeModal(els.loginModal);
      toast("ok", "Logged in", "Session secured with HttpOnly cookie.");
      setStatus("✅ Logged in", "success");

      await loadProducts();
    } catch (e) {
      setHelp(els.loginHelp, `❌ ${String(e.message || e)}`, "error");
      toast("err", "Login failed", String(e.message || e));
    } finally {
      els.loginBtn.disabled = false;
    }
  }

  async function logout() {
    try {
      await api("/admin/logout", { method: "POST" });
    } catch {}
    setStatus("Logged out.", "success");
    toast("ok", "Logged out", "Session cleared.");
    openLogin();
  }

  async function loadProducts() {
    setStatus("Loading products…", "loading");
    els.empty.style.display = "none";
    els.grid.innerHTML = "";

    try {
      const r = await api("/admin/products");
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        if (r.status === 401) {
          openLogin();
          return;
        }
        throw new Error(data.message || "Failed to load products");
      }

      allProducts = Array.isArray(data.products) ? data.products : [];
      setStatus(`✅ Loaded ${allProducts.length} product(s)`, "success");
      render();
    } catch (e) {
      setStatus(`❌ ${String(e.message || e)}`, "error");
      toast("err", "Load failed", String(e.message || e));
    }
  }

  function applyFilters(list) {
    const q = (els.q.value || "").trim().toLowerCase();
    let out = list.slice();

    if (filterMode === "active") out = out.filter(p => Boolean(p.is_active));
    if (filterMode === "inactive") out = out.filter(p => !Boolean(p.is_active));

    if (q) {
      out = out.filter(p => {
        const name = String(p.name || "").toLowerCase();
        const desc = String(p.description || "").toLowerCase();
        const price = String(p.price || "");
        return name.includes(q) || desc.includes(q) || price.includes(q);
      });
    }

    const sort = els.sort.value;
    out.sort((a, b) => {
      if (sort === "new") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sort === "old") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      if (sort === "name") return String(a.name||"").localeCompare(String(b.name||""));
      if (sort === "priceHigh") return Number(b.price||0) - Number(a.price||0);
      if (sort === "priceLow") return Number(a.price||0) - Number(b.price||0);
      return 0;
    });

    return out;
  }

  function render() {
    const filtered = applyFilters(allProducts);

    els.grid.innerHTML = "";
    if (!filtered.length) {
      els.empty.style.display = "block";
      return;
    }
    els.empty.style.display = "none";

    for (const p of filtered) {
      els.grid.appendChild(card(p));
    }
  }

  function card(p) {
    const wrap = document.createElement("div");
    wrap.className = "pcard";

    const badgeText = p.is_active ? "Active" : "Hidden";
    const badgeCls = p.is_active ? "pbadge" : "pbadge off";

    const fallbackImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23fff4da'/%3E%3Ctext x='50%25' y='50%25' font-family='Segoe UI' font-size='18' fill='%234d3523' text-anchor='middle' dominant-baseline='middle'%3ENo image%3C/text%3E%3C/svg%3E";

    wrap.innerHTML = `
      <div class="pimg">
        <img src="${imgUrl(p.image_url) || fallbackImg}" alt="">
      </div>

      <div class="pbody">
        <div class="ptop">
          <div class="pname">${escapeHtml(p.name || "Untitled")}</div>
          <div class="pprice">₦${money(p.price)}</div>
        </div>

        <div class="pdesc">${escapeHtml((p.description || "").slice(0, 240))}${(p.description||"").length>240 ? "…" : ""}</div>

        <div class="pmeta">
          <div class="${badgeCls}">${badgeText}</div>
          <div class="pbtns">
            <button class="pbtn" type="button" data-act="toggle" data-id="${p.id}">${p.is_active ? "Disable" : "Enable"}</button>
            <button class="pbtn" type="button" data-act="edit" data-id="${p.id}">Edit</button>
            <button class="pbtn danger" type="button" data-act="del" data-id="${p.id}">Delete</button>
          </div>
        </div>
      </div>
    `;

    wrap.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.act;
        const id = Number(btn.dataset.id);
        if (act === "edit") openEdit(id);
        else if (act === "del") await delProduct(id);
        else if (act === "toggle") await toggleActive(id);
      });
    });

    return wrap;
  }

  function openCreate() {
    setHelp(els.editHelp, "");
    els.editTitle.textContent = "Add Product";
    els.pid.value = "";
    els.name.value = "";
    els.price.value = "0";
    els.desc.value = "";
    els.active.value = "true";
    els.image.value = "";
    els.previewImg.src = "";
    openModal(els.editModal);
  }

  function openEdit(id) {
    const p = allProducts.find(x => Number(x.id) === Number(id));
    if (!p) return;

    setHelp(els.editHelp, "");
    els.editTitle.textContent = "Edit Product";
    els.pid.value = String(p.id);
    els.name.value = p.name || "";
    els.price.value = String(Number(p.price || 0));
    els.desc.value = p.description || "";
    els.active.value = String(Boolean(p.is_active));
    els.image.value = "";
    els.previewImg.src = imgUrl(p.image_url) || "";
    openModal(els.editModal);
  }

  async function saveProduct() {
    const id = (els.pid.value || "").trim();
    const name = (els.name.value || "").trim();
    const price = Number(els.price.value || 0);
    const description = (els.desc.value || "").trim();
    const is_active = els.active.value;

    if (!name) {
      setHelp(els.editHelp, "❌ Name is required", "error");
      return;
    }

    setHelp(els.editHelp, "Saving…", "loading");
    els.saveBtn.disabled = true;

    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("price", String(Math.max(0, Math.round(price))));
      fd.append("description", description);
      fd.append("is_active", is_active);

      if (els.image.files && els.image.files[0]) fd.append("image", els.image.files[0]);

      const r = await api(id ? `/admin/products/${encodeURIComponent(id)}` : `/admin/products`, {
        method: id ? "PUT" : "POST",
        body: fd
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        if (r.status === 401) {
          closeModal(els.editModal);
          openLogin();
          return;
        }
        throw new Error(data.message || "Save failed");
      }

      closeModal(els.editModal);
      setStatus("✅ Saved", "success");
      toast("ok", "Saved", "Product saved securely.");
      await loadProducts();
    } catch (e) {
      setHelp(els.editHelp, `❌ ${String(e.message || e)}`, "error");
      toast("err", "Save failed", String(e.message || e));
    } finally {
      els.saveBtn.disabled = false;
    }
  }

  async function delProduct(id) {
    const p = allProducts.find(x => Number(x.id) === Number(id));
    if (!p) return;

    const ok = confirm(`Delete "${p.name}"?\nThis cannot be undone.`);
    if (!ok) return;

    setStatus("Deleting…", "loading");
    try {
      const r = await api(`/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        if (r.status === 401) { openLogin(); return; }
        throw new Error(data.message || "Delete failed");
      }
      setStatus("✅ Deleted", "success");
      toast("ok", "Deleted", "Product removed.");
      await loadProducts();
    } catch (e) {
      setStatus(`❌ ${String(e.message || e)}`, "error");
      toast("err", "Delete failed", String(e.message || e));
    }
  }

  async function toggleActive(id) {
    const p = allProducts.find(x => Number(x.id) === Number(id));
    if (!p) return;

    setStatus("Updating…", "loading");
    try {
      const fd = new FormData();
      fd.append("is_active", String(!Boolean(p.is_active)));

      const r = await api(`/admin/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: fd
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) {
        if (r.status === 401) { openLogin(); return; }
        throw new Error(data.message || "Update failed");
      }

      setStatus("✅ Updated", "success");
      toast("ok", "Updated", "Status updated.");
      await loadProducts();
    } catch (e) {
      setStatus(`❌ ${String(e.message || e)}`, "error");
      toast("err", "Update failed", String(e.message || e));
    }
  }

  // Preview image
  els.image.addEventListener("change", () => {
    const f = els.image.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    els.previewImg.src = url;
  });

  // Events
  els.refreshBtn.addEventListener("click", loadProducts);
  els.newBtn.addEventListener("click", openCreate);
  els.logoutBtn.addEventListener("click", logout);

  els.q.addEventListener("input", render);
  els.sort.addEventListener("change", render);

  els.pills.forEach(p => {
    p.addEventListener("click", () => {
      els.pills.forEach(x => x.classList.remove("is-active"));
      p.classList.add("is-active");
      filterMode = p.dataset.filter || "all";
      render();
    });
  });

  // login
  els.loginClose.addEventListener("click", () => closeModal(els.loginModal));
  els.loginCancel.addEventListener("click", () => closeModal(els.loginModal));
  els.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    login(els.adminPass.value || "");
  });

  // edit modal
  els.editClose.addEventListener("click", () => closeModal(els.editModal));
  els.cancelEdit.addEventListener("click", () => closeModal(els.editModal));
  els.editForm.addEventListener("submit", (e) => {
    e.preventDefault();
    saveProduct();
  });

  // Esc closes modals
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal(els.editModal);
      closeModal(els.loginModal);
    }
  });

  // Boot
  (async function init() {
    const ok = await ensureLoggedIn();
    if (ok) await loadProducts();
  })();
})();
