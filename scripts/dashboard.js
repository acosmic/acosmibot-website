// Note: API_BASE_URL and currentUser are now provided by nav.js
// This avoids variable redeclaration errors

let userGuilds = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuthAndLoadData();
});

// Check authentication and load user data
async function checkAuthAndLoadData() {
    // Wait for nav.js to finish authentication
    // nav.js handles token extraction from URL and /auth/me call
    let attempts = 0;
    const maxAttempts = 50; // Wait up to 5 seconds (50 * 100ms)

    // Wait for nav.js to complete auth check
    while (attempts < maxAttempts) {
        // Check if currentUser is set by nav.js
        if (currentUser) {
            console.log('User authenticated by nav.js:', currentUser);
            break;
        }

        // Check if we explicitly logged out (no token)
        const token = localStorage.getItem('discord_token');
        if (!token && attempts > 10) {
            console.log('No token found, redirecting to home');
            setTimeout(() => window.location.href = '/', 1000);
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!currentUser) {
        console.error('Authentication timeout - nav.js did not complete');
        showNotification('Authentication failed. Please try again.', 'error');
        setTimeout(() => window.location.href = '/', 3000);
        return;
    }

    // Load dashboard data using currentUser from nav.js
    try {
        await loadDashboardData();
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showNotification(`Failed to load dashboard: ${error.message}`, 'error');
    }
}

// Load all dashboard data in parallel
async function loadDashboardData() {
    if (!currentUser) return;

    try {
        // Fetch all data in parallel
        const [
            userDataResponse,
            gamesDataResponse,
            guildsDataResponse,
            levelRankResponse
        ] = await Promise.all([
            fetch(`${API_BASE_URL}/api/user/${currentUser.id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
            }),
            fetch(`${API_BASE_URL}/api/user/${currentUser.id}/games`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
            }),
            fetch(`${API_BASE_URL}/api/user/guilds`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
            }),
            fetch(`${API_BASE_URL}/api/user/${currentUser.id}/rank/exp`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
            })
        ]);

        // Process responses
        const userData = await userDataResponse.json();
        const gamesData = await gamesDataResponse.json();
        const guildsData = await guildsDataResponse.json();
        const levelRank = await levelRankResponse.json();

        // Update all sections
        updateInlineBanner(userData, gamesData, levelRank);

        if (guildsData.success) {
            userGuilds = guildsData.guilds || [];
            displayGuilds();
        }

    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// Update inline banner with all stats
function updateInlineBanner(userData, gamesData, levelRank) {
    // Avatar and username
    document.getElementById('userName').textContent = currentUser.username;
    const avatarUrl = currentUser.avatar || `https://cdn.discordapp.com/embed/avatars/0.png`;
    document.getElementById('userAvatar').src = avatarUrl;

    // Inline stats - all 7 metrics
    document.getElementById('userLevel').textContent = userData.level || currentUser.level || 1;
    document.getElementById('userCredits').textContent = (userData.currency || currentUser.currency || 0).toLocaleString();

    // IMPORTANT: Use level-based rank (from exp endpoint)
    document.getElementById('userRank').textContent = levelRank.rank || '?';

    document.getElementById('userMessages').textContent = (userData.total_messages || 0).toLocaleString();
    document.getElementById('userReactions').textContent = (userData.total_reactions || 0).toLocaleString();
    document.getElementById('userGames').textContent = gamesData.total_games || 0;
    document.getElementById('userWinRate').textContent = gamesData.win_rate || 0;

    // Member since
    if (userData.first_seen || currentUser.first_seen) {
        const date = new Date(userData.first_seen || currentUser.first_seen);
        document.getElementById('memberSince').textContent = date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
    } else {
        document.getElementById('memberSince').textContent = 'Unknown';
    }
}

// Display guilds in sections (Owner/Admin/Member)
function displayGuilds() {
    const content = document.getElementById('guildsContent');

    if (!userGuilds || userGuilds.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <h3>No Servers Found</h3>
                <p>You don't have access to any servers with Acosmibot.</p>
            </div>
        `;
        return;
    }

    // Sort guilds: Owner > Admin > Member
    userGuilds.sort((a, b) => {
        const getRank = (guild) => {
            if (guild.owner) return 3;
            if (guild.permissions && guild.permissions.includes('administrator')) return 2;
            return 1;
        };
        return getRank(b) - getRank(a);
    });

    // Group guilds by permission level
    const ownedGuilds = userGuilds.filter(g => g.owner);
    const adminGuilds = userGuilds.filter(g => !g.owner && g.permissions && g.permissions.includes('administrator'));
    const memberGuilds = userGuilds.filter(g => !g.owner && (!g.permissions || !g.permissions.includes('administrator')));

    let html = '';

    // Owner section
    if (ownedGuilds.length > 0) {
        html += `<h3 class="guild-section-title">👑 Your Servers (Owner)</h3>`;
        html += `<div class="guilds-grid">`;
        ownedGuilds.forEach(guild => {
            html += createGuildCard(guild, true, true);
        });
        html += `</div>`;
    }

    // Admin section
    if (adminGuilds.length > 0) {
        html += `<h3 class="guild-section-title">⚡ Admin Servers</h3>`;
        html += `<div class="guilds-grid">`;
        adminGuilds.forEach(guild => {
            html += createGuildCard(guild, false, true);
        });
        html += `</div>`;
    }

    // Member section
    if (memberGuilds.length > 0) {
        html += `<h3 class="guild-section-title">👤 Member Servers</h3>`;
        html += `<div class="guilds-grid">`;
        memberGuilds.forEach(guild => {
            html += createGuildCard(guild, false, false);
        });
        html += `</div>`;
    }

    content.innerHTML = html;
}

// Create individual guild card
function createGuildCard(guild, isOwner, canManage) {
    const guildIconHTML = guild.icon
        ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128" alt="${guild.name}">`
        : guild.name.charAt(0).toUpperCase();

    const guildIconClass = guild.icon ? 'guild-icon' : 'guild-icon guild-icon-fallback';

    const bannerStyle = guild.banner
        ? `background-image: linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.7)), url('https://cdn.discordapp.com/banners/${guild.id}/${guild.banner}.png?size=480'); background-size: cover; background-position: center;`
        : '';

    const badge = isOwner
        ? '<span class="permission-badge owner">👑 Owner</span>'
        : canManage
        ? '<span class="permission-badge admin">⚡ Admin</span>'
        : '<span class="permission-badge member">👤 Member</span>';

    return `
        <div class="guild-card" style="${bannerStyle}">
            <div class="guild-header">
                <div class="${guildIconClass}">
                    ${guildIconHTML}
                </div>
                <div class="guild-info">
                    <h3>${escapeHtml(guild.name)}</h3>
                    <div class="guild-members">
                        👥 ${guild.member_count || 'Unknown'} members
                    </div>
                </div>
            </div>

            <div class="guild-permissions">
                ${badge}
            </div>

            <div class="action-buttons">
                <a href="/guild-stats.html?guild=${guild.id}" class="btn btn-secondary">
                    📊 View Stats
                </a>
                ${canManage ? `
                    <a href="/server/${guild.id}/twitch" class="btn btn-primary">
                        ⚙️ Settings
                    </a>
                ` : ''}
            </div>
        </div>
    `;
}

// Toggle leaderboard visibility
function toggleLeaderboard() {
    const content = document.getElementById('leaderboardContent');
    const icon = document.getElementById('leaderboardIcon');

    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        icon.textContent = '▲';

        // Load default leaderboard (level) if not already loaded
        if (!content.dataset.loaded) {
            switchLeaderboard('level');
            content.dataset.loaded = 'true';
        }
    } else {
        content.classList.add('collapsed');
        icon.textContent = '▼';
    }
}

// Switch between leaderboard types
async function switchLeaderboard(type) {
    const display = document.getElementById('leaderboardDisplay');

    // Show loading
    display.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            Loading ${type} leaderboard...
        </div>
    `;

    try {
        let endpoint;
        let labelFormatter;

        switch(type) {
            case 'level':
                endpoint = '/api/leaderboard/level';
                labelFormatter = (user) => `Level ${user[3]} (${user[4].toLocaleString()} XP)`;
                break;
            case 'exp':
                endpoint = '/api/leaderboard/level'; // Same endpoint, different display
                labelFormatter = (user) => `${user[4].toLocaleString()} XP`;
                break;
            case 'currency':
                endpoint = '/api/leaderboard/currency';
                labelFormatter = (user) => `${user[3].toLocaleString()} Credits`;
                break;
            case 'messages':
                endpoint = '/api/leaderboard/messages';
                labelFormatter = (user) => `${user[3].toLocaleString()} Messages`;
                break;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}?limit=25`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('discord_token')}` }
        });

        if (response.ok) {
            const data = await response.json();
            displayLeaderboardData(data, labelFormatter);
        } else {
            throw new Error(`Failed to load ${type} leaderboard`);
        }

    } catch (error) {
        console.error('Leaderboard error:', error);
        display.innerHTML = `<p style="text-align: center; opacity: 0.7;">Unable to load ${type} leaderboard</p>`;
    }
}

// Display leaderboard data
function displayLeaderboardData(data, labelFormatter) {
    const display = document.getElementById('leaderboardDisplay');

    if (!data || data.length === 0) {
        display.innerHTML = '<p style="text-align: center; opacity: 0.7;">No data available</p>';
        return;
    }

    const html = data.map((user, index) => {
        const username = user[1] || user[2] || 'Unknown User';
        const value = labelFormatter(user);

        return `
            <div class="leaderboard-item">
                <span class="rank">#${index + 1}</span>
                <span class="username">${escapeHtml(username)}</span>
                <span class="value">${value}</span>
            </div>
        `;
    }).join('');

    display.innerHTML = html;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Note: logout() and showNotification() are provided by nav.js
