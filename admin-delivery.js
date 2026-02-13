// admin-delivery.js (FULL UPDATED - uses config.js API_BASE + works with your current backend endpoints)
//
// ✅ Uses window.API_BASE from config.js (local dev + production)
// ✅ Uses window.ADMIN_TOKEN_KEY from config.js (fallback "admin-token")
// ✅ Uses your backend endpoint: POST /admin/delivery-pricing/seed  (NOT seed-nigeria)
// ✅ Seeds Nigeria dataset on the CLIENT (fetches LGAs list) then uploads to server via PUT /admin/delivery-pricing
// ✅ Keeps all your UI features: search, expand/collapse, export/import, inline fee edit debounce, set all fees, clear LGAs
//
// IMPORTANT:
// - Make sure admin-delivery.html includes: <script src="config.js"></script> BEFORE this file (or defer both, config first)
// - Your backend (server.js) currently has: POST /admin/delivery-pricing/seed (not /seed-nigeria)

(async () => {
  const ok = await checkAuth();
  if (!ok) return;

  const API_BASE = window.API_BASE || "http://localhost:4000";
  const TOKEN_KEY = window.ADMIN_TOKEN_KEY || "admin-token";

  const DEFAULT_SEED_FEE = 5000;

  // Nigeria states + LGAs dataset
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

  /* ================= AUTH + FETCH ================= */
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
      window.location.href = "admin-login.html";
      return null;
    }
    return res;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  // ✅ Uses YOUR backend endpoint (exists in server.js): POST /admin/delivery-pricing/seed
  async function apiSeedDefault(fee = 5000) {
    const res = await fetchWithAuth(`${API_BASE}/admin/delivery-pricing/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fee })
    });
    if (!res) return null;
    if (!res.ok) throw new Error("Seed failed");
    const data = await res.json().catch(() => ({}));
    if (!data?.success || !data.pricing) throw new Error("Bad seed response");
    return normalizePricing(data.pricing);
  }

  /* ================= SEED NIGERIA (CLIENT -> SERVER PUT) ================= */
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
          cities: lgas
            .map((lga) => ({ name: String(lga || "").trim(), fee: FEE }))
            .filter((c) => c.name)
        };
      })
      .filter((s) => s.name)
      .sort((a, b) => a.name.localeCompare(b.name));

    states.forEach((s) => s.cities.sort((a, b) => a.name.localeCompare(b.name)));

    return {
      defaultFee: FEE,
      updatedAt: new Date().toISOString(),
      states
    };
  }

  async function seedAllNigeriaToServer(fee) {
    const dataset = await fetchNigeriaDataset();
    const full = buildPricingFromNigeriaDataset(dataset, fee);
    return apiSavePricing(full); // PUT to server (replaces server pricing)
  }

  /* ================= STATE ================= */
  let pricing = normalizePricing(null);

  /* ================= EVENTS ================= */
  logoutBtn?.addEventListener("click", adminLogout);

  collapseAllBtn?.addEventListener("click", () => {
    document.querySelectorAll(".state-body.open").forEach((b) => b.classList.remove("open"));
  });

  expandAllBtn?.addEventListener("click", () => {
    document.querySelectorAll(".state-body").forEach((b) => b.classList.add("open"));
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
  });

  importInput?.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const next = normalizePricing(raw);

      const yes = confirm("Import will REPLACE current pricing on the SERVER. Continue?");
      if (!yes) return;

      pricing = await apiSavePricing(next);
      if (defaultFeeEl) defaultFeeEl.value = pricing.defaultFee;
      setLastUpdate(pricing.updatedAt);
      renderStates();
      alert("✅ Imported + saved to server");
    } catch (e) {
      console.error(e);
      alert("❌ Invalid JSON or failed to save.");
    } finally {
      importInput.value = "";
    }
  });

  saveDefaultFeeBtn?.addEventListener("click", async () => {
    const v = Number(defaultFeeEl?.value);
    if (!Number.isFinite(v) || v < 0) return alert("Enter a valid default fee");

    try {
      pricing.defaultFee = Math.round(v);
      pricing = await apiSavePricing(pricing);
      setLastUpdate(pricing.updatedAt);
      renderStates();
      alert("✅ Default delivery fee saved (server)");
    } catch (e) {
      console.error(e);
      alert("❌ Failed to save to server");
    }
  });

  addStateBtn?.addEventListener("click", async () => {
    const name = (newStateName?.value || "").trim();
    if (!name) return alert("Enter state name");

    if (pricing.states.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return alert("State already exists");
    }

    try {
      pricing.states.push({ name, cities: [] });
      pricing.states.sort((a, b) => a.name.localeCompare(b.name));
      pricing = await apiSavePricing(pricing);

      if (newStateName) newStateName.value = "";
      setLastUpdate(pricing.updatedAt);
      renderStates();
    } catch (e) {
      console.error(e);
      alert("❌ Failed to save to server");
    }
  });

  // ✅ Seed Nigeria (ALL states + ALL LGAs) using dataset, then PUT to your server
  seedNigeriaBtn?.addEventListener("click", async () => {
    const yes = confirm(
      `This will REPLACE server pricing with ALL Nigeria states + LGAs and set every LGA fee.\n\nContinue?`
    );
    if (!yes) return;

    const input = prompt("Set fee for ALL LGAs (₦):", String(DEFAULT_SEED_FEE));
    const fee = Number(input);
    if (!Number.isFinite(fee) || fee < 0) return alert("Enter a valid fee");

    seedNigeriaBtn.disabled = true;
    const oldText = seedNigeriaBtn.textContent;
    seedNigeriaBtn.textContent = "Seeding...";

    try {
      pricing = await seedAllNigeriaToServer(fee);
      if (defaultFeeEl) defaultFeeEl.value = pricing.defaultFee;
      setLastUpdate(pricing.updatedAt);
      renderStates();
      alert("✅ Seeded ALL Nigeria LGAs and saved to SERVER");
    } catch (e) {
      console.error(e);
      alert("❌ Seeding failed. Check backend logs and internet access.");
    } finally {
      seedNigeriaBtn.disabled = false;
      seedNigeriaBtn.textContent = oldText || "Seed Nigeria";
    }
  });

  searchBox?.addEventListener("input", () => renderStates());

  /* ================= RENDER ================= */
  function renderStates() {
    if (!stateList) return;

    const q = String(searchBox?.value || "").trim().toLowerCase();
    stateList.innerHTML = "";

    if (!pricing.states.length) {
      stateList.innerHTML = `<p style="opacity:.85;">No states yet. Add your first state or seed Nigeria.</p>`;
      return;
    }

    const filtered = pricing.states.filter((s) => {
      if (!q) return true;
      const stateMatch = String(s.name || "").toLowerCase().includes(q);
      const cityMatch = (s.cities || []).some((c) => String(c.name || "").toLowerCase().includes(q));
      return stateMatch || cityMatch;
    });

    if (!filtered.length) {
      stateList.innerHTML = `<p style="opacity:.85;">No matches for “${escapeHtml(q)}”.</p>`;
      return;
    }

    filtered.forEach((state) => {
      const sIndex = pricing.states.indexOf(state);
      const cityCount = state.cities?.length || 0;

      const card = document.createElement("div");
      card.className = "state-card";

      card.innerHTML = `
        <div class="state-head" data-toggle="${sIndex}">
          <div class="state-title">
            <span class="name">${escapeHtml(state.name)}</span>
            <span class="state-badge">${cityCount} LGA${cityCount === 1 ? "" : "s"}</span>
          </div>
          <div class="state-actions">
            <button class="icon-btn" data-del-state="${sIndex}" title="Delete state" type="button">✕</button>
            <button class="icon-btn" data-togglebtn="${sIndex}" title="Open" type="button">⌄</button>
          </div>
        </div>

        <div class="state-body" id="stateBody-${sIndex}">
          <div class="inner">
            <div class="state-tools">
              <button class="small-btn" data-set-all="${sIndex}" type="button">Set all fees</button>
              <button class="small-btn danger" data-clear-cities="${sIndex}" type="button">Clear LGAs</button>
            </div>

            <div class="city-list" id="cityList-${sIndex}"></div>

            <div class="add-city">
              <input type="text" id="newCity-${sIndex}" placeholder="LGA name (e.g. Ikeja)">
              <input type="number" id="newFee-${sIndex}" placeholder="Fee (₦)" min="0">
              <button class="small-btn" data-add-city="${sIndex}" type="button">Add LGA</button>
            </div>
          </div>
        </div>
      `;

      stateList.appendChild(card);
      renderCities(sIndex);
    });
  }

  function renderCities(stateIndex) {
    const container = document.getElementById(`cityList-${stateIndex}`);
    if (!container) return;

    const cities = pricing.states[stateIndex]?.cities || [];
    container.innerHTML = "";

    if (!cities.length) {
      container.innerHTML = `<p style="opacity:.85;">No LGAs yet.</p>`;
      return;
    }

    cities.forEach((city, cIndex) => {
      const row = document.createElement("div");
      row.className = "city-row";

      row.innerHTML = `
        <div class="city-left">
          <div class="city-name">${escapeHtml(city.name)}</div>
          <div class="city-meta">
            <span>Fee:</span>
            <input class="inline-fee" type="number" min="0"
              value="${Number(city.fee || 0)}"
              data-fee="${stateIndex}" data-city="${cIndex}">
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
      const body = document.getElementById(`stateBody-${idx}`);
      if (body) body.classList.toggle("open");
      return;
    }

    const delStateBtn = e.target.closest("[data-del-state]");
    if (delStateBtn) {
      const idx = Number(delStateBtn.getAttribute("data-del-state"));
      const name = pricing.states[idx]?.name || "this state";
      if (!confirm(`Delete ${name} and all its LGAs?`)) return;

      try {
        pricing.states.splice(idx, 1);
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);
        renderStates();
      } catch (err) {
        console.error(err);
        alert("❌ Failed to save to server");
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

      if (!cityName) return alert("Enter LGA name");
      if (!Number.isFinite(fee) || fee < 0) return alert("Enter a valid fee");

      const cities = pricing.states[sIndex].cities || (pricing.states[sIndex].cities = []);
      if (cities.some((c) => c.name.toLowerCase() === cityName.toLowerCase())) {
        return alert("LGA already exists in this state");
      }

      try {
        cities.push({ name: cityName, fee: Math.round(fee) });
        cities.sort((a, b) => a.name.localeCompare(b.name));

        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);

        renderCities(sIndex);
        if (cityNameEl) cityNameEl.value = "";
        if (feeEl) feeEl.value = "";
      } catch (err) {
        console.error(err);
        alert("❌ Failed to save to server");
      }
      return;
    }

    const delCityBtn = e.target.closest("[data-del-city]");
    if (delCityBtn) {
      const sIndex = Number(delCityBtn.getAttribute("data-del-city"));
      const cIndex = Number(delCityBtn.getAttribute("data-city"));
      const city = pricing.states[sIndex]?.cities?.[cIndex];
      if (!city) return;

      if (!confirm(`Delete ${city.name}?`)) return;

      try {
        pricing.states[sIndex].cities.splice(cIndex, 1);
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);
        renderCities(sIndex);
      } catch (err) {
        console.error(err);
        alert("❌ Failed to save to server");
      }
      return;
    }

    const setAllBtn = e.target.closest("[data-set-all]");
    if (setAllBtn) {
      const sIndex = Number(setAllBtn.getAttribute("data-set-all"));
      const st = pricing.states[sIndex];
      if (!st) return;

      const input = prompt(`Set one fee for ALL LGAs in ${st.name} (₦):`, String(DEFAULT_SEED_FEE));
      const fee = Number(input);
      if (!Number.isFinite(fee) || fee < 0) return alert("Enter a valid fee");

      try {
        st.cities = (st.cities || []).map((c) => ({ ...c, fee: Math.round(fee) }));
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);
        renderCities(sIndex);
        alert(`✅ Updated all fees in ${st.name} (server)`);
      } catch (err) {
        console.error(err);
        alert("❌ Failed to save to server");
      }
      return;
    }

    const clearBtn = e.target.closest("[data-clear-cities]");
    if (clearBtn) {
      const sIndex = Number(clearBtn.getAttribute("data-clear-cities"));
      const st = pricing.states[sIndex];
      if (!st) return;

      if (!confirm(`Remove ALL LGAs in ${st.name}?`)) return;

      try {
        st.cities = [];
        pricing = await apiSavePricing(pricing);
        setLastUpdate(pricing.updatedAt);
        renderStates();
      } catch (err) {
        console.error(err);
        alert("❌ Failed to save to server");
      }
      return;
    }
  });

  // Inline fee editing: debounce + save
  let feeSaveTimer = null;
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
      } catch (err) {
        console.error(err);
        alert("❌ Failed to save fee to server");
      }
    }, 450);
  });

  /* ================= LOAD FIRST ================= */
  try {
    if (stateList) stateList.innerHTML = `<p style="opacity:.85;">Loading pricing from server...</p>`;
    const loaded = await apiGetPricing();
    if (!loaded) throw new Error("No pricing");
    pricing = loaded;
    if (defaultFeeEl) defaultFeeEl.value = pricing.defaultFee;
    setLastUpdate(pricing.updatedAt);
    renderStates();
  } catch (err) {
    console.error(err);
    if (stateList) stateList.innerHTML = `<p style="opacity:.85;">❌ Failed to load delivery pricing. Check backend + admin login.</p>`;
  }

  /* ================= OPTIONAL: QUICK DEFAULT SEED BUTTON (if you want) =================
     If your admin page has a "seed default capitals" button later, call apiSeedDefault(fee).
     Not used automatically here.
  */
})();
