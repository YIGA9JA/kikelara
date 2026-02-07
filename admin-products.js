/* ================= ADMIN-PRODUCTS.JS (UPLOAD MODE) ================= */

(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const API_BASE = window.API_BASE || "http://localhost:4000";
  const TOKEN_KEY = window.ADMIN_TOKEN_KEY || "admin-token";
  const token = localStorage.getItem(TOKEN_KEY);

  // UI
  const apiLabel = document.getElementById("apiLabel");
  const tbody = document.getElementById("tbody");
  const countLabel = document.getElementById("countLabel");
  const statsRow = document.getElementById("statsRow");
  const searchBox = document.getElementById("searchBox");

  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const addBtn = document.getElementById("addBtn");
  const exportBtn = document.getElementById("exportBtn");

  // Modal
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalSub = document.getElementById("modalSub");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const saveBtn = document.getElementById("saveBtn");
  const editTip = document.getElementById("editTip");

  // Form fields
  const pName = document.getElementById("pName");
  const pCategory = document.getElementById("pCategory");
  const pPrice = document.getElementById("pPrice");
  const pDiscount = document.getElementById("pDiscount");
  const pDesc = document.getElementById("pDesc");

  const pImageFile = document.getElementById("pImageFile");
  const pGalleryFiles = document.getElementById("pGalleryFiles");
  const coverPreview = document.getElementById("coverPreview");
  const galleryPreview = document.getElementById("galleryPreview");
  const coverHint = document.getElementById("coverHint");

  if (apiLabel) apiLabel.textContent = API_BASE;

  let all = [];
  let filtered = [];
  let editing = null; // product object

  /* ================= HELPERS ================= */

  function showToast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function money(n) {
    const v = Number(n || 0);
    return `₦${v.toLocaleString()}`;
  }

  function imageUrl(u) {
    const s = (u || "").trim();
    if (!s) return "";
    if (s.startsWith("http")) return s;
    if (s.startsWith("/uploads/")) return `${API_BASE}${s}`;
    return s;
  }

  function safeText(s) {
    return String(s ?? "").replace(/[<>&"]/g, (c) => ({
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;"
    }[c]));
  }

  function openModal() {
    modal?.classList.add("show");
    modal?.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal?.classList.remove("show");
    modal?.setAttribute("aria-hidden", "true");
    resetForm();
  }

  function resetForm() {
    editing = null;
    modalTitle.textContent = "Add Product";
    modalSub.textContent = "Upload cover + gallery images";
    saveBtn.textContent = "Save";
    editTip.style.display = "none";

    pName.value = "";
    pCategory.value = "";
    pPrice.value = "";
    pDiscount.value = "0";
    pDesc.value = "";

    if (pImageFile) pImageFile.value = "";
    if (pGalleryFiles) pGalleryFiles.value = "";

    coverPreview.style.display = "none";
    coverPreview.src = "";
    galleryPreview.innerHTML = "";

    coverHint.textContent = "Required for new product. Optional when editing.";
  }

  function fillForm(p) {
    editing = p;
    modalTitle.textContent = "Edit Product";
    modalSub.textContent = `Editing ID: ${p.id}`;
    saveBtn.textContent = "Update";
    editTip.style.display = "block";

    pName.value = p.name || "";
    pCategory.value = p.category || "";
    pPrice.value = Number(p.price || 0);
    pDiscount.value = Number(p.discount || 0);
    pDesc.value = p.description || "";

    // previews
    const cover = imageUrl(p.image || "");
    if (cover) {
      coverPreview.src = cover;
      coverPreview.style.display = "block";
    } else {
      coverPreview.style.display = "none";
    }

    galleryPreview.innerHTML = "";
    (Array.isArray(p.images) ? p.images : []).slice(0, 6).forEach((img) => {
      const el = document.createElement("img");
      el.src = imageUrl(img);
      el.alt = "gallery";
      galleryPreview.appendChild(el);
    });

    coverHint.textContent = "Optional on edit: upload a new cover to replace the old one.";
  }

  function renderStats(list) {
    const total = list.length;
    const categories = new Set(list.map(x => (x.category || "").trim()).filter(Boolean));
    const avgPrice = total ? Math.round(list.reduce((a, x) => a + Number(x.price || 0), 0) / total) : 0;

    statsRow.innerHTML = `
      <div class="stat"><div class="k">Total Products</div><div class="v">${total}</div></div>
      <div class="stat"><div class="k">Categories</div><div class="v">${categories.size}</div></div>
      <div class="stat"><div class="k">Avg Price</div><div class="v">${money(avgPrice)}</div></div>
    `;
  }

  function renderTable(list) {
    filtered = list;
    if (countLabel) countLabel.textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
    renderStats(list);

    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">No products found</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const cover = imageUrl(p.image || "");
      const galleryCount = Array.isArray(p.images) ? p.images.length : 0;

      return `
        <tr>
          <td>
            ${cover ? `<img class="thumb" src="${cover}" alt="cover" />` : `<div class="thumb ph">—</div>`}
          </td>
          <td>
            <div class="t-name">${safeText(p.name)}</div>
            <div class="t-sub muted">ID: ${safeText(p.id)}</div>
          </td>
          <td>${safeText(p.category || "—")}</td>
          <td><b>${money(p.price)}</b></td>
          <td>${money(p.discount || 0)}</td>
          <td><span class="chip-mini">${galleryCount} img</span></td>
          <td>
            <div class="actions">
              <button class="btn" data-act="edit" data-id="${safeText(p.id)}">Edit</button>
              <button class="danger-btn" data-act="del" data-id="${safeText(p.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  /* ================= API ================= */

  async function apiGetProducts() {
    const res = await fetch(`${API_BASE}/api/products`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to load products");
    // supports either {items:[...]} or [...]
    return Array.isArray(data) ? data : (data.items || data.products || []);
  }

  async function apiDeleteProduct(id) {
    const res = await fetch(`${API_BASE}/api/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Delete failed");
    return data;
  }

  async function apiSaveProduct() {
    const name = (pName.value || "").trim();
    const category = (pCategory.value || "").trim();
    const price = Number(pPrice.value || 0);
    const discount = Number(pDiscount.value || 0);
    const description = (pDesc.value || "").trim();

    const coverFile = pImageFile?.files?.[0] || null;
    const galleryFiles = Array.from(pGalleryFiles?.files || []);

    if (!name || !category || !price) throw new Error("Name, Category and Price are required.");

    // Add: cover required
    if (!editing && !coverFile) throw new Error("Please upload a cover image.");

    const fd = new FormData();
    fd.append("name", name);
    fd.append("category", category);
    fd.append("price", String(price));
    fd.append("discount", String(discount));
    fd.append("description", description);

    if (coverFile) fd.append("image", coverFile);        // backend expects "image"
    galleryFiles.forEach(f => fd.append("images", f));   // backend expects "images" (multiple)

    const url = editing ? `${API_BASE}/api/products/${editing.id}` : `${API_BASE}/api/products`;
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Save failed");
    return data;
  }

  async function fetchProducts() {
    try {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">Loading…</td></tr>`;
      all = await apiGetProducts();
      all = Array.isArray(all) ? all : [];
      all.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      applySearch();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">${safeText(e.message || "Error")}</td></tr>`;
    }
  }

  /* ================= SEARCH / EXPORT ================= */

  function applySearch() {
    const q = (searchBox?.value || "").trim().toLowerCase();
    if (!q) return renderTable(all);

    const list = all.filter(p => {
      const n = String(p.name || "").toLowerCase();
      const c = String(p.category || "").toLowerCase();
      return n.includes(q) || c.includes(q);
    });

    renderTable(list);
  }

  function exportCSV() {
    const rows = (filtered.length ? filtered : all).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      discount: p.discount,
      image: p.image,
      images: Array.isArray(p.images) ? p.images.join(" | ") : "",
      description: (p.description || "").replace(/\s+/g, " ").trim()
    }));

    const headers = Object.keys(rows[0] || { id: "", name: "" });
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kikelara-products.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ================= EVENTS ================= */

  refreshBtn?.addEventListener("click", fetchProducts);
  logoutBtn?.addEventListener("click", adminLogout);
  addBtn?.addEventListener("click", () => { resetForm(); openModal(); });
  exportBtn?.addEventListener("click", exportCSV);

  closeModalBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  searchBox?.addEventListener("input", applySearch);

  // file previews
  pImageFile?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    coverPreview.src = URL.createObjectURL(f);
    coverPreview.style.display = "block";
  });

  pGalleryFiles?.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    galleryPreview.innerHTML = "";
    files.slice(0, 8).forEach(f => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.alt = "gallery";
      galleryPreview.appendChild(img);
    });
    if (files.length > 8) {
      const more = document.createElement("div");
      more.className = "more";
      more.textContent = `+${files.length - 8} more`;
      galleryPreview.appendChild(more);
    }
  });

  saveBtn?.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = editing ? "Updating..." : "Saving...";

    try {
      await apiSaveProduct();
      showToast(editing ? "✅ Product updated" : "✅ Product added");
      closeModal();
      await fetchProducts();
    } catch (e) {
      showToast(e.message || "Save failed");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = editing ? "Update" : "Save";
    }
  });

  // table action buttons
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");
    const item = all.find(x => String(x.id) === String(id));
    if (!item) return;

    if (act === "edit") {
      resetForm();
      fillForm(item);
      openModal();
      return;
    }

    if (act === "del") {
      const ok = confirm(`Delete "${item.name}"? This cannot be undone.`);
      if (!ok) return;

      btn.disabled = true;
      try {
        await apiDeleteProduct(id);
        showToast("🗑️ Product deleted");
        await fetchProducts();
      } catch (err) {
        showToast(err.message || "Delete failed");
      } finally {
        btn.disabled = false;
      }
    }
  });

  /* ================= INIT ================= */
  await fetchProducts();

})();
