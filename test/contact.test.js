import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

process.env.BREVO_API_KEY = "test-key";
process.env.FROM_EMAIL = "website@example.com";
process.env.OWNER_EMAIL = "owner@example.com";
process.env.OWNER_NAME = "Owner";

const { default: contactHandler } = await import("../api/contact.js");

function request(
  payload,
  id,
  url = "/api/contact?redirect=/form-submitted.html",
  ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
) {
  const req = Readable.from([JSON.stringify(payload)]);
  req.method = "POST";
  req.url = url;
  req.headers = {
    host: "example.com",
    accept: "application/json",
    "content-type": "application/json",
    "idempotency-key": id,
    "x-forwarded-for": ip,
  };
  req.socket = { remoteAddress: "203.0.113.1" };
  return req;
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end(value) { this.body = value ?? this.body; return this; },
  };
}

function validPayload(overrides = {}) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    name: "Test Client",
    email: "client@example.com",
    phone: "+44 7783 109 453",
    occasion: "Wedding",
    bookingFor: "Bride",
    eventDate: tomorrow,
    manyServices: "2",
    location: "Newport",
    readyFor: "12:00",
    message: "Test enquiry",
    ...overrides,
  };
}

test("sends owner email and autoresponder with correct Reply-To headers", async () => {
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ messageId: `message-${calls.length}` }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  const res = response();
  await contactHandler(request(validPayload(), "submission-test-0001"), res);

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].replyTo.email, "client@example.com");
  assert.equal(calls[1].replyTo.email, "owner@example.com");
});

test("same completed idempotency key does not send duplicate emails", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ messageId: `unexpected-${calls}` }), { status: 201 });
  };

  const res = response();
  await contactHandler(request(validPayload(), "submission-test-0001"), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.duplicate, true);
  assert.equal(calls, 0);
});

test("partial failure retry sends only the missing autoresponder", async () => {
  const calls = [];
  let failClientOnce = true;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload);
    if (payload.to[0].email === "partial@example.com" && failClientOnce) {
      failClientOnce = false;
      return new Response(JSON.stringify({ message: "temporary rejection" }), {
        status: 503,
        statusText: "Service Unavailable",
      });
    }
    return new Response(JSON.stringify({ messageId: `partial-${calls.length}` }), {
      status: 201,
    });
  };

  const payload = validPayload({ email: "partial@example.com" });
  const first = response();
  await contactHandler(request(payload, "partial-submission-001"), first);
  assert.equal(first.statusCode, 502);
  assert.equal(calls.length, 2);

  const retry = response();
  await contactHandler(request(payload, "partial-submission-001"), retry);
  assert.equal(retry.statusCode, 200);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].to[0].email, "partial@example.com");
});

test("rejects impossible and past dates on the server", async () => {
  for (const eventDate of ["2026-02-31", "2020-01-01"]) {
    const res = response();
    await contactHandler(
      request(validPayload({ eventDate }), `invalid-date-${eventDate}`),
      res,
    );
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, "Invalid preferred date");
  }
});

test("does not expose an external redirect", async () => {
  const formReq = Readable.from(["hp_company=bot"]);
  formReq.method = "POST";
  formReq.url = "/api/contact?redirect=//evil.example";
  formReq.headers = {
    host: "example.com",
    accept: "text/html",
    "content-type": "application/x-www-form-urlencoded",
  };
  formReq.socket = { remoteAddress: "203.0.113.1" };
  const res = response();

  await contactHandler(formReq, res);
  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.location, "/form-submitted.html");
});

test("limits new submissions from one IP", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ messageId: crypto.randomUUID() }), { status: 201 });

  for (let index = 1; index <= 5; index += 1) {
    const res = response();
    await contactHandler(
      request(
        validPayload({ email: `rate-${index}@example.com` }),
        `rate-submission-000${index}`,
        "/api/contact",
        "198.51.100.55",
      ),
      res,
    );
    assert.equal(res.statusCode, 200);
  }

  const limited = response();
  await contactHandler(
    request(
      validPayload({ email: "rate-6@example.com" }),
      "rate-submission-0006",
      "/api/contact",
      "198.51.100.55",
    ),
    limited,
  );
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers["retry-after"], "900");
});
