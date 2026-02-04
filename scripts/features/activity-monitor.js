/**
 * Activity Monitor Feature Module
 * Manages activity-based role assignment (streaming, playing, listening, etc.)
 */

const ActivityMonitorFeature = (function() {
    'use strict';

    let state = {
        guildId: null,
        config: null,
        roles: [],
        editingRuleId: null
    };

    const ACTIVITY_TYPES = [
        { value: 'playing', label: 'Playing (Game)', icon: '🎮', description: 'Assign role when playing a game' },
        { value: 'streaming', label: 'Streaming', icon: '📺', description: 'Assign role when streaming on Twitch/YouTube' },
        { value: 'listening', label: 'Listening (Music)', icon: '🎵', description: 'Assign role when listening to music' },
        { value: 'watching', label: 'Watching (Video)', icon: '👀', description: 'Assign role when watching something' },
        { value: 'competing', label: 'Competing', icon: '🏆', description: 'Assign role when competing' },
        { value: 'custom', label: 'Custom Status', icon: '💬', description: 'Assign role with custom status' }
    ];

    // ========================================================================
    // Initialization
    // ========================================================================

    async function init() {
        console.log('[ActivityMonitor] Init called');

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('[ActivityMonitor] DashboardCore not available');
            showError('Dashboard not initialized');
            return;
        }

        const guildId = dashboardCore.state.currentGuildId;
        if (!guildId) {
            console.error('[ActivityMonitor] No guild ID available');
            showError('No guild selected');
            return;
        }

        state.guildId = guildId;

        // Initialize dashboard core for SPA
        await dashboardCore.initForSPA('activity-monitor');

        // Load CSS
        loadCSS('/styles/activity-monitor.css');

        // Load HTML view
        await loadView();

        // Load roles from dashboard config
        loadRolesFromConfig();

        // Load configuration
        await loadConfig();

        // Render UI
        renderUI();
    }

    async function loadView() {
        const viewContainer = document.getElementById('activityMonitorView');
        if (!viewContainer) {
            console.error('[ActivityMonitor] View container not found');
            return;
        }

        try {
            const response = await fetch('/server/views/activity-monitor-view.html');
            const html = await response.text();
            viewContainer.innerHTML = html;
        } catch (error) {
            console.error('[ActivityMonitor] Failed to load view:', error);
            viewContainer.innerHTML = '<div class="error-message">Failed to load activity monitor view</div>';
        }
    }

    function loadRolesFromConfig() {
        const dashboardCore = getDashboardCore();
        state.roles = dashboardCore?.state?.guildConfig?.available_roles || [];
        console.log('[ActivityMonitor] Loaded roles:', state.roles.length);
    }

    // ========================================================================
    // API Calls
    // ========================================================================

    async function loadConfig() {
        try {
            showLoading();
            const dashboardCore = getDashboardCore();
            const token = getAuthToken();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/activity-monitor/config`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load configuration');
            }

            const result = await response.json();
            state.config = result.data;
            console.log('[ActivityMonitor] Loaded config:', state.config);
        } catch (error) {
            console.error('[ActivityMonitor] Load config error:', error);
            showError('Failed to load activity monitor configuration');
            // Use default config
            state.config = {
                enabled: false,
                check_interval: 60,
                rules: []
            };
        } finally {
            hideLoading();
        }
    }

    async function saveConfig() {
        try {
            showLoading('Saving configuration...');
            const dashboardCore = getDashboardCore();
            const token = getAuthToken();
            const response = await fetch(
                `${dashboardCore.API_BASE_URL}/api/guilds/${state.guildId}/activity-monitor/config`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(state.config)
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                const errorMsg = result.errors ?
                    result.errors.map(e => typeof e === 'string' ? e : e.message).join(', ') :
                    result.message || 'Failed to save configuration';
                throw new Error(errorMsg);
            }

            showSuccess('Configuration saved successfully!');
            state.config = result.data;
            renderUI();
        } catch (error) {
            console.error('[ActivityMonitor] Save config error:', error);
            showError(error.message || 'Failed to save configuration');
        } finally {
            hideLoading();
        }
    }

    // ========================================================================
    // UI Rendering
    // ========================================================================

    function renderUI() {
        const container = document.getElementById('activityMonitorContainer');
        if (!container) {
            console.error('[ActivityMonitor] Container not found');
            return;
        }

        const html = `
            <div class="activity-monitor-view">
                <div class="feature-header">
                    <div class="header-content">
                        <h1>Activity Monitor</h1>
                        <p>Automatically assign roles based on Discord activities (streaming, playing games, listening to music, etc.)</p>
                    </div>
                </div>

                <div class="master-control-section">
                    <div class="control-row">
                        <div class="control-label">
                            <strong>Activity Monitor</strong>
                            <span class="help-text">Enable automatic role assignment based on user activities</span>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="masterEnable" ${state.config.enabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                ${state.config.enabled ? renderRulesSection() : renderDisabledMessage()}
            </div>
        `;

        container.innerHTML = html;
        attachEventListeners();
    }

    function renderDisabledMessage() {
        return `
            <div class="disabled-message">
                <div class="icon">⚠️</div>
                <h3>Activity Monitor is Disabled</h3>
                <p>Enable the activity monitor above to start creating rules.</p>
            </div>
        `;
    }

    function renderRulesSection() {
        return `
            <div class="rules-section">
                <div class="section-header">
                    <h2>Activity Rules</h2>
                    <button class="btn btn-primary" id="addRuleBtn">
                        <span>➕</span> Add Rule
                    </button>
                </div>

                ${state.config.rules.length === 0 ? renderEmptyRules() : renderRulesList()}
            </div>

            <div class="action-buttons">
                <button class="btn btn-success btn-lg" id="saveConfigBtn">
                    <span>💾</span> Save Configuration
                </button>
            </div>

            ${renderRuleEditorModal()}
        `;
    }

    function renderEmptyRules() {
        return `
            <div class="empty-state">
                <div class="icon">📋</div>
                <h3>No Rules Configured</h3>
                <p>Create your first activity monitoring rule to get started.</p>
                <button class="btn btn-primary" onclick="ActivityMonitorFeature.openRuleEditor()">
                    <span>➕</span> Create Rule
                </button>
            </div>
        `;
    }

    function renderRulesList() {
        return `
            <div class="rules-list">
                ${state.config.rules.map((rule, index) => renderRuleCard(rule, index)).join('')}
            </div>
        `;
    }

    function renderRuleCard(rule, index) {
        const activityType = ACTIVITY_TYPES.find(t => t.value === rule.activity_type);
        const triggerRole = state.roles.find(r => r.id === rule.trigger_role_id);
        const assignedRole = state.roles.find(r => r.id === rule.assigned_role_id);

        return `
            <div class="rule-card ${!rule.enabled ? 'disabled' : ''}">
                <div class="rule-header">
                    <div class="rule-info">
                        <span class="rule-icon">${activityType?.icon || '❓'}</span>
                        <div>
                            <h3>${escapeHtml(rule.name)}</h3>
                            <span class="activity-badge">${activityType?.label || rule.activity_type}</span>
                        </div>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" ${rule.enabled ? 'checked' : ''}
                               onchange="ActivityMonitorFeature.toggleRule('${rule.id}')">
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="rule-body">
                    <div class="role-flow">
                        <div class="role-box trigger">
                            <span class="role-label">Monitor</span>
                            <span class="role-name" style="color: ${triggerRole?.color || '#99AAB5'}">
                                ${triggerRole?.name || 'Unknown Role'}
                            </span>
                        </div>
                        <div class="arrow">→</div>
                        <div class="role-box assigned">
                            <span class="role-label">Assign</span>
                            <span class="role-name" style="color: ${assignedRole?.color || '#99AAB5'}">
                                ${assignedRole?.name || 'Unknown Role'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="rule-actions">
                    <button class="btn btn-sm btn-secondary" onclick="ActivityMonitorFeature.openRuleEditor('${rule.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="ActivityMonitorFeature.deleteRule('${rule.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }

    function renderRuleEditorModal() {
        return `
            <div class="modal" id="ruleEditorModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="modalTitle">Add Activity Rule</h2>
                        <button class="close-btn" onclick="ActivityMonitorFeature.closeRuleEditor()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="ruleForm">
                            <div class="form-group">
                                <label for="ruleName">Rule Name *</label>
                                <input type="text" id="ruleName" class="form-control"
                                       placeholder="e.g., Streamers Live" required maxlength="100">
                            </div>

                            <div class="form-group">
                                <label for="activityType">Activity Type *</label>
                                <select id="activityType" class="form-control" required>
                                    <option value="">Select activity type...</option>
                                    ${ACTIVITY_TYPES.map(type => `
                                        <option value="${type.value}">${type.icon} ${type.label}</option>
                                    `).join('')}
                                </select>
                                <small class="help-text" id="activityHelp"></small>
                            </div>

                            <div class="form-group">
                                <label for="triggerRole">Trigger Role *</label>
                                <select id="triggerRole" class="form-control" required>
                                    <option value="">Select role to monitor...</option>
                                    ${state.roles.map(role => `
                                        <option value="${role.id}" style="color: ${role.color}">
                                            ${escapeHtml(role.name)}
                                        </option>
                                    `).join('')}
                                </select>
                                <small class="help-text">Monitor members with this role for the selected activity</small>
                            </div>

                            <div class="form-group">
                                <label for="assignedRole">Assigned Role *</label>
                                <select id="assignedRole" class="form-control" required>
                                    <option value="">Select role to assign...</option>
                                    ${state.roles.map(role => `
                                        <option value="${role.id}" style="color: ${role.color}">
                                            ${escapeHtml(role.name)}
                                        </option>
                                    `).join('')}
                                </select>
                                <small class="help-text">Automatically assign this role when the activity is detected</small>
                            </div>

                            <div class="info-box">
                                <strong>💡 Pro Tip:</strong> To show active users above others in the member list,
                                enable "Display role members separately from online members" in Discord's role settings
                                for the assigned role.
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="ActivityMonitorFeature.closeRuleEditor()">Cancel</button>
                        <button class="btn btn-primary" onclick="ActivityMonitorFeature.saveRule()">Save Rule</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // Event Handlers
    // ========================================================================

    function attachEventListeners() {
        // Master enable toggle
        const masterEnable = document.getElementById('masterEnable');
        if (masterEnable) {
            masterEnable.addEventListener('change', (e) => {
                state.config.enabled = e.target.checked;
                renderUI();
            });
        }

        // Add rule button
        const addRuleBtn = document.getElementById('addRuleBtn');
        if (addRuleBtn) {
            addRuleBtn.addEventListener('click', () => openRuleEditor());
        }

        // Save config button
        const saveConfigBtn = document.getElementById('saveConfigBtn');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', saveConfig);
        }

        // Activity type change
        const activityType = document.getElementById('activityType');
        if (activityType) {
            activityType.addEventListener('change', (e) => {
                const selected = ACTIVITY_TYPES.find(t => t.value === e.target.value);
                const helpText = document.getElementById('activityHelp');
                if (helpText && selected) {
                    helpText.textContent = selected.description;
                }
            });
        }

        // Modal backdrop click
        const modal = document.getElementById('ruleEditorModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeRuleEditor();
                }
            });
        }
    }

    // ========================================================================
    // Rule Management
    // ========================================================================

    function openRuleEditor(ruleId = null) {
        state.editingRuleId = ruleId;
        const modal = document.getElementById('ruleEditorModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('ruleForm');

        if (ruleId) {
            // Edit mode
            const rule = state.config.rules.find(r => r.id === ruleId);
            if (!rule) {
                showError('Rule not found');
                return;
            }

            modalTitle.textContent = 'Edit Activity Rule';
            document.getElementById('ruleName').value = rule.name;
            document.getElementById('activityType').value = rule.activity_type;
            document.getElementById('triggerRole').value = rule.trigger_role_id;
            document.getElementById('assignedRole').value = rule.assigned_role_id;

            // Update help text
            const selected = ACTIVITY_TYPES.find(t => t.value === rule.activity_type);
            const helpText = document.getElementById('activityHelp');
            if (helpText && selected) {
                helpText.textContent = selected.description;
            }
        } else {
            // Add mode
            modalTitle.textContent = 'Add Activity Rule';
            form.reset();
        }

        modal.style.display = 'flex';
    }

    function closeRuleEditor() {
        const modal = document.getElementById('ruleEditorModal');
        modal.style.display = 'none';
        state.editingRuleId = null;
    }

    function saveRule() {
        const form = document.getElementById('ruleForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const name = document.getElementById('ruleName').value.trim();
        const activityType = document.getElementById('activityType').value;
        const triggerRoleId = document.getElementById('triggerRole').value;
        const assignedRoleId = document.getElementById('assignedRole').value;

        // Validation
        if (!name || !activityType || !triggerRoleId || !assignedRoleId) {
            showError('All fields are required');
            return;
        }

        if (triggerRoleId === assignedRoleId) {
            showError('Trigger and assigned roles cannot be the same');
            return;
        }

        if (state.editingRuleId) {
            // Update existing rule
            const ruleIndex = state.config.rules.findIndex(r => r.id === state.editingRuleId);
            if (ruleIndex !== -1) {
                state.config.rules[ruleIndex] = {
                    ...state.config.rules[ruleIndex],
                    name,
                    activity_type: activityType,
                    trigger_role_id: triggerRoleId,
                    assigned_role_id: assignedRoleId
                };
            }
        } else {
            // Add new rule
            const newRule = {
                id: generateUUID(),
                name,
                enabled: true,
                activity_type: activityType,
                trigger_role_id: triggerRoleId,
                assigned_role_id: assignedRoleId
            };
            state.config.rules.push(newRule);
        }

        closeRuleEditor();
        renderUI();
        showSuccess('Rule saved! Click "Save Configuration" to apply changes.');
    }

    function toggleRule(ruleId) {
        const rule = state.config.rules.find(r => r.id === ruleId);
        if (rule) {
            rule.enabled = !rule.enabled;
            renderUI();
            showSuccess('Rule toggled! Click "Save Configuration" to apply changes.');
        }
    }

    function deleteRule(ruleId) {
        if (!confirm('Are you sure you want to delete this rule?')) {
            return;
        }

        state.config.rules = state.config.rules.filter(r => r.id !== ruleId);
        renderUI();
        showSuccess('Rule deleted! Click "Save Configuration" to apply changes.');
    }

    // ========================================================================
    // Utility Functions
    // ========================================================================

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getDashboardCore() {
        return window.DashboardCore;
    }

    function getAuthToken() {
        return localStorage.getItem('discord_token');
    }

    function loadCSS(href) {
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
    }

    function showLoading(message = 'Loading...') {
        const dashboardCore = getDashboardCore();
        if (dashboardCore?.showNotification) {
            dashboardCore.showNotification(message, 'info');
        }
    }

    function hideLoading() {
        // Notifications auto-dismiss
    }

    function showSuccess(message) {
        const dashboardCore = getDashboardCore();
        if (dashboardCore?.showNotification) {
            dashboardCore.showNotification(message, 'success');
        }
    }

    function showError(message) {
        const dashboardCore = getDashboardCore();
        if (dashboardCore?.showNotification) {
            dashboardCore.showNotification(message, 'error');
        }
    }

    // ========================================================================
    // Public API
    // ========================================================================

    return {
        init,
        openRuleEditor,
        closeRuleEditor,
        saveRule,
        toggleRule,
        deleteRule
    };
})();

// Export feature module for SPA
window.ActivityMonitorFeature = ActivityMonitorFeature;
console.log('[ActivityMonitor] Module loaded, ActivityMonitorFeature:', typeof ActivityMonitorFeature);
