// Lightweight client-side validation for contact form.
// - Highlights invalid fields with .is-invalid
// - Requires: name, email(valid), phone(valid-ish), occasion(select), manyServices, location, readyFor, your-message

(function () {
  const form = document.getElementById("contactForm");
  if (!form) return;

  // Helpers
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^\+?[0-9\s().-]{7,20}$/;

  function byId(id) {
    return form.querySelector("#" + id);
  }

  function markInvalid(el, msg) {
    if (!el) return false;
    el.classList.add("is-invalid");
    el.setAttribute("aria-invalid", "true");
    // Opcjonalnie: pokaż krótką podpowiedź w title
    if (msg) el.title = msg;
    return false;
  }

  function clearInvalid(el) {
    if (!el) return;
    el.classList.remove("is-invalid");
    el.removeAttribute("aria-invalid");
    el.removeAttribute("title");
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

  // Fields
  const fields = {
    name: byId("name"),
    email: byId("email"),
    phone: byId("phone"),
    occasion: byId("occasion"), // <select>
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
    }

    if (!ok) {
      e.preventDefault();
      // Scroll to first invalid
      const firstInvalid = form.querySelector(".is-invalid");
      if (firstInvalid && typeof firstInvalid.scrollIntoView === "function") {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid.focus({ preventScroll: true });
      }
      return;
    }
    // else allow normal submit to /api/contact?redirect=...
  });
})();
