import {
  getEnquiry,
  getMessageLink,
  hasDurableStore,
  saveEnquiry,
} from "./_contact-store.js";

const FAILURE_EVENTS = new Set([
  "hard_bounce",
  "hardBounce",
  "blocked",
  "spam",
  "invalid",
  "error",
]);

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > 64 * 1024) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false });
  }

  const expectedSecret = process.env.BREVO_WEBHOOK_SECRET || "";
  const suppliedSecret = String(req.headers["x-brevo-webhook-secret"] || "");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return res.status(401).json({ ok: false });
  }

  if (!hasDurableStore) {
    return res.status(503).json({ ok: false, error: "Storage unavailable" });
  }

  try {
    const events = await readJson(req);
    const list = Array.isArray(events) ? events : [events];

    for (const event of list) {
      const messageId = event["message-id"] || event.messageId || "";
      const link = await getMessageLink(messageId);
      if (!link) continue;

      const enquiry = await getEnquiry(link.enquiryId);
      if (!enquiry) continue;

      const eventName = String(event.event || event.msg_status || "unknown");
      const target = link.recipientType === "owner" ? "ownerEmail" : "clientEmail";
      enquiry[target] = {
        ...enquiry[target],
        deliveryStatus: eventName,
        deliveryUpdatedAt: new Date().toISOString(),
        failureReason: FAILURE_EVENTS.has(eventName)
          ? String(event.reason || event.message || event.response || "Delivery failed").slice(0, 500)
          : null,
      };
      enquiry.updatedAt = new Date().toISOString();
      await saveEnquiry(enquiry);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Brevo webhook failed", { message: error?.message });
    return res.status(400).json({ ok: false });
  }
}
