# Testing

## Contents

The Sara's Szpak website has been tested the following criteria:

- [Lighthouse Audit](#lighthouse)
- [Code Validation](#code-validation)
  - [W3C HTML Validator](#w3c-html-validator)
  - [W3C CSS Validator](#w3c-css-validator)
- [WAVE](#wave)
- [Browser Compatibility](#browser-compatibility)
- [Manual Testing](#manual-testing)
- [Bugs](#bugs)
  - [Outstanding Bugs](#outstanding-bugs)

## Code Validation

## Lighthouse

I used lighthouse in chrome developer tools to test each of the pages for:

- Performance - how the page performs whilst loading.
- Accessibility - how accessible is the site for all users and how can it be improved.
- Best practices - how does the site conform to industry best practices.
- SEO - search engine optimization. Is the site optimized for search engine result rankings.

[Back to contents](#contents)

#### Desktop:

<img width="476" alt="Lighthouse audit result for desktop screen size" src="https://raw.githubusercontent.com/JiiXaa/SaraSzpak-Makeup/main/.github/screenshots/lighthouse-desktop.jpg">

#### Mobile:

<img width="476" alt="Lighthouse audit result for mobile screen size" src="https://raw.githubusercontent.com/JiiXaa/SaraSzpak-Makeup/main/.github/screenshots/lighthouse-mobile.jpg">

[Back to contents](#contents)

### W3C HTML Validator

<img width="403" alt="HTML validation result" src="https://raw.githubusercontent.com/JiiXaa/SaraSzpak-Makeup/main/.github/screenshots/html-validated.jpg">

**All other html files went through the same verification process with exact same result. No errors.**

[Back to contents](#contents)

### W3C CSS Validator

<img width="403" alt="CSS validation result" src="https://raw.githubusercontent.com/JiiXaa/SaraSzpak-Makeup/main/.github/screenshots/css-validated.jpg">

**All styles passed the CSS validator without error.**

[Back to contents](#contents)

## WAVE

I used wave (web accessibility evaluation tool) in chrome developer tools to test the website accessibility. Scanned website for on-page and technical accessibility issues and errors to bring site in line with recognized accessibility standards, like the Web Content Accessibility Guidelines (WCAG).

<img width="302" alt="WAVE accessibility check result" src="https://raw.githubusercontent.com/JiiXaa/SaraSzpak-Makeup/main/.github/screenshots/wave-testing.jpg">

[Back to contents](#contents)

## Browser Compatibility

The site was tested on Google Chrome, Microsoft Edge, Safari and Mozilla Firefox, with no visible issues for the user. Appearance, functionality and responsiveness were consistent throughout for a range of device sizes and browsers.

| DEVICE        | BROWSER              | OS             |
| ------------- | -------------------- | -------------- |
| Pixel 6 Pro   | Chrome               | Android, v10.0 |
| Galaxy Note 8 | Firefox              | Android, v7.1  |
| iPhone 6S     | Chrome               | iOS, v12.1     |
| Windows PC    | Chrome               | iOS, v12.1     |
| Windows PC    | Edge 107             | Windows 11     |
| Windows PC    | Firefox 104          | Windows 11     |
| Windows PC    | Internet Explorer 11 | Windows 10     |

[Back to contents](#contents)

## Manual Testing

### Navigation:

Navigation's behavior checked on every page for every responsive breakpoint (mobile, tablet, desktop, desktop-large):

- [x] For mobile screen size extra step was to check if the hamburger menu opens the mobile menu.
- [x] Click on the website's logo redirects to index.html.
- [x] Click on Home link redirects to index.html.
- [x] Click on Portfolio link redirects to portfolio.html.
- [x] Click on Services link redirects to services.html.
  - [x] Services page contains 3 cards, and all when clicked redirects to specific page:
    - [x] Bridal card redirects to bridal.html.
    - [x] Makeup|Hairstyle card redirects to other.html.
    - [x] Makeup Lessons card redirects to lessons.html.
- [x] Click on Rates link redirects to rates.html.
- [x] Click on Contact link redirects to contact.html.

**Social media icons:**

- [x] Hover on one icon changes color of other icons (dim the color) with use of JavaScript.
- [x] All icon links have target attribute set to "\_blank" and open in new tab.
- [x] Click on Instagram icon opens new tab with Sara's Szpak profile.
- [x] Click on Facebook icon opens new tab with Sara's Szpak profile.
- [x] Click on Envelope icon opens new tab with option to send email to Sara.

### Submit Contact Form:

- [x] Try to submit.
- [x] Try to submit the empty form and verify that an error message about the required fields appears.
- [x] Try to submit the form with an invalid email address and verify that a relevant error message appears.
- [x] Try to submit the form with all inputs valid and verify that a success message appears.
- [x] Check form responsiveness for all breakpoints (mobile, tablet, desktop, desktop-large)

### Responsive Testing:

For each Device/ Browser/ OS noted in the Browser Compatibility Table, this has been tested:

- [x] Click on submit button - verify it looks as it has been designed.
- [x] Form is easy to access and invalid entries are noted.
- [x] Submission of contact form takes user to confirmation page.
- [x] Submission confirmation page takes user back to index.html on button click.

### Submission confirmation page:

- [x] The links go to the right page
- [x] Go back button redirects user to the index.html on click.

### Page 404:

- [x] If wrong URL used, user see the custom 404.html page.
- [x] Go back button redirects user to the index.html on click.

[Back to contents](#contents)

## Bugs

- Constant unit test was done as the features were added. Fixed, checked with appropriate commit messages. No official tracking system was used as the project scope was relatively small.

### Outstanding Bugs

- No outstanding bugs exist at this time that the developer is aware of.

[Back to contents](#contents)

## MAIN PAGE (README)

[Back to Main README](https://github.com/JiiXaa/SaraSzpak-Makeup#testing)
