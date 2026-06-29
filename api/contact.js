// Purpose: Progressive enhancement handler for contact form.
// - Works with classic form POST (x-www-form-urlencoded) and AJAX (JSON).
// - On success: redirects with 303 See Other to ?redirect=/form-submitted.html
// - Honeypot submissions also redirect, silently.

const BREVO_API = "https://api.brevo.com/v3/smtp/email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s().-]{7,20}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Small HTML escape for email output
function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mailto(email, subject, body = "") {
  const query = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${encodeURIComponent(email)}?${query.toString()}`;
}

function sendHtmlError(
  res,
  statusCode,
  title,
  message,
  backUrl = "/contact.html",
) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)} | Venus Hour</title>
    <link rel="stylesheet" href="/css/style.css">
  </head>
  <body>
    <main class="form-submitted__wrapper" style="min-height:100vh">
      <h1>${esc(title)}</h1>
      <p>${esc(message)}</p>
      <a class="btn-custom" href="${esc(backUrl)}">Back to contact form</a>
    </main>
  </body>
</html>`);
}

function isValidEventDate(value) {
  if (!value) return true;
  if (!ISO_DATE_RE.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

async function sendBrevoEmail(payload, headers) {
  const response = await fetch(BREVO_API, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return { ok: true };
  }

  const details = await response.text().catch(() => "");

  return {
    ok: false,
    status: response.status,
    statusText: response.statusText,
    details,
  };
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

  function formError(statusCode, title, message) {
    return sendHtmlError(res, statusCode, title, message, "/contact.html");
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
    const bookingFor = (body.bookingFor || "").trim();
    const eventDate = (body.eventDate || "").trim();
    const manyServices = (body.manyServices || "").trim();
    const location = (body.location || "").trim();
    const readyFor = (body.readyFor || "").trim();
    const message = (body.message || body["your-message"] || "").trim();

    const missingFields = [
      ["name", name],
      ["email", email],
      ["phone", phone],
      ["occasion", occasion],
      ["bookingFor", bookingFor],
      ["eventDate", eventDate],
      ["manyServices", manyServices],
      ["location", location],
      ["readyFor", readyFor],
      ["message", message],
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field);

    if (missingFields.length > 0) {
      return wantsJson
        ? res.status(400).json({
            ok: false,
            error: "Missing fields",
            fields: missingFields,
          })
        : formError(
            400,
            "Please check the form",
            `Some required fields are missing: ${missingFields.join(", ")}. Please go back and complete the form.`,
          );
    }
    if (!EMAIL_RE.test(email)) {
      return wantsJson
        ? res.status(400).json({ ok: false, error: "Invalid email" })
        : formError(
            400,
            "Please check your email",
            "The email address does not look valid. Please go back and correct it.",
          );
    }
    if (!PHONE_RE.test(phone)) {
      return wantsJson
        ? res.status(400).json({ ok: false, error: "Invalid phone" })
        : formError(
            400,
            "Please check your phone number",
            "The phone number does not look valid. Please go back and correct it.",
          );
    }
    if (!isValidEventDate(eventDate)) {
      return wantsJson
        ? res.status(400).json({ ok: false, error: "Invalid preferred date" })
        : formError(
            400,
            "Please check your preferred date",
            "The preferred date does not look valid. Please go back and correct it.",
          );
    }

    const missingConfig = [
      ["BREVO_API_KEY", process.env.BREVO_API_KEY],
      ["FROM_EMAIL", process.env.FROM_EMAIL],
      ["OWNER_EMAIL", process.env.OWNER_EMAIL],
    ]
      .filter(([, value]) => !String(value || "").trim())
      .map(([key]) => key);

    if (missingConfig.length > 0) {
      const error = `Email sending is not configured: missing ${missingConfig.join(", ")}`;

      return wantsJson
        ? res.status(500).json({ ok: false, error })
        : formError(
            500,
            "Message could not be sent",
            "Email sending is not configured correctly. Please contact Sara directly by email or WhatsApp.",
          );
    }

    // OWNER EMAIL (HTML + TEXT)
    const replySubject = `Re: Your enquiry to Venus Hour`;
    const replyBody = `Hi ${name},\n\n`;
    const replyLink = mailto(email, replySubject, replyBody);

    const ownerHtml = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">New enquiry from website</h2>
        <p style="margin:0 0 16px">
          <a href="${esc(replyLink)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:4px;padding:11px 16px;font-weight:700">
            Reply to client
          </a>
        </p>
        <p style="color:#666;margin:0 0 16px">Use the button above to start a clean email to the client. Avoid normal “Reply” if you do not want the enquiry details below to be quoted.</p>
        <table style="border-collapse:collapse;width:100%;max-width:640px">
          <tbody>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Name</strong></td><td style="padding:8px;border:1px solid #eee">${esc(name)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Email</strong></td><td style="padding:8px;border:1px solid #eee">${esc(email)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Phone</strong></td><td style="padding:8px;border:1px solid #eee">${esc(phone) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Occasion</strong></td><td style="padding:8px;border:1px solid #eee">${esc(occasion) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Booking for</strong></td><td style="padding:8px;border:1px solid #eee">${esc(bookingFor) || "—"}</td></tr>
            ${
              eventDate
                ? `<tr><td style="padding:8px;border:1px solid #eee"><strong>Preferred date</strong></td><td style="padding:8px;border:1px solid #eee">${esc(eventDate)}</td></tr>`
                : ""
            }
            <tr><td style="padding:8px;border:1px solid #eee"><strong>People requiring services</strong></td><td style="padding:8px;border:1px solid #eee">${esc(manyServices) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Venue Location</strong></td><td style="padding:8px;border:1px solid #eee">${esc(location) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee"><strong>Ready by</strong></td><td style="padding:8px;border:1px solid #eee">${esc(readyFor) || "—"}</td></tr>
            <tr><td style="padding:8px;border:1px solid #eee;vertical-align:top"><strong>Plans</strong></td><td style="padding:8px;border:1px solid #eee;white-space:pre-wrap">${esc(message)}</td></tr>
          </tbody>
        </table>
      </div>
    `;

    const ownerText = `New enquiry from website

Reply to client:
${replyLink}

Use this link to start a clean email to the client. Avoid normal Reply if you do not want the enquiry details below to be quoted.

Name: ${name}
Email: ${email}
Phone: ${phone || "—"}
Occasion: ${occasion || "—"}
Booking for: ${bookingFor || "—"}
${
  eventDate
    ? `Preferred date: ${eventDate}
`
    : ""
}People requiring services: ${manyServices || "—"}
Venue Location: ${location || "—"}
Ready by: ${readyFor || "—"}

Plans:
${message}
`.trim();

    // CLIENT AUTOREPLY (HTML + TEXT)
    const clientHtml = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px">Thank you, ${esc(name)}!</h2>
        <p>We’ve received your enquiry and will get back to you within <strong>24 hours</strong>.</p>

        <p>If your date is time-sensitive, you can also reach us here:</p>
        <ul style="margin:0 0 12px 20px">
          <li>Instagram: @venushourbeauty</li>
          <li>WhatsApp: +44 7783 109 453</li>
          <li>Website: <a href="https://venus-hour.co.uk" target="_blank" rel="noopener">venus-hour.co.uk</a></li>
          <li>Email: hello@venus-hour.co.uk</li>
        </ul>

        <p style="margin-top:16px">Warmly,<br>Venus Hour – Bridal Hair & Makeup</p>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <div style="font-size:13px;color:#666;line-height:1.5">
          <div><strong>Venus Hour — Bridal Hair & Makeup</strong></div>
          <div>Newport, South Wales • +44 7783 109 453 • hello@venus-hour.co.uk</div>
          <div><a href="https://venus-hour.co.uk" target="_blank" rel="noopener" style="color:#666;text-decoration:underline">https://venus-hour.co.uk</a></div>
          <div style="margin-top:8px">If you didn’t submit this enquiry, you can ignore this email.</div>
        </div>
      </div>
    `;

    const clientText = `Thank you, ${name}!
      We’ve received your enquiry and will get back to you within 24 hours.

      If your date is time-sensitive, you can also reach us here:
      - Instagram: @venushourbeauty
      - WhatsApp: +44 7783 109 453
      - Website: https://venus-hour.co.uk
      - Email: hello@venus-hour.co.uk

      Warmly,
      Sara Szpak

      Venus Hour — Bridal Hair & Makeup
      Newport, South Wales • +44 7783 109 453 • hello@venus-hour.co.uk
      https://venus-hour.co.uk

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
        name: "Venus Hour – Bridal Hair & Makeup",
      },
      to: [{ email, name }],
      subject: "We received your enquiry – thank you!",
      htmlContent: clientHtml,
      textContent: clientText,
    };

    const ownerResult = await sendBrevoEmail(ownerPayload, headers);

    if (!ownerResult.ok) {
      console.error("Brevo owner email failed", {
        status: ownerResult.status,
        statusText: ownerResult.statusText,
        details: ownerResult.details,
        sender: process.env.FROM_EMAIL,
        ownerEmail: process.env.OWNER_EMAIL,
        hasReplyTo: Boolean(email),
      });

      return wantsJson
        ? res.status(502).json({
            ok: false,
            error: "Owner email failed",
            details: ownerResult.details,
          })
        : formError(
            502,
            "Message could not be sent",
            "The email service did not accept the message. Please try again or contact Sara directly by email or WhatsApp.",
          );
    }

    const clientResult = await sendBrevoEmail(clientPayload, headers);

    if (!clientResult.ok) {
      console.error("Brevo client autoresponse failed", {
        status: clientResult.status,
        statusText: clientResult.statusText,
        details: clientResult.details,
        sender: process.env.FROM_EMAIL,
        clientEmail: email,
      });

      return wantsJson
        ? res.status(502).json({
            ok: false,
            error: "Client autoresponse failed",
            details: clientResult.details,
          })
        : formError(
            502,
            "Message could not be sent",
            "The confirmation email could not be sent. Please try again or contact Sara directly by email or WhatsApp.",
          );
    }

    return wantsJson ? res.status(200).json({ ok: true }) : redirect303();
  } catch (err) {
    return wantsJson
      ? res
          .status(500)
          .json({ ok: false, error: err?.message || "Server error" })
      : formError(
          500,
          "Message could not be sent",
          "Something went wrong while sending the message. Please try again or contact Sara directly by email or WhatsApp.",
        );
  }
}
