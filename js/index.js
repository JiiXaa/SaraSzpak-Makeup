const navigationMainList = document.querySelector('.nav__list');
const navigationSocials = document.querySelector('.nav__socials');
const overlay = document.querySelector('.overlay');
const menuBtn = document.querySelector('#nav__toggle');

const socialsColorChange = document.querySelectorAll('[data-color-id]');

//////////////////////
/// Mobile Menu Logic

// Menu toggle on hamburger menu click
menuBtn.addEventListener('click', () => {
  showMenu();
});

// Menu close when overlay clicked
overlay.addEventListener('click', () => {
  showMenu();
});

// Menu close on scroll event
window.addEventListener('scroll', () => {
  if (navigationMainList.classList.contains('show')) {
    showMenu();
  }
});

function showMenu() {
  overlay.classList.toggle('show');
  navigationMainList.classList.toggle('show');
  navigationSocials.classList.toggle('show');
}

function disableMenu() {
  overlay.classList.remove('show');
  navigationMainList.classList.remove('show');
  navigationSocials.classList.remove('show');
}

// Socials icons change color of others on hover
socialsColorChange.forEach((socialIcon) => {
  socialIcon.addEventListener('mouseover', () => {
    socialsColorChange.forEach((icon) => {
      icon.classList.remove('socials-change-color');
      if (icon.dataset.colorId !== socialIcon.dataset.colorId) {
        icon.classList.add('socials-change-color');
      }
    });
  });
});

// Socials icons color go back to the default state/color
socialsColorChange.forEach((socialIcon) => {
  socialIcon.addEventListener('mouseout', () => {
    socialsColorChange.forEach((icon) => {
      icon.classList.remove('socials-change-color');
    });
  });
});

// When social icon is clicked, it closes mobile menu
socialsColorChange.forEach((socialIcon) => {
  socialIcon.addEventListener('click', () => {
    disableMenu();
  });
});
