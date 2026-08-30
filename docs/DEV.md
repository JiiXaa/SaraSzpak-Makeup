# Development Notes

## Scripts

Project scripts from `package.json`:

- `npm run dev`
  Starts both the SCSS watcher and the local Node dev server.
- `npm run dev:css`
  Watches `scss/main.scss` and rebuilds `public/css/style.css` on every change.
- `npm run dev:app`
  Starts the custom local server from `scripts/dev-server.js` on port `3000`.
  This server serves static files from `public/` and the contact, Brevo webhook,
  and Google Reviews API routes from `api/`.
  It now loads `.env.local` automatically when the file exists.
- `npm run dev:serve`
  Starts `live-server` on port `5500` for static-only preview.
  Use this only for visual checks of static pages and styles.
  Do not use it for contact form or Google reviews API testing.
- `npm run build:css`
  One-off SCSS build to `public/css/style.css`.
- `npm run build`
  Runs `npm run build:css` and writes the compiled stylesheet to
  `public/css/style.css`. Vercel uses this as the project build command.
- `npm run start`
  Placeholder only. Production runtime on Vercel is handled by static hosting plus `/api/*`.

## Local Development

Recommended local flow:

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/` for the full local app
- `http://localhost:3000/api/google-reviews?limit=5` to inspect the reviews endpoint

Important:

- `npm run dev` is the correct command when you need both frontend and local API routes.
- `npm run dev:serve` uses `live-server` and does not run `api/contact` or `api/google-reviews`.
- The contact form uses progressive enhancement:
  with JavaScript it submits with `fetch`,
  without JavaScript it still posts to `/api/contact`.

## Local Environment Variables

For local API testing create `.env.local` in the project root.

Required for contact email delivery:

```bash
BREVO_API_KEY=your_brevo_key
FROM_EMAIL=verified-sender@example.com
OWNER_EMAIL=business-inbox@example.com
OWNER_NAME=Business Name
```

Required for durable contact storage and global rate limiting:

```bash
KV_REST_API_URL=https://your-database.upstash.io
KV_REST_API_TOKEN=your_upstash_token
```

Recommended production safety switch after storage has been verified:

```bash
REQUIRE_DURABLE_CONTACT_STORAGE=true
```

Required only when the Brevo delivery webhook is configured:

```bash
BREVO_WEBHOOK_SECRET=generate-a-long-random-secret
```

Required for live Google reviews:

```bash
GOOGLE_PLACES_API_KEY=your_google_places_key
GOOGLE_PLACE_ID=your_google_place_id
```

Behavior without env vars:

- `/api/google-reviews` returns an empty `reviews` array when Google config is missing.
- `/api/contact` needs Brevo env vars to actually send emails.
- without Redis credentials, `/api/contact` uses process memory unless
  `REQUIRE_DURABLE_CONTACT_STORAGE=true`, in which case it returns `503` before sending;
- without `BREVO_WEBHOOK_SECRET`, `/api/brevo-webhook` rejects every request
  and accepted messages are not promoted to final delivery statuses in Upstash.

If you want to call Google APIs directly from terminal, first export env vars manually:

```bash
export $(grep -v '^#' .env.local | xargs)
```

## Google Reviews

The homepage testimonial rotator fetches reviews from `/api/google-reviews?limit=5`.

Notes:

- Google Place Details returns up to 5 reviews.
- These are Google-selected reviews, not guaranteed latest reviews.
- The frontend shuffles the returned reviews before rotating them.
- If the endpoint fails or returns no data, the homepage keeps the hardcoded fallback testimonial.

### Find Google Place ID

```bash
curl -X POST "https://places.googleapis.com/v1/places:searchText" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
  -H "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress" \
  -d '{
    "textQuery": "Sara Szpak Makeup Artist Newport"
  }'
```

Use `places[0].id` as `GOOGLE_PLACE_ID`.

### Check Google Reviews Response

```bash
curl "https://places.googleapis.com/v1/places/$GOOGLE_PLACE_ID" \
  -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
  -H "X-Goog-FieldMask: id,displayName,reviews"
```

Readable version:

```bash
curl -s "https://places.googleapis.com/v1/places/$GOOGLE_PLACE_ID" \
  -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
  -H "X-Goog-FieldMask: reviews" | jq '.reviews // [] | map({author: .authorAttribution.displayName, text: .text.text, rating: .rating})'
```

## Contact Form and Email Flow

`/api/contact` accepts `POST` only and supports:

- classic form submission with `application/x-www-form-urlencoded`
- AJAX submission with `application/json`

Current behavior:

- required backend fields: all fields visible in the form
- honeypot field: `company` / `hp_company`
- success redirect: `/form-submitted.html`
- owner email goes to `OWNER_EMAIL`
- autoresponder goes to the client email address
- `Reply-To` is set to the client, so Sara can reply directly
- `Reply-To` on the autoresponder is set to `OWNER_EMAIL`
- JavaScript submissions reuse one submission ID after a partial failure,
  preventing duplicate owner emails during an in-page retry
- enquiry and sending state are retained for 365 days when Upstash is configured;
  final delivery state is added only by a configured Brevo webhook

### Contact storage and rate limiting

Create one free Upstash Redis database through Vercel Marketplace and connect it
to this project. Depending on the integration version, Vercel provides
`KV_REST_API_URL` and `KV_REST_API_TOKEN` or the equivalent
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The code accepts both.
Set `REQUIRE_DURABLE_CONTACT_STORAGE=true` in Preview and Production only after
a real submission has confirmed that records appear in Upstash. Without the
switch, configured Redis is still used; the switch only disables the
non-durable memory fallback.

The store is used for:

- a durable copy of every validated enquiry before email sending starts;
- idempotency and continuation after a partial failure;
- limits of 5 new submissions per IP and 3 per email address per 15 minutes;
- Brevo API acceptance status, plus final delivery/bounce status when the webhook is configured.

Without Upstash, local development uses process memory. That fallback is not
durable and is not a global rate limiter across Vercel instances.

### View saved enquiry history in Upstash

Upstash contains form submissions, not a copy of the Outlook mailbox or later
email replies. Only enquiries submitted after Redis was connected to the active
Vercel environment can appear here.

Dashboard steps:

1. Open the `sara-szpak-makeup` project in Vercel.
2. Open **Storage** and select the connected Upstash Redis resource.
3. Choose **Open in Upstash**, then open **Data Browser** or **Data**.
4. Search for keys beginning with `contact:enquiry:`.
5. Select a key to view its JSON value, including `contact`, `ownerEmail`,
   `clientEmail`, `createdAt`, `updatedAt`, and the overall `status`.

The sorted set `contact:enquiries` is the chronological index. In the Upstash
Redis console, list enquiry IDs from newest to oldest with:

```text
ZRANGE contact:enquiries 0 -1 REV
```

Then retrieve one record with:

```text
GET contact:enquiry:<ID_FROM_THE_LIST>
```

Related keys:

- `contact:enquiry:<id>` — full form data and sending/delivery states;
- `contact:message:<brevo-message-id>` — maps a Brevo message to an enquiry;
- `contact:enquiries` — chronological enquiry index;
- `contact:rate:*` — temporary hashed rate-limit counters;
- `contact:lock:*` — very short-lived concurrent-submission locks.

Important status meanings:

- `saved` — the enquiry was stored before email sending;
- `owner-email-accepted` — Brevo accepted the owner email, but the autoresponder
  is not complete yet;
- `client-email-failed` — the owner email was accepted but the autoresponder failed;
- `complete` — Brevo accepted both API requests;
- `ownerEmail.status` / `clientEmail.status` equal to `accepted` do not prove
  final inbox delivery;
- `deliveryStatus: delivered` appears only after the Brevo webhook is configured
  and successfully matches the Brevo message ID.

If no `contact:enquiry:*` keys appear after a new successful form submission:

1. confirm `KV_REST_API_URL` and the writable `KV_REST_API_TOKEN` apply to the
   same Vercel environment as the deployment being tested;
2. redeploy after changing environment variables;
3. submit one new enquiry, because older emails are not imported retroactively;
4. inspect Vercel Function logs for `Contact store returned HTTP ...`;
5. leave `REQUIRE_DURABLE_CONTACT_STORAGE` disabled until storage is confirmed,
   then enable it to prevent future email sends without a durable backup.

### Brevo delivery webhook

Create a transactional webhook in Brevo pointing to:

```text
https://YOUR_DOMAIN/api/brevo-webhook
```

Subscribe it to `delivered`, `deferred`, `softBounce`, `hardBounce`, `blocked`,
`spam`, `invalid`, and `error`. Configure this custom request header in Brevo:

```text
X-Brevo-Webhook-Secret: the same value as BREVO_WEBHOOK_SECRET
```

When both the secret and the Brevo webhook are configured, the endpoint records
the latest real delivery event against the saved enquiry. An API acceptance is
stored as `accepted`; only webhook events change it to `delivered` or a
bounce/block status.

Expected Brevo result after one valid submission:

- 1 email to owner with enquiry details
- 1 autoresponder email to client

## Preview and Production on Vercel

Set these variables in Vercel for both Preview and Production:

- `BREVO_API_KEY`
- `FROM_EMAIL`
- `OWNER_EMAIL`
- `OWNER_NAME`
- `KV_REST_API_URL` (or `UPSTASH_REDIS_REST_URL`)
- `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_TOKEN`)
- `REQUIRE_DURABLE_CONTACT_STORAGE` (recommended after Redis verification)
- `BREVO_WEBHOOK_SECRET` (only with a configured Brevo webhook)
- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_PLACE_ID`

Basic verification after deploy:

1. Open `/`
2. Confirm homepage loads and testimonial rotator still renders
3. Open `/contact.html`
4. Submit the form with a real email
5. Confirm redirect to `/form-submitted.html`
6. Check Brevo transactional logs
7. Verify owner email and autoresponder were both sent

## Email Deliverability Checks

In the received email source check:

- SPF: PASS
- DKIM: PASS
- DMARC: PASS
- `From`: exact verified sender configured in `FROM_EMAIL`
- `Reply-To`: client email from the form

If DNS changes were made recently, wait 15 to 60 minutes and retest.

After the mailbox setup is stable, consider tightening DMARC:

- `p=none` -> `p=quarantine`
- `p=reject` only if you are confident all senders are configured correctly

## Brevo Tracking Domain

Optional but recommended for production emails.

Suggested setup:

- subdomain: `link.saraszpak.com`
- DNS type: `CNAME`
- target: value provided by Brevo

Then in Brevo:

1. Open `Settings -> Senders & Domains -> Domains`
2. Select `saraszpak.com`
3. Verify tracking domain is active
4. Enable the custom tracking domain if Brevo shows a toggle

## Anti-Spam

Currently implemented:

- honeypot input named `company`
- client-side validation and submission locking in `public/js/contact.js`
- server-side validation in `api/contact.js`
- IP and email rate limiting through Upstash
- idempotent continuation after partial sending failures

CAPTCHA is intentionally not used.

## Google Reviews cache and billing

`/api/google-reviews` sends a 12-hour CDN cache header, with 24 hours of stale
content allowed while refreshing. Error fallbacks are cached for 5 minutes.
These directives are intended to prevent a separate billable Google Places
request for every homepage view; verify the effective CDN response headers after
deployment.

## Production status (2026-08-30)

- commit `e4ffef5` was deployed from `main`;
- the current contact JavaScript and safe local redirect were confirmed on the
  production domain;
- a honeypot POST returned `303` without sending email;
- Upstash `KV_*` variables were connected to Preview and Production according
  to the deployment setup;
- live owner email and client autoresponder were reported working;
- `REQUIRE_DURABLE_CONTACT_STORAGE` and the Brevo delivery webhook were not yet
  confirmed as enabled;
- `/api/google-reviews` returned the built-in fallback during the deployment
  smoke check, so live Google reviews still need a separate configuration check.
