// Home page specific functionality
// Note: Navigation logic is now in nav.js

// Initialize home page specific features
document.addEventListener('DOMContentLoaded', function() {
    setupHomePageListeners();
    setupAnimations();
})

// Support section functions
function showCryptoAddress() {
    document.getElementById('cryptoModal').style.display = 'flex';
}

function closeCryptoModal() {
    document.getElementById('cryptoModal').style.display = 'none';
}

function copyBTCAddress() {
    const addressInput = document.getElementById('btcAddress');
    addressInput.select();
    addressInput.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(addressInput.value).then(function() {
        showNotification('Bitcoin address copied to clipboard!', 'success');
    }, function(err) {
        console.error('Failed to copy: ', err);
        showNotification('Failed to copy address', 'error');
    });
}

// Setup home page specific event listeners
function setupHomePageListeners() {
    const inviteBtn = document.getElementById('inviteBtn');
    if (inviteBtn) {
        inviteBtn.addEventListener('click', handleInvite);
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Handle bot invite (coming soon version)
async function handleInvite() {
    try {
        showNotification('Checking bot availability...', 'info');

        const response = await fetch(`${API_BASE_URL}/bot/invite`);
        const data = await response.json();

        if (data.status === 'coming_soon') {
            showNotification(data.message, 'info');
            showComingSoonModal(data);
        } else if (data.invite_url) {
            window.open(data.invite_url, '_blank');
            showNotification('Bot invite opened in new tab!', 'success');
        }
    } catch (error) {
        console.error('Invite error:', error);
        showNotification('Unable to process invite request.', 'error');
    }
}

// Show coming soon modal
function showComingSoonModal(data) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8); display: flex; align-items: center;
        justify-content: center; z-index: 1000;
    `;

    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #5865F2, #7289DA); padding: 30px; border-radius: 15px; max-width: 400px; text-align: center; color: white; border: 1px solid rgba(255,255,255,0.2);">
            <h2 style="margin-bottom: 15px;">🚀 Coming Soon!</h2>
            <p style="margin-bottom: 15px;">${data.eta}</p>
            <p style="margin-bottom: 20px;">${data.contact}</p>
            <button onclick="this.closest('div').parentElement.remove()"
                    style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                Got it!
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Note: Navigation functions (checkAuthState, updateUIForLoggedIn, updateUIForLoggedOut,
// showUserMenu, logout, showNotification) are now provided by nav.js

// Setup scroll animations
function setupAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(el => {
        el.style.animationPlayState = 'paused';
        observer.observe(el);
    });
}