# Sara Szpak Makeup

Marketing website for Sara Szpak, a bridal hair and makeup artist based in South Wales.

The project is a static frontend served from `public/`, with lightweight serverless-style API handlers in `api/` for:

- contact form delivery through Brevo
- Google reviews fetch for homepage testimonials

## Project Structure

- `public/`
  Static HTML, CSS, JS, images, and public assets
- `scss/`
  Source styles compiled into `public/css/style.css`
- `api/`
  Backend handlers used locally by the custom dev server and in production on Vercel
- `scripts/dev-server.js`
  Local Node server for static files plus `/api/*`
- `docs/DEV.md`
  Development, env vars, deploy, and email setup notes
- `docs/TESTING.md`
  Current testing checklist and release verification notes

## Tech Stack

- HTML
- SCSS
- JavaScript
- Node.js 20
- Vercel
- Brevo Transactional Email
- Google Places API

## Local Development

Install dependencies:

```bash
npm install
```

Main local workflow:

```bash
npm run dev
```

This starts:

- SCSS watch mode
- local app server on `http://localhost:3000`

Available scripts:

- `npm run dev`
  Run SCSS watch and local app server together
- `npm run dev:css`
  Watch and compile SCSS only
- `npm run dev:app`
  Run the custom local app server only
- `npm run dev:serve`
  Static-only preview via `live-server` on port `5500`
- `npm run build:css`
  One-off SCSS build
- `npm run build`
  Placeholder command for Vercel compatibility

## Environment Variables

For local API testing, create `.env.local` in the project root:

```bash
BREVO_API_KEY=your_brevo_key
FROM_EMAIL=Contact@saraszpak.com
OWNER_EMAIL=saraszpak@hotmail.com
OWNER_NAME=Sara
GOOGLE_PLACES_API_KEY=your_google_places_key
GOOGLE_PLACE_ID=your_google_place_id
```

`scripts/dev-server.js` loads `.env.local` automatically when present.

## Contact Form

The contact form posts to `/api/contact` and supports:

- progressive enhancement with `fetch` when JavaScript is enabled
- normal form POST when JavaScript is disabled

On valid submit:

- one email is sent to the business owner
- one autoresponder is sent to the client
- the visitor is redirected to `/form-submitted.html`

Anti-spam currently includes:

- honeypot field
- client-side validation
- server-side validation

## Google Reviews

Homepage testimonials can be enriched from `/api/google-reviews`.

Current behavior:

- reviews are fetched from Google Places
- up to 5 reviews are returned
- frontend shuffles them before rotating
- if the API is unavailable, the site falls back to a built-in testimonial

## Deployment

The intended deployment target is Vercel.

Production model:

- static files served from `public/`
- API handlers served from `api/`
- environment variables configured in Vercel Project Settings

Before production release, verify:

1. homepage loads correctly
2. Google reviews endpoint works with production env vars
3. contact form sends both emails
4. redirect to `/form-submitted.html` works
5. SPF, DKIM, and DMARC pass in received mail headers

Detailed deployment and operational notes are in [docs/DEV.md](./docs/DEV.md).

## Testing

Current testing and sign-off checklist is in [docs/TESTING.md](./docs/TESTING.md).
