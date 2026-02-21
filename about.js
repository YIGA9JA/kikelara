/* ================= ABOUT.JS (ADMIN HERO PICK #9)
   ✅ Uses same hero source as index: GET /api/hero
   ✅ Picks hero #9 (9th item after sort_order)
   ✅ Smooth fade transition + preload
============================================================================ */

(() => {
  const API_BASE = (window.API_BASE || "").replace(/\/+$/, "");
  const FALLBACK_HERO = "images/about-hero.jpg";

  // 1-indexed pick:
  const ABOUT_HERO_NUMBER = 9; // "Hero no 9"
  const ABOUT_HERO_INDEX = Math.max(0, ABOUT_HERO_NUMBER - 1);

  function resolveImageUrl(img) {
    const val = String(img || "").trim();
    if (!val) return FALLBACK_HERO;
    if (/^https?:\/\//i.test(val)) return val;
    if (val.startsWith("/uploads/") && API_BASE) return `${API_BASE}${val}`;
    if (val.startsWith("uploads/") && API_BASE) return `${API_BASE}/${val}`;
    return val;
  }

  function preloadUrl(src){
    return new Promise((resolve) => {
      if (!src) return resolve();
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  function normalizeHeroItem(it) {
    return {
      id: it?.id,
      title: String(it?.title || "").trim(),
      description: String(it?.description || "").trim(),
      link_url: String(it?.link_url || "").trim(),
      sort_order: Number(it?.sort_order || 0),
      image_url: resolveImageUrl(it?.image_url || "")
    };
  }

  async function fetchHeroItems() {
    if (!API_BASE) return [];
    try {
      const res = await fetch(`${API_BASE}/api/hero`, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json().catch(() => null);
      const items = Array.isArray(data?.items) ? data.items : [];
      return items.map(normalizeHeroItem).filter(x => x.image_url);
    } catch {
      return [];
    }
  }

  async function setAboutHeroBg(heroImgEl, src) {
    if (!heroImgEl || !src) return;

    // fade out
    heroImgEl.style.opacity = "0";
    await preloadUrl(src);

    // swap + fade in
    heroImgEl.src = src;
    heroImgEl.style.transform = "scale(1.02)";

    requestAnimationFrame(() => {
      heroImgEl.style.opacity = "0.92";
      heroImgEl.style.transform = "scale(1.0)";
    });
  }

  async function init() {
    const heroBg = document.getElementById("aboutHeroBgImage");
    if (!heroBg) return;

    // Try fetch admin hero set
    const heroItems = await fetchHeroItems();

    if (!heroItems.length) {
      // keep fallback
      heroBg.src = FALLBACK_HERO;
      heroBg.style.opacity = "0.92";
      return;
    }

    // sort like index: sort_order ascending
    const sorted = heroItems.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // pick hero #9 (index 8). If not enough items, fallback to last item.
    const picked = sorted[ABOUT_HERO_INDEX] || sorted[sorted.length - 1] || sorted[0];
    const src = resolveImageUrl(picked?.image_url);

    await setAboutHeroBg(heroBg, src);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
