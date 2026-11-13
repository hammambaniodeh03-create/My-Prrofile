// =========================================
// Supabase config (Dashboard → Project Settings → API Keys).
// The anon / publishable key is safe in the browser: Row Level Security
// protects the data. NEVER put the service_role / secret key here.
// =========================================
const SUPABASE_CONFIG = {
  url: "https://burbdllmicsawmoqgees.supabase.co",
  anonKey: "sb_publishable_Lcsevw8B8TD5t5CouI_dug_EgkNfrTW",
};

// The only account allowed into the dashboard (Supabase → Authentication → Users → UID).
// This check is for a friendly message only; the real lock is the RLS policy in
// supabase/migrations/20261113000000_admin_read_contacts.sql.
const ADMIN_UID = "c1baed7b-26f7-4d7d-99a1-ebf1c30350a7";

// Created only on pages that load the Supabase library.
const db = window.supabase
  ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  : null;

// ---------- shared helpers ----------
function setLoading(form, loading) {
  const btn = form.querySelector(".btn");
  btn.disabled = loading;
  btn.classList.toggle("is-loading", loading);
}

function setMessage(form, text) {
  form.querySelector(".form-message").textContent = text;
}

// =========================================
// Contact page (runs only when the form exists on the page)
// =========================================
const contactForm = document.getElementById("contact-form");

if (contactForm) {
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

// =========================================
// Admin dashboard (runs only when the login form exists on the page)
// Passwords are never handled here: Supabase Auth hashes them with bcrypt
// and compares the hash on its server.
// =========================================
const loginForm = document.getElementById("login-form");

if (loginForm) {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  const tableBody = document.getElementById("contacts-body");
  const countText = document.getElementById("contacts-count");
  const dashboardMessage = document.getElementById("dashboard-message");
  const refreshBtn = document.getElementById("refresh-btn");

  const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

  function showLogin(message = "") {
    dashboardView.hidden = true;
    loginView.hidden = false;
    setMessage(loginForm, message);
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    loadContacts();
  }

  // Build a cell with textContent so anything typed into the contact form is shown as plain text.
  function cell(text, href) {
    const td = document.createElement("td");
    if (href) {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = text;
      td.append(a);
    } else {
      td.textContent = text;
    }
    return td;
  }

  function renderContacts(rows) {
    tableBody.replaceChildren();
    countText.textContent = `${rows.length} ${rows.length === 1 ? "message" : "messages"}`;

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = cell("No contacts yet.");
      td.colSpan = 5;
      td.className = "empty";
      tr.append(td);
      tableBody.append(tr);
      return;
    }

    rows.forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.append(
        cell(String(i + 1)),
        cell(`${row.first_name} ${row.last_name}`),
        cell(row.phone, `tel:${row.phone.replace(/[^\d+]/g, "")}`),
        cell(row.email, `mailto:${row.email}`),
        cell(dateFormat.format(new Date(row.created_at)))
      );
      tableBody.append(tr);
    });
  }

  async function loadContacts() {
    dashboardMessage.textContent = "";
    refreshBtn.disabled = true;
    const { data, error } = await db
      .from("contacts")
      .select("first_name, last_name, phone, email, created_at")
      .order("created_at", { ascending: false });
    refreshBtn.disabled = false;

    if (error) {
      dashboardMessage.textContent = "Could not load contacts. Please try again.";
      console.error(error);
      return;
    }
    renderContacts(data);
  }

  // Signed in with an account that isn't the admin → sign it out.
  async function handleSession(session) {
    if (!session) return showLogin();
    if (session.user.id !== ADMIN_UID) {
      await db.auth.signOut();
      return showLogin("This account doesn't have access.");
    }
    showDashboard();
  }

  // ---------- sign in ----------
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginForm.elements.email.value.trim();
    const password = loginForm.elements.password.value;
    if (!email || !password) return setMessage(loginForm, "Please enter your email and password.");

    setMessage(loginForm, "");
    setLoading(loginForm, true);
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    setLoading(loginForm, false);

    if (error) {
      setMessage(loginForm, "Wrong email or password.");
      return;
    }
    loginForm.reset();
    handleSession(data.session);
  });

  // ---------- sign out / refresh ----------
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await db.auth.signOut();
    tableBody.replaceChildren();
    showLogin();
  });

  refreshBtn.addEventListener("click", loadContacts);

  // ---------- on page load: already signed in? ----------
  db.auth.getSession().then(({ data }) => handleSession(data.session));
}
