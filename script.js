// =========================================
// Supabase config (Dashboard → Project Settings → API Keys).
// The anon / publishable key is safe in the browser: Row Level Security
// protects the data. NEVER put the service_role / secret key here.
// =========================================
const SUPABASE_CONFIG = {
  url: "https://burbdllmicsawmoqgees.supabase.co",
  anonKey: "sb_publishable_Lcsevw8B8TD5t5CouI_dug_EgkNfrTW",
};

// =========================================
// Contact page (runs only when the form exists on the page)
// =========================================
const contactForm = document.getElementById("contact-form");

if (contactForm) {
  const db = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

  // ---------- helpers ----------
  function showStep(n) {
    const panels = ["step-details", "step-success"];
    panels.forEach((id, i) => document.getElementById(id).classList.toggle("is-visible", i === n - 1));
    document.querySelectorAll(".step").forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle("is-active", s === n);
      el.classList.toggle("is-done", s < n);
      if (s === n) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
  }

  function setLoading(form, loading) {
    const btn = form.querySelector(".btn");
    btn.disabled = loading;
    btn.classList.toggle("is-loading", loading);
  }

  function setMessage(form, text) {
    form.querySelector(".form-message").textContent = text;
  }

  // ---------- validation ----------
  const rules = {
    firstName: (v) => (v.length >= 2 ? "" : "Please enter your first name."),
    lastName: (v) => (v.length >= 2 ? "" : "Please enter your last name."),
    phone: (v) => (/^\+?[0-9\s-]{7,15}$/.test(v) ? "" : "Please enter a valid phone number."),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Please enter a valid email."),
  };

  function validate(form) {
    let ok = true;
    const data = {};
    for (const [name, check] of Object.entries(rules)) {
      const input = form.elements[name];
      const value = input.value.trim();
      const error = check(value);
      input.closest(".field").classList.toggle("has-error", !!error);
      input.closest(".field").querySelector(".error").textContent = error;
      input.setAttribute("aria-invalid", error ? "true" : "false");
      if (error) ok = false;
      data[name] = value;
    }
    return ok ? data : null;
  }

  // ---------- submit: save to public.contacts ----------
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMessage(contactForm, "");
    const data = validate(contactForm);
    if (!data) return;

    setLoading(contactForm, true);
    const { error } = await db.from("contacts").insert({
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      email: data.email.toLowerCase(),
    });
    setLoading(contactForm, false);

    if (error) {
      setMessage(contactForm, "Something went wrong. Please try again.");
      console.error(error);
      return;
    }

    document.getElementById("welcome-name").textContent = data.firstName;
    showStep(2);
  });
}
