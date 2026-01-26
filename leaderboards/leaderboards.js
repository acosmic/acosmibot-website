/**
 * Leaderboards Page Script
 * Handles authentication and displays coming soon message
 */

const API_BASE_URL = 'https://api.acosmibot.com';

// State
const state = {
    currentUser: null,
    userGuilds: []
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('Initializing leaderboards page...');

    // Check authentication
    const token = localStorage.getItem('discord_token');
    if (!token) {
        console.log('No token found, redirecting to home');
        window.location.href = '/';
        return;
    }

    try {
        // Fetch current user
        const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!userResponse.ok) {
            if (userResponse.status === 401) {
                localStorage.removeItem('discord_token');
                window.location.href = '/';
                return;
            }
            throw new Error('Failed to fetch user');
        }

        state.currentUser = await userResponse.json();
        console.log('Current user:', state.currentUser);

        // Initialize overview layout (active page: 'leaderboards')
        await initializeOverviewLayout(state.currentUser, 'leaderboards');

        // Setup mobile menu
        if (window.innerWidth <= 768) {
            setupMobileMenu();
        }

        console.log('Leaderboards page initialized');

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to load data. Please try refreshing the page.');
    }
}

// Mobile menu setup
function setupMobileMenu() {
    const menuBtn = document.querySelector('.top-nav-left');
    const guildSelector = document.querySelector('.guild-selector-sidebar');
    const navSidebar = document.querySelector('.navigation-sidebar');

    if (!menuBtn || !guildSelector || !navSidebar) return;

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        guildSelector.classList.toggle('open');
        navSidebar.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!guildSelector.contains(e.target) &&
            !navSidebar.contains(e.target) &&
            !menuBtn.contains(e.target)) {
            guildSelector.classList.remove('open');
            navSidebar.classList.remove('open');
        }
    });
}

function showError(message) {
    const container = document.querySelector('#leaderboards-content-wrapper');
    if (container) {
        container.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; cursor: pointer;">
                    Refresh Page
                </button>
            </div>
        `;
    }
}
