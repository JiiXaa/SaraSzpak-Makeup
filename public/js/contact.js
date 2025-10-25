const form = document.getElementById("contactForm");
const statusEl = document.getElementById("contactStatus");

function serialize(formEl) {
  const data = Object.fromEntries(new FormData(formEl).entries());
  return {
    name: (data["name"] || "").trim(),
    email: (data["email"] || "").trim(),
    occasion: (data["occasion"] || "").trim(),
    manyServices: (data["manyServices"] || "").trim(),
    location: (data["location"] || "").trim(),
    readyFor: (data["readyFor"] || "").trim(),
    message: (data["your-message"] || "").trim(),
    hp_company: (data["company"] || "").trim(),
  };
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault(); // we handle submit via fetch; fallback works without JS
  statusEl.textContent = "Sending…";

  const payload = serialize(form);
  if (!payload.name || !isValidEmail(payload.email) || !payload.message) {
    statusEl.textContent =
      "Please enter your name, a valid email, and your message.";
    return;
  }

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
