// contact.js — clean submit UX (backend optional)
document.addEventListener("DOMContentLoaded", () => {
  // Mobile menu (matches your pattern)
  const hamburger = document.getElementById("hamburger");
  const mobileNav = document.getElementById("mobileNav");
  if (hamburger && mobileNav) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("active");
      mobileNav.classList.toggle("active");
    });
  }

  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");

  if (!form || !status) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Sending…";

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      // OPTION A: If you later create backend endpoint:
      // const res = await fetch("/api/contact", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(data) });
      // if (!res.ok) throw new Error("Failed");

      // For now: store locally + show success (works without backend)
      const old = JSON.parse(localStorage.getItem("contactMessages") || "[]");
      old.push({ ...data, createdAt: new Date().toISOString() });
      localStorage.setItem("contactMessages", JSON.stringify(old));

      form.reset();
      status.textContent = "✅ Message sent! We’ll reply soon.";
    } catch (err) {
      status.textContent = "⚠️ Could not send right now. Please try again.";
    }
  });
});
