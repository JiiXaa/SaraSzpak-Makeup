// Module scope = no globals on window
const navigationMainList = document.querySelector(".nav__list");
const navigationSocials = document.querySelector(".nav__socials");
const overlay = document.querySelector(".overlay");
const menuBtn = document.querySelector("#nav__toggle");
const socialsColorChange = document.querySelectorAll("[data-color-id]");

// if subpage without navigation, exit politely
if (!navigationMainList || !navigationSocials || !overlay || !menuBtn) {
  // don't do anything
} else {
  // Mobile Menu Logic
  menuBtn.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", toggleMenu);

  // Close menu on scroll (if opened)
  window.addEventListener(
    "scroll",
    () => {
      if (navigationMainList.classList.contains("show")) closeMenu();
    },
    { passive: true },
  );

  function toggleMenu() {
    overlay.classList.toggle("show");
    navigationMainList.classList.toggle("show");
    navigationSocials.classList.toggle("show");
  }
  function closeMenu() {
    overlay.classList.remove("show");
    navigationMainList.classList.remove("show");
    navigationSocials.classList.remove("show");
  }

  // Socials: change color of other icons on hover
  socialsColorChange.forEach((icon) => {
    icon.addEventListener("mouseover", () => {
      socialsColorChange.forEach((i) => {
        i.classList.toggle(
          "socials-change-color",
          i.dataset.colorId !== icon.dataset.colorId,
        );
      });
    });
    icon.addEventListener("mouseout", () => {
      socialsColorChange.forEach((i) =>
        i.classList.remove("socials-change-color"),
      );
    });
    icon.addEventListener("click", () => {
      closeMenu();
    });
  });
}

initTestimonials();

async function initTestimonials() {
  const rotateDelay = 8000;
  const fadeDuration = 500;
  const testimonialsBox = document.querySelector(".header__about__testimonials");
  const textEl = testimonialsBox?.querySelector(".testimonials-text");
  const nameEl = testimonialsBox?.querySelector(".testimonials-name");
  const avatarEl = testimonialsBox?.querySelector(".testimonials-avatar");
  const reviewLinkEl = testimonialsBox?.querySelector(".testimonials-link");

  if (!testimonialsBox || !textEl || !nameEl || !avatarEl || !reviewLinkEl) {
    return;
  }

  const fallbackReview = {
    text: textEl.textContent.trim(),
    authorName: nameEl.textContent.trim(),
    authorPhotoUrl: avatarEl.getAttribute("src") || "/img/favicon-32x32.png",
    googleMapsUri: reviewLinkEl.getAttribute("href") || "https://www.google.com/maps",
    rating: 5,
  };

  let reviews = [fallbackReview];

  try {
    const response = await fetch("/api/google-reviews?limit=5", {
      headers: { accept: "application/json" },
    });
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload.reviews) && payload.reviews.length > 0) {
        reviews = shuffleReviews(payload.reviews);
      }
    }
  } catch {
    // keep fallback review if endpoint fails
  }

  let currentIndex = 0;
  renderReview(reviews[currentIndex]);

  if (reviews.length <= 1) return;

  setInterval(() => {
    currentIndex = (currentIndex + 1) % reviews.length;
    testimonialsBox.classList.add("is-animating");

    window.setTimeout(() => {
      renderReview(reviews[currentIndex]);
      testimonialsBox.classList.remove("is-animating");
    }, fadeDuration);
  }, rotateDelay);

  function renderReview(review) {
    const reviewText = (review.text || "").trim();
    const reviewAuthor = (review.authorName || "Anonymous").trim();
    const reviewPhoto = (review.authorPhotoUrl || "").trim();
    const reviewUrl = (review.googleMapsUri || "").trim();

    textEl.textContent = reviewText ? `\u201c${reviewText}\u201d` : "\u201c\u201d";
    nameEl.textContent = reviewAuthor;
    reviewLinkEl.href = reviewUrl || "https://www.google.com/maps";

    if (reviewPhoto) {
      avatarEl.src = reviewPhoto;
      avatarEl.alt = `${reviewAuthor} profile photo`;
      avatarEl.loading = "lazy";
      avatarEl.referrerPolicy = "no-referrer";
    } else {
      avatarEl.src = "/img/favicon-32x32.png";
      avatarEl.alt = "Reviewer profile photo";
    }
  }

  function shuffleReviews(items) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ];
    }

    return shuffled;
  }
}
