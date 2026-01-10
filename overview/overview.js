/**
 * Overview Page Script
 * Handles authentication, fetching global user stats, and displaying servers
 */

const API_BASE_URL = 'https://api.acosmibot.com';

// State
const state = {
    currentUser: null,
    userStats: null,
    userGuilds: []
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('Initializing overview page...');

    // Check for token in URL (from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
        localStorage.setItem('discord_token', tokenFromUrl);
        // Clean URL
        window.history.replaceState({}, document.title, '/overview');
    }

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

        // Render user avatar in nav
        renderNavAvatar(state.currentUser);

        // Fetch all data in parallel
        await Promise.all([
            loadUserStats(),
            loadUserGuilds()
        ]);

        // Populate UI
        populateUserStats();
        populateServers();

        console.log('Overview page initialized');

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to load data. Please try refreshing the page.');
    }
}

async function loadUserStats() {
    const token = localStorage.getItem('discord_token');
    const userId = state.currentUser?.id;

    if (!userId) return;

    try {
        // Fetch global user stats
        const [userResponse, rankResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/user/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_BASE_URL}/api/user/${userId}/rank/exp`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (userResponse.ok) {
            state.userStats = await userResponse.json();
        }

        if (rankResponse.ok) {
            const rankData = await rankResponse.json();
            if (state.userStats) {
                state.userStats.rank = rankData.rank;
            }
        }

        console.log('User stats loaded:', state.userStats);

    } catch (error) {
        console.warn('Could not load user stats:', error);
    }
}

async function loadUserGuilds() {
    const token = localStorage.getItem('discord_token');

    try {
        const response = await fetch(`${API_BASE_URL}/api/user/guilds`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            state.userGuilds = data.success ? data.guilds : [];
        }

        console.log('User guilds loaded:', state.userGuilds.length);

    } catch (error) {
        console.warn('Could not load guilds:', error);
    }
}

function renderNavAvatar(user) {
    const avatarEl = document.getElementById('userAvatarNav');
    if (!avatarEl || !user) return;

    if (user.avatar) {
        const avatarUrl = user.avatar.startsWith('http')
            ? user.avatar
            : `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
        avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
    } else {
        avatarEl.textContent = (user.username || user.global_name || 'U').charAt(0).toUpperCase();
        avatarEl.style.display = 'flex';
        avatarEl.style.alignItems = 'center';
        avatarEl.style.justifyContent = 'center';
        avatarEl.style.fontSize = '14px';
        avatarEl.style.fontWeight = 'bold';
        avatarEl.style.color = 'white';
    }
    avatarEl.title = user.global_name || user.username || 'User';

    // Add click handler for menu
    avatarEl.addEventListener('click', showUserMenu);
    avatarEl.style.position = 'relative';
}

function populateUserStats() {
    const user = state.currentUser;
    const stats = state.userStats || {};

    // Large avatar
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl && user) {
        if (user.avatar) {
            const avatarUrl = user.avatar.startsWith('http')
                ? user.avatar
                : `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
            avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
        } else {
            avatarEl.textContent = (user.username || user.global_name || 'U').charAt(0).toUpperCase();
        }
    }

    // Username
    const nameEl = document.getElementById('userName');
    if (nameEl && user) {
        nameEl.textContent = user.global_name || user.username || 'Unknown User';
    }

    // Stats
    setStatValue('userLevel', stats.level || 1);
    setStatValue('userCredits', formatNumber(stats.currency || 0));
    setStatValue('userRank', stats.rank ? `#${stats.rank}` : '-');
    setStatValue('userMessages', formatNumber(stats.total_messages || 0));
    setStatValue('userReactions', formatNumber(stats.total_reactions || 0));
    setStatValue('userExp', formatNumber(stats.global_exp || 0));

    // Member since
    const memberSince = stats.first_seen || user?.first_seen;
    if (memberSince) {
        const date = new Date(memberSince);
        setStatValue('memberSince', date.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        }));
    } else {
        setStatValue('memberSince', '-');
    }
}

function populateServers() {
    const container = document.getElementById('serversGrid');
    if (!container) return;

    if (state.userGuilds.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">No servers found</div>';
        return;
    }

    // Sort guilds: owner first, then admin, then member
    const sortedGuilds = [...state.userGuilds].sort((a, b) => {
        const aScore = a.owner ? 2 : (a.permissions?.includes('administrator') ? 1 : 0);
        const bScore = b.owner ? 2 : (b.permissions?.includes('administrator') ? 1 : 0);
        return bScore - aScore;
    });

    container.innerHTML = sortedGuilds.map(guild => {
        const isOwner = guild.owner === true;
        const isAdmin = guild.permissions?.includes('administrator');
        const hasAccess = isOwner || isAdmin;

        // Build icon
        let iconHtml = '';
        if (guild.icon) {
            const iconUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
            iconHtml = `<div class="server-icon" style="background-image: url('${iconUrl}')"></div>`;
        } else {
            const initial = (guild.name || 'S').charAt(0).toUpperCase();
            iconHtml = `<div class="server-icon">${initial}</div>`;
        }

        // Build badge
        let badgeHtml = '';
        if (isOwner) {
            badgeHtml = '<span class="server-badge owner">Owner</span>';
        } else if (isAdmin) {
            badgeHtml = '<span class="server-badge admin">Admin</span>';
        }

        // Build premium icon
        let premiumIconHtml = '';
        if (guild.premium_tier === 'premium') {
            premiumIconHtml = '<span class="premium-icon" title="Premium Server">💎</span>';
        }

        // Link destination
        const href = hasAccess ? `/server/${guild.id}/dashboard` : '#';
        const clickHandler = hasAccess ? '' : 'onclick="return false;"';

        return `
            <a href="${href}" class="server-card" ${clickHandler}>
                ${iconHtml}
                <div class="server-info">
                    <div class="server-name">${escapeHtml(guild.name)}</div>
                    <div class="server-members">${guild.member_count || 0} members</div>
                </div>
                ${badgeHtml}
                ${premiumIconHtml}
            </a>
        `;
    }).join('');
}

// Utility functions
function setStatValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    const container = document.querySelector('.overview-content');
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

    const user = state.currentUser;
    const stats = state.userStats || {};

    menu.innerHTML = `
        <div class="user-info">
            <div class="user-name">${user.global_name || user.username || 'User'}</div>
            <div class="user-stats">Level ${stats.level || 1} • ${formatNumber(stats.currency || 0)} Credits</div>
        </div>
        <a href="/overview">Overview</a>
        <a href="#" onclick="showProfile(); return false;">Profile</a>
        <div style="border-top: 1px solid var(--border-light); margin: 5px 0;"></div>
        <a href="#" onclick="logout(); return false;" class="logout-btn">🚪 Logout</a>
    `;

    // Position menu
    const avatarEl = document.getElementById('userAvatarNav');
    if (avatarEl) {
        avatarEl.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && !avatarEl.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }
}

// Profile placeholder
function showProfile() {
    alert('Profile page coming soon!');
}

// Logout
function logout() {
    localStorage.removeItem('discord_token');
    state.currentUser = null;

    // Remove any existing menu
    const menu = document.querySelector('.user-menu');
    if (menu) menu.remove();

    alert('Successfully logged out!');

    // Redirect to home
    setTimeout(() => {
        window.location.href = '/';
    }, 500);
}
