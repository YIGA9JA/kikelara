// admin-delivery.js (FINAL PREMIUM 3D + BULK MODE + STICKY SUMMARY)
//
// ✅ Uses window.API_BASE from config.js
// ✅ Uses window.ADMIN_TOKEN_KEY from config.js (fallback "admin-token")
// ✅ Uses backend endpoints: GET/PUT /admin/delivery-pricing, POST /admin/delivery-pricing/seed (optional)
// ✅ Client seed of Nigeria dataset -> PUT /admin/delivery-pricing
// ✅ Bulk edit: select multiple LGAs across states; set fee once; delete selected once; save once
// ✅ Premium modal + toast (replaces alert/confirm/prompt)

(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const API_BASE = window.API_BASE || "http://localhost:4000";
  const TOKEN_KEY = window.ADMIN_TOKEN_KEY || "admin-token";
  const DEFAULT_SEED_FEE = 5000;

  const NIGERIA_LGA_SOURCE =
    "https://gist.githubusercontent.com/chrisidakwo/4ba3a4f03afc442305021be4ca67738e/raw/a8276ee3a756ae47ee853c4be5a82a11d6c8a313/nigerian-states.json";

  /* ================= ELEMENTS ================= */
  const stateList = document.getElementById("stateList");
  const addStateBtn = document.getElementById("addStateBtn");
  const newStateName = document.getElementById("newStateName");

  const defaultFeeEl = document.getElementById("defaultFee");
  const saveDefaultFeeBtn = document.getElementById("saveDefaultFeeBtn");

  const seedNigeriaBtn = document.getElementById("seedNigeriaBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const searchBox = document.getElementById("searchBox");
  const lastUpdateEl = document.getElementById("lastUpdate");

  const collapseAllBtn = document.getElementById("collapseAllBtn");
  const expandAllBtn = document.getElementById("expandAllBtn");

  const exportBtn = document.getElementById("exportBtn");
  const importInput = document.getElementById("importInput");

  const toastWrap = document.getElementById("toastWrap");

  // Summary
  const sumStates = document.getElementById("sumStates");
  const sumLgas = document.getElementById("sumLgas");
  const sumSelected = document.getElementById("sumSelected");
  const bulkFeeBtn = document.getElementById("bulkFeeBtn");
  const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
  const bulkClearBtn = document.getElementById("bulkClearBtn");

  // Modal elements
  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalDesc = document.getElementById("modalDesc");
  const modalBody = document.getElementById("modalBody");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalCancelBtn = document.getElementById("modalCancelBtn");
  const modalOkBtn = document.getElementById("modalOkBtn");

  /* ================= HELPERS ================= */
  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(type, title, body, ms = 3200) {
    if (!toastWrap) return;

    const el = document.createElement("div");
    el.className = `toast ${type || ""}`.trim();

    el.innerHTML = `
      <div class="t-row">
        <div class="t-title">${escapeHtml(title || "")}</div>
        <button class="t-close" type="button" aria-label="Close">✕</button>
      </div>
      ${body ? `<div class="t-body">${escapeHtml(body)}</div>` : ""}
    `;

    toastWrap.appendChild(el);

    const close = () => {
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(() => el.remove(), 180);
    };

    el.querySelector(".t-close")?.addEventListener("click", close);
    if (ms > 0) setTimeout(close, ms);
  }

  function setBusy(btn, busyText = "Working...") {
    if (!btn) return () => {};
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyText;
    return () => {
      btn.disabled = false;
      btn.textContent = old || "Done";
    };
  }

  function setLastUpdate(ts) {
    if (!lastUpdateEl) return;
    if (!ts) return (lastUpdateEl.textContent = "—");
    try {
      lastUpdateEl.textContent = new Date(ts).toLocaleString();
    } catch {
      lastUpdateEl.textContent = "—";
    }
  }

  function authHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchWithAuth(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), ...authHeaders() }
    });

    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      toast("err", "Session expired", "Please login again.");
      window.location.href = "admin-login.html";
      return null;
    }
    return res;
  }

  function normalizePricing(raw) {
    const out = { defaultFee: 5000, updatedAt: null, states: [] };
    if (!raw || typeof raw !== "object") return out;

    const def = Number(raw.defaultFee);
    out.defaultFee = Number.isFinite(def) && def >= 0 ? Math.round(def) : 5000;
    out.updatedAt = raw.updatedAt || null;

    const states = Array.isArray(raw.states) ? raw.states : [];
    out.states = states
      .map((s) => {
        const name = String(s?.name || "").trim();
        const citiesIn = Array.isArray(s?.cities) ? s.cities : [];
        const cities = citiesIn
          .map((c) => ({
            name: String(c?.name || "").trim(),
            fee: Math.max(0, Math.round(Number(c?.fee) || 0))
          }))
          .filter((c) => c.name);
        return { name, cities };
      })
      .filter((s) => s.name);

    out.states.sort((a, b) => a.name.localeCompare(b.name));
    out.states.forEach((s) => s.cities.sort((a, b) => a.name.localeCompare(b.name)));
    return out;
  }

  /* ================= MODAL SYSTEM ================= */
  let lastActiveEl = null;

  function openModal({ title, desc, fields = [], okText = "OK", cancelText = "Cancel" }) {
    return new Promise((resolve) => {
      if (!modalOverlay || !modalBody) return resolve({ ok: false, values: {} });

      lastActiveEl = document.activeElement;

      modalTitle.textContent = title || "Confirm";
      modalDesc.textContent = desc || "";
      modalOkBtn.textContent = okText || "OK";
      modalCancelBtn.textContent = cancelText || "Cancel";

      modalBody.innerHTML = "";
      const inputs = {};

      fields.forEach((f) => {
        const wrap = document.createElement("div");
        wrap.className = "modal-field";
        const id = `m_${Math.random().toString(16).slice(2)}`;

        wrap.innerHTML = `
          <label for="${id}">${escapeHtml(f.label || "")}</label>
          <input
            id="${id}"
            type="${escapeHtml(f.type || "text")}"
            placeholder="${escapeHtml(f.placeholder || "")}"
            ${f.min !== undefined ? `min="${escapeHtml(String(f.min))}"` : ""}
            ${f.step !== undefined ? `step="${escapeHtml(String(f.step))}"` : ""}
            value="${escapeHtml(f.value ?? "")}"
            ${f.inputmode ? `inputmode="${escapeHtml(f.inputmode)}"` : ""}
            autocomplete="off"
          />
        `;
        modalBody.appendChild(wrap);
        inputs[f.name] = wrap.querySelector("input");
        if (f.autofocus) setTimeout(() => inputs[f.name]?.focus(), 30);
      });

      function getValues() {
        const out = {};
        fields.forEach((f) => (out[f.name] = inputs[f.name]?.value ?? ""));
        return out;
      }

      function closeModal(result) {
        modalOverlay.classList.remove("open");
        modalOverlay.setAttribute("aria-hidden", "true");

        document.removeEventListener("keydown", onKey);
        modalOverlay.removeEventListener("click", onOverlayClick);

        modalOkBtn.onclick = null;
        modalCancelBtn.onclick = null;
        modalCloseBtn.onclick = null;

        if (lastActiveEl && typeof lastActiveEl.focus === "function") {
          setTimeout(() => lastActiveEl.focus(), 0);
        }

        resolve(result);
      }

      function onKey(e) {
        if (e.key === "Escape") closeModal({ ok: false, values: getValues() });
        if (e.key === "Enter") {
          const active = document.activeElement;
          if (active && active.tagName === "INPUT") {
            e.preventDefault();
            closeModal({ ok: true, values: getValues() });
          }
        }
      }

      function onOverlayClick(e) {
        if (e.target === modalOverlay) closeModal({ ok: false, values: getValues() });
      }

      modalCloseBtn.onclick = () => closeModal({ ok: false, values: getValues() });
      modalCancelBtn.onclick = () => closeModal({ ok: false, values: getValues() });
      modalOkBtn.onclick = () => closeModal({ ok: true, values: getValues() });

      document.addEventListener("keydown", onKey);
      modalOverlay.addEventListener("click", onOverlayClick);

      modalOverlay.classList.add("open");
      modalOverlay.setAttribute("aria-hidden", "false");

      if (!fields.some((f) => f.autofocus)) setTimeout(() => modalOkBtn?.focus(), 30);
    });
  }

  async function modalConfirm(title, desc, { okText = "Yes", cancelText = "Cancel" } = {}) {
    const r = await openModal({ title, desc, fields: [], okText, cancelText });
    return !!r.ok;
  }

  async function modalPromptNumber(title, desc, { label, placeholder, value, min = 0, okText = "Continue" } = {}) {
    const r = await openModal({
      title,
      desc,
      okText,
      cancelText: "Cancel",
      fields: [
        {
          name: "num",
          label: label || "Amount",
          type: "number",
          placeholder: placeholder || "",
          value: value ?? "",
          min,
          step: 1,
          inputmode: "numeric",
          autofocus: true
        }
      ]
    });
    if (!r.ok) return { ok: false, value: null };
    const n = Number(r.values.num);
    if (!Number.isFinite(n) || n < min) return { ok: false, value: null };
    return { ok: true, value: Math.round(n) };
  }

  /* ================= API ================= */
  async function apiGetPricing() {
    const res = await fetchWithAuth(`${API_BASE}/admin/delivery-pricing`, { cache: "no-store" });
    if (!res) return null;
    if (!res.ok) throw new Error("Failed to load pricing");
    const data = await res.json().catch(() => ({}));
    if (!data?.success || !data.pricing) throw new Error("Bad pricing response");
    return normalizePricing(data.pricing);
  }

  async function apiSavePricing(pricingObj) {
    const res = await fetchWithAuth(`${API_BASE}/admin/delivery-pricing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pricingObj)
    });
    if (!res) return null;
    if (!res.ok) throw new Error("Failed to save pricing");
    const data = await res.json().catch(() => ({}));
    if (!data?.success || !data.pricing) throw new Error("Bad save response");
    return normalizePricing(data.pricing);
  }

  async function fetchNigeriaDataset() {
    const res = await fetch(NIGERIA_LGA_SOURCE, { cache: "no-store" });
    if (!res.ok) throw new Error(`Nigeria dataset fetch failed: ${res.status}`);
    return res.json();
  }

  function buildPricingFromNigeriaDataset(dataset, fee) {
    const FEE = Number.isFinite(Number(fee)) ? Math.max(0, Math.round(Number(fee))) : DEFAULT_SEED_FEE;

    const states = Object.keys(dataset || {})
      .map((stateName) => {
        const lgas = Array.isArray(dataset[stateName]) ? dataset[stateName] : [];
        return {
          name: String(stateName || "").trim(),
          cities: lgas.map((lga) => ({ name: String(lga || "").trim(), fee: FEE })).filter((c) => c.name)
        };
      })
      .filter((s) => s.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    states.forEach((s) => s.cities.sort((a, b) => a.name.localeCompare(b.name)));
    return { defaultFee: FEE, updatedAt: new Date().toISOString(), states };
  }

  async function seedAllNigeriaToServer(fee) {
    const dataset = await fetchNigeriaDataset();
    const full = buildPricingFromNigeriaDataset(dataset, fee);
    return apiSavePricing(full);
  }

  /* ================= STATE ================= */
  let pricing = normalizePricing(null);

  // Bulk selection across states
  // key format: `${sIndex}:${cIndex}`
  const selected = new Set();

  function totalLgas() {
    return pricing.states.reduce((acc, s) => acc + (s.cities?.length || 0), 0);
  }

  function updateSummary() {
    if (sumStates) sumStates.textContent = String(pricing.states.length);
    if (sumLgas) sumLgas.textContent = String(totalLgas());
    if (sumSelected) sumSelected.textContent = String(selected.size);

    const hasSel = selected.size > 0;
    if (bulkFeeBtn) bulkFeeBtn.disabled = !hasSel;
    if (bulkDeleteBtn) bulkDeleteBtn.disabled = !hasSel;
    if (bulkClearBtn) bulkClearBtn.disabled = !hasSel;
  }

  function pruneSelection() {
    // Remove selections pointing to deleted cities/states
    const next = new Set();
    selected.forEach((k) => {
      const [s, c] = k.split(":").map(Number);
      if (pricing.states?.[s]?.cities?.[c]) next.add(k);
    });
    selected.clear();
    next.forEach((k) => selected.add(k));
  }

  function toggleState(idx) {
    const body = document.getElementById(`stateBody-${idx}`);
    if (!body) return;
    body.classList.toggle("open");

    const head = body.parentElement?.querySelector(`.state-head[data-toggle="${idx}"]`);
    if (head) head.setAttribute("aria-expanded", body.classList.contains("open") ? "true" : "false");
  }

  /* ================= GLOBAL UI EVENTS ================= */
  logoutBtn?.addEventListener("click", () => adminLogout());

  collapseAllBtn?.addEventListener("click", () => {
    document.querySelectorAll(".state-body.open").forEach((b) => b.classList.remove("open"));
    toast("ok", "Collapsed", "All states collapsed.");
  });

  expandAllBtn?.addEventListener("click", () => {
    document.querySelectorAll(".state-body").forEach((b) => b.classList.add("open"));
    toast("ok", "Expanded", "All states expanded.");
  });

  exportBtn?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(pricing, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliveryPricing_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("ok", "Exported", "JSON backup downloaded.");
  });

  importInput?.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const next = normalizePricing(raw);

      const yes = await modalConfirm(
        "Import pricing?",
        "This will REPLACE current pricing on the SERVER. Continue?",
        { okText: "Import", cancelText: "Cancel" }
      );
      if (!yes) return;

      pricing = await apiSavePricing(next);
      selected.clear();
      pruneSelection();
      if (defaultFeeEl) defaultFeeEl.value = pricing.defaultFee;
      setLastUpdate(pricing.updatedAt);
      renderStates();
      toast("ok", "Imported", "Saved to server.");
    } catch (e) {
      console.error(e);
      toast("err", "Import failed", "Invalid JSON or failed to save.");
    } finally {
      importInput.value = "";
    }
  });

  saveDefaultFeeBtn?.addEventListener("click", async () => {
    const v = Number(defaultFeeEl?.value);
    if (!Number.isFinite(v) || v < 0) return toast("warn", "Invalid fee", "Enter a valid default fee.");

    const done = setBusy(saveDefaultFeeBtn, "Saving...");
    try {
      pricing.defaultFee = Math.round(v);
      pricing = await apiSavePricing(pricing);
      setLastUpdate(pricing.updatedAt);
      renderStates();
      toast("ok", "Saved", "Default delivery fee saved (server).");
    } catch (e) {
      console.error(e);
      toast("err", "Save failed", "Failed to save to server.");
    } finally {
      done();
    }
  });

  addStateBtn?.addEventListener("click", async () => {
    const name = (newStateName?.value || "").trim();
    if (!name) return toast("warn", "Missing state", "Enter a state name.");

    if (pricing.states.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return toast("warn", "Already exists", "That state already exists.");
    }

    const done = setBusy(addStateBtn, "Adding...");
    try {
      pricing.states.push({ name, cities: [] });
      pricing.states.sort((a, b) => a.name.localeCompare(b.name));
      pricing = await apiSavePricing(pricing);

      newStateName.value = "";
      setLastUpdate(pricing.updatedAt);
      renderStates();
      toast("ok", "Added", `${name} added.`);
    } catch (e) {
      console.error(e);
      toast("err", "Add failed", "Failed to save to server.");
    } finally {
      done();
    }
  });

  seedNigeriaBtn?.addEventListener("click", async () => {
    const yes = await modalConfirm(
      "Seed ALL Nigeria LGAs?",
      "This will REPLACE server pricing with ALL Nigeria states + LGAs and set every LGA fee.",
      { okText: "Seed", cancelText: "Cancel" }
    );
    if (!yes) return;

    const feeAsk = await modalPromptNumber("Set fee", "Choose the fee to apply to ALL LGAs.", {
      label: "Fee (₦)",
      placeholder: "e.g. 5000",
      value: String(DEFAULT_SEED_FEE),
      min: 0,
      okText: "Continue"
    });
    if (!feeAsk.ok) return toast("warn", "Cancelled", "No changes made.");

    const done = setBusy(seedNigeriaBtn, "Seeding...");
    try {
      pricing = await seedAllNigeriaToServer(feeAsk.value);
      selected.clear();
      if (defaultFeeEl) defaultFeeEl.value = pricing.defaultFee;
      setLastUpdate(pricing.updatedAt);
      renderStates();
      toast("ok", "Seed complete", "All Nigeria LGAs saved to server.");
    } catch (e) {
      console.error(e);
      toast("err", "Seeding failed", "Check backend logs and internet access.");
    } finally {
      done();
    }
  });

  searchBox?.addEventListener("input", () => renderStates());

  newStateName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addStateBtn?.click();
  });
  defaultFeeEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveDefaultFeeBtn?.click();
  });

  /* ================= BULK SUMMARY BUTTONS ================= */
  bulkClearBtn?.addEventListener("click", () => {
    selected.clear();
    renderStates();
    toast("ok", "Cleared", "Selection cleared.");
  });

  bulkFeeBtn?.addEventListener("click", async () => {
    if (selected.size === 0) return;

    const feeAsk = await modalPromptNumber("Set fee (Selected)", "This sets ONE fee for all selected LGAs.", {
      label: "Fee (₦)",
      placeholder: "e.g. 5000",
      value: String(DEFAULT_SEED_FEE),
      min: 0,
      okText: "Apply"
    });
    if (!feeAsk.ok) return;

    const yes = await modalConfirm(
      "Confirm bulk update",
      `Apply ₦${feeAsk.value} to ${selected.size} selected LGA(s)?`,
      { okText: "Apply", cancelText: "Cancel" }
    );
    if (!yes) return;

    try {
      selected.forEach((k) => {
        const [s, c] = k.split(":").map(Number);
        const city = pricing.states?.[s]?.cities?.[c];
        if (city) city.fee = feeAsk.value;
      });

      pricing = await apiSavePricing(pricing);
      setLastUpdate(pricing.updatedAt);
      renderStates();
      toast("ok", "Updated", `Fee set for ${selected.size} selected LGA(s).`);
    } catch (e) {
      console.error(e);
      toast("err", "Bulk update failed", "Failed to save to server.");
    }
  });

  bulkDeleteBtn?.addEventListener("click", async () => {
    if (selected.size === 0) return;

    const yes = await modalConfirm(
      "Delete selected?",
      `This will delete ${selected.size} selected LGA(s). Continue?`,
      { okText: "Delete", cancelText: "Cancel" }
    );
    if (!yes) return;

    try {
      // Delete from highest indexes to avoid reindex issues
      const byState = new Map(); // sIndex -> array cIndex
      selected.forEach((k) => {
        const [s, c] = k.split(":").map(Number);
        if (!byState.has(s)) byState.set(s, []);
        byState.get(s).push(c);
      });

      for (const [s, arr] of byState.entries()) {
        arr.sort((a, b) => b - a);
        const cities = pricing.states?.[s]?.cities;
        if (!cities) continue;
        arr.forEach((cIndex) => {
          if (cities[cIndex]) cities.splice(cIndex, 1);
        });
      }

      selected.clear();

      pricing = await apiSavePricing(pricing);
      setLastUpdate(pricing.updatedAt);
      renderStates();
      toast("ok", "Deleted", "Selected LGAs removed.");
    } catch (e) {
      console.error(e);
      toast("err", "Bulk delete failed", "Failed to save to server.");
    }
  });

  /* ================= RENDER ================= */
  function renderStates() {
    if (!stateList) return;

    pruneSelection();

    const q = String(searchBox?.value || "").trim().toLowerCase();
    stateList.innerHTML = "";

    updateSummary();

    if (!pricing.states.length) {
      stateList.innerHTML = `<div class="soft-note">No states yet. Add your first state or seed Nigeria.</div>`;
      return;
    }

    const filtered = pricing.states.filter((s) => {
      if (!q) return true;
      const stateMatch = String(s.name || "").toLowerCase().includes(q);
      const cityMatch = (s.cities || []).some((c) => String(c.name || "").toLowerCase().includes(q));
      return stateMatch || cityMatch;
    });

    if (!filtered.length) {
      stateList.innerHTML = `<div class="soft-note">No matches for “${escapeHtml(q)}”.</div>`;
      return;
    }

    filtered.forEach((state) => {
      const sIndex = pricing.states.indexOf(state);
      const cityCount = state.cities?.length || 0;

      // compute selected count within this state
      let selectedInState = 0;
      for (const k of selected) {
        const [s] = k.split(":").map(Number);
        if (s === sIndex) selectedInState++;
      }

      const card = document.createElement("div");
      card.className = "state-card";

      card.innerHTML = `
        <div class="state-head" data-toggle="${sIndex}" role="button" tabindex="0" aria-expanded="false">
          <div class="state-title">
            <span class="name">${escapeHtml(state.name)}</span>
            <span class="state-badge">${cityCount} LGA${cityCount === 1 ? "" : "s"}</span>
            ${selectedInState ? `<span class="state-badge">Selected: ${selectedInState}</span>` : ""}
          </div>
          <div class="state-actions">
            <button class="icon-btn" data-del-state="${sIndex}" title="Delete state" type="button" aria-label="Delete state">✕</button>
            <button class="icon-btn" data-togglebtn="${sIndex}" title="Open" type="button" aria-label="Toggle state">⌄</button>
          </div>
        </div>

        <div class="state-body" id="stateBody-${sIndex}">
          <div class="inner">
            <div class="bulk-strip">
              <div class="left">
                <span class="hint"><b>${escapeHtml(state.name)}</b> • Select LGAs for bulk actions</span>
              </div>
              <div class="right">
                <button class="small-btn" data-select-all="${sIndex}" type="button">Select all</button>
                <button class="small-btn" data-select-none="${sIndex}" type="button">Select none</button>
              </div>
            </div>

            <div class="state-tools">
              <button class="small-btn" data-set-all="${sIndex}" type="button">Set all fees</button>
              <button class="small-btn danger" data-clear-cities="${sIndex}" type="button">Clear LGAs</button>
            </div>

            <div class="city-list" id="cityList-${sIndex}"></div>

            <div class="add-city">
              <input type="text" id="newCity-${sIndex}" placeholder="LGA name (e.g. Ikeja)" autocomplete="off">
              <input type="number" id="newFee-${sIndex}" placeholder="Fee (₦)" min="0" inputmode="numeric">
              <button class="small-btn" data-add-city="${sIndex}" type="button">Add LGA</button>
            </div>
          </div>
        </div>
      `;

      stateList.appendChild(card);
      renderCities(sIndex);
    });

    updateSummary();
  }

  function renderCities(stateIndex) {
    const container = document.getElementById(`cityList-${stateIndex}`);
    if (!container) return;

    const cities = pricing.states[stateIndex]?.cities || [];
    container.innerHTML = "";

    if (!cities.length) {
      container.innerHTML = `<div class="soft-note">No LGAs yet.</div>`;
      return;
    }

    cities.forEach((city, cIndex) => {
      const key = `${stateIndex}:${cIndex}`;
      const checked = selected.has(key);

      const row = document.createElement("div");
      row.className = "city-row";

      row.innerHTML = `
        <div class="sel">
          <input type="checkbox" data-sel="${key}" ${checked ? "checked" : ""} aria-label="Select LGA">
        </div>

        <div class="city-left">
          <div class="city-name">${escapeHtml(city.name)}</div>
          <div class="city-meta">
            <span>Fee:</span>
            <input class="inline-fee" type="number" min="0"
              value="${Number(city.fee || 0)}"
              data-fee="${stateIndex}" data-city="${cIndex}" inputmode="numeric">
            <span style="opacity:.75;">₦</span>
          </div>
        </div>

        <div class="city-actions">
          <button class="small-btn danger" data-del-city="${stateIndex}" data-city="${cIndex}" type="button">Delete</button>
        </div>
      `;

      container.appendChild(row);
    });
  }

  /* ================= CLICK EVENTS ================= */
  document.addEventListener("click", async (e) => {
    const toggle = e.target.closest("[data-toggle], [data-togglebtn]");
    if (toggle) {
      const idx = toggle.getAttribute("data-toggle") ?? toggle.getAttribute("data-togglebtn");
      toggleState(idx);
      return;
    }

    // per-state select all/none
    const selAll = e.target.closest("[data-select-all]");
    if (selAll) {
      const sIndex = Number(selAll.getAttribute("data-select-all"));
      const cities = pricing.states?.[sIndex]?.cities || [];
      cities.forEach((_, cIndex) => selected.add(`${sIndex}:${cIndex}`));
      renderStates();
      toast("ok", "Selected", `Selected all LGAs in ${pricing.states[sIndex]?.name || "state"}.`);
      return;
    }

    const selNone = e.target.closest("[data-select-none]");
    if (selNone) {
      const sIndex = Number(selNone.getAttribute("data-select-none"));
      const cities = pricing.states?.[sIndex]?.cities || [];
      cities.forEach((_, cIndex) => selected.delete(`${sIndex}:${cIndex}`));
      renderStates();
      toast("ok", "Cleared", `Selection cleared for ${pricing.states[sIndex]?.name || "state"}.`);
      return;
    }

    const delStateBtn = e.target.closest("[data-del-state]");
    if (delStateBtn) {
      const idx = Number(delStateBtn.getAttribute("data-del-state"));
      const name = pricing.states[idx]?.name || "this state";

      const yes = await modalConfirm("Delete state?", `Delete ${name} and all its LGAs?`, {
        okText: "Delete",
        cancelText: "Cancel"
      });
      if (!yes) return;

      try {
        pricing.states.splice(idx, 1);
        selected.clear(); // easiest and safest after reindex
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);
        renderStates();
        toast("ok", "Deleted", `${name} deleted.`);
      } catch (err) {
        console.error(err);
        toast("err", "Delete failed", "Failed to save to server.");
      }
      return;
    }

    const addCityBtn = e.target.closest("[data-add-city]");
    if (addCityBtn) {
      const sIndex = Number(addCityBtn.getAttribute("data-add-city"));
      const cityNameEl = document.getElementById(`newCity-${sIndex}`);
      const feeEl = document.getElementById(`newFee-${sIndex}`);

      const cityName = (cityNameEl?.value || "").trim();
      const fee = Number(feeEl?.value);

      if (!cityName) return toast("warn", "Missing LGA", "Enter LGA name.");
      if (!Number.isFinite(fee) || fee < 0) return toast("warn", "Invalid fee", "Enter a valid fee.");

      const cities = pricing.states[sIndex].cities || (pricing.states[sIndex].cities = []);
      if (cities.some((c) => c.name.toLowerCase() === cityName.toLowerCase())) {
        return toast("warn", "Already exists", "That LGA already exists in this state.");
      }

      const done = setBusy(addCityBtn, "Adding...");
      try {
        cities.push({ name: cityName, fee: Math.round(fee) });
        cities.sort((a, b) => a.name.localeCompare(b.name));

        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);

        renderStates();
        toast("ok", "Added", `${cityName} added.`);
      } catch (err) {
        console.error(err);
        toast("err", "Add failed", "Failed to save to server.");
      } finally {
        done();
      }
      return;
    }

    const delCityBtn = e.target.closest("[data-del-city]");
    if (delCityBtn) {
      const sIndex = Number(delCityBtn.getAttribute("data-del-city"));
      const cIndex = Number(delCityBtn.getAttribute("data-city"));
      const city = pricing.states[sIndex]?.cities?.[cIndex];
      if (!city) return;

      const yes = await modalConfirm("Delete LGA?", `Delete ${city.name}?`, {
        okText: "Delete",
        cancelText: "Cancel"
      });
      if (!yes) return;

      try {
        pricing.states[sIndex].cities.splice(cIndex, 1);
        selected.clear(); // safest due to reindex
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);
        renderStates();
        toast("ok", "Deleted", `${city.name} deleted.`);
      } catch (err) {
        console.error(err);
        toast("err", "Delete failed", "Failed to save to server.");
      }
      return;
    }

    const setAllBtn = e.target.closest("[data-set-all]");
    if (setAllBtn) {
      const sIndex = Number(setAllBtn.getAttribute("data-set-all"));
      const st = pricing.states[sIndex];
      if (!st) return;

      const feeAsk = await modalPromptNumber("Set all fees", `Set ONE fee for ALL LGAs in ${st.name}.`, {
        label: "Fee (₦)",
        placeholder: "e.g. 5000",
        value: String(DEFAULT_SEED_FEE),
        min: 0,
        okText: "Update"
      });
      if (!feeAsk.ok) return;

      const done = setBusy(setAllBtn, "Updating...");
      try {
        st.cities = (st.cities || []).map((c) => ({ ...c, fee: feeAsk.value }));
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);
        renderStates();
        toast("ok", "Updated", `All fees updated in ${st.name}.`);
      } catch (err) {
        console.error(err);
        toast("err", "Update failed", "Failed to save to server.");
      } finally {
        done();
      }
      return;
    }

    const clearBtn = e.target.closest("[data-clear-cities]");
    if (clearBtn) {
      const sIndex = Number(clearBtn.getAttribute("data-clear-cities"));
      const st = pricing.states[sIndex];
      if (!st) return;

      const yes = await modalConfirm("Clear LGAs?", `Remove ALL LGAs in ${st.name}?`, {
        okText: "Clear",
        cancelText: "Cancel"
      });
      if (!yes) return;

      const done = setBusy(clearBtn, "Clearing...");
      try {
        st.cities = [];
        selected.clear();
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);
        renderStates();
        toast("ok", "Cleared", `All LGAs removed in ${st.name}.`);
      } catch (err) {
        console.error(err);
        toast("err", "Clear failed", "Failed to save to server.");
      } finally {
        done();
      }
      return;
    }
  });

  // Checkbox selection
  document.addEventListener("change", (e) => {
    const cb = e.target.closest("[data-sel]");
    if (!cb) return;
    const key = cb.getAttribute("data-sel");
    if (!key) return;

    if (cb.checked) selected.add(key);
    else selected.delete(key);

    updateSummary();
  });

  // Keyboard toggle on state head
  document.addEventListener("keydown", (e) => {
    const head = e.target?.closest?.(".state-head[data-toggle]");
    if (!head) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleState(head.getAttribute("data-toggle"));
    }
  });

  // Inline fee editing: debounce + save (quiet save toast)
  let feeSaveTimer = null;
  let lastFeeToastAt = 0;

  document.addEventListener("input", (e) => {
    const feeInput = e.target.closest("[data-fee][data-city]");
    if (!feeInput) return;

    const sIndex = Number(feeInput.getAttribute("data-fee"));
    const cIndex = Number(feeInput.getAttribute("data-city"));
    const fee = Number(feeInput.value);

    if (!Number.isFinite(fee) || fee < 0) return;

    const city = pricing.states?.[sIndex]?.cities?.[cIndex];
    if (!city) return;

    city.fee = Math.round(fee);

    clearTimeout(feeSaveTimer);
    feeSaveTimer = setTimeout(async () => {
      try {
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);

        const now = Date.now();
        if (now - lastFeeToastAt > 2500) {
          lastFeeToastAt = now;
          toast("ok", "Saved", "Fee updated.");
        }
      } catch (err) {
        console.error(err);
        toast("err", "Save failed", "Failed to save fee to server.");
      }
    }, 450);
  });

  /* ================= LOAD FIRST ================= */
  try {
    if (stateList) {
      stateList.innerHTML = `
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
      `;
    }

    const loaded = await apiGetPricing();
    if (!loaded) throw new Error("No pricing");

    pricing = loaded;

    if (defaultFeeEl) defaultFeeEl.value = pricing.defaultFee;
    setLastUpdate(pricing.updatedAt);
    renderStates();

    toast("ok", "Loaded", "Delivery pricing loaded from server.");
  } catch (err) {
    console.error(err);
    if (stateList) stateList.innerHTML = `<div class="soft-note">❌ Failed to load delivery pricing. Check backend + admin login.</div>`;
    toast("err", "Load failed", "Check backend + admin login.");
  }
})();
