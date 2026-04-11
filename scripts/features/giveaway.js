// ===== GIVEAWAY FEATURE =====
// Feature-specific logic for giveaway configuration and dashboard display

function getDashboardCore() {
    return window.DashboardCore;
}

const GiveawayFeature = {

    // ===== FEATURE STATE =====
    state: {
        initialized: false,
        bannedUsers: [],       // [{ id: string, username: string }]
        requiredRoles: [],     // [roleId: string]
        excludedRoles: [],     // [roleId: string]
        roleMultipliers: {},   // { roleId: multiplier }
        activeGiveaways: [],
        recentGiveaways: [],
    },

    // ===== INITIALIZATION =====
    async init() {
        console.log('GiveawayFeature.init() called');
        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('DashboardCore not available');
            return;
        }

        const { Router } = window;
        if (Router) {
            await dashboardCore.initForSPA('giveaway');
        } else {
            await dashboardCore.init('giveaway');
        }

        this.populateGiveawayUI();
        this.setupEventListeners();
        await this.refreshGiveaways();
        this.state.initialized = true;
        console.log('GiveawayFeature initialized');
    },

    // ===== CLEANUP =====
    async cleanup() {
        console.log('GiveawayFeature.cleanup() called');
        this.state.initialized = false;
        this.state.bannedUsers = [];
        this.state.requiredRoles = [];
        this.state.excludedRoles = [];
        this.state.roleMultipliers = {};
        this.state.activeGiveaways = [];
        this.state.recentGiveaways = [];
    },

    // ===== UI POPULATION =====
    populateGiveawayUI() {
        const dashboardCore = getDashboardCore();
        const config = dashboardCore?.state?.guildConfig;
        if (!config) return;

        if (!config.settings) config.settings = {};
        if (!config.settings.giveaway) config.settings.giveaway = {};

        const cfg = config.settings.giveaway;

        // Feature toggle
        const featureToggle = document.getElementById('featureToggle');
        if (featureToggle) {
            featureToggle.checked = cfg.enabled === true;
            featureToggle.addEventListener('change', () => this.markUnsavedChanges());
        }

        // Default emoji
        const defaultEmoji = document.getElementById('defaultEmoji');
        if (defaultEmoji) {
            defaultEmoji.value = cfg.default_emoji || '🎉';
        }

        // Winner log channel
        this._populateChannelSelect('winnerLogChannel', config.available_channels, cfg.winner_log_channel_id || '');

        // DM winner (default true)
        const dmWinner = document.getElementById('dmWinner');
        if (dmWinner) {
            dmWinner.checked = cfg.dm_winner !== false;
        }

        // Recent winner lockout
        const lockout = document.getElementById('recentWinnerLockout');
        if (lockout) {
            lockout.value = cfg.recent_winner_lockout_count || 0;
        }

        // Booster multiplier
        const boosterEnabled = document.getElementById('boosterMultiplierEnabled');
        const boosterValue = document.getElementById('boosterMultiplier');
        if (boosterEnabled) {
            boosterEnabled.checked = cfg.booster_multiplier_enabled === true;
        }
        if (boosterValue) {
            boosterValue.value = cfg.booster_multiplier || 2;
        }
        this._updateBoosterValueVisibility();

        // Min account age
        const minAccountAge = document.getElementById('minAccountAge');
        if (minAccountAge) {
            minAccountAge.value = cfg.min_account_age_days || 0;
        }

        // Min server join age
        const minServerJoinAge = document.getElementById('minServerJoinAge');
        if (minServerJoinAge) {
            minServerJoinAge.value = cfg.min_server_join_days || 0;
        }

        // Required roles
        this.state.requiredRoles = [...(cfg.required_role_ids || [])].map(String);
        this._populateRoleAddSelect('requiredRoleAdd', config.available_roles);
        this._renderRequiredRoles();

        // Excluded roles
        this.state.excludedRoles = [...(cfg.excluded_role_ids || [])].map(String);
        this._populateRoleAddSelect('excludedRoleAdd', config.available_roles);
        this._renderExcludedRoles();

        // Role multipliers: stored as { roleId: multiplier } dict
        this.state.roleMultipliers = { ...(cfg.role_multipliers || {}) };
        this._populateRoleAddSelect('roleMulRoleSelect', config.available_roles);
        this._renderRoleMultipliers();

        // Banned users
        this.state.bannedUsers = (cfg.banned_user_ids || []).map(id => ({
            id: String(id),
            username: `User ${id}`
        }));
        this._renderBannedUsers();
    },

    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Simple fields that just mark unsaved
        const simpleFields = [
            'defaultEmoji', 'winnerLogChannel', 'dmWinner',
            'recentWinnerLockout', 'boosterMultiplier',
            'minAccountAge', 'minServerJoinAge'
        ];
        simpleFields.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const event = el.type === 'checkbox' ? 'change' : 'input';
            el.addEventListener(event, () => this.markUnsavedChanges());
        });

        // Booster enabled toggle — show/hide value input
        const boosterEnabled = document.getElementById('boosterMultiplierEnabled');
        if (boosterEnabled) {
            boosterEnabled.addEventListener('change', () => {
                this._updateBoosterValueVisibility();
                this.markUnsavedChanges();
            });
        }

        // Required role add dropdown
        const requiredRoleAdd = document.getElementById('requiredRoleAdd');
        if (requiredRoleAdd) {
            requiredRoleAdd.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.addRequiredRole(e.target.value);
                    e.target.value = '';
                }
            });
        }

        // Excluded role add dropdown
        const excludedRoleAdd = document.getElementById('excludedRoleAdd');
        if (excludedRoleAdd) {
            excludedRoleAdd.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.addExcludedRole(e.target.value);
                    e.target.value = '';
                }
            });
        }
    },

    // ===== SECTION TOGGLE =====
    toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.toggle('collapsed');
        }
    },

    // ===== SAVE =====
    async saveAllChanges() {
        const dashboardCore = getDashboardCore();
        if (!dashboardCore) return;

        const config = dashboardCore.state?.guildConfig;
        if (!config) return;

        if (!config.settings) config.settings = {};

        config.settings.giveaway = {
            enabled: document.getElementById('featureToggle')?.checked ?? false,
            default_emoji: document.getElementById('defaultEmoji')?.value?.trim() || '🎉',
            winner_log_channel_id: document.getElementById('winnerLogChannel')?.value || null,
            dm_winner: document.getElementById('dmWinner')?.checked ?? true,
            recent_winner_lockout_count: parseInt(
                document.getElementById('recentWinnerLockout')?.value || '0', 10
            ),
            booster_multiplier_enabled: document.getElementById('boosterMultiplierEnabled')?.checked ?? false,
            booster_multiplier: parseInt(
                document.getElementById('boosterMultiplier')?.value || '2', 10
            ),
            min_account_age_days: parseInt(
                document.getElementById('minAccountAge')?.value || '0', 10
            ),
            min_server_join_days: parseInt(
                document.getElementById('minServerJoinAge')?.value || '0', 10
            ),
            required_role_ids: [...this.state.requiredRoles],
            excluded_role_ids: [...this.state.excludedRoles],
            banned_user_ids: this.state.bannedUsers.map(u => u.id),
            role_multipliers: { ...this.state.roleMultipliers },
        };

        const success = await dashboardCore.saveGuildConfig({
            giveaway: config.settings.giveaway
        });

        if (success) {
            const saveBtn = document.getElementById('saveButton');
            if (saveBtn) saveBtn.disabled = true;
            dashboardCore.clearUnsavedChanges();
        }
    },

    // ===== MARK UNSAVED CHANGES =====
    markUnsavedChanges() {
        const dashboardCore = getDashboardCore();
        if (dashboardCore?.markUnsavedChanges) {
            dashboardCore.markUnsavedChanges();
        }
    },

    // ===== REQUIRED ROLES =====
    addRequiredRole(roleId) {
        if (this.state.requiredRoles.includes(String(roleId))) return;
        this.state.requiredRoles.push(String(roleId));
        this._renderRequiredRoles();
        this.markUnsavedChanges();
    },

    removeRequiredRole(roleId) {
        this.state.requiredRoles = this.state.requiredRoles.filter(id => id !== String(roleId));
        this._renderRequiredRoles();
        this.markUnsavedChanges();
    },

    _renderRequiredRoles() {
        const container = document.getElementById('requiredRolesContainer');
        if (!container) return;

        const roles = getDashboardCore()?.state?.guildConfig?.available_roles || [];

        if (this.state.requiredRoles.length === 0) {
            container.innerHTML = '<p class="giveaway-empty-text">No required roles — all members can enter.</p>';
            return;
        }

        container.innerHTML = this.state.requiredRoles.map(roleId => {
            const role = roles.find(r => String(r.id) === String(roleId));
            const name = role ? role.name : `Role ${roleId}`;
            const color = role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5';
            return `
                <div class="giveaway-role-tag" style="border-color: ${color}">
                    <span class="giveaway-role-dot" style="background: ${color}"></span>
                    <span>${this._escapeHtml(name)}</span>
                    <button class="btn-remove-icon" onclick="GiveawayFeature.removeRequiredRole('${this._escapeHtml(roleId)}')" title="Remove">✕</button>
                </div>
            `;
        }).join('');
    },

    // ===== EXCLUDED ROLES =====
    addExcludedRole(roleId) {
        if (this.state.excludedRoles.includes(String(roleId))) return;
        this.state.excludedRoles.push(String(roleId));
        this._renderExcludedRoles();
        this.markUnsavedChanges();
    },

    removeExcludedRole(roleId) {
        this.state.excludedRoles = this.state.excludedRoles.filter(id => id !== String(roleId));
        this._renderExcludedRoles();
        this.markUnsavedChanges();
    },

    _renderExcludedRoles() {
        const container = document.getElementById('excludedRolesContainer');
        if (!container) return;

        const roles = getDashboardCore()?.state?.guildConfig?.available_roles || [];

        if (this.state.excludedRoles.length === 0) {
            container.innerHTML = '<p class="giveaway-empty-text">No excluded roles.</p>';
            return;
        }

        container.innerHTML = this.state.excludedRoles.map(roleId => {
            const role = roles.find(r => String(r.id) === String(roleId));
            const name = role ? role.name : `Role ${roleId}`;
            const color = role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5';
            return `
                <div class="giveaway-role-tag" style="border-color: ${color}">
                    <span class="giveaway-role-dot" style="background: ${color}"></span>
                    <span>${this._escapeHtml(name)}</span>
                    <button class="btn-remove-icon" onclick="GiveawayFeature.removeExcludedRole('${this._escapeHtml(roleId)}')" title="Remove">✕</button>
                </div>
            `;
        }).join('');
    },

    // ===== ROLE MULTIPLIERS =====
    addRoleMultiplier() {
        const roleSelect = document.getElementById('roleMulRoleSelect');
        const valueInput = document.getElementById('roleMulValue');
        if (!roleSelect || !valueInput) return;

        const roleId = roleSelect.value;
        const mult = parseInt(valueInput.value, 10);

        if (!roleId) {
            alert('Please select a role.');
            return;
        }
        if (!mult || mult < 2 || mult > 10) {
            alert('Multiplier must be between 2 and 10.');
            return;
        }

        this.state.roleMultipliers[roleId] = mult;
        this._renderRoleMultipliers();
        this.markUnsavedChanges();

        roleSelect.value = '';
        valueInput.value = '';
    },

    removeRoleMultiplier(roleId) {
        delete this.state.roleMultipliers[roleId];
        this._renderRoleMultipliers();
        this.markUnsavedChanges();
    },

    _renderRoleMultipliers() {
        const container = document.getElementById('roleMultipliersList');
        if (!container) return;

        const roles = getDashboardCore()?.state?.guildConfig?.available_roles || [];
        const entries = Object.entries(this.state.roleMultipliers);

        if (entries.length === 0) {
            container.innerHTML = '<p class="giveaway-empty-text">No role multipliers configured.</p>';
            return;
        }

        container.innerHTML = entries.map(([roleId, mult]) => {
            const role = roles.find(r => String(r.id) === String(roleId));
            const name = role ? role.name : `Role ${roleId}`;
            const color = role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5';
            return `
                <div class="giveaway-role-multiplier-row">
                    <span class="role-dot" style="background: ${color}"></span>
                    <span class="role-name">${this._escapeHtml(name)}</span>
                    <span class="multiplier-value">${mult}× entries</span>
                    <button class="btn-remove-icon" onclick="GiveawayFeature.removeRoleMultiplier('${this._escapeHtml(roleId)}')" title="Remove">✕</button>
                </div>
            `;
        }).join('');
    },

    // ===== BANNED USERS =====
    addBannedUser() {
        const input = document.getElementById('bannedUserInput');
        if (!input) return;

        const userId = input.value.trim();
        if (!userId || !/^\d{17,20}$/.test(userId)) {
            alert('Please enter a valid Discord User ID (17–20 digits).');
            return;
        }
        if (this.state.bannedUsers.some(u => u.id === userId)) {
            alert('This user is already in the banned list.');
            return;
        }

        this.state.bannedUsers.push({ id: userId, username: `User ${userId}` });
        this._renderBannedUsers();
        this.markUnsavedChanges();
        input.value = '';
    },

    removeBannedUser(userId) {
        this.state.bannedUsers = this.state.bannedUsers.filter(u => u.id !== String(userId));
        this._renderBannedUsers();
        this.markUnsavedChanges();
    },

    _renderBannedUsers() {
        const container = document.getElementById('bannedUsersList');
        if (!container) return;

        if (this.state.bannedUsers.length === 0) {
            container.innerHTML = '<p class="giveaway-empty-text">No banned users.</p>';
            return;
        }

        container.innerHTML = this.state.bannedUsers.map(user => `
            <div class="giveaway-banned-entry">
                <div class="user-info">
                    <span class="user-name">${this._escapeHtml(user.username)}</span>
                    <span class="user-id">${this._escapeHtml(user.id)}</span>
                </div>
                <button class="btn-remove-icon" onclick="GiveawayFeature.removeBannedUser('${this._escapeHtml(user.id)}')" title="Remove ban">✕</button>
            </div>
        `).join('');
    },

    // ===== ACTIVE / RECENT GIVEAWAYS =====
    async refreshGiveaways() {
        const dashboardCore = getDashboardCore();
        const guildId = dashboardCore?.state?.currentGuildId;
        if (!guildId) return;

        const token = localStorage.getItem('discord_token');
        const apiBase = window.AppConfig?.apiBaseUrl || '';
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            const [activeRes, recentRes] = await Promise.all([
                fetch(`${apiBase}/api/guilds/${guildId}/giveaways?status=active&limit=10`,
                    { headers, credentials: 'include' }),
                fetch(`${apiBase}/api/guilds/${guildId}/giveaways?status=ended&limit=10`,
                    { headers, credentials: 'include' })
            ]);

            const activeData = activeRes.ok ? await activeRes.json() : { success: false };
            const recentData = recentRes.ok ? await recentRes.json() : { success: false };

            this.state.activeGiveaways = activeData.success ? activeData.data : [];
            this.state.recentGiveaways = recentData.success ? recentData.data : [];

            this._renderActiveGiveaways();
            this._renderRecentGiveaways();
        } catch (err) {
            console.error('Failed to load giveaways:', err);
            const activeList = document.getElementById('activeGiveawaysList');
            if (activeList) {
                activeList.innerHTML = '<p class="giveaway-error-text">Failed to load giveaways.</p>';
            }
        }
    },

    _renderActiveGiveaways() {
        const container = document.getElementById('activeGiveawaysList');
        if (!container) return;

        if (!this.state.activeGiveaways.length) {
            container.innerHTML = '<p class="giveaway-empty-text">No active giveaways.</p>';
            return;
        }

        container.innerHTML = this.state.activeGiveaways.map(g => {
            const endTime = new Date(g.end_time);
            const now = Date.now();
            const diffMs = endTime.getTime() - now;
            const timeLeft = diffMs > 0 ? this._formatTimeLeft(diffMs) : 'Ending soon';

            return `
                <div class="giveaway-card active">
                    <div class="giveaway-card-header">
                        <span class="giveaway-prize">${this._escapeHtml(g.prize)}</span>
                        <span class="giveaway-status-badge active">Active</span>
                    </div>
                    ${g.description ? `<p class="giveaway-desc">${this._escapeHtml(g.description)}</p>` : ''}
                    <div class="giveaway-meta">
                        <span>🎟️ ${(g.entry_count || 0).toLocaleString()} entries</span>
                        <span>⏰ Ends in ${timeLeft}</span>
                        <span>📅 ${endTime.toLocaleString()}</span>
                    </div>
                    <div class="giveaway-card-footer">
                        <button class="giveaway-btn-danger" onclick="GiveawayFeature.cancelGiveaway(${g.id})">
                            Cancel Giveaway
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    _renderRecentGiveaways() {
        const container = document.getElementById('recentGiveawaysList');
        if (!container) return;

        if (!this.state.recentGiveaways.length) {
            container.innerHTML = '<p class="giveaway-empty-text">No recent giveaways.</p>';
            return;
        }

        container.innerHTML = this.state.recentGiveaways.map(g => {
            const endTime = new Date(g.end_time);
            const winnerStr = g.winner_id && g.winner_id !== 0
                ? `🏆 Winner: <code>${this._escapeHtml(String(g.winner_id))}</code>`
                : '<span style="color: var(--text-muted)">No winner</span>';

            return `
                <div class="giveaway-card ended">
                    <div class="giveaway-card-header">
                        <span class="giveaway-prize">${this._escapeHtml(g.prize)}</span>
                        <span class="giveaway-status-badge ended">Ended</span>
                    </div>
                    ${g.description ? `<p class="giveaway-desc">${this._escapeHtml(g.description)}</p>` : ''}
                    <div class="giveaway-meta">
                        <span>🎟️ ${(g.entry_count || 0).toLocaleString()} entries</span>
                        <span>${winnerStr}</span>
                        <span>📅 ${endTime.toLocaleDateString()}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    async cancelGiveaway(giveawayId) {
        if (!confirm('Are you sure you want to cancel this giveaway? This cannot be undone.')) return;

        const dashboardCore = getDashboardCore();
        const guildId = dashboardCore?.state?.currentGuildId;
        const token = localStorage.getItem('discord_token');
        const apiBase = window.AppConfig?.apiBaseUrl || '';

        try {
            const res = await fetch(
                `${apiBase}/api/guilds/${guildId}/giveaways/${giveawayId}/cancel`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                }
            );
            const data = await res.json();
            if (data.success) {
                dashboardCore.showSuccess('Giveaway cancelled.');
                await this.refreshGiveaways();
            } else {
                dashboardCore.showError(`Failed to cancel: ${data.message}`);
            }
        } catch (err) {
            console.error('Cancel giveaway error:', err);
            dashboardCore.showError('Failed to cancel giveaway. Please try again.');
        }
    },

    // ===== HELPERS =====

    _populateChannelSelect(selectId, channels, selectedValue) {
        const select = document.getElementById(selectId);
        if (!select) return;

        // Clear all but the first "None" option
        while (select.options.length > 1) select.remove(1);

        if (!channels || !Array.isArray(channels)) return;

        channels.forEach(ch => {
            // Only text (0) and announcement (5) channels
            if (ch.type !== 0 && ch.type !== 5) return;
            const opt = document.createElement('option');
            opt.value = ch.id;
            opt.textContent = `#${ch.name}`;
            if (String(ch.id) === String(selectedValue)) opt.selected = true;
            select.appendChild(opt);
        });

        if (selectedValue) select.value = String(selectedValue);
    },

    _populateRoleAddSelect(selectId, roles) {
        const select = document.getElementById(selectId);
        if (!select || !roles) return;

        while (select.options.length > 1) select.remove(1);

        roles
            .filter(r => !r.managed && r.name !== '@everyone')
            .forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                select.appendChild(opt);
            });
    },

    _updateBoosterValueVisibility() {
        const enabled = document.getElementById('boosterMultiplierEnabled')?.checked;
        const group = document.getElementById('boosterMultiplierValueGroup');
        if (group) {
            group.style.display = enabled ? '' : 'none';
        }
    },

    _formatTimeLeft(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str || '')));
        return div.innerHTML;
    },
};

// Export feature module for SPA
window.GiveawayFeature = GiveawayFeature;

// MPA backwards compatibility — auto-init if not in SPA mode
if (!window.Router) {
    document.addEventListener('DOMContentLoaded', async () => {
        await GiveawayFeature.init();
    });
}
