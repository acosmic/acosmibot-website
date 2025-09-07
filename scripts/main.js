// Configuration
const API_BASE_URL = 'https://api.acosmibot.com';

// Global variables
let currentUser = null;

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const inviteBtn = document.getElementById('inviteBtn');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    setupEventListeners();
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

// Setup event listeners
function setupEventListeners() {
    loginBtn.addEventListener('click', handleLogin);
    inviteBtn.addEventListener('click', handleInvite);

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

    // Dynamic navbar background on scroll
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('nav');
        if (window.scrollY > 100) {
            nav.style.background = 'rgba(88, 101, 242, 0.3)';
        } else {
            nav.style.background = 'rgba(88, 101, 242, 0.15)';
        }
    });
}

// Handle login/logout
async function handleLogin() {
    if (currentUser) {
        showUserMenu();
    } else {
        await loginWithDiscord();
    }
}

// Login with Discord
async function loginWithDiscord() {
    try {
        showNotification('Redirecting to Discord...', 'info');
        window.location.href = `${API_BASE_URL}/auth/login`;
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Failed to initiate login. Please try again.', 'error');
    }
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

// Check authentication state on page load
async function checkAuthState() {
    try {
        const token = localStorage.getItem('discord_token');
        if (!token) {
            updateUIForLoggedOut();
            return;
        }

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            updateUIForLoggedIn();
        } else {
            localStorage.removeItem('discord_token');
            updateUIForLoggedOut();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        updateUIForLoggedOut();
    }
}

function updateUIForLoggedIn() {
    loginBtn.innerHTML = `
        <img src="${currentUser.avatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
        ${currentUser.username}
    `;

    // Show navigation links
    const dashboardLink = document.getElementById('userDashboardLink');
    const guildLink = document.getElementById('guildManagementLink');

    if (dashboardLink) dashboardLink.style.display = 'block';
    if (guildLink) guildLink.style.display = 'block';
}

function updateUIForLoggedOut() {
    loginBtn.innerHTML = `
        <svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.196.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            <path d="M8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
        Login with Discord
    `;

    // Hide navigation links
    const dashboardLink = document.getElementById('userDashboardLink');
    const guildLink = document.getElementById('guildManagementLink');

    if (dashboardLink) dashboardLink.style.display = 'none';
    if (guildLink) guildLink.style.display = 'none';
}

// Get current user info from API (deprecated - now handled in checkAuthState)
async function getCurrentUser(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            updateUIForLoggedIn();
            showNotification(`Welcome back, ${userData.username}!`, 'success');
        } else {
            // Token is invalid, remove it
            localStorage.removeItem('discord_token');
            currentUser = null;
        }
    } catch (error) {
        console.error('Failed to get user info:', error);
        localStorage.removeItem('discord_token');
        currentUser = null;
    }
}

// Update navigation for logged-in user (deprecated - use updateUIForLoggedIn)
function updateNavForLoggedInUser(user) {
    const avatarUrl = user.avatar || `https://cdn.discordapp.com/embed/avatars/0.png`;

    loginBtn.innerHTML = `
        <img src="${avatarUrl}" alt="${user.username}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
        ${user.username}
    `;

    // Show dashboard link in navigation
    const dashboardLink = document.getElementById('userDashboardLink');
    if (dashboardLink) {
        dashboardLink.style.display = 'block';
    }
}

// Show user dropdown menu
function showUserMenu() {
    // Remove existing menu if it exists
    const existingMenu = document.querySelector('.user-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const menu = document.createElement('div');
    menu.className = 'user-menu';

    menu.innerHTML = `
        <div class="user-info">
            <div class="user-name">${currentUser.username}</div>
            <div class="user-stats">Level ${currentUser.level || 1} • ${currentUser.currency || 0} Credits</div>
        </div>
        <a href="/user-dashboard.html">🏠 Personal Dashboard</a>
        <a href="/guild-selector.html">🏰 Server Management</a>
        <a href="#" onclick="showProfile()">👤 Profile</a>
        <div style="border-top: 1px solid rgba(255,255,255,0.2); margin: 5px 0;"></div>
        <a href="#" onclick="logout()" class="logout-btn">🚪 Logout</a>
    `;

    // Position menu
    loginBtn.style.position = 'relative';
    loginBtn.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !loginBtn.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// Dashboard placeholder
function showDashboard() {
    showNotification('Dashboard coming soon!', 'info');
}

// Profile placeholder
function showProfile() {
    showNotification('Profile page coming soon!', 'info');
}

// Logout
function logout() {
    localStorage.removeItem('discord_token');
    currentUser = null;

    // Use the centralized logout UI function
    updateUIForLoggedOut();

    // Remove any existing menu
    const menu = document.querySelector('.user-menu');
    if (menu) menu.remove();

    showNotification('Successfully logged out!', 'info');
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Auto remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

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