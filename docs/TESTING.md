# Testing

## Current Status

This file documents the testing approach for the current codebase.
It intentionally avoids claiming checks that were not re-run against the current implementation.

## Verified From Code / Local Commands

The following was verified directly against the repository:

- static pages are served from `public/`
- local API routes exist for contact submission, Brevo webhooks, and Google reviews
- local development uses `scripts/dev-server.js`
- SCSS builds successfully with `npm run build:css`
- `npm run build` compiles SCSS to `public/css/style.css`
- contact handler regression tests pass with `npm test`

## Manual Testing Checklist

Run these checks before client sign-off and before production deploy.

### Navigation and Pages

- Open `/`, `/portfolio.html`, `/services.html`, `/rates.html`, `/contact.html`
- Verify all top navigation links work
- Verify mobile menu opens and closes correctly
- Verify external social links open correctly
- Verify `404.html` is shown for invalid routes in local dev

### Testimonials / Google Reviews

- Open homepage with Google env vars configured
- Confirm testimonials render
- Confirm reviews rotate without layout jump
- Confirm fallback testimonial still renders if `/api/google-reviews` returns no reviews
- Check `/api/google-reviews?limit=5` returns JSON with `ok` and `reviews`

### Contact Form

- Submit empty form and confirm validation blocks submission
- Submit invalid email and confirm validation error
- Submit valid form and confirm redirect to `/form-submitted.html`
- Confirm owner email is sent through Brevo
- Confirm autoresponder email is sent to the client
- Confirm honeypot submissions do not send emails
- Confirm repeated clicks produce only one owner email
- Confirm a failed autoresponder can be retried without duplicating the owner email
- Confirm the sixth new enquiry from one IP inside 15 minutes returns HTTP 429
- Confirm Upstash contains the enquiry and both message states
- If the webhook is configured, confirm it updates `deliveryStatus`

### Responsive Check

- Review homepage and contact form on mobile width
- Review main service pages on tablet width
- Review homepage, portfolio, rates, and contact on desktop width
- Confirm no major overflow, broken images, or layout collapse

## What Is Not Covered Automatically

There are automated handler tests for the contact flow, including Reply-To,
idempotency, partial failure recovery, date validation, redirect safety, and IP
rate limiting. Browser end-to-end tests and live Brevo/Upstash integration tests
remain manual.

That means release confidence depends on:

- manual browser checks
- a real contact form submission in the target deployment environment
- verification of Brevo and Google API configuration

## Recommended Release Pass

Prefer a clean Preview deployment before Production. If deploying directly to
Production, perform the same checks immediately after deployment:

1. homepage loads correctly
2. Google reviews work with production env vars
3. contact form sends both emails
4. redirect to confirmation page works
5. email headers show SPF, DKIM, and DMARC pass

## Production smoke check (2026-08-30)

- production served the new idempotent `contact.js`;
- a honeypot POST returned `303` and redirected locally to
  `/form-submitted.html` without sending email;
- the owner email and client autoresponder were reported working in a live test;
- the Google Reviews endpoint returned `{ "fallback": true }` during the check;
- Upstash record creation and Brevo webhook delivery events still require
  explicit confirmation in their provider dashboards.

## Notes

- Old screenshots or historic Lighthouse/WAVE claims should be treated as archival only unless re-run now.
- Internet Explorer 11 support should not be claimed without a fresh compatibility test.
