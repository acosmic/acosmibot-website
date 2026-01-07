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
        gameStats: null,
        rankData: null
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
        this.state.gameStats = null;
        this.state.rankData = null;
    },

    async loadUserStats() {
        const dashboardCore = getDashboardCore();
        const currentUser = dashboardCore?.state?.currentUser;

        if (!currentUser || !currentUser.id) {
            console.warn('No current user available');
            return;
        }

        const token = localStorage.getItem('discord_token');
        const userId = currentUser.id;

        try {
            // Fetch all user data in parallel
            const [userResponse, gamesResponse, rankResponse] = await Promise.all([
                fetch(`${dashboardCore.API_BASE_URL}/api/user/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${dashboardCore.API_BASE_URL}/api/user/${userId}/games`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${dashboardCore.API_BASE_URL}/api/user/${userId}/rank/exp`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (userResponse.ok) {
                this.state.userStats = await userResponse.json();
            }

            if (gamesResponse.ok) {
                this.state.gameStats = await gamesResponse.json();
            }

            if (rankResponse.ok) {
                this.state.rankData = await rankResponse.json();
            }

            console.log('User stats loaded:', this.state.userStats, this.state.gameStats, this.state.rankData);

        } catch (error) {
            console.error('Error loading user stats:', error);
        }
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

        const userStats = this.state.userStats || {};
        const gameStats = this.state.gameStats || {};
        const rankData = this.state.rankData || {};

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

        // Stats
        this.setStatValue('userLevel', userStats.level || currentUser.level || 1);
        this.setStatValue('userCredits', this.formatNumber(userStats.currency || currentUser.currency || 0));
        this.setStatValue('userRank', rankData.rank ? `#${rankData.rank}` : '-');
        this.setStatValue('userMessages', this.formatNumber(userStats.total_messages || 0));
        this.setStatValue('userReactions', this.formatNumber(userStats.total_reactions || 0));
        this.setStatValue('userGames', gameStats.total_games || 0);
        this.setStatValue('userWinRate', `${gameStats.win_rate || 0}%`);

        // Member since
        const memberSince = userStats.first_seen || currentUser.first_seen;
        if (memberSince) {
            const date = new Date(memberSince);
            this.setStatValue('memberSince', date.toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric'
            }));
        }
    },

    populateServerInfo(guildConfig) {
        if (!guildConfig) return;

        // Server icon
        const iconEl = document.getElementById('serverIcon');
        if (iconEl) {
            if (guildConfig.guild_icon) {
                iconEl.style.backgroundImage = `url('${guildConfig.guild_icon}')`;
            } else if (guildConfig.guild_name) {
                iconEl.textContent = guildConfig.guild_name.charAt(0).toUpperCase();
            }
        }

        // Server name
        const nameEl = document.getElementById('serverName');
        if (nameEl) {
            nameEl.textContent = guildConfig.guild_name || 'Unknown Server';
        }

        // Member count
        const memberEl = document.getElementById('serverMemberCount');
        if (memberEl) {
            const count = guildConfig.member_count || guildConfig.approximate_member_count || 0;
            memberEl.textContent = `${this.formatNumber(count)} members`;
        }

        // Enabled features
        this.populateEnabledFeatures(guildConfig.settings);
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
