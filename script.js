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
  
    // Close menu when clicking outside of it
    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target) && !linkText.contains(event.target)) {
        menu.style.display = 'none';
        menuOpen = false;
      }
    });
  
    // Prevent menu from closing when interacting with it
    menu.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  });
  