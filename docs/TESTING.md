# Testing

## Current Status

This file documents the testing approach for the current codebase.
It intentionally avoids claiming checks that were not re-run against the current implementation.

## Verified From Code / Local Commands

The following was verified directly against the repository:

- static pages are served from `public/`
- local API routes exist in `api/contact.js` and `api/google-reviews.js`
- local development uses `scripts/dev-server.js`
- SCSS builds successfully with `npm run build:css`
- `npm run build` is only a placeholder and does not produce deploy artifacts

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

### Responsive Check

- Review homepage and contact form on mobile width
- Review main service pages on tablet width
- Review homepage, portfolio, rates, and contact on desktop width
- Confirm no major overflow, broken images, or layout collapse

## What Is Not Covered Automatically

There are currently no automated unit tests, integration tests, or end-to-end tests in this repository.

That means release confidence depends on:

- manual browser checks
- a real contact form submission in Preview
- verification of Brevo and Google API configuration

## Recommended Pre-Production Pass

Before production approval, do one clean Preview deployment and confirm:

1. homepage loads correctly
2. Google reviews work with production env vars
3. contact form sends both emails
4. redirect to confirmation page works
5. email headers show SPF, DKIM, and DMARC pass

## Notes

- Old screenshots or historic Lighthouse/WAVE claims should be treated as archival only unless re-run now.
- Internet Explorer 11 support should not be claimed without a fresh compatibility test.
