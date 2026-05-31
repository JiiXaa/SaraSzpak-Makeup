// Lightweight client-side validation for contact form.
// - Highlights invalid fields with .is-invalid
// - Requires: name, email(valid), phone(valid-ish), occasion(select), manyServices, location, readyFor, your-message
// - Requires eventDate only on pages that include the field.

(function () {
  const form = document.getElementById("contactForm");
  if (!form) return;

  // Helpers
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^\+?[0-9\s().-]{7,20}$/;
  const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;

  function byId(id) {
    return form.querySelector("#" + id);
  }

  function markInvalid(el, msg) {
    if (!el) return false;
    const flatpickrAltInput = el._flatpickr?.altInput;

    el.classList.add("is-invalid");
    el.setAttribute("aria-invalid", "true");
    // Opcjonalnie: pokaż krótką podpowiedź w title
    if (msg) el.title = msg;

    if (flatpickrAltInput) {
      flatpickrAltInput.classList.add("is-invalid");
      flatpickrAltInput.setAttribute("aria-invalid", "true");
      if (msg) flatpickrAltInput.title = msg;
    }

    return false;
  }

  function clearInvalid(el) {
    if (!el) return;
    const flatpickrAltInput = el._flatpickr?.altInput;

    el.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
    el.removeAttribute("title");

    if (flatpickrAltInput) {
      flatpickrAltInput.classList.remove("is-invalid");
      flatpickrAltInput.removeAttribute("aria-invalid");
      flatpickrAltInput.removeAttribute("title");
    }
  }

  function required(el, msg) {
    const v = String(el?.value || "").trim();
    if (!v) return markInvalid(el, msg || "This field is required.");
    return true;
  }

  function validEmail(el) {
    const v = String(el?.value || "").trim();
    if (!emailRe.test(v)) return markInvalid(el, "Please enter a valid email.");
    return true;
  }

  function validPhone(el) {
    const v = String(el?.value || "").trim();
    if (!v) return markInvalid(el, "Phone number is required.");
    if (!phoneRe.test(v))
      return markInvalid(
        el,
        "Please enter a valid phone number (e.g. +44 7783 109 453).",
      );
    return true;
  }

  function validFutureDate(el) {
    const v = String(el?.value || "").trim();

    if (!isoDateRe.test(v)) {
      return markInvalid(el, "Please select a valid preferred date.");
    }

    const selected = new Date(`${v}T00:00:00`);
    if (Number.isNaN(selected.getTime())) {
      return markInvalid(el, "Please select a valid preferred date.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selected < today) {
      return markInvalid(el, "Please choose today or a future date.");
    }

    return true;
  }

  // Fields
  const fields = {
    name: byId("name"),
    email: byId("email"),
    phone: byId("phone"),
    occasion: byId("occasion"), // <select>
    eventDate: byId("eventDate"),
    manyServices: byId("manyServices"),
    location: byId("location"),
    readyFor: byId("readyFor"),
    message: byId("your-message"),
  };

  // Live clearing of errors
  const liveInputs = [
    fields.name,
    fields.email,
    fields.phone,
    fields.eventDate,
    fields.manyServices,
    fields.location,
    fields.readyFor,
    fields.message,
  ].filter(Boolean);

  liveInputs.forEach((el) => {
    el.addEventListener("input", () => clearInvalid(el));
    el.addEventListener("blur", () => clearInvalid(el));
  });

  if (fields.occasion) {
    fields.occasion.addEventListener("change", () =>
      clearInvalid(fields.occasion),
    );
    fields.occasion.addEventListener("blur", () =>
      clearInvalid(fields.occasion),
    );
  }

  form.addEventListener("submit", (e) => {
    // Wyzeruj stare błędy
    Object.values(fields).forEach(clearInvalid);

    let ok = true;

    // Required text inputs
    ok = required(fields.name) && ok;
    ok = required(fields.email) && ok;
    ok = required(fields.phone) && ok;
    ok = required(fields.occasion) && ok; // <select> ma pustą option + required
    if (fields.eventDate) {
      ok = required(fields.eventDate, "Please select your preferred date.") && ok;
    }
    ok = required(fields.manyServices) && ok;
    ok = required(fields.location) && ok;
    ok = required(fields.readyFor) && ok;
    ok =
      required(
        fields.message,
        "Please enter a short message (min 5 characters).",
      ) && ok;

    // Specific formats
    if (ok) {
      ok = validEmail(fields.email) && ok;
      ok = validPhone(fields.phone) && ok;
      if (fields.eventDate) {
        ok = validFutureDate(fields.eventDate) && ok;
      }
    }

    if (!ok) {
      e.preventDefault();
      // Scroll to first invalid
      const firstInvalid = form.querySelector(".is-invalid");
      if (firstInvalid && typeof firstInvalid.scrollIntoView === "function") {
        const focusTarget = firstInvalid._flatpickr?.altInput || firstInvalid;

        focusTarget.scrollIntoView({ behavior: "smooth", block: "center" });
        focusTarget.focus({ preventScroll: true });
      }
      return;
    }
    // else allow normal submit to /api/contact?redirect=...
  });
})();
