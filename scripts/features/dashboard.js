/**
 * Dashboard Feature Module
 * Shows user stats and server overview
 */

function getDashboardCore() {
    return window.DashboardCore;
}

const DashboardFeature = {
    state: {
        initialized: false,
        userStats: null,
        guildStats: null
    },

    async init() {
        console.log('DashboardFeature.init() called');

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('DashboardCore not available');
            return;
        }

        await dashboardCore.initForSPA('dashboard');

        // Load user stats from API
        await this.loadUserStats();

        // Populate the UI
        this.populateDashboardUI();

        this.state.initialized = true;
        console.log('DashboardFeature initialized');
    },

    async cleanup() {
        console.log('DashboardFeature.cleanup() called');
        this.state.initialized = false;
        this.state.userStats = null;
        this.state.guildStats = null;
    },

    async loadUserStats() {
        const dashboardCore = getDashboardCore();
        const currentUser = dashboardCore?.state?.currentUser;
        const guildId = dashboardCore?.state?.currentGuildId;

        if (!currentUser || !currentUser.id) {
            console.warn('No current user available');
            return;
        }

        if (!guildId) {
            console.warn('No guild ID available');
            return;
        }

        const token = localStorage.getItem('discord_token');
        const userId = currentUser.id;

        // Try to fetch server-specific stats (may fail if API not available)
        try {
            const userStatsResponse = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${guildId}/user/${userId}/stats`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (userStatsResponse.ok) {
                const userData = await userStatsResponse.json();
                this.state.userStats = userData.success ? userData.data : userData;
            }
        } catch (error) {
            console.warn('Could not load user stats:', error.message);
        }

        // Try to fetch guild stats (may fail due to CORS/API issues)
        try {
            const guildStatsResponse = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${guildId}/stats-db`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (guildStatsResponse.ok) {
                const guildData = await guildStatsResponse.json();
                this.state.guildStats = guildData.success ? guildData.data : guildData;
            }
        } catch (error) {
            console.warn('Could not load guild stats:', error.message);
        }

        console.log('Stats loaded:', this.state.userStats, this.state.guildStats);
    },

    populateDashboardUI() {
        const dashboardCore = getDashboardCore();
        const currentUser = dashboardCore?.state?.currentUser;
        const guildConfig = dashboardCore?.state?.guildConfig;

        // Populate user stats
        this.populateUserStats(currentUser);

        // Populate server info
        this.populateServerInfo(guildConfig);
    },

    populateUserStats(currentUser) {
        if (!currentUser) return;

        // Server-specific stats from /api/guilds/{guildId}/user/{userId}/stats
        const userStats = this.state.userStats || {};

        // Avatar
        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
            if (currentUser.avatar) {
                const avatarUrl = currentUser.avatar.startsWith('http')
                    ? currentUser.avatar
                    : `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=128`;
                avatarEl.style.backgroundImage = `url('${avatarUrl}')`;
            } else {
                avatarEl.textContent = (currentUser.username || 'U').charAt(0).toUpperCase();
            }
        }

        // Username
        const nameEl = document.getElementById('userName');
        if (nameEl) {
            nameEl.textContent = currentUser.global_name || currentUser.username || 'Unknown User';
        }

        // Server-specific stats (field names from guild-stats.js userStats structure)
        this.setStatValue('userLevel', userStats.level || 1);
        this.setStatValue('userCredits', this.formatNumber(userStats.currency || 0));
        this.setStatValue('userRank', userStats.rank ? `#${userStats.rank}` : '-');
        this.setStatValue('userMessages', this.formatNumber(userStats.messages || 0));
        this.setStatValue('userReactions', this.formatNumber(userStats.reactions || 0));
        this.setStatValue('userExp', this.formatNumber(userStats.exp || 0));

        // Member since (joined_at from server-specific stats)
        const memberSince = userStats.joined_at;
        if (memberSince) {
            const date = new Date(memberSince);
            this.setStatValue('memberSince', date.toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric'
            }));
        } else {
            this.setStatValue('memberSince', '-');
        }
    },

    populateServerInfo(guildConfig) {
        const dashboardCore = getDashboardCore();
        const guildId = dashboardCore?.state?.currentGuildId;
        const guildStats = this.state.guildStats || {};

        // Try to get guild info from userGuilds list (has icon hash and member_count)
        const currentGuild = dashboardCore?.state?.userGuilds?.find(g => g.id === guildId);

        // Server icon - construct proper Discord CDN URL
        const iconEl = document.getElementById('serverIcon');
        if (iconEl) {
            // Check for icon hash in order of preference
            const iconHash = currentGuild?.icon || guildConfig?.guild_icon;
            if (iconHash && guildId) {
                const iconUrl = `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=128`;
                iconEl.style.backgroundImage = `url('${iconUrl}')`;
                iconEl.textContent = '';
            } else {
                // Fallback to first letter
                const guildName = guildStats.guild_name || guildConfig?.guild_name || currentGuild?.name || 'S';
                iconEl.textContent = guildName.charAt(0).toUpperCase();
                iconEl.style.backgroundImage = '';
            }
        }

        // Server name (prefer guildStats as it's from the DB)
        const nameEl = document.getElementById('serverName');
        if (nameEl) {
            nameEl.textContent = guildStats.guild_name || guildConfig?.guild_name || currentGuild?.name || 'Unknown Server';
        }

        // Member count from guild stats API (more accurate)
        const memberEl = document.getElementById('serverMemberCount');
        if (memberEl) {
            const count = guildStats.member_count || currentGuild?.member_count || guildConfig?.member_count || 0;
            const activeCount = guildStats.total_active_members;
            if (activeCount) {
                memberEl.textContent = `${this.formatNumber(count)} members (${this.formatNumber(activeCount)} active)`;
            } else {
                memberEl.textContent = `${this.formatNumber(count)} members`;
            }
        }

        // Enabled features
        if (guildConfig?.settings) {
            this.populateEnabledFeatures(guildConfig.settings);
        }
    },

    populateEnabledFeatures(settings) {
        const container = document.getElementById('enabledFeatures');
        if (!container || !settings) return;

        const features = [
            { key: 'leveling', name: 'Leveling', enabled: settings.leveling?.enabled },
            { key: 'twitch', name: 'Twitch', enabled: settings.twitch?.enabled },
            { key: 'youtube', name: 'YouTube', enabled: settings.youtube?.enabled },
            { key: 'games', name: 'Games', enabled: settings.games?.enabled },
            { key: 'ai', name: 'AI', enabled: settings.ai?.enabled },
            { key: 'reaction_roles', name: 'Reaction Roles', enabled: settings.reaction_roles?.enabled }
        ];

        container.innerHTML = features.map(feature => {
            const enabledClass = feature.enabled ? '' : 'disabled';
            const statusIcon = feature.enabled ? '✓' : '✗';
            return `<span class="feature-badge ${enabledClass}">${statusIcon} ${feature.name}</span>`;
        }).join('');
    },

    navigateTo(feature) {
        const dashboardCore = getDashboardCore();
        if (dashboardCore) {
            dashboardCore.navigateToFeature(feature);
        }
    },

    setStatValue(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    },

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }
};

// Export for feature loader
window.DashboardFeature = DashboardFeature;
