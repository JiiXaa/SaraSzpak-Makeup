// Mobile Menu

const navigationMainList = document.querySelector('.nav__list');
const navigationSocials = document.querySelector('.nav__socials');
const overlay = document.querySelector('.overlay');
const menuBtn = document.querySelector('#nav__toggle');

console.log(menuBtn);
console.log(overlay);
console.log(navigationMainList);

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
