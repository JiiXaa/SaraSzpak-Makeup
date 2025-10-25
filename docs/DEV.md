# Development Notes

## Vercel Environment Variables (Preview + Production)

Project -> Settings -> Environment Variables:

BREVO_API_KEY = (Brevo API key)
FROM_EMAIL = Contact@saraszpak.com (verified sender)
OWNER_EMAIL = saraszpak@hotmail.com (email notifications of reci)
OWNER_NAME = Sara (optional)

- eng: For local testing, add it in the .env.local file in the project directory.

### Local Tests

```
npm i -g vercel
vercel login
vercel dev
```

Visit http://localhost:3000/contact.html -> fill out the form -> it should redirect to form-submitted.html.

Check in Brevo -> Transactional -> Logs:

- one email to you – table with fields,
- one mail to client – autoresponder.

### Preview Tests

`vercel`
Go to: https://<your-project>.vercel.app/contact.html -> submit the form -> check Logs as above.

### Verify headers

Verify headers (PASS)

In the received email (e.g., in Gmail "Show original" / Outlook "View source"):

SPF: PASS
DKIM: PASS
DMARC: PASS
From: = Contact@saraszpak.com
Reply-To = client's address (our backend sets it, so you can reply with one click).

If any of the PASS statuses do not appear immediately, wait 15–60 minutes (DNS propagation) and try again.

After 1–2 weeks (when everything is clean): tighten DMARC
eng: change DMARC in DNS \_dmarc from:

p=none -> p=quarantine
eng: optionally p=reject, but this is very strict and may cause deliverability issues if something goes wrong.
To maksymalizuje ochronę przed podszywaniem (phishing).

==============================

# Tracking domain and anti-spam documentation

Tracking Domain + Anti-Spam (Honeypot & Turnstile) — Implementation Notes

This doc explains how to (a) enable **Brevo Tracking Domain** so links in your emails use your own domain and (b) harden your contact form with a **honeypot** and optional **Cloudflare Turnstile**.

---

## 1) Brevo Tracking Domain (`link.saraszpak.com`)

### What it is

A custom CNAME so all tracked links/open-pixels in Brevo emails use your brand domain instead of a Brevo URL. This improves trust, deliverability signals, and click-through rates.

### Prerequisites

- Your domain is **Authenticated** in Brevo (SPF/DKIM/DMARC).
- You can edit **DNS** where `saraszpak.com` is hosted.

### DNS Record (added during domain auth)

Create the CNAME

- **Host/Name:** `link`
- **Type:** `CNAME`
- **Target/Value:** _(Brevo gives this—e.g. `r.brevo.com`)_
- **TTL:** default (or 1h)

> Do **not** touch A/CNAME for `www` or **MX**. This CNAME is **only** for tracking links.

### Enable the Tracking Domain in Brevo

1. **Brevo → Settings → Senders & Domains → Domains**
2. Open your domain (`saraszpak.com`) → ensure **Tracking domain** shows as _Verified/Active_.
3. If there’s a toggle for “Use custom tracking domain”, switch it **ON**.

### How to Verify It’s Working

- Send a test email (Transactional → _Send a Test_ or via your form).
- Hover any link in the email → it should start with `https://link.saraszpak.com/...`
- In Brevo **Transactional Logs**, events (open/click) should still record as usual.

### Troubleshooting

- **DNS not verified yet?** Wait 15–60 minutes for propagation and click **Verify** again in Brevo.
- **Mixed content / SSL issues?** Ensure your provider issues a certificate for `link.saraszpak.com`. (Brevo typically handles this after verification; if not, re-verify or re-save the domain.)

---

## 2) Anti-Spam Strategy for the Contact Form

### 2.1 Honeypot (already implemented)

**What it is**  
A hidden input that real users won’t fill, but bots often do. If the honeypot has a value, you silently drop/redirect.

**Example (HTML)**

```html
<!-- Honeypot: keep it hidden from real users -->
<input
  type="text"
  name="company"
  id="company"
  autocomplete="off"
  tabindex="-1"
  aria-hidden="true"
  style="position:absolute;left:-9999px;"
/>

<!-- Your real inputs -->
<input name="name" id="name" type="text" required />
<input name="email" id="email" type="email" required />
<!-- ... -->
```

## SCSS BUILDING

npm run build:css
