const { useState, useEffect } = React;


function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('settings');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminInfo, setAdminInfo] = useState(null);

    // Settings state
    const [settings, setSettings] = useState({
        features: [],
        rate_limits: [],
        defaults: [],
        maintenance: []
    });

    // Pending changes (unsaved edits)
    const [pendingChanges, setPendingChanges] = useState({});

    // Guild management state
    const [guilds, setGuilds] = useState([]);
    const [guildsLoading, setGuildsLoading] = useState(false);
    const [guildSearch, setGuildSearch] = useState('');
    const [guildPage, setGuildPage] = useState(0);
    const [guildTotal, setGuildTotal] = useState(0);

    // Monitoring state
    const [stats, setStats] = useState({
        total_guilds: 0,
        active_guilds: 0,
        total_users: 0,
        total_messages: 0,
        total_currency: 0,
        commands_today: 0,
        avg_members_per_guild: 0
    });

    // Audit log state
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditLogsLoading, setAuditLogsLoading] = useState(false);
    const [auditLogTotal, setAuditLogTotal] = useState(0);
    const [auditLogPage, setAuditLogPage] = useState(0);

    const token = localStorage.getItem('discord_token');

    // Check admin status on mount
    useEffect(() => {
        checkAdminStatus();
    }, []);

    // Load data when tab changes
    useEffect(() => {
        if (isAdmin) {
            loadTabData();
        }
    }, [activeTab, isAdmin]);

    const checkAdminStatus = async () => {
        if (!token) {
            window.location.href = '/';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/check`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!data.success || !data.is_admin) {
                showNotification('Access denied: You are not an administrator', 'error');
                setTimeout(() => window.location.href = '/', 2000);
                return;
            }

            setIsAdmin(true);
            setAdminInfo(data.admin_info);
            setLoading(false);
        } catch (error) {
            console.error('Error checking admin status:', error);
            showNotification('Failed to verify admin status', 'error');
            setTimeout(() => window.location.href = '/', 2000);
        }
    };

    const loadTabData = async () => {
        switch(activeTab) {
            case 'settings':
                await loadSettings();
                break;
            case 'guilds':
                await loadGuilds();
                break;
            case 'monitoring':
                await loadStats();
                break;
            case 'audit':
                await loadAuditLogs();
                break;
        }
    };

    const loadSettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (data.success) {
                setSettings(data.settings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showNotification('Failed to load settings', 'error');
        }
    };

    const loadGuilds = async () => {
        setGuildsLoading(true);
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/admin/guilds?limit=50&offset=${guildPage * 50}&search=${guildSearch}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();
            if (data.success) {
                setGuilds(data.guilds);
                setGuildTotal(data.total);
            }
        } catch (error) {
            console.error('Error loading guilds:', error);
            showNotification('Failed to load guilds', 'error');
        } finally {
            setGuildsLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/stats/overview`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            showNotification('Failed to load statistics', 'error');
        }
    };

    const loadAuditLogs = async () => {
        setAuditLogsLoading(true);
        try {
            const response = await fetch(
                `${API_BASE_URL}/api/admin/audit-log?limit=100&offset=${auditLogPage * 100}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();
            if (data.success) {
                setAuditLogs(data.logs);
                setAuditLogTotal(data.total);
            }
        } catch (error) {
            console.error('Error loading audit logs:', error);
            showNotification('Failed to load audit logs', 'error');
        } finally {
            setAuditLogsLoading(false);
        }
    };

    const handleSettingChange = (key, value) => {
        // Update local pending changes instead of immediately saving
        setPendingChanges(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const saveAllChanges = async () => {
        if (Object.keys(pendingChanges).length === 0) {
            showNotification('No changes to save', 'info');
            return;
        }

        // Filter out invalid values
        const validChanges = {};
        const invalidKeys = [];

        for (const [key, value] of Object.entries(pendingChanges)) {
            if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
                invalidKeys.push(key);
            } else {
                validChanges[key] = value;
            }
        }

        if (invalidKeys.length > 0) {
            showNotification(`Invalid values for: ${invalidKeys.join(', ')}`, 'error');
            return;
        }

        if (Object.keys(validChanges).length === 0) {
            showNotification('No valid changes to save', 'error');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ settings: validChanges })
            });

            const data = await response.json();
            if (data.success) {
                showNotification(`Successfully updated ${Object.keys(validChanges).length} setting(s)`, 'success');
                setPendingChanges({});
                await loadSettings();
            } else {
                showNotification(data.message || 'Failed to update settings', 'error');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            showNotification('Failed to update settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const discardChanges = () => {
        setPendingChanges({});
        showNotification('Changes discarded', 'info');
    };

    const hasPendingChanges = Object.keys(pendingChanges).length > 0;

    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="loading-spinner">Loading admin dashboard...</div>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <h1>🛡️ Admin Dashboard</h1>
                <div className="admin-badge">
                    {adminInfo && (
                        <span className="admin-role">{adminInfo.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                    )}
                </div>
            </div>

            <div className="dashboard-tabs">
                <button
                    className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    ⚙️ Global Settings
                </button>
                <button
                    className={`tab ${activeTab === 'guilds' ? 'active' : ''}`}
                    onClick={() => setActiveTab('guilds')}
                >
                    🏰 Guild Management
                </button>
                <button
                    className={`tab ${activeTab === 'monitoring' ? 'active' : ''}`}
                    onClick={() => setActiveTab('monitoring')}
                >
                    📊 Monitoring
                </button>
                <button
                    className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                >
                    📜 Audit Log
                </button>
            </div>

            <div className="dashboard-content">
                {activeTab === 'settings' && (
                    <SettingsTab
                        settings={settings}
                        pendingChanges={pendingChanges}
                        onSettingChange={handleSettingChange}
                        onSave={saveAllChanges}
                        onDiscard={discardChanges}
                        saving={saving}
                        hasPendingChanges={hasPendingChanges}
                    />
                )}

                {activeTab === 'guilds' && (
                    <GuildsTab
                        guilds={guilds}
                        loading={guildsLoading}
                        search={guildSearch}
                        onSearchChange={setGuildSearch}
                        page={guildPage}
                        total={guildTotal}
                        onPageChange={setGuildPage}
                        onRefresh={loadGuilds}
                    />
                )}

                {activeTab === 'monitoring' && (
                    <MonitoringTab stats={stats} />
                )}

                {activeTab === 'audit' && (
                    <AuditLogTab
                        logs={auditLogs}
                        loading={auditLogsLoading}
                        page={auditLogPage}
                        total={auditLogTotal}
                        onPageChange={setAuditLogPage}
                    />
                )}
            </div>
        </div>
    );
}

// Configuration field schemas for each feature
const CONFIG_SCHEMAS = {
    leveling_enabled: {
        fields: [
            { key: 'leveling.exp_per_message', label: 'XP Per Message', type: 'number', min: 1, max: 100, description: 'Base experience points awarded per message' },
            { key: 'leveling.exp_cooldown_seconds', label: 'XP Cooldown (seconds)', type: 'number', min: 1, max: 3600, description: 'Cooldown period between XP gains for the same user' },
            { key: 'leveling.streak_multiplier', label: 'Streak Multiplier', type: 'float', min: 0, max: 1, step: 0.01, description: 'Bonus multiplier per day of streak (5% = 0.05)' },
            { key: 'leveling.max_streak_bonus', label: 'Max Streak Bonus', type: 'number', min: 1, max: 50, description: 'Maximum streak days counted for bonus calculation' },
            { key: 'leveling.daily_bonus', label: 'Daily Bonus', type: 'number', min: 100, max: 10000, description: 'Base currency reward for daily claim' }
        ]
    },
    ai_enabled: {
        fields: [
            { key: 'ai.daily_limit', label: 'Daily Limit', type: 'number', min: 1, max: 1000, description: 'Maximum AI interactions per guild per day' },
            { key: 'ai.available_models', label: 'Available Models', type: 'multiselect', options: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'], description: 'AI models guilds can choose from' },
            { key: 'ai.default_instructions', label: 'Default Instructions', type: 'textarea', description: 'Default system instructions if guild doesn\'t customize' }
        ]
    },
    economy_enabled: {
        fields: [
            { key: 'economy.deposit_fee_percent', label: 'Deposit Fee %', type: 'float', min: 0, max: 10, step: 0.1, description: 'Percentage fee when depositing to bank' },
            { key: 'economy.withdraw_fee_percent', label: 'Withdraw Fee %', type: 'float', min: 0, max: 10, step: 0.1, description: 'Percentage fee when withdrawing from bank' },
            { key: 'economy.min_transaction', label: 'Min Transaction', type: 'number', min: 1, max: 10000, description: 'Minimum amount for bank transactions' },
            { key: 'economy.max_transaction', label: 'Max Transaction', type: 'number', min: 100, max: 10000000, description: 'Maximum amount for bank transactions' },
            { key: 'economy.daily_transfer_limit', label: 'Daily Transfer Limit', type: 'number', min: 1000, max: 10000000, description: 'Maximum credits transferred per day' },
            { key: 'economy.interest_enabled', label: 'Interest Enabled', type: 'toggle', description: 'Enable interest on bank balances' },
            { key: 'economy.interest_rate_percent', label: 'Interest Rate %', type: 'float', min: 0, max: 10, step: 0.1, description: 'Interest rate percentage' },
            { key: 'economy.interest_interval', label: 'Interest Interval', type: 'dropdown', options: ['daily', 'weekly', 'monthly'], description: 'How often interest is applied' }
        ]
    },
    games_enabled: {
        fields: [
            { key: 'games.slots.match_two_multiplier', label: 'Match 2 Multiplier', type: 'number', min: 1, max: 10, description: 'Win multiplier for matching 2 symbols' },
            { key: 'games.slots.match_three_multiplier', label: 'Match 3 Multiplier', type: 'number', min: 1, max: 100, description: 'Win multiplier for matching 3 symbols' },
            { key: 'games.slots.min_bet', label: 'Min Bet', type: 'number', min: 1, max: 10000, description: 'Minimum bet amount in credits' },
            { key: 'games.slots.max_bet', label: 'Max Bet', type: 'number', min: 100, max: 1000000, description: 'Maximum bet amount in credits' },
            { key: 'games.slots.bet_options', label: 'Bet Options', type: 'array', description: 'Quick bet amounts (comma-separated)' }
        ]
    },
    cross_server_enabled: {
        fields: []
    }
};

// Input component renderers
function NumberInput({ field, value, onChange, disabled }) {
    // Ensure value is a valid number or use minimum/default
    const displayValue = value !== undefined && value !== null && !isNaN(value) ? value : (field.min ?? 0);

    return (
        <input
            type="number"
            className="config-input config-number-input"
            value={displayValue}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            onChange={(e) => {
                const val = e.target.value;
                // Allow empty string during typing, default to minimum
                if (val === '' || val === '-') {
                    onChange(field.key, field.min ?? 0);
                } else {
                    const numVal = Number(val);
                    if (!isNaN(numVal)) {
                        onChange(field.key, numVal);
                    }
                }
            }}
            disabled={disabled}
        />
    );
}

function TextAreaInput({ field, value, onChange, disabled }) {
    // Handle undefined, null, or non-string values
    const displayValue = (value !== undefined && value !== null) ? String(value) : '';

    return (
        <textarea
            className="config-input config-textarea"
            value={displayValue}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={disabled}
            rows={3}
        />
    );
}

function DropdownInput({ field, value, onChange, disabled }) {
    // Ensure we have a valid option selected
    const displayValue = (value !== undefined && value !== null) ? value : field.options[0];

    return (
        <select
            className="config-input config-select"
            value={displayValue}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={disabled}
        >
            {field.options.map(option => (
                <option key={option} value={option}>{option}</option>
            ))}
        </select>
    );
}

function ToggleInput({ field, value, onChange, disabled }) {
    // Handle string "true"/"false" from database
    let isChecked = false;
    if (value === true || value === 'true') {
        isChecked = true;
    } else if (value === false || value === 'false') {
        isChecked = false;
    }

    return (
        <label className="toggle-switch">
            <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => onChange(field.key, e.target.checked)}
                disabled={disabled}
            />
            <span className="toggle-slider"></span>
        </label>
    );
}

function MultiSelectInput({ field, value, onChange, disabled }) {
    // Parse value if it's a string (from JSON), or use as array, or default to empty
    let selectedValues = [];
    if (Array.isArray(value)) {
        selectedValues = value;
    } else if (typeof value === 'string') {
        try {
            selectedValues = JSON.parse(value);
            if (!Array.isArray(selectedValues)) {
                selectedValues = [];
            }
        } catch (e) {
            selectedValues = [];
        }
    }

    const toggleOption = (option) => {
        if (selectedValues.includes(option)) {
            onChange(field.key, selectedValues.filter(v => v !== option));
        } else {
            onChange(field.key, [...selectedValues, option]);
        }
    };

    return (
        <div className="config-multiselect">
            {field.options.map(option => (
                <label key={option} className="multiselect-option">
                    <input
                        type="checkbox"
                        checked={selectedValues.includes(option)}
                        onChange={() => toggleOption(option)}
                        disabled={disabled}
                    />
                    <span className="option-label">{option}</span>
                </label>
            ))}
        </div>
    );
}

function ArrayInput({ field, value, onChange, disabled }) {
    // Parse value if needed
    let arrayValue = '';
    if (Array.isArray(value)) {
        arrayValue = value.join(', ');
    } else if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                arrayValue = parsed.join(', ');
            }
        } catch (e) {
            arrayValue = '';
        }
    }

    const handleChange = (e) => {
        const str = e.target.value;
        const arr = str.split(',').map(v => v.trim()).filter(v => v).map(v => parseInt(v, 10)).filter(v => !isNaN(v));
        onChange(field.key, arr);
    };

    return (
        <input
            type="text"
            className="config-input config-array-input"
            value={arrayValue}
            onChange={handleChange}
            placeholder="e.g., 100, 1000, 5000"
            disabled={disabled}
        />
    );
}

// Feature Group Component
function FeatureGroup({ featureName, group, onSettingChange, saving, settings, pendingChanges }) {
    const [expanded, setExpanded] = useState(false);
    const displayName = featureName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const isEnabled = group.toggle.setting_value;
    // Extract feature name from "features.leveling_enabled" -> "leveling_enabled"
    const schemaKey = group.toggle.setting_key.split('.')[1];
    const schema = CONFIG_SCHEMAS[schemaKey];

    // Get current values from settings state or pending changes
    const getFieldValue = (fieldKey) => {
        // First check if there's a pending change
        if (fieldKey in pendingChanges) {
            return pendingChanges[fieldKey];
        }

        // Search all category arrays for this setting key
        // Settings structure: { features: [...], defaults: [...], rate_limits: [...], maintenance: [...] }
        const categories = ['features', 'defaults', 'rate_limits', 'maintenance'];

        for (const category of categories) {
            const categorySettings = settings[category];
            if (Array.isArray(categorySettings)) {
                const setting = categorySettings.find(s => s.setting_key === fieldKey);
                if (setting !== undefined) {
                    const settingValue = setting.setting_value;
                    // Parse numeric strings to numbers
                    if (typeof settingValue === 'string' && settingValue !== '') {
                        const parsed = Number(settingValue);
                        if (!isNaN(parsed)) {
                            return parsed;
                        }
                    }
                    return settingValue;
                }
            }
        }

        return undefined;
    };

    const renderConfigField = (field) => {
        const value = getFieldValue(field.key);
        let inputComponent;

        switch (field.type) {
            case 'number':
            case 'float':
                inputComponent = <NumberInput field={field} value={value} onChange={onSettingChange} disabled={saving} />;
                break;
            case 'textarea':
                inputComponent = <TextAreaInput field={field} value={value} onChange={onSettingChange} disabled={saving} />;
                break;
            case 'dropdown':
                inputComponent = <DropdownInput field={field} value={value} onChange={onSettingChange} disabled={saving} />;
                break;
            case 'toggle':
                inputComponent = <ToggleInput field={field} value={value} onChange={onSettingChange} disabled={saving} />;
                break;
            case 'multiselect':
                inputComponent = <MultiSelectInput field={field} value={value} onChange={onSettingChange} disabled={saving} />;
                break;
            case 'array':
                inputComponent = <ArrayInput field={field} value={value} onChange={onSettingChange} disabled={saving} />;
                break;
            default:
                inputComponent = null;
        }

        return (
            <div key={field.key} className="config-field">
                <div className="config-field-info">
                    <label className="config-label">{field.label}</label>
                    {field.description && <p className="config-description">{field.description}</p>}
                </div>
                <div className="config-field-control">
                    {inputComponent}
                </div>
            </div>
        );
    };

    return (
        <div className="feature-group">
            <div className="feature-header" onClick={() => setExpanded(!expanded)}>
                <span className="expand-icon-small">{expanded ? '▼' : '▶'}</span>
                <span className="feature-name">{displayName}</span>
                <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => onSettingChange(group.toggle.setting_key, e.target.checked)}
                        disabled={saving}
                    />
                    <span className="toggle-slider"></span>
                </label>
            </div>
            {expanded && schema && schema.fields.length > 0 && (
                <div className="feature-configs">
                    <div className="configs-label">Default Configurations:</div>
                    <div className="config-fields-container">
                        {schema.fields.map(renderConfigField)}
                    </div>
                </div>
            )}
            {expanded && (!schema || schema.fields.length === 0) && (
                <div className="feature-configs">
                    <div className="configs-label">No additional configuration available.</div>
                </div>
            )}
        </div>
    );
}

// Settings Tab Component
function SettingsTab({ settings, pendingChanges, onSettingChange, onSave, onDiscard, saving, hasPendingChanges }) {
    const [expandedCategory, setExpandedCategory] = useState('features');

    const toggleCategory = (category) => {
        setExpandedCategory(expandedCategory === category ? null : category);
    };

    // Helper to get effective value (pending change or current setting)
    const getEffectiveValue = (key) => {
        if (key in pendingChanges) {
            return pendingChanges[key];
        }
        // Navigate through nested settings structure
        const parts = key.split('.');
        let value = settings;
        for (const part of parts) {
            if (value && typeof value === 'object') {
                // Check if it's an array of settings
                if (Array.isArray(value)) {
                    const setting = value.find(s => s.setting_key === key);
                    return setting?.setting_value;
                }
                value = value[part];
            } else {
                return undefined;
            }
        }
        return value?.setting_value;
    };

    const renderSetting = (setting) => {
        const value = setting.setting_value;
        const isBool = typeof value === 'boolean';
        const isNumber = typeof value === 'number';
        const isString = typeof value === 'string';

        return (
            <div key={setting.setting_key} className="setting-item">
                <div className="setting-info">
                    <label>{setting.setting_key.split('.').pop().replace(/_/g, ' ')}</label>
                    {setting.description && <p className="setting-description">{setting.description}</p>}
                </div>
                <div className="setting-control">
                    {isBool && (
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => onSettingChange(setting.setting_key, e.target.checked)}
                                disabled={saving}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    )}
                    {isNumber && (
                        <input
                            type="number"
                            value={value}
                            onChange={(e) => onSettingChange(setting.setting_key, parseInt(e.target.value))}
                            disabled={saving}
                            className="number-input"
                        />
                    )}
                    {isString && !isBool && (
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onSettingChange(setting.setting_key, e.target.value)}
                            disabled={saving}
                            className="text-input"
                        />
                    )}
                </div>
            </div>
        );
    };

    const categories = [
        { key: 'features', label: 'Features', icon: '✨' },
        { key: 'rate_limits', label: 'Rate Limits & Quotas', icon: '⏱️' },
        { key: 'maintenance', label: 'Maintenance Mode', icon: '🔧' }
    ];

    // Group features with their defaults
    const groupFeatureSettings = () => {
        const featureSettings = settings.features || [];
        const defaultSettings = settings.defaults || [];

        // Create a map of feature toggles (deduplicate by featureName)
        const featureGroups = {};
        const seenFeatures = new Set();

        featureSettings.forEach(setting => {
            const key = setting.setting_key;
            const featureName = key.split('.')[1]?.replace(/_enabled$/, '');
            if (featureName && key.endsWith('_enabled') && !seenFeatures.has(featureName)) {
                seenFeatures.add(featureName);
                featureGroups[featureName] = {
                    toggle: setting,
                    configs: []
                };
            }
        });

        // Add corresponding default configs to each feature
        // Settings are like "leveling.exp_per_message", NOT "defaults.leveling.exp_per_message"
        // Extract feature name from first part of setting_key
        defaultSettings.forEach(setting => {
            const key = setting.setting_key;
            const parts = key.split('.');
            const featureName = parts[0]; // "leveling", "ai", "economy", "games"
            if (featureGroups[featureName]) {
                featureGroups[featureName].configs.push(setting);
            }
        });

        return featureGroups;
    };

    return (
        <div className="settings-tab">
            {hasPendingChanges && (
                <div className="save-changes-bar">
                    <div className="save-bar-content">
                        <div className="save-bar-info">
                            <span className="unsaved-badge">{Object.keys(pendingChanges).length}</span>
                            <span className="save-bar-text">unsaved change{Object.keys(pendingChanges).length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="save-bar-actions">
                            <button
                                className="btn-discard"
                                onClick={onDiscard}
                                disabled={saving}
                            >
                                Discard
                            </button>
                            <button
                                className="btn-save"
                                onClick={onSave}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save All Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {categories.map(category => (
                <div key={category.key} className="settings-category">
                    <div
                        className="category-header"
                        onClick={() => toggleCategory(category.key)}
                    >
                        <span className="category-icon">{category.icon}</span>
                        <h3>{category.label}</h3>
                        <span className="expand-icon">{expandedCategory === category.key ? '▼' : '▶'}</span>
                    </div>
                    {expandedCategory === category.key && (
                        <div className="category-content">
                            {category.key === 'features' ? (
                                (() => {
                                    const featureGroups = groupFeatureSettings();
                                    const groupKeys = Object.keys(featureGroups);
                                    return groupKeys.length > 0 ? (
                                        groupKeys.map(featureName =>
                                            <FeatureGroup
                                                key={featureName}
                                                featureName={featureName}
                                                group={featureGroups[featureName]}
                                                onSettingChange={onSettingChange}
                                                saving={saving}
                                                settings={settings}
                                                pendingChanges={pendingChanges}
                                            />
                                        )
                                    ) : (
                                        <p className="empty-state">No features configured</p>
                                    );
                                })()
                            ) : (
                                settings[category.key]?.length > 0 ? (
                                    settings[category.key].map(renderSetting)
                                ) : (
                                    <p className="empty-state">No settings in this category</p>
                                )
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// Guilds Tab Component
function GuildsTab({ guilds, loading, search, onSearchChange, page, total, onPageChange, onRefresh }) {
    return (
        <div className="guilds-tab">
            <div className="guilds-controls">
                <input
                    type="text"
                    placeholder="Search guilds..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="search-input"
                />
                <button onClick={onRefresh} className="refresh-btn">🔄 Refresh</button>
            </div>

            {loading ? (
                <div className="loading-spinner">Loading guilds...</div>
            ) : (
                <>
                    <div className="guilds-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Guild Name</th>
                                    <th>Members</th>
                                    <th>Owner ID</th>
                                    <th>Created</th>
                                    <th>Features</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {guilds.map(guild => (
                                    <tr key={guild.id}>
                                        <td><strong>{guild.name}</strong></td>
                                        <td>{guild.member_count}</td>
                                        <td><code>{guild.owner_id}</code></td>
                                        <td>{guild.created_at ? new Date(guild.created_at).toLocaleDateString() : 'N/A'}</td>
                                        <td>
                                            <div className="feature-badges">
                                                {guild.settings_enabled?.leveling && <span className="badge">📈 Leveling</span>}
                                                {guild.settings_enabled?.ai && <span className="badge">🤖 AI</span>}
                                                {guild.settings_enabled?.economy && <span className="badge">💰 Economy</span>}
                                                {guild.settings_enabled?.portal && <span className="badge">🌐 Portal</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${guild.active ? 'active' : 'inactive'}`}>
                                                {guild.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page === 0}
                        >
                            Previous
                        </button>
                        <span>Page {page + 1} of {Math.ceil(total / 50)}</span>
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={(page + 1) * 50 >= total}
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// Monitoring Tab Component
function MonitoringTab({ stats }) {
    const statCards = [
        { label: 'Total Guilds', value: stats.total_guilds, icon: '🏰' },
        { label: 'Active Guilds', value: stats.active_guilds, icon: '✅' },
        { label: 'Total Users', value: stats.total_users.toLocaleString(), icon: '👥' },
        { label: 'Total Messages', value: stats.total_messages.toLocaleString(), icon: '💬' },
        { label: 'Total Currency', value: stats.total_currency.toLocaleString(), icon: '💰' },
        { label: 'Commands Today', value: stats.commands_today, icon: '⚡' },
        { label: 'Avg Members/Guild', value: Math.round(stats.avg_members_per_guild), icon: '📊' }
    ];

    return (
        <div className="monitoring-tab">
            <h2>System Overview</h2>
            <div className="stats-grid">
                {statCards.map((stat, index) => (
                    <div key={index} className="stat-card">
                        <div className="stat-icon">{stat.icon}</div>
                        <div className="stat-content">
                            <div className="stat-value">{stat.value}</div>
                            <div className="stat-label">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Audit Log Tab Component
function AuditLogTab({ logs, loading, page, total, onPageChange }) {
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const formatChanges = (changes) => {
        if (!changes) return 'N/A';
        return JSON.stringify(changes, null, 2);
    };

    return (
        <div className="audit-log-tab">
            {loading ? (
                <div className="loading-spinner">Loading audit logs...</div>
            ) : (
                <>
                    <div className="audit-log-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Admin</th>
                                    <th>Action</th>
                                    <th>Target</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id}>
                                        <td>{formatTimestamp(log.timestamp)}</td>
                                        <td>{log.admin_username}</td>
                                        <td><code>{log.action_type}</code></td>
                                        <td>{log.target_type ? `${log.target_type}: ${log.target_id}` : 'N/A'}</td>
                                        <td>
                                            {log.changes && (
                                                <details>
                                                    <summary>View Changes</summary>
                                                    <pre>{formatChanges(log.changes)}</pre>
                                                </details>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page === 0}
                        >
                            Previous
                        </button>
                        <span>Page {page + 1} of {Math.ceil(total / 100)}</span>
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={(page + 1) * 100 >= total}
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminDashboard />);
