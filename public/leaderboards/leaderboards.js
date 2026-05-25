/**
 * Leaderboards Page Script
 * Handles authentication and displays coming soon message
 * Note: API_BASE_URL is declared in overview-nav.js
 */

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

        // Load the global XP leaderboard
        await loadLeaderboard();

        console.log('Leaderboards page initialized');

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to load data. Please try refreshing the page.');
    }
}

async function loadLeaderboard() {
    const container = document.querySelector('#leaderboard-table');
    if (!container) return;

    const token = localStorage.getItem('discord_token');
    try {
        const response = await fetch(`${API_BASE_URL}/api/leaderboard/global-xp?limit=25&offset=0`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('Failed to fetch leaderboard');

        const data = await response.json();
        renderLeaderboard(container, data.entries || []);
    } catch (error) {
        console.error('Leaderboard load error:', error);
        container.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <p>Failed to load the leaderboard. Please try refreshing the page.</p>
            </div>
        `;
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

function renderLeaderboard(container, entries) {
    if (!entries.length) {
        container.innerHTML = `<p class="header-description">No ranked members yet.</p>`;
        return;
    }

    const rows = entries.map((e) => {
        const name = escapeHtml(e.global_name || e.discord_username || 'Unknown User');
        const initial = name.charAt(0).toUpperCase();
        const avatar = e.avatar_url
            ? `<span class="lb-avatar" style="background-image: url('${escapeHtml(e.avatar_url)}')"></span>`
            : `<span class="lb-avatar lb-avatar-fallback">${initial}</span>`;
        const rankClass = e.rank <= 3 ? ` rank-${e.rank}` : '';
        return `
            <div class="leaderboard-row">
                <div class="rank-col"><span class="rank-badge${rankClass}">#${e.rank}</span></div>
                <div class="member-col">${avatar}<span class="lb-name">${name}</span></div>
                <div class="level-col">${Number(e.global_level).toLocaleString()}</div>
                <div class="xp-col">${Number(e.global_exp).toLocaleString()}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="leaderboard-table">
            <div class="leaderboard-header">
                <div class="rank-col">Rank</div>
                <div class="member-col">Member</div>
                <div class="level-col">Level</div>
                <div class="xp-col">XP</div>
            </div>
            ${rows}
        </div>
    `;
}

// Mobile menu setup
function setupMobileMenu() {
    const menuBtn = document.querySelector('.top-nav-left');
    const navSidebar = document.querySelector('.navigation-sidebar');

    if (!menuBtn || !navSidebar) return;

    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        backdrop.id = 'sidebarBackdrop';
        document.body.appendChild(backdrop);
    }

    const openSidebar = () => {
        navSidebar.classList.add('open');
        backdrop.classList.add('open');
        menuBtn.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
        navSidebar.classList.remove('open');
        backdrop.classList.remove('open');
        menuBtn.classList.remove('open');
        document.body.style.overflow = '';
    };

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navSidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    backdrop.addEventListener('click', closeSidebar);
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
