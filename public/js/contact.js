const form = document.getElementById("contactForm");
const statusEl = document.getElementById("contactStatus");
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^\+?[0-9\s().-]{7,20}$/;

function serialize(formEl) {
  const data = Object.fromEntries(new FormData(formEl).entries());
  return {
    name: (data["name"] || "").trim(),
    email: (data["email"] || "").trim(),
    phone: (data["phone"] || "").trim(),
    occasion: (data["occasion"] || "").trim(),
    manyServices: (data["manyServices"] || "").trim(),
    location: (data["location"] || "").trim(),
    readyFor: (data["readyFor"] || "").trim(),
    message: (data["your-message"] || "").trim(),
    hp_company: (data["company"] || "").trim(),
  };
}

function isValidEmail(v) {
  return emailRe.test(v);
}

function markInvalid(name, message) {
  const field =
    form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);

  if (!field) return;

  field.classList.add("is-invalid");
  field.setAttribute("aria-invalid", "true");
  field.title = message;
}

function clearInvalidFields() {
  form.querySelectorAll(".is-invalid").forEach((field) => {
    field.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");
    field.removeAttribute("title");
  });
}

function validatePayload(payload) {
  const errors = [];

  if (!payload.name) errors.push(["name", "Please enter your name."]);
  if (!isValidEmail(payload.email)) {
    errors.push(["email", "Please enter a valid email."]);
  }
  if (!phoneRe.test(payload.phone)) {
    errors.push(["phone", "Please enter a valid phone number."]);
  }
  if (!payload.occasion) {
    errors.push(["occasion", "Please select an occasion."]);
  }
  if (!payload.manyServices) {
    errors.push(["manyServices", "Please enter how many services are needed."]);
  }
  if (!payload.location) {
    errors.push(["location", "Please enter the location or postcode."]);
  }
  if (!payload.readyFor) {
    errors.push(["readyFor", "Please enter what time you need to be ready."]);
  }
  if (!payload.message) {
    errors.push(["your-message", "Please enter your message."]);
  }

  return errors;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault(); // we handle submit via fetch; fallback works without JS
  clearInvalidFields();

  const payload = serialize(form);
  const errors = validatePayload(payload);

  if (errors.length > 0) {
    errors.forEach(([name, message]) => markInvalid(name, message));
    statusEl.textContent = errors[0][1];

    const firstInvalid = form.querySelector(".is-invalid");
    if (firstInvalid && typeof firstInvalid.scrollIntoView === "function") {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid.focus({ preventScroll: true });
    }

    return;
  }

  statusEl.textContent = "Sending…";

  try {
    const res = await fetch(form.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      // Respect the redirect target defined in the form action
      const url = new URL(form.action, window.location.origin);
      const redirect =
        url.searchParams.get("redirect") || "/form-submitted.html";
      window.location.href = redirect;
      return;
    }

    const data = await res.json().catch(() => ({}));
    statusEl.textContent =
      "Sending failed: " + (data.error || "please try again.");
  } catch (err) {
    statusEl.textContent = "Network error. Please try again.";
  }
});
