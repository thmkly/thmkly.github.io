document.addEventListener('DOMContentLoaded', () => {
    const linkText = document.querySelector('.link-text');
    const menu = document.querySelector('.menu');
    let menuOpen = false;
  
    // Toggle menu visibility on click
    linkText.addEventListener('click', (event) => {
      event.preventDefault(); // Prevent default link behavior
      menuOpen = !menuOpen;
      menu.style.display = menuOpen ? 'flex' : 'none';
    });
  
    // Open menu on hover
    linkText.addEventListener('mouseenter', () => {
      if (!menuOpen) {
        menu.style.display = 'flex';
      }
    });
  
    // Close menu when mouse leaves the text (if not clicked)
    linkText.addEventListener('mouseleave', () => {
      if (!menuOpen) {
        menu.style.display = 'none';
      }
    });
  
    // Keep menu open when mouse is over it
    menu.addEventListener('mouseenter', () => {
      menu.style.display = 'flex';
    });
  
    // Close menu when mouse leaves it (if not clicked)
    menu.addEventListener('mouseleave', () => {
      if (!menuOpen) {
        menu.style.display = 'none';
      }
    });
  
    // Handle click outside menu to close it
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target) && !linkText.contains(event.target)) {
        menu.style.display = 'none';
        menuOpen = false;
      }
    });
  });
  