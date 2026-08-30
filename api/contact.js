// Purpose: Progressive enhancement handler for contact form.
// - Works with classic form POST (x-www-form-urlencoded) and AJAX (JSON).
// - On success: redirects with 303 See Other to ?redirect=/form-submitted.html
// - Honeypot submissions also redirect, silently.

import {
  getEnquiry,
  deleteValue,
  hasDurableStore,
  incrementWithWindow,
  linkMessage,
  saveEnquiry,
  setIfAbsent,
} from "./_contact-store.js";
import { createHash, randomUUID } from "node:crypto";

const BREVO_API = "https://api.brevo.com/v3/smtp/email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s().-]{7,20}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IDEMPOTENCY_RE = /^[a-zA-Z0-9_-]{16,100}$/;
const MAX_BODY_BYTES = 24 * 1024;
const RATE_WINDOW_SECONDS = 15 * 60;
const MAX_IP_SUBMISSIONS = 5;
const MAX_EMAIL_SUBMISSIONS = 3;
const FIELD_LIMITS = {
  name: 120,
  email: 254,
  phone: 30,
  occasion: 100,
  bookingFor: 100,
  eventDate: 10,
  manyServices: 100,
  location: 240,
  readyFor: 100,
  message: 4000,
};

// Small HTML escape for email output
function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  if (!ISO_DATE_RE.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return false;
  }

  const today = new Date();
  const todayIso = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
  return value >= todayIso;
}

async function sendBrevoEmail(payload, headers, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await fetch(BREVO_API, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      // A timed-out POST may already have reached Brevo. Retrying it could
      // produce a duplicate email, so ambiguous network failures are not retried.
      return { ok: false, status: 0, statusText: error?.name || "Network error" };
    }

    const responseText = await response.text().catch(() => "");
    let responseBody = {};
    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseBody = {};
    }

    if (response.ok) {
      return { ok: true, messageId: responseBody.messageId || null };
    }

    // A 429 means Brevo rejected the request before sending. It is safe to retry.
    if (response.status === 429 && attempt < maxAttempts) {
      const resetSeconds = Math.min(
        Math.max(Number(response.headers.get("x-sib-ratelimit-reset")) || attempt, 1),
        4,
      );
      await new Promise((resolve) => setTimeout(resolve, resetSeconds * 1000));
      continue;
    }

    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      details: responseBody.message || responseBody.code || "Brevo rejected the email",
    };
  }
}

async function parseBody(req) {
  const ctype = req.headers["content-type"] || "";
  const buf = await new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (ch) => {
      buf += ch;
      if (Buffer.byteLength(buf) > MAX_BODY_BYTES) {
        const error = new Error("Request body too large");
        error.statusCode = 413;
        reject(error);
      }
    });
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });

  if (ctype.includes("application/json")) {
    try {
      return JSON.parse(buf || "{}");
    } catch {
      return {};
    }
  }

  const params = new URLSearchParams(buf);
  return Object.fromEntries(params.entries());
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  return (forwarded.split(",")[0] || req.socket?.remoteAddress || "unknown").trim();
}

function rateKey(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function safeRedirect(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/form-submitted.html";
}

function publicError(res, status, error, fields) {
  const payload = { ok: false, error };
  if (fields) payload.fields = fields;
  return res.status(status).json(payload);
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
  const redirectTo = safeRedirect(url.searchParams.get("redirect"));

  function redirect303() {
    res.statusCode = 303;
    res.setHeader("Location", redirectTo);
    return res.end();
  }

  function formError(statusCode, title, message) {
    return sendHtmlError(res, statusCode, title, message, "/contact.html");
  }

  let submissionLockKey = null;
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
    const suppliedIdempotencyKey = String(
      req.headers["idempotency-key"] || body.idempotencyKey || "",
    ).trim();
    const idempotencyKey = suppliedIdempotencyKey ||
      (!wantsJson ? randomUUID() : "");

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

    const values = {
      name,
      email,
      phone,
      occasion,
      bookingFor,
      eventDate,
      manyServices,
      location,
      readyFor,
      message,
    };
    const tooLongFields = Object.entries(values)
      .filter(([field, value]) => value.length > FIELD_LIMITS[field])
      .map(([field]) => field);

    if (tooLongFields.length > 0) {
      return wantsJson
        ? publicError(res, 400, "Some fields are too long", tooLongFields)
        : formError(400, "Please check the form", "Some fields contain too much text.");
    }

    if (!IDEMPOTENCY_RE.test(idempotencyKey)) {
      return wantsJson
        ? publicError(res, 400, "Invalid submission identifier")
        : formError(400, "Please reload the form", "The form session is invalid. Please reload and try again.");
    }

    const existingEnquiry = await getEnquiry(idempotencyKey);
    if (existingEnquiry?.status === "complete") {
      return wantsJson ? res.status(200).json({ ok: true, duplicate: true }) : redirect303();
    }

    if (
      existingEnquiry?.contact &&
      JSON.stringify(existingEnquiry.contact) !== JSON.stringify(values)
    ) {
      return wantsJson
        ? publicError(res, 409, "Submission identifier was already used")
        : formError(409, "Please reload the form", "This form session was already used with different details.");
    }

    submissionLockKey = `contact:lock:${idempotencyKey}`;
    const acquiredLock = await setIfAbsent(
      submissionLockKey,
      "1",
      60,
    );
    if (!acquiredLock) {
      res.setHeader("Retry-After", "60");
      return wantsJson
        ? publicError(res, 409, "This submission is already being processed")
        : formError(409, "Message is being sent", "Please wait before trying again.");
    }

    const clientIp = getClientIp(req);
    if (!existingEnquiry) {
      const [ipCount, emailCount] = await Promise.all([
        incrementWithWindow(`contact:rate:ip:${rateKey(clientIp)}`, RATE_WINDOW_SECONDS),
        incrementWithWindow(
          `contact:rate:email:${rateKey(email.toLowerCase())}`,
          RATE_WINDOW_SECONDS,
        ),
      ]);

      if (ipCount > MAX_IP_SUBMISSIONS || emailCount > MAX_EMAIL_SUBMISSIONS) {
        res.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
        return wantsJson
          ? publicError(res, 429, "Too many submissions. Please try again in 15 minutes.")
          : formError(429, "Please wait", "Too many messages were sent recently. Please try again in 15 minutes.");
      }
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

    if (!hasDurableStore && process.env.REQUIRE_DURABLE_CONTACT_STORAGE === "true") {
      return wantsJson
        ? publicError(res, 503, "Contact storage is temporarily unavailable")
        : formError(503, "Message could not be saved", "Please contact Sara directly by email or WhatsApp.");
    }

    // OWNER EMAIL (HTML + TEXT)
    const ownerHtml = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">New enquiry from website</h2>
        <p style="color:#666;margin:0 0 16px">Use Reply in your email app to respond directly to the client.</p>
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

Use Reply in your email app to respond directly to the client.

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
      tags: ["website-enquiry", `enquiry-${idempotencyKey.slice(0, 24)}`],
    };

    const clientPayload = {
      sender: {
        email: process.env.FROM_EMAIL,
        name: "Venus Hour – Bridal Hair & Makeup",
      },
      to: [{ email, name }],
      replyTo: {
        email: process.env.OWNER_EMAIL,
        name: process.env.OWNER_NAME || "Venus Hour",
      },
      subject: "We received your enquiry – thank you!",
      htmlContent: clientHtml,
      textContent: clientText,
      tags: ["website-autoreply", `enquiry-${idempotencyKey.slice(0, 24)}`],
    };

    const enquiry = existingEnquiry || {
      id: idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "saved",
      contact: values,
      ownerEmail: { status: "pending", messageId: null },
      clientEmail: { status: "pending", messageId: null },
    };
    await saveEnquiry(enquiry);

    let ownerResult = { ok: true, messageId: enquiry.ownerEmail?.messageId || null };
    if (enquiry.ownerEmail?.status !== "accepted") {
      ownerResult = await sendBrevoEmail(ownerPayload, headers);
    }

    if (!ownerResult.ok) {
      enquiry.ownerEmail = {
        status: "failed",
        error: ownerResult.statusText || "Brevo rejected the email",
      };
      enquiry.status = "owner-email-failed";
      enquiry.updatedAt = new Date().toISOString();
      await saveEnquiry(enquiry);
      console.error("Brevo owner email failed", {
        status: ownerResult.status,
        statusText: ownerResult.statusText,
        details: ownerResult.details,
        enquiryId: enquiry.id,
      });

      return wantsJson
        ? publicError(res, 502, "The message could not be sent. Please try again.")
        : formError(
            502,
            "Message could not be sent",
            "The email service did not accept the message. Please try again or contact Sara directly by email or WhatsApp.",
          );
    }

    enquiry.ownerEmail = {
      status: "accepted",
      messageId: ownerResult.messageId,
    };
    enquiry.status = "owner-email-accepted";
    enquiry.updatedAt = new Date().toISOString();
    await saveEnquiry(enquiry);
    await linkMessage(ownerResult.messageId, enquiry.id, "owner");

    let clientResult = { ok: true, messageId: enquiry.clientEmail?.messageId || null };
    if (enquiry.clientEmail?.status !== "accepted") {
      clientResult = await sendBrevoEmail(clientPayload, headers);
    }

    if (!clientResult.ok) {
      enquiry.clientEmail = {
        status: "failed",
        error: clientResult.statusText || "Brevo rejected the email",
      };
      enquiry.status = "client-email-failed";
      enquiry.updatedAt = new Date().toISOString();
      await saveEnquiry(enquiry);
      console.error("Brevo client autoresponse failed", {
        status: clientResult.status,
        statusText: clientResult.statusText,
        details: clientResult.details,
        enquiryId: enquiry.id,
      });

      return wantsJson
        ? publicError(res, 502, "Your message was saved, but confirmation could not be sent. Please try again.")
        : formError(
            502,
            "Message could not be sent",
            "The confirmation email could not be sent. Please try again or contact Sara directly by email or WhatsApp.",
          );
    }

    enquiry.clientEmail = {
      status: "accepted",
      messageId: clientResult.messageId,
    };
    enquiry.status = "complete";
    enquiry.updatedAt = new Date().toISOString();
    await saveEnquiry(enquiry);
    await linkMessage(clientResult.messageId, enquiry.id, "client");

    return wantsJson
      ? res.status(200).json({ ok: true, enquiryId: enquiry.id })
      : redirect303();
  } catch (err) {
    const statusCode = err?.statusCode || 500;
    return wantsJson
      ? res
          .status(statusCode)
          .json({ ok: false, error: statusCode === 413 ? "Request too large" : "Server error" })
      : formError(
          statusCode,
          "Message could not be sent",
          "Something went wrong while sending the message. Please try again or contact Sara directly by email or WhatsApp.",
        );
  } finally {
    if (submissionLockKey) {
      await deleteValue(submissionLockKey).catch((error) => {
        console.error("Contact submission lock cleanup failed", {
          message: error?.message,
        });
      });
    }
  }
}
