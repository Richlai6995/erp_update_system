// Console greeting
console.log("%c Welcome to My Portfolio! ", "background: #6366f1; color: white; padding: 5px; border-radius: 5px; font-weight: bold;");

// Navbar scroll effect
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(11, 15, 25, 0.95)';
        navbar.style.padding = '1rem 2rem';
        navbar.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
    } else {
        navbar.style.background = 'rgba(11, 15, 25, 0.8)';
        navbar.style.padding = '1.5rem 2rem';
        navbar.style.boxShadow = 'none';
    }
});

// Smooth Scroll for setup (optional if CSS scroll-behavior fails)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({
                top: target.offsetTop - 80, // Offset for fixed header
                behavior: 'smooth'
            });
        }
    });
});

// Simple Scroll Reveal API
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Select elements to animate
// We need to set initial state first via JS to avoid checking CSS
document.querySelectorAll('.about-card, .skill-category, .section-title').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
});
