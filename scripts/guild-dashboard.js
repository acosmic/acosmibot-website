const API_BASE_URL = 'https://api.acosmibot.com';
let guildId = '1155577094940655696'; // Default to your guild
let guildConfig = null;

async function loadDashboard() {
    try {
        const token = localStorage.getItem('discord_token');
        if (!token) {
            showError('No authentication token found. Please login first.');
            return;
        }

        console.log('Loading dashboard for guild:', guildId);

        // Load guild config using our working hybrid endpoint
        const response = await fetch(`${API_BASE_URL}/api/guilds/${guildId}/config-hybrid`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`Failed to load guild config: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Dashboard data:', data);

        if (data.success) {
            guildConfig = data.data;
            setupDashboard();
        } else {
            throw new Error(data.message || 'Failed to load guild config');
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showError('Failed to load dashboard: ' + error.message);

        // Show the error in the dashboard grid too
        document.getElementById('dashboardGrid').innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <h3>Failed to load dashboard</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="loadDashboard()">Retry</button>
            </div>
        `;
    }
}

function setupDashboard() {
    // Update guild name
    document.getElementById('guildName').textContent = guildConfig.guild_name;

    // Update guild info
    document.getElementById('guildInfo').innerHTML = `
        <p><strong>Roles:</strong> ${guildConfig.available_roles.length} | <strong>Channels:</strong> ${guildConfig.available_channels.length}</p>
        <p><strong>Permission Method:</strong> ${guildConfig.permissions.method}</p>
    `;

    // Create feature cards
    createFeatureCards();
}

function createFeatureCards() {
    const settings = guildConfig.settings;
    const dashboardGrid = document.getElementById('dashboardGrid');

    dashboardGrid.innerHTML = `
        <!-- Leveling System -->
        <div class="feature-card ${settings.leveling?.enabled ? 'enabled' : ''}" id="levelingCard">
            <div class="feature-header">
                <div class="feature-title">
                    📈 Leveling System
                </div>
                <div class="toggle-switch ${settings.leveling?.enabled ? 'active' : ''}"
                     id="levelingToggle" onclick="toggleFeature('leveling')"></div>
            </div>
            <div class="feature-content">
                <div class="setting-item">
                    <label class="setting-label">XP per Message</label>
                    <input type="number" class="form-control" id="expPerMessage"
                           value="${settings.leveling?.exp_per_message || 15}" min="1" max="100">
                </div>
                <div class="setting-item">
                    <label class="setting-label">XP Cooldown (seconds)</label>
                    <input type="number" class="form-control" id="expCooldown"
                           value="${settings.leveling?.exp_cooldown_seconds || 60}" min="0" max="300">
                </div>
                <div class="setting-item">
                    <label class="setting-label">Level Up Announcements</label>
                    <div class="toggle-switch ${settings.leveling?.level_up_announcements ? 'active' : ''}"
                         id="levelUpAnnouncements" onclick="toggleSetting('levelUpAnnouncements')"></div>
                </div>
                <button class="btn btn-primary" onclick="saveLevelingSettings()">Save Settings</button>
            </div>
        </div>

        <!-- Role System -->
        <div class="feature-card ${settings.roles?.enabled ? 'enabled' : ''}" id="roleCard">
            <div class="feature-header">
                <div class="feature-title">
                    🎭 Role Assignment
                </div>
                <div class="toggle-switch ${settings.roles?.enabled ? 'active' : ''}"
                     id="roleToggle" onclick="toggleFeature('roles')"></div>
            </div>
            <div class="feature-content">
                <div class="setting-item">
                    <label class="setting-label">Assignment Mode</label>
                    <select class="form-control" id="roleMode">
                        <option value="progressive" ${settings.roles?.mode === 'progressive' ? 'selected' : ''}>Progressive (Remove old roles)</option>
                        <option value="additive" ${settings.roles?.mode === 'additive' ? 'selected' : ''}>Additive (Keep all roles)</option>
                    </select>
                </div>
                <div class="setting-item">
                    <label class="setting-label">Role Announcements</label>
                    <div class="toggle-switch ${settings.roles?.role_announcement ? 'active' : ''}"
                         id="roleAnnouncements" onclick="toggleSetting('roleAnnouncements')"></div>
                </div>
                <button class="btn btn-primary" onclick="saveRoleSettings()">Save Settings</button>
            </div>
        </div>

        <!-- Economy System -->
        <div class="feature-card ${settings.economy?.enabled ? 'enabled' : ''}" id="economyCard">
            <div class="feature-header">
                <div class="feature-title">
                    💰 Economy System
                </div>
                <div class="toggle-switch ${settings.economy?.enabled ? 'active' : ''}"
                     id="economyToggle" onclick="toggleFeature('economy')"></div>
            </div>
            <div class="feature-content">
                <div class="setting-item">
                    <label class="setting-label">Daily Bonus Amount</label>
                    <input type="number" class="form-control" id="dailyBonus"
                           value="${settings.economy?.daily_bonus || 100}" min="0" max="1000">
                </div>
                <div class="setting-item">
                    <label class="setting-label">Enable Gambling</label>
                    <div class="toggle-switch ${settings.economy?.gambling_enabled !== false ? 'active' : ''}"
                         id="gamblingEnabled" onclick="toggleSetting('gamblingEnabled')"></div>
                </div>
                <button class="btn btn-primary" onclick="saveEconomySettings()">Save Settings</button>
            </div>
        </div>
    `;
}

function toggleFeature(feature) {
    const toggle = document.getElementById(feature + 'Toggle');
    const card = document.getElementById(feature + 'Card');

    toggle.classList.toggle('active');
    card.classList.toggle('enabled');

    const isEnabled = toggle.classList.contains('active');

    // Auto-save the main toggle
    if (feature === 'leveling') {
        saveLevelingSettings();
    } else if (feature === 'roles') {
        saveRoleSettings();
    } else if (feature === 'economy') {
        saveEconomySettings();
    }
}

function toggleSetting(settingId) {
    const toggle = document.getElementById(settingId);
    toggle.classList.toggle('active');
}

async function saveLevelingSettings() {
    try {
        const token = localStorage.getItem('discord_token');
        const settings = {
            enabled: document.getElementById('levelingToggle').classList.contains('active'),
            exp_per_message: parseInt(document.getElementById('expPerMessage').value) || 15,
            exp_cooldown_seconds: parseInt(document.getElementById('expCooldown').value) || 60,
            level_up_announcements: document.getElementById('levelUpAnnouncements').classList.contains('active'),
            announcement_channel_id: null
        };

        const response = await fetch(`${API_BASE_URL}/api/guilds/${guildId}/leveling`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        const data = await response.json();
        if (data.success) {
            showSuccess('Role settings saved!');
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error saving role settings:', error);
        showError('Failed to save role settings');
    }
}

async function saveEconomySettings() {
    try {
        const token = localStorage.getItem('discord_token');
        const settings = {
            enabled: document.getElementById('economyToggle').classList.contains('active'),
            daily_bonus: parseInt(document.getElementById('dailyBonus').value) || 100,
            gambling_enabled: document.getElementById('gamblingEnabled').classList.contains('active')
        };

        const response = await fetch(`${API_BASE_URL}/api/guilds/${guildId}/economy`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        const data = await response.json();
        if (data.success) {
            showSuccess('Economy settings saved!');
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error saving economy settings:', error);
        showError('Failed to save economy settings');
    }
}

function showSuccess(message) {
    showStatus(message, 'success');
}

function showError(message) {
    showStatus(message, 'error');
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type} show`;

    setTimeout(() => {
        status.classList.remove('show');
    }, 3000);
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', loadDashboard);

async function saveRoleSettings() {
    try {
        const token = localStorage.getItem('discord_token');
        const settings = {
            enabled: document.getElementById('roleToggle').classList.contains('active'),
            mode: document.getElementById('roleMode').value,
            role_announcement: document.getElementById('roleAnnouncements').classList.contains('active')
        };

        const response = await fetch(`${API_BASE_URL}/api/guilds/${guildId}/roles`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        const data = await response.json();
        if (data.success) {
                                showSuccess('Role settings saved!');
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error saving role settings:', error);
        showError('Failed to save role settings');
    }
}