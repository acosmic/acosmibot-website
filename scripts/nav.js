// Shared Navigation Component
// This file provides consistent navigation across all pages

const API_BASE_URL = 'https://api.acosmibot.com';
let currentUser = null;

// Initialize navigation on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
});

async function initializeNavigation() {
    await checkAuthState();
    setupNavigationListeners();
    highlightActivePage();
}

// Check authentication state
async function checkAuthState() {
    try {
        // Check for token in URL parameters first (from OAuth redirect)
        const urlParams = new URLSearchParams(window.location.search);
        let token = urlParams.get('token');

        if (token) {
            // Store token from URL and clean up URL
            localStorage.setItem('discord_token', token);
            window.history.replaceState({}, document.title, window.location.pathname);
            console.log('Token received from URL and stored in nav.js');
        } else {
            // Try to get token from localStorage
            token = localStorage.getItem('discord_token');
        }

        if (!token) {
            updateNavForLoggedOut();
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
            updateNavForLoggedIn();
        } else {
            localStorage.removeItem('discord_token');
            updateNavForLoggedOut();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        updateNavForLoggedOut();
    }
}

// Update navigation for logged in state
async function updateNavForLoggedIn() {
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) return;

    loginBtn.innerHTML = `
        <img src="${currentUser.avatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
        ${currentUser.username}
    `;

    // Show navigation links
    const dashboardLink = document.getElementById('userDashboardLink');
    const guildLink = document.getElementById('guildManagementLink');

    if (dashboardLink) dashboardLink.style.display = 'block';
    if (guildLink) guildLink.style.display = 'block';

    // Check if user is an admin and show admin panel link
    await checkAndShowAdminLink();
}

// Check if user is an admin and show the admin panel link
async function checkAndShowAdminLink() {
    try {
        const token = localStorage.getItem('discord_token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/admin/check`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        const adminLink = document.getElementById('adminPanelLink');

        if (data.success && data.is_admin && adminLink) {
            adminLink.style.display = 'block';
        }
    } catch (error) {
        // Silently fail - user is not an admin
        console.log('Admin check failed (user is not an admin)');
    }
}

// Update navigation for logged out state
function updateNavForLoggedOut() {
    const loginBtn = document.getElementById('loginBtn');
    if (!loginBtn) return;

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
    const adminLink = document.getElementById('adminPanelLink');

    if (dashboardLink) dashboardLink.style.display = 'none';
    if (guildLink) guildLink.style.display = 'none';
    if (adminLink) adminLink.style.display = 'none';
}

// Setup navigation event listeners
function setupNavigationListeners() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLoginClick);
    }

    // Dynamic navbar background on scroll
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('nav');
        if (nav) {
            if (window.scrollY > 100) {
                nav.style.background = 'rgba(88, 101, 242, 0.5)';
            } else {
                nav.style.background = 'rgba(88, 101, 242, 0.3)';
            }
        }
    });
}

// Handle login button click
async function handleLoginClick() {
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
        <a href="/user-dashboard.html">Personal Dashboard</a>
        <a href="/guild-selector.html">Server Management</a>
        <a href="#" onclick="showProfile()">Profile</a>
        <div style="border-top: 1px solid rgba(255,255,255,0.2); margin: 5px 0;"></div>
        <a href="#" onclick="logout()" class="logout-btn">🚪 Logout</a>
    `;

    // Position menu
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
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
}

// Profile placeholder
function showProfile() {
    showNotification('Profile page coming soon!', 'info');
}

// Logout
function logout() {
    localStorage.removeItem('discord_token');
    currentUser = null;

    updateNavForLoggedOut();

    // Remove any existing menu
    const menu = document.querySelector('.user-menu');
    if (menu) menu.remove();

    showNotification('Successfully logged out!', 'info');

    // Redirect to home if on dashboard pages
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    }
}

// Highlight active page in navigation
function highlightActivePage() {
    // Normalize current path: remove .html extension and trailing slash
    let currentPath = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
    if (currentPath === '') currentPath = '/';

    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        // Get the link's href
        let linkPath = new URL(link.href).pathname;

        // Handle anchor links (like #features) - check if we're on the base page
        if (link.hash && linkPath.split('#')[0] === window.location.pathname.split('#')[0]) {
            // If link has an anchor and we're on the same base page, mark it active
            if (currentPath === '/' || currentPath === '/index') {
                link.classList.add('active');
            }
            return;
        }

        // Normalize link path: remove .html extension and trailing slash
        linkPath = linkPath.replace(/\.html$/, '').replace(/\/$/, '');
        if (linkPath === '') linkPath = '/';

        // Compare normalized paths
        if (linkPath === currentPath) {
            link.classList.add('active');
        }
    });
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
