const toggle = document.getElementById('menuToggle');
const menu = document.getElementById('mobileMenu');

toggle.onclick = () => {
  menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
};
