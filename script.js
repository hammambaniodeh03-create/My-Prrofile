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

// Read the password-reset link info from the URL *before* the Supabase client
// is created, because the client consumes and clears the URL hash.
const authHash = new URLSearchParams(location.hash.slice(1));
const isRecoveryLink = authHash.get("type") === "recovery";
const authLinkError = authHash.get("error_code") || authHash.get("error");

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

function setMessage(form, text, isSuccess = false) {
  const el = form.querySelector(".form-message");
  el.textContent = text;
  el.classList.toggle("is-success", isSuccess);
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
  const forgotForm = document.getElementById("forgot-form");
  const resetForm = document.getElementById("reset-form");
  const views = ["login-view", "forgot-view", "reset-view", "dashboard-view"].map((id) =>
    document.getElementById(id)
  );
  const tableBody = document.getElementById("contacts-body");
  const countText = document.getElementById("contacts-count");
  const dashboardMessage = document.getElementById("dashboard-message");
  const refreshBtn = document.getElementById("refresh-btn");

  const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

  // true while the user came from a reset link and hasn't set the new password yet.
  let recovering = false;

  const RESET_LINK_INVALID = "This reset link is invalid or has expired. Please request a new one.";

  // Show one screen (login / forgot / reset / dashboard) and hide the others.
  function showView(id) {
    views.forEach((view) => (view.hidden = view.id !== id));
  }

  function showLogin(message = "") {
    showView("login-view");
    setMessage(loginForm, message);
  }

  function showDashboard() {
    showView("dashboard-view");
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
    // Opened from a reset link: ask for the new password before showing any data.
    if (recovering) return showView("reset-view");
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

  // ---------- switch between "Sign in" and "Forgot password" ----------
  document.querySelectorAll("[data-show]").forEach((btn) => {
    btn.addEventListener("click", () => {
      [loginForm, forgotForm].forEach((form) => setMessage(form, ""));
      showView(btn.dataset.show);
      document.querySelector(`#${btn.dataset.show} input`)?.focus();
    });
  });

  // ---------- forgot password: email a reset link ----------
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = forgotForm.elements.email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setMessage(forgotForm, "Please enter a valid email.");
    }

    setMessage(forgotForm, "");
    setLoading(forgotForm, true);

    // Ask the database whether this is the admin email (returns true/false only;
    // see supabase/migrations/20261118000000_is_admin_email.sql).
    const { data: isAdmin, error: checkError } = await db.rpc("is_admin_email", { p_email: email });
    if (checkError) {
      setLoading(forgotForm, false);
      console.error(checkError);
      return setMessage(forgotForm, "Could not send the link. Please try again.");
    }
    if (!isAdmin) {
      setLoading(forgotForm, false);
      return setMessage(forgotForm, "This email is not the admin email.");
    }

    // The link in the email brings the user back to this page.
    // This URL must be listed in Supabase → Authentication → URL Configuration → Redirect URLs.
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname,
    });
    setLoading(forgotForm, false);

    if (error) {
      console.error(error);
      return setMessage(
        forgotForm,
        error.status === 429
          ? "Too many requests. Please wait a few minutes and try again."
          : "Could not send the link. Please try again."
      );
    }
    forgotForm.reset();
    setMessage(forgotForm, "Reset link sent. Check your inbox (and spam).", true);
  });

  // ---------- reset link opened: set the new password ----------
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = resetForm.elements.password.value;
    const confirm = resetForm.elements.confirm.value;
    if (password.length < 6) return setMessage(resetForm, "Password must be at least 6 characters.");
    if (password !== confirm) return setMessage(resetForm, "Passwords don't match.");

    setMessage(resetForm, "");
    setLoading(resetForm, true);
    const { error } = await db.auth.updateUser({ password });
    setLoading(resetForm, false);

    if (error) {
      console.error(error);
      const messages = {
        same_password: "New password must be different from your current one.",
        weak_password: "This password is too weak. Please choose a stronger one.",
      };
      return setMessage(resetForm, messages[error.code] || "Could not update the password. " + RESET_LINK_INVALID);
    }

    resetForm.reset();
    recovering = false;
    const { data } = await db.auth.getSession();
    handleSession(data.session);
  });

  // Supabase fires this when the session came from a reset link.
  db.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recovering = true;
      showView("reset-view");
    }
  });

  // ---------- on page load ----------
  if (authLinkError) {
    // Expired or already-used reset link: clean the URL and explain.
    history.replaceState(null, "", location.pathname + location.search);
    showLogin(RESET_LINK_INVALID);
  } else {
    recovering = isRecoveryLink;
    db.auth.getSession().then(({ data }) => {
      if (recovering && !data.session) {
        recovering = false;
        return showLogin(RESET_LINK_INVALID);
      }
      handleSession(data.session);
    });
  }
}
