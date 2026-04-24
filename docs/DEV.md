# Development Notes

## Scripts

Project scripts from `package.json`:

- `npm run dev`
  Starts both the SCSS watcher and the local Node dev server.
- `npm run dev:css`
  Watches `scss/main.scss` and rebuilds `public/css/style.css` on every change.
- `npm run dev:app`
  Starts the custom local server from `scripts/dev-server.js` on port `3000`.
  This server serves static files from `public/` and local API routes from `api/`.
  It now loads `.env.local` automatically when the file exists.
- `npm run dev:serve`
  Starts `live-server` on port `5500` for static-only preview.
  Use this only for visual checks of static pages and styles.
  Do not use it for contact form or Google reviews API testing.
- `npm run build:css`
  One-off SCSS build to `public/css/style.css`.
- `npm run build`
  Placeholder only. There is no build pipeline for the site itself.
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

Required variables:

```bash
BREVO_API_KEY=your_brevo_key
FROM_EMAIL=Contact@saraszpak.com
OWNER_EMAIL=saraszpak@hotmail.com
OWNER_NAME=Sara
GOOGLE_PLACES_API_KEY=your_google_places_key
GOOGLE_PLACE_ID=your_google_place_id
```

Behavior without env vars:

- `/api/google-reviews` returns an empty `reviews` array when Google config is missing.
- `/api/contact` needs Brevo env vars to actually send emails.

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

- required backend fields: `name`, `email`, `message`
- honeypot field: `company` / `hp_company`
- success redirect: `/form-submitted.html`
- owner email goes to `OWNER_EMAIL`
- autoresponder goes to the client email address
- `Reply-To` is set to the client, so Sara can reply directly

Expected Brevo result after one valid submission:

- 1 email to owner with enquiry details
- 1 autoresponder email to client

## Preview and Production on Vercel

Set these variables in Vercel for both Preview and Production:

- `BREVO_API_KEY`
- `FROM_EMAIL`
- `OWNER_EMAIL`
- `OWNER_NAME`
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
- `From`: `Contact@saraszpak.com`
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
- client-side validation in `public/js/contact-validate.js`
- server-side validation in `api/contact.js`

Not implemented in code:

- Cloudflare Turnstile

If Turnstile is added later, document it separately after implementation.
