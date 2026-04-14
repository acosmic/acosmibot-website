// Documentation page interactivity

document.addEventListener('DOMContentLoaded', function() {
    initializeDocs();
});

function initializeDocs() {
    setupSidebarHighlighting();
    setupSmoothScroll();
}

// Highlight active section in sidebar based on scroll position
function setupSidebarHighlighting() {
    const sections = document.querySelectorAll('.docs-section');
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-section');

    if (sections.length === 0 || navLinks.length === 0) return;

    // Highlight on scroll
    window.addEventListener('scroll', () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;

            if (window.pageYOffset >= (sectionTop - 150)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === '#' + current) {
                link.classList.add('active');
            }
        });
    });

    // Set initial active state
    if (navLinks.length > 0) {
        navLinks[0].classList.add('active');
    }
}

// Smooth scroll for sidebar navigation
function setupSmoothScroll() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-section');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}
