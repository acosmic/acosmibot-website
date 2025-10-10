let userGuilds = [];

document.addEventListener('DOMContentLoaded', async function() {
    await loadUserGuilds();
});

async function loadUserGuilds() {
    try {
        const token = localStorage.getItem('discord_token');
        if (!token) {
            showError('You need to be logged in to view your servers.');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/user/guilds`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            userGuilds = data.guilds;
            displayGuilds();
        } else {
            throw new Error(data.message || 'Failed to load guilds');
        }

    } catch (error) {
        console.error('Error loading guilds:', error);
        showError('Failed to load your servers. Please try again.');
    }
}

function displayGuilds() {
    const content = document.getElementById('content');

    if (!userGuilds || userGuilds.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <h3>No Servers Found</h3>
                <p>You don't have access to any servers with Acosmibot, or you don't have admin permissions.</p>
                <a href="/" class="btn btn-primary">Go Home</a>
            </div>
        `;
        return;
    }

    const guildsHTML = userGuilds.map(guild => {
        const permissions = [];
        if (guild.owner) {
            permissions.push('<span class="permission-badge owner">👑 Owner</span>');
        } else if (guild.permissions && guild.permissions.includes('administrator')) {
            permissions.push('<span class="permission-badge admin">⚡ Admin</span>');
        } else {
            permissions.push('<span class="permission-badge member">👤 Member</span>');
        }

        const guildIconHTML = guild.icon
            ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128" alt="${guild.name}">`
            : guild.name.charAt(0).toUpperCase();

        const canManage = guild.owner || (guild.permissions && guild.permissions.includes('administrator'));

        return `
            <div class="guild-card" onclick="selectGuild('${guild.id}', ${canManage})">
                <div class="guild-header">
                    <div class="guild-icon">
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
                    ${permissions.join('')}
                </div>

                <div class="action-buttons">
                    <a href="/guild-dashboard.html?guild=${guild.id}" class="btn btn-primary" onclick="event.stopPropagation()">
                        📊 View Stats
                    </a>
                    ${canManage ? `
                        <a href="/guild-dashboard.html?guild=${guild.id}&tab=settings" class="btn btn-secondary" onclick="event.stopPropagation()">
                            ⚙️ Settings
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div class="guilds-grid">
            ${guildsHTML}
        </div>
    `;
}

function selectGuild(guildId, canManage) {
    // Navigate to guild dashboard
    window.location.href = `/guild-dashboard.html?guild=${guildId}`;
}

function showError(message) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="error-state">
            <h3>Error</h3>
            <p>${escapeHtml(message)}</p>
            <button onclick="loadUserGuilds()" class="btn btn-primary">Try Again</button>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}