/**
 * Overview Page Script
 * Handles authentication, fetching global user stats, and displaying servers
 * Note: API_BASE_URL is declared in overview-nav.js
 */

// Utility: Fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}

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
        window.history.replaceState({}, document.title, '/dashboard');
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

        // Initialize overview layout (sidebars)
        await initializeOverviewLayout(state.currentUser, 'overview');

        // Fetch all data in parallel
        await Promise.all([
            loadUserStats(),
            loadUserGuilds()
        ]);

        // Populate UI
        populateUserStats();
        populateServers();

        // Setup mobile menu
        if (window.innerWidth <= 768) {
            setupMobileMenu();
        }

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
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/user/guilds`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }, 10000);

        if (response.ok) {
            const data = await response.json();
            state.userGuilds = data.success ? data.guilds : [];
        } else {
            console.warn('Could not load guilds - response not ok:', response.status);
            state.userGuilds = [];
        }

        console.log('User guilds loaded:', state.userGuilds.length);

    } catch (error) {
        console.warn('Could not load guilds:', error);
        state.userGuilds = [];

        // Show user-friendly error notification
        if (error.message === 'Request timeout') {
            showNotification('⏱️ Server took too long to respond. Showing empty state.', 'warning');
        }
    }
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
            // Fallback: Discord default avatar
            const defaultAvatarIndex = (parseInt(user.id) >> 22) % 6;
            const defaultAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
            avatarEl.style.backgroundImage = `url('${defaultAvatarUrl}')`;
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
        container.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-state-icon">🤖</div>
                <h3>Add Acosmibot to Your Server</h3>
                <p>You don't have any servers with Acosmibot yet. Get started by adding the bot to a Discord server you own or manage.</p>

                <div class="empty-state-steps">
                    <div class="step">
                        <span class="step-number">1</span>
                        <div class="step-content">
                            <strong>Own or manage a Discord server</strong>
                            <p>If you don't have one yet, <a href="https://discord.com/channels/@me" target="_blank">create a server in Discord</a></p>
                        </div>
                    </div>
                    <div class="step">
                        <span class="step-number">2</span>
                        <div class="step-content">
                            <strong>Add Acosmibot to your server</strong>
                            <p>Click the button below to invite the bot</p>
                        </div>
                    </div>
                    <div class="step">
                        <span class="step-number">3</span>
                        <div class="step-content">
                            <strong>Come back and configure</strong>
                            <p>Refresh this page to see your server</p>
                        </div>
                    </div>
                </div>

                <button onclick="handleBotInvite()" class="primary-button">
                    <span class="button-icon">➕</span>
                    Add Acosmibot to Server
                </button>

                <div class="help-links">
                    <a href="/documentation" class="help-link">📚 View Documentation</a>
                    <a href="/support" class="help-link">💬 Get Help</a>
                </div>
            </div>
        `;
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
        if (guild.premium_tier === 'premium_plus_ai') {
            premiumIconHtml = '<span class="premium-icon" title="Premium + AI Server">🤖💎</span>';
        } else if (guild.premium_tier === 'premium') {
            premiumIconHtml = '<span class="premium-icon" title="Premium Server">💎</span>';
        }

        // Link destination
        const href = hasAccess ? `/server/${guild.id}/overview` : '#';
        const clickHandler = hasAccess ? '' : 'onclick="return false;"';

        return `
            <a href="${href}" class="server-card" ${clickHandler}>
                ${iconHtml}
                <div class="server-info">
                    <div class="server-name">${escapeHtml(guild.name)}</div>
                    <div class="server-members">${guild.member_count || 0} members</div>
                </div>
                <div class="server-badges">
                    ${badgeHtml}
                    ${premiumIconHtml}
                </div>
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

function showNotification(message, type = 'info') {
    // Simple notification implementation
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Bot invite handler
async function handleBotInvite() {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/bot/invite`, {}, 5000);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.invite_url) {
            // Open invite in new window
            const inviteWindow = window.open(
                data.invite_url,
                'discord-bot-invite',
                'width=500,height=800,scrollbars=yes'
            );

            // Show success message
            showNotification('✅ Bot invite opened! After adding the bot, refresh this page.', 'success');

            // Optionally: auto-refresh after delay
            setTimeout(() => {
                const shouldRefresh = confirm('Have you finished adding the bot? Click OK to refresh and see your server.');
                if (shouldRefresh) {
                    location.reload();
                }
            }, 10000);
        } else {
            throw new Error(data.message || 'Invite URL not available');
        }
    } catch (error) {
        console.error('Bot invite error:', error);
        showNotification('❌ Failed to open bot invite. Please try again.', 'error');
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

// Make functions globally accessible for onclick handlers
window.handleBotInvite = handleBotInvite;
