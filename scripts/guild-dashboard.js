const { useState, useEffect, useRef } = React;

// Custom Number Input Component
const NumberInput = ({ value, min, max, step = 1, onChange, ...props }) => {
  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange({ target: { value: newValue } });
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange({ target: { value: newValue } });
  };

  return (
    <div className="number-input-wrapper">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="form-control"
        {...props}
      />
      <div className="number-controls">
        <button type="button" className="number-btn" onClick={handleIncrement}>▲</button>
        <button type="button" className="number-btn" onClick={handleDecrement}>▼</button>
      </div>
    </div>
  );
};

// Custom Role Selector Component
const RoleSelector = ({ selectedRoleIds, availableRoles, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedRoles = availableRoles.filter(role => selectedRoleIds.includes(role.id));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleRole = (roleId) => {
    if (selectedRoleIds.includes(roleId)) {
      onChange(selectedRoleIds.filter(id => id !== roleId));
    } else {
      onChange([...selectedRoleIds, roleId]);
    }
  };

  const removeRole = (roleId, e) => {
    e.stopPropagation();
    onChange(selectedRoleIds.filter(id => id !== roleId));
  };

  return (
    <div className="role-selector-wrapper" ref={dropdownRef}>
      <div
        className={`role-selector-display ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedRoles.length === 0 ? (
          <span className="role-selector-placeholder">Click to select roles...</span>
        ) : (
          selectedRoles.map(role => (
            <span key={role.id} className="role-tag">
              {role.name}
              <span
                className="role-tag-remove"
                onClick={(e) => removeRole(role.id, e)}
              >
                ×
              </span>
            </span>
          ))
        )}
      </div>
      {isOpen && (
        <div className="role-dropdown">
          {availableRoles.map(role => {
            const isSelected = selectedRoleIds.includes(role.id);
            return (
              <div
                key={role.id}
                className={`role-dropdown-item ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleRole(role.id)}
              >
                <span>{role.name}</span>
                {isSelected && <span className="checkmark">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const GuildDashboard = () => {
  const [settings, setSettings] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableChannels, setAvailableChannels] = useState([]);
  const [availableEmojis, setAvailableEmojis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const guildId = new URLSearchParams(window.location.search).get('guild');

  const getAuthToken = () => localStorage.getItem('discord_token');

  const standardEmojis = [
    { id: 'cherry', name: 'cherry', url: null, emoji: '🍒' },
    { id: 'lemon', name: 'lemon', url: null, emoji: '🍋' },
    { id: 'orange', name: 'orange', url: null, emoji: '🍊' },
    { id: 'grapes', name: 'grapes', url: null, emoji: '🍇' },
    { id: 'apple', name: 'apple', url: null, emoji: '🍎' },
    { id: 'banana', name: 'banana', url: null, emoji: '🍌' },
    { id: 'star', name: 'star', url: null, emoji: '⭐' },
    { id: 'bell', name: 'bell', url: null, emoji: '🔔' },
    { id: 'gem', name: 'gem', url: null, emoji: '💎' },
    { id: 'slot', name: 'slot', url: null, emoji: '🎰' },
    { id: 'clover', name: 'clover', url: null, emoji: '🍀' },
    { id: 'heart', name: 'heart', url: null, emoji: '❤️' }
  ];

  useEffect(() => {
    if (guildId) fetchGuildConfig();
  }, [guildId]);

  const fetchGuildConfig = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      if (!token) {
        window.location.href = `${API_BASE_URL}/auth/login`;
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/guilds/${guildId}/config-hybrid`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('discord_token');
        window.location.href = `${API_BASE_URL}/auth/login`;
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch guild config (${response.status})`);
      }

      const data = await response.json();
      if (data.success) {
        setSettings(data.data.settings);
        setAvailableRoles(data.data.available_roles || []);
        setAvailableChannels(data.data.available_channels || []);
        const serverEmojis = data.data.available_emojis || [];
        setAvailableEmojis([...serverEmojis, ...standardEmojis]);
      } else {
        throw new Error(data.message || 'API returned success: false');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const token = getAuthToken();
      if (!token) {
        window.location.href = `${API_BASE_URL}/auth/login`;
        return;
      }

      // Ensure all required sections exist with proper defaults
      const sanitizedSettings = {
        leveling: {
          enabled: settings.leveling?.enabled === true,
          exp_per_message: settings.leveling?.exp_per_message || 10,
          exp_cooldown_seconds: settings.leveling?.exp_cooldown_seconds || 60,
          level_up_announcements: settings.leveling?.level_up_announcements === true,
          announcement_channel_id: settings.leveling?.announcement_channel_id || null,
          streak_multiplier: settings.leveling?.streak_multiplier || 0.05,
          max_streak_bonus: settings.leveling?.max_streak_bonus || 7,
          daily_bonus: settings.leveling?.daily_bonus || 1000,
          daily_announcements_enabled: settings.leveling?.daily_announcements_enabled === true,
          daily_announcement_channel_id: settings.leveling?.daily_announcement_channel_id || null
        },
        roles: {
          enabled: settings.roles?.enabled !== false,
          mode: settings.roles?.mode || 'progressive',
          role_mappings: settings.roles?.role_mappings || {},
          role_cache: settings.roles?.role_cache || {},
          role_announcement: settings.roles?.role_announcement !== false,
          announcement_channel_id: settings.roles?.announcement_channel_id || null,
          remove_previous_roles: settings.roles?.remove_previous_roles !== false,
          max_level_tracked: settings.roles?.max_level_tracked || 100,
          role_announcement_message: settings.roles?.role_announcement_message || 'Congratulations {user}! You reached level {level} and earned the {role} role!'
        },
        ai: {
          enabled: settings.ai?.enabled === true,
          instructions: settings.ai?.instructions || '',
          model: settings.ai?.model || 'gpt-4o-mini',
          daily_limit: settings.ai?.daily_limit || 100
        },
        games: {
          'slots-config': {
            enabled: settings.games?.['slots-config']?.enabled === true,
            symbols: settings.games?.['slots-config']?.symbols || ['🍒', '🍋', '🍊', '🍇', '🍎', '🍌', '⭐', '🔔', '💎', '🎰', '🍀', '❤️'],
            match_two_multiplier: settings.games?.['slots-config']?.match_two_multiplier || 2,
            match_three_multiplier: settings.games?.['slots-config']?.match_three_multiplier || 10,
            min_bet: settings.games?.['slots-config']?.min_bet || 100,
            max_bet: settings.games?.['slots-config']?.max_bet || 25000,
            bet_options: settings.games?.['slots-config']?.bet_options || [100, 1000, 5000, 10000, 25000]
          }
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/guilds/${guildId}/config-hybrid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ settings: sanitizedSettings })
      });

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('discord_token');
        window.location.href = `${API_BASE_URL}/auth/login`;
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (path, value) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current = newSettings;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const addRoleMapping = () => {
    const roleMappings = settings?.roles?.role_mappings || {};
    const newLevel = Object.keys(roleMappings).length > 0
      ? Math.max(...Object.keys(roleMappings).map(Number)) + 5
      : 5;
    updateSetting('roles.role_mappings', { ...roleMappings, [newLevel]: [] });
  };

  const removeRoleMapping = (level) => {
    const roleMappings = { ...settings.roles.role_mappings };
    delete roleMappings[level];
    updateSetting('roles.role_mappings', roleMappings);
  };

  const updateRoleMapping = (oldLevel, newLevel, roleIds) => {
    const roleMappings = { ...settings.roles.role_mappings };
    if (oldLevel !== newLevel) delete roleMappings[oldLevel];
    roleMappings[newLevel] = roleIds;
    updateSetting('roles.role_mappings', roleMappings);
  };

  const parseCustomEmoji = (symbolString) => {
    const match = symbolString.match(/<(a?):([^:]+):(\d+)>/);
    if (match) {
      const [, animated, name, id] = match;
      return {
        id,
        name,
        animated: animated === 'a',
        url: `https://cdn.discordapp.com/emojis/${id}.${animated === 'a' ? 'gif' : 'png'}`
      };
    }
    return null;
  };

  const toggleEmojiSelection = (emoji) => {
    const currentSymbols = settings?.games?.['slots-config']?.symbols || [];

    let symbolToStore;
    if (emoji.url && emoji.id) {
      const animated = emoji.animated ? 'a' : '';
      symbolToStore = `<${animated}:${emoji.name}:${emoji.id}>`;
    } else {
      symbolToStore = emoji.emoji || emoji.name;
    }

    if (currentSymbols.includes(symbolToStore)) {
      updateSetting('games.slots-config.symbols',
        currentSymbols.filter(s => s !== symbolToStore)
      );
    } else if (currentSymbols.length < 12) {
      updateSetting('games.slots-config.symbols',
        [...currentSymbols, symbolToStore]
      );
    }
  };

  if (!guildId) {
    return (
      <div className="error-screen">
        <div className="error-box">
          <h3>No Guild Selected</h3>
          <p>Please select a guild from the guild selector.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Loading guild settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="error-screen">
        <div className="error-box">
          <h3>Error Loading Settings</h3>
          <p>{error || 'Failed to load guild configuration'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="dashboard-header">
        <div className="header-info">
          <h1>Guild Settings</h1>
          <p>Configure your server bot behavior</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="save-btn">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          Settings saved successfully!
        </div>
      )}

      {/* Leveling System */}
      <div className="feature-card">
        <div className="feature-header">
          <h2 className="feature-title">⭐ Leveling System</h2>
          <div
            className={`toggle-switch ${settings.leveling?.enabled ? 'active' : ''}`}
            onClick={() => updateSetting('leveling.enabled', !settings.leveling?.enabled)}
          />
        </div>
        {settings.leveling?.enabled && (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">XP Per Message</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.leveling?.exp_per_message || 10}
                  onChange={(e) => updateSetting('leveling.exp_per_message', parseInt(e.target.value))}
                  className="form-control"
                />
                <p className="form-hint">Range: 1-100</p>
              </div>
              <div className="form-group">
                <label className="form-label">XP Cooldown (seconds)</label>
                <input
                  type="number"
                  min="1"
                  max="3600"
                  value={settings.leveling?.exp_cooldown_seconds || 60}
                  onChange={(e) => updateSetting('leveling.exp_cooldown_seconds', parseInt(e.target.value))}
                  className="form-control"
                />
                <p className="form-hint">Range: 1-3600</p>
              </div>
              <div className="form-group">
                <label className="form-label">Streak Multiplier</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.leveling?.streak_multiplier || 0.05}
                  onChange={(e) => updateSetting('leveling.streak_multiplier', parseFloat(e.target.value))}
                  className="form-control"
                />
                <p className="form-hint">Range: 0-1.0</p>
              </div>
              <div className="form-group">
                <label className="form-label">Max Streak Bonus</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.leveling?.max_streak_bonus || 7}
                  onChange={(e) => updateSetting('leveling.max_streak_bonus', parseInt(e.target.value))}
                  className="form-control"
                />
                <p className="form-hint">Range: 1-50</p>
              </div>
              <div className="form-group">
                <label className="form-label">Daily Reward Bonus</label>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  value={settings.leveling?.daily_bonus || 1000}
                  onChange={(e) => updateSetting('leveling.daily_bonus', parseInt(e.target.value))}
                  className="form-control"
                />
                <p className="form-hint">Range: 100-10000</p>
              </div>
            </div>

            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={settings.leveling?.level_up_announcements || false}
                onChange={(e) => updateSetting('leveling.level_up_announcements', e.target.checked)}
              />
              <span>Enable level up announcements</span>
            </div>

            {settings.leveling?.level_up_announcements && (
              <div className="form-group">
                <label className="form-label">Level Up Announcement Channel</label>
                <select
                  value={settings.leveling?.announcement_channel_id || ''}
                  onChange={(e) => updateSetting('leveling.announcement_channel_id', e.target.value)}
                  className="form-control"
                >
                  <option value="">Current channel (where user leveled up)</option>
                  {availableChannels.map(channel => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={settings.leveling?.daily_announcements_enabled || false}
                onChange={(e) => updateSetting('leveling.daily_announcements_enabled', e.target.checked)}
              />
              <span>Enable daily reward announcements</span>
            </div>

            {settings.leveling?.daily_announcements_enabled && (
              <div className="form-group">
                <label className="form-label">Daily Reward Announcement Channel</label>
                <select
                  value={settings.leveling?.daily_announcement_channel_id || ''}
                  onChange={(e) => updateSetting('leveling.daily_announcement_channel_id', e.target.value)}
                  className="form-control"
                >
                  <option value="">Select a channel</option>
                  {availableChannels.map(channel => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {/* Role Assignment */}
      <div className="feature-card">
        <div className="feature-header">
          <h2 className="feature-title">🎭 Role Assignment</h2>
          <div
            className={`toggle-switch ${settings.roles?.enabled ? 'active' : ''}`}
            onClick={() => updateSetting('roles.enabled', !settings.roles?.enabled)}
          />
        </div>
        {settings.roles?.enabled && (
          <>
            <div className="form-group">
              <label className="form-label">Assignment Mode</label>
              <select
                value={settings.roles?.mode || 'progressive'}
                onChange={(e) => updateSetting('roles.mode', e.target.value)}
                className="form-control"
              >
                <option value="progressive">Progressive</option>
                <option value="single">Single</option>
                <option value="cumulative">Cumulative</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Role Announcement Channel</label>
              <select
                value={settings.roles?.announcement_channel_id || ''}
                onChange={(e) => updateSetting('roles.announcement_channel_id', e.target.value)}
                className="form-control"
              >
                <option value="">Same as level up channel</option>
                {availableChannels.map(channel => (
                  <option key={channel.id} value={channel.id}>#{channel.name}</option>
                ))}
              </select>
              <p className="form-hint">Where to announce role assignments</p>
            </div>

            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={settings.roles?.role_announcement !== false}
                onChange={(e) => updateSetting('roles.role_announcement', e.target.checked)}
              />
              <span>Announce role assignments in channel</span>
            </div>

            <div style={{ marginTop: '20px' }}>
              {Object.entries(settings.roles?.role_mappings || {}).map(([level, roleIds]) => (
                <div key={level} className="role-mapping-item">
                  <div className="role-mapping-content">
                    <div className="form-group">
                      <label className="form-label">Level</label>
                      <input
                        type="number"
                        min="1"
                        value={level}
                        onChange={(e) => updateRoleMapping(level, e.target.value, roleIds)}
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Roles</label>
                      <RoleSelector
                        selectedRoleIds={roleIds}
                        availableRoles={availableRoles}
                        onChange={(newRoleIds) => updateRoleMapping(level, level, newRoleIds)}
                      />
                      <p className="form-hint">Click to select multiple roles</p>
                    </div>
                  </div>
                  <button onClick={() => removeRoleMapping(level)} className="delete-btn">
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addRoleMapping} className="add-btn">
              + Add Role Mapping
            </button>
          </>
        )}
      </div>

      {/* AI Configuration */}
      <div className="feature-card">
        <div className="feature-header">
          <h2 className="feature-title">🤖 AI Configuration</h2>
          <div
            className={`toggle-switch ${settings.ai?.enabled ? 'active' : ''}`}
            onClick={() => updateSetting('ai.enabled', !settings.ai?.enabled)}
          />
        </div>
        {settings.ai?.enabled && (
          <>
            <div className="form-group">
              <label className="form-label">AI Model</label>
              <select
                value={settings.ai?.model || 'gpt-4o-mini'}
                onChange={(e) => updateSetting('ai.model', e.target.value)}
                className="form-control"
              >
                <option value="gpt-4o-mini">GPT-4o Mini (Fast & Affordable)</option>
                <option value="gpt-4o">GPT-4o (Recommended)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>
              </select>
              <p className="form-hint">Higher tier models provide better responses</p>
            </div>
            <div className="form-group">
              <label className="form-label">AI Instructions</label>
              <textarea
                value={settings.ai?.instructions || ''}
                onChange={(e) => updateSetting('ai.instructions', e.target.value)}
                placeholder="Enter custom instructions for AI behavior..."
                className="form-control"
              />
              <p className="form-hint">Customize AI personality and response style</p>
            </div>
            <div className="form-group">
              <label className="form-label">Daily Interaction Limit</label>
              <input
                type="number"
                min="1"
                max="100"
                value={settings.ai?.daily_limit || 100}
                onChange={(e) => updateSetting('ai.daily_limit', parseInt(e.target.value))}
                className="form-control"
              />
              <p className="form-hint">Maximum AI interactions per day</p>
            </div>
          </>
        )}
      </div>

      {/* Games - Slots */}
      <div className="feature-card">
        <div className="feature-header">
          <h2 className="feature-title">🎰 Games - Slots</h2>
          <div
            className={`toggle-switch ${settings.games?.['slots-config']?.enabled ? 'active' : ''}`}
            onClick={() => updateSetting('games.slots-config.enabled', !settings.games?.['slots-config']?.enabled)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Slot Symbols (Select 12)</label>
          <div className="emoji-selection-box">
            <div className="emoji-grid">
              {(settings.games?.['slots-config']?.symbols || []).length === 0 ? (
                <span style={{ opacity: 0.6 }}>Click emojis below to select them</span>
              ) : (
                (settings.games?.['slots-config']?.symbols || []).map((symbol, idx) => {
                  const customEmoji = parseCustomEmoji(symbol);
                  const emojiData = customEmoji || availableEmojis.find(e => (e.emoji || e.name) === symbol);

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (customEmoji) {
                          toggleEmojiSelection({ ...customEmoji, emoji: null });
                        } else if (emojiData) {
                          toggleEmojiSelection(emojiData);
                        }
                      }}
                      className="emoji-btn selected"
                      title="Click to deselect"
                    >
                      {(customEmoji?.url || emojiData?.url) ? (
                        <img src={customEmoji?.url || emojiData.url} alt={customEmoji?.name || emojiData.name} />
                      ) : (
                        <span>{symbol}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <div className="emoji-counter">
              {(settings.games?.['slots-config']?.symbols?.length || 0)} / 12 selected
              {(settings.games?.['slots-config']?.symbols?.length || 0) < 12 && (
                <span className="needed">
                  {' '}({12 - (settings.games?.['slots-config']?.symbols?.length || 0)} more needed)
                </span>
              )}
            </div>
          </div>

          <label className="form-label">Available Emojis (Click to select)</label>
          <div className="emoji-picker-grid">
            {availableEmojis.map((emoji) => {
              let storedFormat;
              if (emoji.url && emoji.id) {
                const animated = emoji.animated ? 'a' : '';
                storedFormat = `<${animated}:${emoji.name}:${emoji.id}>`;
              } else {
                storedFormat = emoji.emoji || emoji.name;
              }

              const isSelected = settings.games?.['slots-config']?.symbols?.includes(storedFormat);

              return (
                <button
                  key={emoji.id}
                  onClick={() => toggleEmojiSelection(emoji)}
                  disabled={(settings.games?.['slots-config']?.symbols?.length || 0) >= 12 && !isSelected}
                  className={`emoji-btn ${isSelected ? 'selected' : ''}`}
                  title={isSelected ? 'Already selected' : 'Click to select'}
                >
                  {emoji.url ? (
                    <img src={emoji.url} alt={emoji.name} />
                  ) : (
                    <span>{emoji.emoji}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-grid compact">
          <div className="form-group">
            <label className="form-label">Match 2 Multiplier</label>
            <NumberInput
              value={settings.games?.['slots-config']?.match_two_multiplier || 2}
              min={1}
              max={10}
              onChange={(e) => updateSetting('games.slots-config.match_two_multiplier', parseInt(e.target.value))}
            />
            <p className="form-hint">Range: 1-10</p>
          </div>
          <div className="form-group">
            <label className="form-label">Match 3 Multiplier</label>
            <NumberInput
              value={settings.games?.['slots-config']?.match_three_multiplier || 10}
              min={1}
              max={100}
              onChange={(e) => updateSetting('games.slots-config.match_three_multiplier', parseInt(e.target.value))}
            />
            <p className="form-hint">Range: 1-100</p>
          </div>
          <div className="form-group">
            <label className="form-label">Minimum Bet</label>
            <NumberInput
              value={settings.games?.['slots-config']?.min_bet || 100}
              min={1}
              max={10000}
              onChange={(e) => updateSetting('games.slots-config.min_bet', parseInt(e.target.value))}
            />
            <p className="form-hint">Range: 1-10000</p>
          </div>
          <div className="form-group">
            <label className="form-label">Maximum Bet</label>
            <NumberInput
              value={settings.games?.['slots-config']?.max_bet || 25000}
              min={1}
              max={1000000}
              onChange={(e) => updateSetting('games.slots-config.max_bet', parseInt(e.target.value))}
            />
            <p className="form-hint">Range: min_bet-1000000</p>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Bet Options (comma-separated)</label>
          <input
            type="text"
            value={(settings.games?.['slots-config']?.bet_options || []).join(', ')}
            onChange={(e) => {
              const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
              updateSetting('games.slots-config.bet_options', values);
            }}
            placeholder="100, 1000, 5000, 10000, 25000"
            className="form-control"
          />
          <p className="form-hint">Quick bet amounts for users</p>
        </div>
      </div>

      <div className="dashboard-footer">
        <p>All changes are saved to the database and will take effect immediately.</p>
      </div>
    </div>
  );
};

// Render the application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<GuildDashboard />);