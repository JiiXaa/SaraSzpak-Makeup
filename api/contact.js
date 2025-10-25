// Purpose: Progressive enhancement handler for contact form.
// - Works with classic form POST (x-www-form-urlencoded) and AJAX (JSON).
// - On success: redirects with 303 See Other to ?redirect=/form-submitted.html
// - Honeypot submissions also redirect, silently.

const BREVO_API = "https://api.brevo.com/v3/smtp/email";

// Small HTML escape for email output
function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function parseBody(req) {
  const ctype = req.headers["content-type"] || "";
  if (ctype.includes("application/json")) {
    return new Promise((resolve) => {
      let buf = "";
      req.on("data", (ch) => (buf += ch));
      req.on("end", () => {
        try {
          resolve(JSON.parse(buf || "{}"));
        } catch {
          resolve({});
        }
      });
    });
  }
  // x-www-form-urlencoded (classic form)
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (ch) => (buf += ch));
    req.on("end", () => {
      try {
        const params = new URLSearchParams(buf);
        const obj = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        resolve(obj);
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Determine response mode and redirect target
  const wantsJson =
    (req.headers["accept"] || "").includes("application/json") ||
    (req.headers["content-type"] || "").includes("application/json");
  const url = new URL(req.url, `http://${req.headers.host}`);
  const redirectTo = url.searchParams.get("redirect") || "/form-submitted.html";

  function redirect303() {
    res.statusCode = 303;
    res.setHeader("Location", redirectTo);
    return res.end();
  }

  try {
    const body = await parseBody(req);

    // Honeypot: if filled, pretend success (and redirect if non-AJAX)
    if (body.company || body.hp_company) {
      return wantsJson ? res.status(200).json({ ok: true }) : redirect303();
    }

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    const occasion = (body.occasion || "").trim();
    const manyServices = (body.manyServices || "").trim();
    const location = (body.location || "").trim();
    const readyFor = (body.readyFor || "").trim();
    const message = (body.message || body["your-message"] || "").trim();

    if (!name || !email || !message) {
      return wantsJson
        ? res.status(400).json({ ok: false, error: "Missing fields" })
        : redirect303(); // keep UX consistent even if validation fails without JS
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return wantsJson
        ? res.status(400).json({ ok: false, error: "Invalid email" })
        : redirect303();
    }

    // OWNER EMAIL (HTML + TEXT)
    const ownerHtml = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">New enquiry from website</h2>
        <table style="border-collapse:collapse;width:100%;max-width:640px">
          <tbody>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Name</strong></td><td style="padding:8px;border:1px solid #eee">${esc(name)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Email</strong></td><td style="padding:8px;border:1px solid #eee">${esc(email)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Phone</strong></td><td style="padding:8px;border:1px solid #eee">${esc(phone) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Occasion</strong></td><td style="padding:8px;border:1px solid #eee">${esc(occasion) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Services needed</strong></td><td style="padding:8px;border:1px solid #eee">${esc(manyServices) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Location</strong></td><td style="padding:8px;border:1px solid #eee">${esc(location) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Ready for</strong></td><td style="padding:8px;border:1px solid #eee">${esc(readyFor) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee;vertical-align:top"><strong>Message</strong></td><td style="padding:8px;border:1px solid #eee;white-space:pre-wrap">${esc(message)}</td></tr>
          </tbody>
        </table>
        <p style="color:#666;margin-top:16px">Tip: hit “Reply” to respond directly to the client.</p>
      </div>
    `;

    const ownerText = `New enquiry from website

Name: ${name}
Email: ${email}
Phone: ${phone || "—"}
Occasion: ${occasion || "—"}
Services needed: ${manyServices || "—"}
Location: ${location || "—"}
Ready for: ${readyFor || "—"}

Message:
${message}
`.trim();

    // CLIENT AUTOREPLY (HTML + TEXT)
    const clientHtml = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">Thank you, ${esc(name)}!</h2>
        <p>We’ve received your enquiry and will get back to you within <strong>24 hours</strong>.</p>

        <p>If your date is time-sensitive, you can also reach us here:</p>
        <ul style="margin:0 0 12px 20px">
          <li>Instagram: @saraszpak_mua</li>
          <li>WhatsApp: +44 7783 109 453</li>
          <li>Website: <a href="https://saraszpak.com" target="_blank" rel="noopener">saraszpak.com</a></li>
          <li>Email: Contact@saraszpak.com</li>
        </ul>

        <p style="margin-top:16px">Warmly,<br>Sara – Bridal Hair & Makeup</p>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <div style="font-size:13px;color:#666;line-height:1.5">
          <div><strong>Sara Szpak — Bridal Hair & Makeup</strong></div>
          <div>Newport, South Wales • +44 7783 109 453 • Contact@saraszpak.com</div>
          <div><a href="https://saraszpak.com" target="_blank" rel="noopener" style="color:#666;text-decoration:underline">https://saraszpak.com</a></div>
          <div style="margin-top:8px">If you didn’t submit this enquiry, you can ignore this email.</div>
        </div>
      </div>
    `;

    const clientText = `Thank you, ${name}!
      We’ve received your enquiry and will get back to you within 24 hours.

      If your date is time-sensitive, you can also reach us here:
      - Instagram: @saraszpak_mua
      - WhatsApp: +44 7783 109 453
      - Website: https://saraszpak.com
      - Email: Contact@saraszpak.com

      Warmly,
      Sara – Bridal Hair & Makeup

      Sara Szpak — Bridal Hair & Makeup
      Newport, South Wales • +44 7783 109 453 • Contact@saraszpak.com
      https://saraszpak.com

      If you didn’t submit this enquiry, you can ignore this email.
      `.trim();

    const headers = {
      "Content-Type": "application/json",
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
    };

    const ownerPayload = {
      sender: { email: process.env.FROM_EMAIL, name: "Website Contact Form" },
      to: [
        {
          email: process.env.OWNER_EMAIL,
          name: process.env.OWNER_NAME || "Owner",
        },
      ],
      replyTo: { email, name },
      subject: `New enquiry: ${name}${occasion ? " – " + occasion : ""}`,
      htmlContent: ownerHtml,
      textContent: ownerText,
    };

    const clientPayload = {
      sender: {
        email: process.env.FROM_EMAIL,
        name: "Sara – Bridal Hair & Makeup",
      },
      to: [{ email, name }],
      subject: "We received your enquiry – thank you!",
      htmlContent: clientHtml,
      textContent: clientText,
    };

    const [r1, r2] = await Promise.all([
      fetch(BREVO_API, {
        method: "POST",
        headers,
        body: JSON.stringify(ownerPayload),
      }),
      fetch(BREVO_API, {
        method: "POST",
        headers,
        body: JSON.stringify(clientPayload),
      }),
    ]);

    if (!r1.ok) {
      const t = await r1.text();
      return wantsJson
        ? res
            .status(502)
            .json({ ok: false, error: "Owner email failed", details: t })
        : redirect303();
    }
    if (!r2.ok) {
      const t = await r2.text();
      return wantsJson
        ? res.status(502).json({
            ok: false,
            error: "Client autoresponse failed",
            details: t,
          })
        : redirect303();
    }

    return wantsJson ? res.status(200).json({ ok: true }) : redirect303();
  } catch (err) {
    return wantsJson
      ? res
          .status(500)
          .json({ ok: false, error: err?.message || "Server error" })
      : redirect303();
  }
}
