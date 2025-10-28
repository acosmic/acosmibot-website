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

    const updateSettings = async (updatedSettings) => {
        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ settings: updatedSettings })
            });

            const data = await response.json();
            if (data.success) {
                showNotification('Settings updated successfully', 'success');
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

    const handleSettingChange = (key, value) => {
        const updates = {};
        updates[key] = value;
        updateSettings(updates);
    };

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
                        onSettingChange={handleSettingChange}
                        saving={saving}
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

// Settings Tab Component
function SettingsTab({ settings, onSettingChange, saving }) {
    const [expandedCategory, setExpandedCategory] = useState('features');

    const toggleCategory = (category) => {
        setExpandedCategory(expandedCategory === category ? null : category);
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

        // Create a map of feature toggles
        const featureGroups = {};

        featureSettings.forEach(setting => {
            const key = setting.setting_key;
            const featureName = key.split('.')[1]?.replace(/_enabled$/, '');
            if (featureName && key.endsWith('_enabled')) {
                featureGroups[featureName] = {
                    toggle: setting,
                    configs: []
                };
            }
        });

        // Add corresponding default configs to each feature
        defaultSettings.forEach(setting => {
            const key = setting.setting_key;
            const parts = key.split('.');
            if (parts[0] === 'defaults' && parts[1]) {
                const featureName = parts[1];
                if (featureGroups[featureName]) {
                    featureGroups[featureName].configs.push(setting);
                }
            }
        });

        return featureGroups;
    };

    const renderFeatureGroup = (featureName, group) => {
        const [expanded, setExpanded] = useState(false);
        const displayName = featureName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const isEnabled = group.toggle.setting_value;

        return (
            <div key={featureName} className="feature-group">
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
                {expanded && group.configs.length > 0 && (
                    <div className="feature-configs">
                        <div className="configs-label">Default Configurations:</div>
                        {group.configs.map(renderSetting)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="settings-tab">
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
                                            renderFeatureGroup(featureName, featureGroups[featureName])
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
