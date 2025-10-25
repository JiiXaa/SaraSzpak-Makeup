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
