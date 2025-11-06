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
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedRoles = availableRoles.filter(role => selectedRoleIds.includes(role.id));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const updatePosition = () => {
      if (containerRef.current && isOpen) {
        const rect = containerRef.current.getBoundingClientRect();
        const dropdownHeight = 300; // Max height
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;

        setDropdownPosition({
          top: shouldOpenUpward ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
          left: rect.left,
          width: rect.width
        });
      }
    };

    if (isOpen) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
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

  // Filter roles based on search query
  const filteredRoles = availableRoles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dropdownContent = isOpen && ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 10000
      }}
      className="role-dropdown"
    >
      {filteredRoles.length > 0 ? (
        filteredRoles.map(role => {
          const isSelected = selectedRoleIds.includes(role.id);
          return (
            <div
              key={role.id}
              className={`role-dropdown-item ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                toggleRole(role.id);
                setSearchQuery('');
              }}
            >
              <span>{role.name}</span>
              {isSelected && <span className="checkmark">✓</span>}
            </div>
          );
        })
      ) : (
        <div className="role-dropdown-item disabled">
          <span>No roles found</span>
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div className="role-selector-wrapper">
      <div
        ref={containerRef}
        className={`role-selector-display ${isOpen ? 'open' : ''}`}
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {selectedRoles.map(role => (
          <span key={role.id} className="role-tag">
            {role.name}
            <span
              className="role-tag-remove"
              onClick={(e) => removeRole(role.id, e)}
            >
              ×
            </span>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="role-selector-input"
          placeholder={selectedRoles.length === 0 ? "Type to search roles..." : ""}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {dropdownContent}
    </div>
  );
};

// Custom Channel Selector Component
const ChannelSelector = ({ selectedChannelIds, availableChannels, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedChannels = availableChannels.filter(channel => selectedChannelIds.includes(channel.id));

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

  const toggleChannel = (channelId) => {
    if (selectedChannelIds.includes(channelId)) {
      onChange(selectedChannelIds.filter(id => id !== channelId));
    } else {
      onChange([...selectedChannelIds, channelId]);
    }
  };

  const removeChannel = (channelId, e) => {
    e.stopPropagation();
    onChange(selectedChannelIds.filter(id => id !== channelId));
  };

  return (
    <div className="role-selector-wrapper" ref={dropdownRef}>
      <div
        className={`role-selector-display ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedChannels.length === 0 ? (
          <span className="role-selector-placeholder">Click to select channels...</span>
        ) : (
          selectedChannels.map(channel => (
            <span key={channel.id} className="role-tag">
              #{channel.name}
              <span
                className="role-tag-remove"
                onClick={(e) => removeChannel(channel.id, e)}
              >
                ×
              </span>
            </span>
          ))
        )}
      </div>
      {isOpen && (
        <div className="role-dropdown">
          {availableChannels.map(channel => {
            const isSelected = selectedChannelIds.includes(channel.id);
            return (
              <div
                key={channel.id}
                className={`role-dropdown-item ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleChannel(channel.id)}
              >
                <span>#{channel.name}</span>
                {isSelected && <span className="checkmark">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Message Template Input with Placeholder Buttons
const MessageTemplateInput = ({ value, onChange, placeholders, rows = 3, placeholder: placeholderText }) => {
  const textareaRef = useRef(null);

  const insertPlaceholder = (placeholder) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value || '';

    // Insert the placeholder at cursor position
    const newText = text.substring(0, start) + `{${placeholder}}` + text.substring(end);

    // Update the value
    onChange({ target: { value: newText } });

    // Restore focus and set cursor position after the inserted placeholder
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + placeholder.length + 2; // +2 for the curly braces
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className="message-template-wrapper">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        className="form-control message-template"
        rows={rows}
        placeholder={placeholderText}
      />
      <div className="placeholder-buttons">
        {placeholders.map(placeholder => (
          <button
            key={placeholder}
            type="button"
            className="placeholder-btn"
            onClick={() => insertPlaceholder(placeholder)}
          >
            {'{' + placeholder + '}'}
          </button>
        ))}
      </div>
    </div>
  );
};

// StreamerListItem component for Twitch streamers
const StreamerListItem = ({ streamer, index, onUpdate, onRemove, availableRoles }) => {
  const [validating, setValidating] = React.useState(false);
  const [isValid, setIsValid] = React.useState(null);
  const [expanded, setExpanded] = React.useState(false);

  const validateUsername = async (username) => {
    if (!username || username.trim() === '') {
      setIsValid(null);
      return;
    }

    setValidating(true);
    try {
      const token = localStorage.getItem('discord_token');
      const response = await fetch(`${API_BASE_URL}/api/twitch/validate-username`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username.trim() })
      });

      const data = await response.json();
      setIsValid(data.valid);
    } catch (error) {
      console.error('Error validating Twitch username:', error);
      setIsValid(false);
    } finally {
      setValidating(false);
    }
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    onUpdate(index, { ...streamer, twitch_username: newUsername });
    if (isValid !== null) setIsValid(null); // Reset validation on change
  };

  const handleUsernameBlur = () => {
    if (streamer.twitch_username) {
      validateUsername(streamer.twitch_username);
    }
  };

  return (
    <div className="streamer-item">
      <div className="streamer-item-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <input
            type="text"
            className="form-control"
            placeholder="Twitch username"
            value={streamer.twitch_username || ''}
            onChange={handleUsernameChange}
            onBlur={handleUsernameBlur}
            style={{ flex: 1 }}
          />
          {validating && <span style={{ color: '#999' }}>⏳</span>}
          {!validating && isValid === true && <span style={{ color: '#4CAF50', fontSize: '1.2rem' }}>✓</span>}
          {!validating && isValid === false && <span style={{ color: '#dc3545', fontSize: '1.2rem' }}>✗</span>}
        </div>
        <button
          className="btn-icon"
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'rgba(88, 101, 242, 0.1)', border: '1px solid #5865F2', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer' }}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <button
          className="btn-danger btn-sm"
          onClick={() => onRemove(index)}
          style={{ background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="streamer-item-body">
          <div className="form-group">
            <label className="form-label">Ping Roles (Optional)</label>
            <RoleSelector
              selectedRoleIds={streamer.mention_role_ids || []}
              availableRoles={availableRoles}
              onChange={(roleIds) => onUpdate(index, { ...streamer, mention_role_ids: roleIds })}
            />
            <p className="form-hint">Roles to mention when this streamer goes live</p>
          </div>

          <div className="checkbox-wrapper">
            <input
              type="checkbox"
              id={`streamer-${index}-everyone`}
              checked={streamer.mention_everyone || false}
              onChange={(e) => onUpdate(index, { ...streamer, mention_everyone: e.target.checked })}
            />
            <label htmlFor={`streamer-${index}-everyone`}>Mention @everyone</label>
          </div>

          <div className="checkbox-wrapper">
            <input
              type="checkbox"
              id={`streamer-${index}-here`}
              checked={streamer.mention_here || false}
              onChange={(e) => onUpdate(index, { ...streamer, mention_here: e.target.checked })}
            />
            <label htmlFor={`streamer-${index}-here`}>Mention @here</label>
          </div>

          <div className="form-group">
            <label className="form-label">Custom Announcement Message (Optional)</label>
            <MessageTemplateInput
              value={streamer.custom_message || ''}
              onChange={(e) => onUpdate(index, { ...streamer, custom_message: e.target.value })}
              placeholders={['username', 'game', 'title', 'viewer_count']}
              rows={2}
              placeholder="🎮 {username} is streaming {game}! Come watch!"
            />
            <p className="form-hint">Message sent above the embed (with pings prepended). Leave empty for embed only.</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== REACTION ROLE COMPONENTS =====

// Color Picker Component
const ColorPicker = ({ value, onChange }) => {
  return (
    <div className="color-picker-wrapper">
      <input
        type="color"
        value={value || '#5865F2'}
        onChange={(e) => onChange(e.target.value)}
        className="color-picker-input"
      />
      <span className="color-value">{value || '#5865F2'}</span>
    </div>
  );
};

// Helper function to parse Discord emoji format
const parseDiscordEmojiFormat = (value) => {
  if (!value || !value.includes(':')) return null;
  // Matches: <:name:id> or <a:name:id>
  const match = value.match(/<(a?):([^:]+):(\d+)>/);
  if (match) {
    return {
      animated: match[1] === 'a',
      name: match[2],
      id: match[3]
    };
  }
  return null;
};

// Emoji Selector Component
const EmojiSelector = ({ value, onSelect, availableEmojis = [], guildName = 'Guild' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('standard');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, openUpward: false });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const standardEmojiCategories = {
    people: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😌', '😔', '😑', '😐', '🤐', '🤨', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤮', '🤢', '🤮', '🤮', '🤮'],
    nature: ['🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🎍', '🎎', '🎏', '🎐', '🎑', '🌍', '🌎', '🌏', '💐', '🌐', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️'],
    food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥑', '🍆', '🍅', '🌶️', '🌽', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🍰', '🎂', '🧁', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🍯', '🥛', '🍼', '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎳', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '⛸️', '🎣', '🎽', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🎯', '🪀', '🪃', '🎪', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '🧩'],
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const updatePosition = () => {
      if (buttonRef.current && isOpen) {
        const rect = buttonRef.current.getBoundingClientRect();
        const dropdownHeight = 550; // Max height
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;

        setDropdownPosition({
          top: shouldOpenUpward ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
          left: rect.left,
          width: Math.max(rect.width, 500),
          openUpward: shouldOpenUpward
        });
      }
    };

    if (isOpen) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const getDisplayEmoji = () => {
    if (!value) return '😀';
    // For custom Discord emoji format, return the original value
    const parsedEmoji = parseDiscordEmojiFormat(value);
    if (parsedEmoji) {
      // Look up emoji in available emojis to get URL for image rendering
      const emojiObj = availableEmojis.find(e => e.id === parsedEmoji.id);
      if (emojiObj && emojiObj.url) {
        return (
          <img
            src={emojiObj.url}
            alt={parsedEmoji.name}
            title={value}
            style={{ width: '24px', height: '24px', objectFit: 'contain' }}
          />
        );
      }
    }
    // Return standard emoji as-is
    return value;
  };

  const buildCustomEmojiValue = (emoji) => {
    // Build Discord emoji format: <:name:id> or <a:name:id> for animated
    const prefix = emoji.animated ? 'a' : '';
    return `<${prefix}:${emoji.name}:${emoji.id}>`;
  };

  const renderCustomEmojiDisplay = (emoji) => {
    // Display custom emoji using CDN URL
    if (emoji.url) {
      return (
        <img
          src={emoji.url}
          alt={emoji.name}
          title={emoji.name}
          style={{ width: '32px', height: '32px', objectFit: 'contain' }}
        />
      );
    }
    // Fallback to text format if URL not available
    return buildCustomEmojiValue(emoji);
  };

  const filteredEmojis = category === 'custom'
    ? availableEmojis.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : Object.values(standardEmojiCategories).flat().filter((e, i, arr) => arr.indexOf(e) === i);

  const dropdownContent = isOpen && ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 10000
      }}
      className="emoji-selector-dropdown"
    >
          <div className="emoji-categories">
            <button
              className={`category-btn ${category === 'standard' ? 'active' : ''}`}
              onClick={() => { setCategory('standard'); setSearchQuery(''); }}
            >
              Standard
            </button>
            {availableEmojis.length > 0 && (
              <button
                className={`category-btn ${category === 'custom' ? 'active' : ''}`}
                onClick={() => setCategory('custom')}
              >
                {guildName} Emojis ({availableEmojis.length})
              </button>
            )}
          </div>

          {category === 'custom' && (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search custom emojis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="emoji-search"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '4px 8px',
                    color: 'var(--text-secondary)'
                  }}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          )}

          <div className="emoji-grid">
            {filteredEmojis.map((emoji, idx) => {
              const emojiValue = category === 'custom' ? buildCustomEmojiValue(emoji) : emoji;
              const isSelected = category === 'custom'
                ? value === emojiValue
                : value === emoji;

              return (
                <button
                  key={idx}
                  className={`emoji-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onSelect(emojiValue);
                    setIsOpen(false);
                  }}
                  title={category === 'custom' ? emoji.name : ''}
                  type="button"
                >
                  {category === 'custom' ? renderCustomEmojiDisplay(emoji) : emoji}
                </button>
              );
            })}
          </div>
    </div>,
    document.body
  );

  return (
    <div className="emoji-selector-wrapper">
      <div
        ref={buttonRef}
        className={`emoji-selector-display ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="emoji-display">{getDisplayEmoji()}</span>
        {!parseDiscordEmojiFormat(value) && (
          <span className="emoji-label">{value || 'Select emoji'}</span>
        )}
      </div>
      {dropdownContent}
    </div>
  );
};

// Embed Builder Component
const EmbedBuilder = ({ value, onChange }) => {
  const [previewMode, setPreviewMode] = useState(false);

  const updateEmbedField = (field, fieldValue) => {
    const updated = { ...value };
    updated[field] = fieldValue;
    onChange(updated);
  };

  const addField = () => {
    const updated = { ...value };
    if (!updated.fields) updated.fields = [];
    updated.fields.push({ name: '', value: '', inline: false });
    onChange(updated);
  };

  const updateField = (idx, key, fieldValue) => {
    const updated = { ...value };
    updated.fields[idx][key] = fieldValue;
    onChange(updated);
  };

  const removeField = (idx) => {
    const updated = { ...value };
    updated.fields.splice(idx, 1);
    onChange(updated);
  };

  const embed = value || {};

  return (
    <div className="embed-builder">
      <div className="embed-builder-header">
        <h4>Embed Builder</h4>
        <button
          type="button"
          className="btn-small"
          onClick={() => setPreviewMode(!previewMode)}
        >
          {previewMode ? 'Edit' : 'Preview'}
        </button>
      </div>

      {!previewMode ? (
        <div className="embed-builder-form">
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              maxLength="256"
              value={embed.title || ''}
              onChange={(e) => updateEmbedField('title', e.target.value)}
              placeholder="Embed title"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              maxLength="4096"
              value={embed.description || ''}
              onChange={(e) => updateEmbedField('description', e.target.value)}
              placeholder="Embed description"
              className="form-control"
              rows="4"
            ></textarea>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Color</label>
              <ColorPicker
                value={embed.color}
                onChange={(color) => updateEmbedField('color', color)}
              />
            </div>

            <div className="form-group">
              <label>Thumbnail URL</label>
              <input
                type="url"
                value={embed.thumbnail || ''}
                onChange={(e) => updateEmbedField('thumbnail', e.target.value)}
                placeholder="https://example.com/image.png"
                className="form-control"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Image URL</label>
            <input
              type="url"
              value={embed.image || ''}
              onChange={(e) => updateEmbedField('image', e.target.value)}
              placeholder="https://example.com/image.png"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Author Name</label>
            <input
              type="text"
              value={embed.author_name || ''}
              onChange={(e) => updateEmbedField('author_name', e.target.value)}
              placeholder="Author name"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Footer Text</label>
            <input
              type="text"
              value={embed.footer || ''}
              onChange={(e) => updateEmbedField('footer', e.target.value)}
              placeholder="Footer text"
              className="form-control"
            />
          </div>

          <div className="embed-fields-section">
            <div className="fields-header">
              <h5>Custom Fields (up to 5)</h5>
              {(!embed.fields || embed.fields.length < 5) && (
                <button type="button" className="btn-small" onClick={addField}>
                  + Add Field
                </button>
              )}
            </div>

            {embed.fields && embed.fields.map((field, idx) => (
              <div key={idx} className="embed-field">
                <div className="form-row">
                  <div className="form-group">
                    <label>Field Name</label>
                    <input
                      type="text"
                      value={field.name || ''}
                      onChange={(e) => updateField(idx, 'name', e.target.value)}
                      placeholder="Field name"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label>Inline</label>
                    <input
                      type="checkbox"
                      checked={field.inline || false}
                      onChange={(e) => updateField(idx, 'inline', e.target.checked)}
                      className="form-checkbox"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Field Value</label>
                  <textarea
                    value={field.value || ''}
                    onChange={(e) => updateField(idx, 'value', e.target.value)}
                    placeholder="Field value"
                    className="form-control"
                    rows="2"
                  ></textarea>
                </div>

                <button
                  type="button"
                  className="btn-danger btn-small"
                  onClick={() => removeField(idx)}
                >
                  Remove Field
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="embed-preview">
          <div className="discord-embed">
            {embed.color && <div className="embed-color-bar" style={{ backgroundColor: embed.color }}></div>}
            <div className="embed-content">
              {embed.title && <div className="embed-title">{embed.title}</div>}
              {embed.description && <div className="embed-description">{embed.description}</div>}
              {embed.fields && embed.fields.map((field, idx) => (
                <div key={idx} className="embed-field-preview">
                  <div className="field-name">{field.name}</div>
                  <div className="field-value">{field.value}</div>
                </div>
              ))}
              {embed.footer && <div className="embed-footer">{embed.footer}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Button Config Builder Component
const ButtonConfigBuilder = ({ buttons, onChange, availableEmojis, availableRoles }) => {
  const [buttonStyles] = useState(['primary', 'secondary', 'success', 'danger']);

  const addButton = () => {
    const updated = [...buttons];
    updated.push({
      label: `Button ${updated.length + 1}`,
      style: 'primary',
      emoji: null,
      role_ids: []
    });
    onChange(updated);
  };

  const updateButton = (idx, field, value) => {
    const updated = [...buttons];
    updated[idx][field] = value;
    onChange(updated);
  };

  const removeButton = (idx) => {
    const updated = buttons.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <div className="button-config-builder">
      <div className="builder-header">
        <h4>Button Configuration</h4>
        {buttons.length < 25 && (
          <button type="button" className="btn-small" onClick={addButton}>
            + Add Button
          </button>
        )}
      </div>

      <div className="buttons-list">
        {buttons.map((button, idx) => (
          <div key={idx} className="button-config-item">
            <div className="form-row">
              <div className="form-group">
                <label>Label</label>
                <input
                  type="text"
                  maxLength="80"
                  value={button.label || ''}
                  onChange={(e) => updateButton(idx, 'label', e.target.value)}
                  placeholder="Button label"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Style</label>
                <select
                  value={button.style || 'primary'}
                  onChange={(e) => updateButton(idx, 'style', e.target.value)}
                  className="form-control"
                >
                  {buttonStyles.map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Emoji (Optional)</label>
              <EmojiSelector
                value={button.emoji}
                onSelect={(emoji) => updateButton(idx, 'emoji', emoji)}
                availableEmojis={availableEmojis}
                guildName={guildName}
              />
            </div>

            <div className="form-group">
              <label>Assign Roles</label>
              <RoleSelector
                selectedRoleIds={button.role_ids || []}
                availableRoles={availableRoles || []}
                onChange={(roleIds) => updateButton(idx, 'role_ids', roleIds)}
              />
            </div>

            <button
              type="button"
              className="btn-danger btn-small"
              onClick={() => removeButton(idx)}
            >
              Remove Button
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Dropdown Config Builder Component
const DropdownConfigBuilder = ({ config, onChange, availableEmojis, availableRoles }) => {
  const [dropdownConfig, setDropdownConfig] = useState(config || {
    placeholder: 'Select an option...',
    min_values: 1,
    max_values: 1,
    options: []
  });

  const addOption = () => {
    const updated = { ...dropdownConfig };
    if (!updated.options) updated.options = [];
    updated.options.push({
      label: `Option ${updated.options.length + 1}`,
      value: `option_${updated.options.length + 1}`,
      emoji: null,
      role_ids: []
    });
    setDropdownConfig(updated);
    onChange(updated);
  };

  const updateOption = (idx, field, value) => {
    const updated = { ...dropdownConfig };
    updated.options[idx][field] = value;
    setDropdownConfig(updated);
    onChange(updated);
  };

  const removeOption = (idx) => {
    const updated = { ...dropdownConfig };
    updated.options = updated.options.filter((_, i) => i !== idx);
    setDropdownConfig(updated);
    onChange(updated);
  };

  const updateConfig = (field, value) => {
    const updated = { ...dropdownConfig };
    updated[field] = value;
    setDropdownConfig(updated);
    onChange(updated);
  };

  return (
    <div className="dropdown-config-builder">
      <div className="builder-header">
        <h4>Dropdown Configuration</h4>
        {dropdownConfig.options && dropdownConfig.options.length < 25 && (
          <button type="button" className="btn-small" onClick={addOption}>
            + Add Option
          </button>
        )}
      </div>

      <div className="dropdown-settings">
        <div className="form-group">
          <label>Placeholder Text</label>
          <input
            type="text"
            value={dropdownConfig.placeholder || ''}
            onChange={(e) => updateConfig('placeholder', e.target.value)}
            placeholder="Select an option..."
            className="form-control"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Min Selections</label>
            <input
              type="number"
              min="1"
              max="25"
              value={dropdownConfig.min_values || 1}
              onChange={(e) => updateConfig('min_values', parseInt(e.target.value))}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Max Selections</label>
            <input
              type="number"
              min="1"
              max="25"
              value={dropdownConfig.max_values || 1}
              onChange={(e) => updateConfig('max_values', parseInt(e.target.value))}
              className="form-control"
            />
          </div>
        </div>
      </div>

      <div className="options-list">
        {dropdownConfig.options && dropdownConfig.options.map((option, idx) => (
          <div key={idx} className="option-config-item">
            <div className="form-row">
              <div className="form-group">
                <label>Label</label>
                <input
                  type="text"
                  maxLength="100"
                  value={option.label || ''}
                  onChange={(e) => updateOption(idx, 'label', e.target.value)}
                  placeholder="Option label"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Value</label>
                <input
                  type="text"
                  maxLength="100"
                  value={option.value || ''}
                  onChange={(e) => updateOption(idx, 'value', e.target.value)}
                  placeholder="option_value"
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Emoji (Optional)</label>
              <EmojiSelector
                value={option.emoji}
                onSelect={(emoji) => updateOption(idx, 'emoji', emoji)}
                availableEmojis={availableEmojis}
                guildName={guildName}
              />
            </div>

            <div className="form-group">
              <label>Assign Roles</label>
              <RoleSelector
                selectedRoleIds={option.role_ids || []}
                availableRoles={availableRoles || []}
                onChange={(roleIds) => updateOption(idx, 'role_ids', roleIds)}
              />
            </div>

            <button
              type="button"
              className="btn-danger btn-small"
              onClick={() => removeOption(idx)}
            >
              Remove Option
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Reaction Roles Card Component (Inline Form)
const ReactionRolesCard = ({
  settings,
  setSettings,
  collapsedSections,
  showForm,
  editingId,
  toggleSectionCollapse,
  updateToggleAndCollapse,
  updateSetting,
  availableRoles,
  availableChannels,
  availableEmojis,
  showNotification,
  onToggleForm,
  onSetEditingId,
  currentGuildId,
  token,
  onSaveConfig,
  guildName
}) => {
  const [formData, setFormData] = useState({
    channel_id: '',
    interaction_type: 'emoji',
    text_content: '',
    embed_config: null,
    allow_removal: true,
    emoji_role_mappings: [{ emoji: null, role_ids: [] }],
    button_configs: [],
    dropdown_config: { placeholder: 'Select...', min_values: 1, max_values: 1, options: [] }
  });
  const [errors, setErrors] = useState({});
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData({
      channel_id: '',
      interaction_type: 'emoji',
      text_content: '',
      embed_config: null,
      allow_removal: true,
      emoji_role_mappings: [{ emoji: null, role_ids: [] }],
      button_configs: [],
      dropdown_config: { placeholder: 'Select...', min_values: 1, max_values: 1, options: [] }
    });
    setErrors({});
    setPreviewMode(false);
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.channel_id) {
      newErrors.channel_id = 'Channel is required';
    }
    if (!formData.text_content && !formData.embed_config) {
      newErrors.content = 'Either message text or embed is required';
    }

    if (formData.interaction_type === 'emoji') {
      if (!formData.emoji_role_mappings || formData.emoji_role_mappings.every(m => !m.emoji)) {
        newErrors.emoji = 'At least one emoji with roles is required';
      }
    } else if (formData.interaction_type === 'button') {
      if (!formData.button_configs || formData.button_configs.length === 0) {
        newErrors.buttons = 'At least one button is required';
      }
    } else if (formData.interaction_type === 'dropdown') {
      if (!formData.dropdown_config?.options || formData.dropdown_config.options.length === 0) {
        newErrors.dropdown = 'At least one option is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setPreviewMode(true);
  };

  const handleConfirmPost = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/guilds/${currentGuildId}/reaction-roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create reaction role');
      }

      // Update local state with new message and ensure feature is enabled
      setSettings(prev => {
        const newSettings = { ...prev };
        if (!newSettings.reaction_roles) {
          newSettings.reaction_roles = { enabled: true, messages: [] };
        }
        newSettings.reaction_roles = {
          ...newSettings.reaction_roles,
          enabled: true,
          messages: [...(newSettings.reaction_roles?.messages || []), result.data]
        };
        return newSettings;
      });

      // Save the guild config to persist the changes
      await onSaveConfig();

      showNotification('Reaction role created!', 'success');
      resetForm();
      onToggleForm(false);
      onSetEditingId(null);
    } catch (error) {
      console.error('Error:', error);
      showNotification(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings.reaction_roles?.enabled) {
    return (
      <div className="feature-card">
        <div className="feature-header">
          <span
            className="collapse-icon"
            onClick={() => toggleSectionCollapse('reaction_roles')}
            style={{ cursor: 'pointer', marginRight: '0.5rem', transition: 'transform 0.2s', display: 'inline-block', transform: collapsedSections.reaction_roles ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▶
          </span>
          <h2 className="feature-title">⚙️ Reaction Roles</h2>
          <div
            className={`toggle-switch ${settings.reaction_roles?.enabled ? 'active' : ''}`}
            onClick={() => updateToggleAndCollapse('reaction_roles.enabled', !settings.reaction_roles?.enabled, 'reaction_roles')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="feature-card">
      <div className="feature-header">
        <span
          className="collapse-icon"
          onClick={() => toggleSectionCollapse('reaction_roles')}
          style={{ cursor: 'pointer', marginRight: '0.5rem', transition: 'transform 0.2s', display: 'inline-block', transform: collapsedSections.reaction_roles ? 'rotate(0deg)' : 'rotate(90deg)' }}
        >
          ▶
        </span>
        <h2 className="feature-title">⚙️ Reaction Roles</h2>
        <div
          className={`toggle-switch ${settings.reaction_roles?.enabled ? 'active' : ''}`}
          onClick={() => updateToggleAndCollapse('reaction_roles.enabled', !settings.reaction_roles?.enabled, 'reaction_roles')}
        />
      </div>
      <div className={`feature-content ${collapsedSections.reaction_roles ? 'collapsed' : ''}`} style={{ maxHeight: collapsedSections.reaction_roles ? '0' : '10000px', overflow: 'hidden', transition: 'max-height 0.3s ease-in-out' }}>
        <p className="feature-description">
          Create custom messages where users can click emoji reactions, buttons, or dropdowns to get roles!
        </p>

        {/* Existing Messages List */}
        {(settings.reaction_roles?.messages || []).length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Current Reaction Role Messages</h3>
            {(settings.reaction_roles?.messages || []).map((message, idx) => (
              <div key={idx} style={{ padding: '1rem', background: 'var(--bg-overlay)', border: '1px solid var(--border-light)', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: '500' }}>
                      Message ID: <code style={{ fontFamily: 'monospace', color: '#5865F2' }}>{message.message_id}</code>
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Type: <strong>{message.interaction_type}</strong> • Removal: {message.allow_removal ? '✅ Enabled' : '❌ Disabled'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        onSetEditingId(message.message_id);
                        onToggleForm(true);
                      }}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-danger"
                      onClick={async () => {
                        if (confirm('Delete this reaction role message?')) {
                          const updated = settings.reaction_roles.messages.filter((_, i) => i !== idx);
                          setSettings(prev => ({
                            ...prev,
                            reaction_roles: {
                              ...prev.reaction_roles,
                              messages: updated
                            }
                          }));
                          await onSaveConfig();
                        }
                      }}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form Toggle & Content */}
        {!showForm && (
          <button
            className="btn-secondary"
            onClick={() => {
              resetForm();
              onSetEditingId(null);
              onToggleForm(true);
            }}
            style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}
          >
            + Create New Reaction Role
          </button>
        )}

        {showForm && !previewMode && (
          <div style={{ background: 'var(--bg-overlay)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Create Reaction Role Message</h3>

            {Object.keys(errors).length > 0 && (
              <div style={{
                background: 'rgba(220, 53, 69, 0.1)',
                border: '1px solid rgba(220, 53, 69, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                color: '#dc3545'
              }}>
                {Object.entries(errors).map(([key, error]) => (
                  <p key={key} style={{ margin: '4px 0', fontSize: '0.9rem' }}>
                    ❌ {error}
                  </p>
                ))}
              </div>
            )}

            {/* Channel Selection */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Channel *</label>
              <select
                value={formData.channel_id}
                onChange={(e) => updateFormField('channel_id', e.target.value)}
                className="form-control"
              >
                <option value="">Select a channel...</option>
                {(availableChannels || []).map(ch => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
            </div>

            {/* Interaction Type */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Interaction Type *</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                {['emoji'].map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="interaction_type"
                      value={type}
                      checked={formData.interaction_type === type}
                      onChange={(e) => updateFormField('interaction_type', e.target.value)}
                    />
                    <span>{type === 'emoji' ? '😀 Emoji' : type === 'button' ? '🔘 Button' : '📋 Dropdown'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Message Content */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Message Content (at least one required)</h4>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Text Message</label>
                <textarea
                  value={formData.text_content || ''}
                  onChange={(e) => updateFormField('text_content', e.target.value)}
                  placeholder="Optional: Add text above the embed"
                  className="form-control"
                  rows="2"
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={!!formData.embed_config}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateFormField('embed_config', { title: '', description: '' });
                      } else {
                        updateFormField('embed_config', null);
                      }
                    }}
                  />
                  Include Embed
                </label>
              </div>

              {formData.embed_config && (
                <EmbedBuilder
                  value={formData.embed_config}
                  onChange={(embed) => updateFormField('embed_config', embed)}
                />
              )}
            </div>

            {/* Allow Removal */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.allow_removal}
                  onChange={(e) => updateFormField('allow_removal', e.target.checked)}
                />
                Allow users to remove roles
              </label>
            </div>

            {/* Type-Specific Configuration */}
            {formData.interaction_type === 'emoji' && (
              <EmojiRoleMapping
                mappings={formData.emoji_role_mappings}
                onChange={(mappings) => updateFormField('emoji_role_mappings', mappings)}
                availableRoles={availableRoles}
                availableEmojis={availableEmojis}
                guildName={guildName}
              />
            )}

            {/* Button and Dropdown types temporarily hidden - backend framework preserved */}
            {/* {formData.interaction_type === 'button' && (
              <ButtonConfigBuilder
                buttons={formData.button_configs}
                onChange={(buttons) => updateFormField('button_configs', buttons)}
                availableEmojis={availableEmojis}
                availableRoles={availableRoles}
              />
            )}

            {formData.interaction_type === 'dropdown' && (
              <DropdownConfigBuilder
                config={formData.dropdown_config}
                onChange={(config) => updateFormField('dropdown_config', config)}
                availableEmojis={availableEmojis}
                availableRoles={availableRoles}
              />
            )} */}

            {/* Form Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  resetForm();
                  onToggleForm(false);
                  onSetEditingId(null);
                }}
                disabled={saving}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1 }}
              >
                Preview & Post
              </button>
            </div>
          </div>
        )}

        {/* Preview Screen */}
        {showForm && previewMode && (
          <div style={{ background: 'var(--bg-overlay)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Preview - This is how your message will appear:</h3>

            <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-light)' }}>
              {formData.text_content && (
                <p style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>{formData.text_content}</p>
              )}

              {formData.embed_config && (
                <div style={{ background: 'var(--bg-overlay)', borderLeft: `4px solid ${formData.embed_config.color || '#5865F2'}`, padding: '12px', borderRadius: '4px' }}>
                  {formData.embed_config.title && (
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{formData.embed_config.title}</h4>
                  )}
                  {formData.embed_config.description && (
                    <p style={{ margin: '0 0 0.5rem 0', whiteSpace: 'pre-wrap' }}>{formData.embed_config.description}</p>
                  )}
                  {formData.embed_config.fields && formData.embed_config.fields.map((field, idx) => (
                    <div key={idx} style={{ marginTop: '0.5rem' }}>
                      <strong>{field.name}</strong>
                      <p style={{ margin: '0.25rem 0 0 0' }}>{field.value}</p>
                    </div>
                  ))}
                  {formData.embed_config.footer && (
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formData.embed_config.footer}</p>
                  )}
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(88, 101, 242, 0.1)', border: '1px solid rgba(88, 101, 242, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '1.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                ✅ <strong>{formData.interaction_type}</strong> interaction type
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                📌 Posted in: <strong>#{availableChannels?.find(c => c.id === formData.channel_id)?.name || 'Unknown'}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-secondary"
                onClick={() => setPreviewMode(false)}
                disabled={saving}
                style={{ flex: 1 }}
              >
                Back to Edit
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmPost}
                disabled={saving}
                style={{ flex: 1 }}
              >
                {saving ? 'Posting...' : 'Confirm & Post'}
              </button>
            </div>
          </div>
        )}

        <div className="info-box" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(88, 101, 242, 0.1)', borderRadius: '8px', border: '1px solid rgba(88, 101, 242, 0.3)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#3900a0', lineHeight: '1.5' }}>
            <strong>ℹ️ How it works:</strong> Configure your message content and interaction type. We'll automatically post it to Discord and assign it a message ID.
          </p>
        </div>
      </div>
    </div>
  );
};

// Emoji Role Mapping Component (Table UI)
const EmojiRoleMapping = ({ mappings, onChange, availableRoles, availableEmojis, guildName }) => {
  const addMapping = () => {
    const updated = [...mappings];
    updated.push({ emoji: null, role_ids: [] });
    onChange(updated);
  };

  const updateMapping = (idx, field, value) => {
    const updated = [...mappings];
    updated[idx][field] = value;
    onChange(updated);
  };

  const removeMapping = (idx) => {
    const updated = mappings.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '1rem', margin: 0 }}>Emoji → Role Mapping</h3>
        <button
          type="button"
          className="btn-small"
          onClick={addMapping}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          + Add Emoji
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-overlay)', borderBottom: '1px solid var(--border-light)' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', fontWeight: '600' }}>Emoji</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.9rem', fontWeight: '600' }}>Assign Roles</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.9rem', fontWeight: '600', width: '80px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, idx) => (
              <tr key={idx} style={{ borderBottom: idx < mappings.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                <td style={{ padding: '12px', width: '150px' }}>
                  <EmojiSelector
                    value={mapping.emoji}
                    onSelect={(emoji) => updateMapping(idx, 'emoji', emoji)}
                    availableEmojis={availableEmojis}
                    guildName={guildName}
                  />
                </td>
                <td style={{ padding: '12px' }}>
                  <RoleSelector
                    selectedRoleIds={mapping.role_ids || []}
                    availableRoles={availableRoles}
                    onChange={(roleIds) => updateMapping(idx, 'role_ids', roleIds)}
                  />
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn-danger btn-small"
                    onClick={() => removeMapping(idx)}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mappings.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '8px' }}>
          No emoji mappings yet. Click "Add Emoji" to get started.
        </p>
      )}
    </div>
  );
};

const GuildDashboard = () => {
  const [settings, setSettings] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableChannels, setAvailableChannels] = useState([]);
  const [availableEmojis, setAvailableEmojis] = useState([]);
  const [guildName, setGuildName] = useState('');
  const [guildIcon, setGuildIcon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    leveling: true,
    roles: true,
    ai: true,
    games: true,
    cross_server_portal: true,
    twitch: true,
    reaction_roles: true
  });
  const [showReactionRoleForm, setShowReactionRoleForm] = useState(false);
  const [editingReactionRoleId, setEditingReactionRoleId] = useState(null);

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

      // First check permissions
      const permissionsResponse = await fetch(`${API_BASE_URL}/api/guilds/${guildId}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (permissionsResponse.ok) {
        const permissionsData = await permissionsResponse.json();
        if (permissionsData.success && permissionsData.data) {
          // If user doesn't have admin permissions, redirect to stats page
          if (!permissionsData.data.has_admin && !permissionsData.data.can_configure_bot) {
            window.location.href = `/guild-stats.html?guild=${guildId}`;
            return;
          }
        }
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

      if (response.status === 403) {
        // User doesn't have permission, redirect to stats page
        window.location.href = `/guild-stats.html?guild=${guildId}`;
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch guild config (${response.status})`);
      }

      const data = await response.json();
      if (data.success) {
        setGuildName(data.data.guild_name || 'Guild Settings');
        setGuildIcon(data.data.guild_icon || null);
        setSettings(data.data.settings);
        setAvailableRoles(data.data.available_roles || []);
        setAvailableChannels(data.data.available_channels || []);
        const serverEmojis = data.data.available_emojis || [];
        setAvailableEmojis(serverEmojis);
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
          level_up_announcements: settings.leveling?.level_up_announcements === true,
          level_up_message: settings.leveling?.level_up_message || "🎉 {mention} GUILD LEVEL UP! You have reached level {level}! Gained {credits} Credits!",
          level_up_message_with_streak: settings.leveling?.level_up_message_with_streak || "🎉 {mention} GUILD LEVEL UP! You have reached level {level}! Gained {credits} Credits! {base_credits} + {streak_bonus} from {streak}x Streak!",
          announcement_channel_id: settings.leveling?.announcement_channel_id || null,
          daily_announcements_enabled: settings.leveling?.daily_announcements_enabled === true,
          daily_announcement_message: settings.leveling?.daily_announcement_message || "💰 {mention} claimed their daily reward! +{credits} Credits!",
          daily_announcement_message_with_streak: settings.leveling?.daily_announcement_message_with_streak || "💰 {mention} claimed their daily reward! +{credits} Credits! ({base_credits} + {streak_bonus} from {streak}x streak!)",
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
          channel_mode: settings.ai?.channel_mode || 'all',
          allowed_channels: settings.ai?.allowed_channels || [],
          excluded_channels: settings.ai?.excluded_channels || []
        },
        games: {
          enabled: settings.games?.enabled === true,
          'slots-config': {
            enabled: settings.games?.['slots-config']?.enabled === true,
            symbols: settings.games?.['slots-config']?.symbols || ['🍒', '🍋', '🍊', '🍇', '🍎', '🍌', '⭐', '🔔', '💎', '🎰', '🍀', '❤️']
          }
        },
        cross_server_portal: {
          enabled: settings.cross_server_portal?.enabled === true,
          channel_id: settings.cross_server_portal?.channel_id || null,
          public_listing: settings.cross_server_portal?.public_listing !== false,
          display_name: settings.cross_server_portal?.display_name || null,
          portal_cost: settings.cross_server_portal?.portal_cost || 1000
        },
        twitch: {
          enabled: settings.twitch?.enabled === true,
          announcement_channel_id: settings.twitch?.announcement_channel_id || null,
          tracked_streamers: settings.twitch?.tracked_streamers || [],
          announcement_settings: {
            include_thumbnail: settings.twitch?.announcement_settings?.include_thumbnail !== false,
            include_game: settings.twitch?.announcement_settings?.include_game !== false,
            include_viewer_count: settings.twitch?.announcement_settings?.include_viewer_count !== false,
            include_start_time: settings.twitch?.announcement_settings?.include_start_time !== false,
            color: settings.twitch?.announcement_settings?.color || '0x6441A4'
          },
          vod_settings: {
            enabled: settings.twitch?.vod_settings?.enabled === true,
            edit_message_when_vod_available: settings.twitch?.vod_settings?.edit_message_when_vod_available !== false,
            vod_check_interval_seconds: settings.twitch?.vod_settings?.vod_check_interval_seconds || 300,
            vod_message_suffix: settings.twitch?.vod_settings?.vod_message_suffix || '\n\n📺 **VOD Available:** [Watch Recording]({vod_url})'
          },
          notification_method: settings.twitch?.notification_method || 'polling'
        },
        reaction_roles: {
          enabled: settings.reaction_roles?.enabled === true,
          messages: settings.reaction_roles?.messages || []
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

  const toggleSectionCollapse = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateToggleAndCollapse = (path, value, section) => {
    // Update the setting
    updateSetting(path, value);
    // Update collapse state: OFF = collapsed, ON = expanded
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !value
    }));
  };

  const addRoleMapping = () => {
    const roleMappings = settings?.roles?.role_mappings || {};
    const newLevel = Object.keys(roleMappings).length > 0
      ? Math.max(...Object.keys(roleMappings).map(Number)) + 5
      : 5;
    updateSetting('roles.role_mappings', {
      ...roleMappings,
      [newLevel]: {
        role_ids: [],
        announcement_message: "🎉 {mention} reached level {level} and earned the {role} role!"
      }
    });
  };

  const removeRoleMapping = (level) => {
    const roleMappings = { ...settings.roles.role_mappings };
    delete roleMappings[level];
    updateSetting('roles.role_mappings', roleMappings);
  };

  const updateRoleMapping = (oldLevel, newLevel, roleIds, message) => {
    const roleMappings = { ...settings.roles.role_mappings };
    const currentEntry = roleMappings[oldLevel];

    // Preserve the announcement message if not provided
    const announcementMessage = message !== undefined
      ? message
      : (currentEntry?.announcement_message || "🎉 {mention} reached level {level} and earned the {role} role!");

    if (oldLevel !== newLevel) delete roleMappings[oldLevel];

    roleMappings[newLevel] = {
      role_ids: roleIds,
      announcement_message: announcementMessage
    };

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
          {guildIcon ? (
            <img
              src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=128`}
              alt="Guild Icon"
              className="guild-settings-icon"
            />
          ) : (
            <div className="guild-settings-icon guild-icon-fallback">
              {(guildName || 'G').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="header-text">
            <h1>{guildName || 'Guild Settings'}</h1>
            <p>Configure your server bot behavior</p>
          </div>
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
          <span
            className="collapse-icon"
            onClick={() => toggleSectionCollapse('leveling')}
            style={{ cursor: 'pointer', marginRight: '0.5rem', transition: 'transform 0.2s', display: 'inline-block', transform: collapsedSections.leveling ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▶
          </span>
          <h2 className="feature-title">⭐ Level-Up Announcements</h2>
          <div
            className={`toggle-switch ${settings.leveling?.level_up_announcements !== false ? 'active' : ''}`}
            onClick={() => updateToggleAndCollapse('leveling.level_up_announcements', !settings.leveling?.level_up_announcements, 'leveling')}
          />
        </div>
        <p className="feature-description" style={{marginBottom: '16px', color: '#888'}}>
          Stats (messages, exp, levels) are always tracked. This toggle controls level-up announcement messages.
        </p>
        <div className={`feature-content ${collapsedSections.leveling ? 'collapsed' : ''}`} style={{ maxHeight: collapsedSections.leveling ? '0' : '5000px', overflow: 'hidden', transition: 'max-height 0.3s ease-in-out' }}>
          {settings.leveling?.level_up_announcements !== false && (
          <>
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

            <div className="form-group">
              <label className="form-label">Level Up Message Template</label>
              <MessageTemplateInput
                value={settings.leveling?.level_up_message || ''}
                onChange={(e) => updateSetting('leveling.level_up_message', e.target.value)}
                placeholders={['mention', 'username', 'level', 'credits', 'xp', 'streak', 'base_credits', 'streak_bonus']}
                rows={3}
                placeholder="🎉 {mention} GUILD LEVEL UP! You have reached level {level}! Gained {credits} Credits!"
              />
            </div>

            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={settings.leveling?.daily_announcements_enabled || false}
                onChange={(e) => updateSetting('leveling.daily_announcements_enabled', e.target.checked)}
              />
              <span>Enable daily reward announcements</span>
            </div>

            {settings.leveling?.daily_announcements_enabled && (
              <>
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

                <div className="form-group">
                  <label className="form-label">Daily Reward Message Template</label>
                  <MessageTemplateInput
                    value={settings.leveling?.daily_announcement_message || ''}
                    onChange={(e) => updateSetting('leveling.daily_announcement_message', e.target.value)}
                    placeholders={['mention', 'username', 'credits', 'streak', 'base_credits', 'streak_bonus']}
                    rows={3}
                    placeholder="💰 {mention} claimed their daily reward! +{credits} Credits!"
                  />
                </div>
              </>
            )}
          </>
        )}
        </div>
      </div>

      {/* Role Assignment */}
      <div className="feature-card">
        <div className="feature-header">
          <span
            className="collapse-icon"
            onClick={() => toggleSectionCollapse('roles')}
            style={{ cursor: 'pointer', marginRight: '0.5rem', transition: 'transform 0.2s', display: 'inline-block', transform: collapsedSections.roles ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▶
          </span>
          <h2 className="feature-title">🎭 Role Assignment</h2>
          <div
            className={`toggle-switch ${settings.roles?.enabled ? 'active' : ''}`}
            onClick={() => updateToggleAndCollapse('roles.enabled', !settings.roles?.enabled, 'roles')}
          />
        </div>
        <div className={`feature-content ${collapsedSections.roles ? 'collapsed' : ''}`} style={{ maxHeight: collapsedSections.roles ? '0' : '5000px', overflow: 'hidden', transition: 'max-height 0.3s ease-in-out' }}>
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
              {Object.entries(settings.roles?.role_mappings || {}).map(([level, roleData]) => {
                // Handle both old format (array) and new format (object)
                const roleIds = Array.isArray(roleData) ? roleData : (roleData?.role_ids || []);
                const announcementMessage = Array.isArray(roleData)
                  ? "🎉 {mention} reached level {level} and earned the {role} role!"
                  : (roleData?.announcement_message || "🎉 {mention} reached level {level} and earned the {role} role!");

                return (
                  <div key={level} className="role-mapping-item">
                    <div className="role-mapping-content">
                      <div className="role-mapping-grid">
                        <div className="form-group">
                          <label className="form-label">Level</label>
                          <input
                            type="number"
                            min="1"
                            value={level}
                            onChange={(e) => updateRoleMapping(level, e.target.value, roleIds, announcementMessage)}
                            className="form-control"
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Roles</label>
                          <RoleSelector
                            selectedRoleIds={roleIds}
                            availableRoles={availableRoles}
                            onChange={(newRoleIds) => updateRoleMapping(level, level, newRoleIds, announcementMessage)}
                          />
                          <p className="form-hint">Click to select multiple roles</p>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Role Announcement Message</label>
                        <MessageTemplateInput
                          value={announcementMessage}
                          onChange={(e) => updateRoleMapping(level, level, roleIds, e.target.value)}
                          placeholders={['mention', 'username', 'level', 'role', 'roles']}
                          rows={2}
                          placeholder="🎉 {mention} reached level {level} and earned the {role} role!"
                        />
                      </div>
                    </div>
                    <button onClick={() => removeRoleMapping(level)} className="delete-btn">
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={addRoleMapping} className="add-btn">
              + Add Role Mapping
            </button>
          </>
        )}
        </div>
      </div>

      {/* Twitch Integration */}
      <div className="feature-card">
        <div className="feature-header">
          <span
            className="collapse-icon"
            onClick={() => toggleSectionCollapse('twitch')}
            style={{ cursor: 'pointer', marginRight: '0.5rem', transition: 'transform 0.2s', display: 'inline-block', transform: collapsedSections.twitch ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▶
          </span>
          <h2 className="feature-title">📺 Twitch Integration</h2>
          <div
            className={`toggle-switch ${settings.twitch?.enabled ? 'active' : ''}`}
            onClick={() => updateToggleAndCollapse('twitch.enabled', !settings.twitch?.enabled, 'twitch')}
          />
        </div>
        <div className={`feature-content ${collapsedSections.twitch ? 'collapsed' : ''}`} style={{ maxHeight: collapsedSections.twitch ? '0' : '5000px', overflow: 'hidden', transition: 'max-height 0.3s ease-in-out' }}>
          {settings.twitch?.enabled && (
          <>
            <p className="feature-description">
              Get notified in Discord when your favorite Twitch streamers go live! Supports custom messages, role pings, and automatic VOD detection.
            </p>

            {/* Announcement Channel */}
            <div className="form-group">
              <label className="form-label">Announcement Channel</label>
              <p className="form-hint">Where to post live notifications</p>
              <select
                value={settings.twitch?.announcement_channel_id || ''}
                onChange={(e) => updateSetting('twitch.announcement_channel_id', e.target.value)}
                className="form-control"
              >
                <option value="">Select a channel...</option>
                {availableChannels.map(channel => (
                  <option key={channel.id} value={channel.id}>#{channel.name}</option>
                ))}
              </select>
            </div>

            {/* Tracked Streamers */}
            <div className="form-group">
              <label className="form-label">Tracked Streamers ({(settings.twitch?.tracked_streamers || []).length}/2)</label>
              <p className="form-hint">Add up to 2 Twitch usernames to monitor</p>

              <div className="streamer-list">
                {(settings.twitch?.tracked_streamers || []).map((streamer, index) => (
                  <StreamerListItem
                    key={index}
                    streamer={streamer}
                    index={index}
                    availableRoles={availableRoles}
                    onUpdate={(idx, updatedStreamer) => {
                      const newStreamers = [...(settings.twitch?.tracked_streamers || [])];
                      newStreamers[idx] = updatedStreamer;
                      updateSetting('twitch.tracked_streamers', newStreamers);
                    }}
                    onRemove={(idx) => {
                      const newStreamers = (settings.twitch?.tracked_streamers || []).filter((_, i) => i !== idx);
                      updateSetting('twitch.tracked_streamers', newStreamers);
                    }}
                  />
                ))}
              </div>

              <button
                className="btn-secondary"
                onClick={() => {
                  const newStreamers = [...(settings.twitch?.tracked_streamers || []), {
                    twitch_username: '',
                    mention_role_ids: [],
                    mention_everyone: false,
                    mention_here: false,
                    custom_message: null
                  }];
                  updateSetting('twitch.tracked_streamers', newStreamers);
                }}
                disabled={(settings.twitch?.tracked_streamers || []).length >= 2}
                style={{ marginTop: '1rem', opacity: (settings.twitch?.tracked_streamers || []).length >= 2 ? 0.5 : 1 }}
              >
                + Add Streamer
              </button>
              {(settings.twitch?.tracked_streamers || []).length >= 2 && (
                <p style={{ marginTop: '0.5rem', color: '#ffa500', fontSize: '0.9rem' }}>
                  ⚠️ Maximum of 2 streamers reached. Upgrade to premium for unlimited tracking!
                </p>
              )}
            </div>

            {/* VOD Settings */}
            <div className="subsection" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>📺 VOD Settings</h3>

              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="twitch-vod-enabled"
                  checked={settings.twitch?.vod_settings?.enabled || false}
                  onChange={(e) => updateSetting('twitch.vod_settings.enabled', e.target.checked)}
                />
                <label htmlFor="twitch-vod-enabled">Enable VOD Detection</label>
              </div>
              <p className="form-hint">Automatically detect when VODs become available after streams end</p>

              {settings.twitch?.vod_settings?.enabled && (
                <div className="checkbox-wrapper" style={{ marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="twitch-vod-edit"
                    checked={settings.twitch?.vod_settings?.edit_message_when_vod_available !== false}
                    onChange={(e) => updateSetting('twitch.vod_settings.edit_message_when_vod_available', e.target.checked)}
                  />
                  <label htmlFor="twitch-vod-edit">Auto-edit announcement with VOD link</label>
                </div>
              )}
            </div>

            {/* Announcement Customization */}
            <div className="subsection" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>🎨 Announcement Customization</h3>

              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="twitch-include-thumbnail"
                  checked={settings.twitch?.announcement_settings?.include_thumbnail !== false}
                  onChange={(e) => updateSetting('twitch.announcement_settings.include_thumbnail', e.target.checked)}
                />
                <label htmlFor="twitch-include-thumbnail">Show stream thumbnail</label>
              </div>

              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="twitch-include-game"
                  checked={settings.twitch?.announcement_settings?.include_game !== false}
                  onChange={(e) => updateSetting('twitch.announcement_settings.include_game', e.target.checked)}
                />
                <label htmlFor="twitch-include-game">Show game/category</label>
              </div>

              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="twitch-include-viewers"
                  checked={settings.twitch?.announcement_settings?.include_viewer_count !== false}
                  onChange={(e) => updateSetting('twitch.announcement_settings.include_viewer_count', e.target.checked)}
                />
                <label htmlFor="twitch-include-viewers">Show viewer count</label>
              </div>

              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="twitch-include-start-time"
                  checked={settings.twitch?.announcement_settings?.include_start_time !== false}
                  onChange={(e) => updateSetting('twitch.announcement_settings.include_start_time', e.target.checked)}
                />
                <label htmlFor="twitch-include-start-time">Show start time</label>
              </div>
            </div>

            {/* Info Box */}
            <div className="info-box" style={{marginTop: '1rem', padding: '1rem', background: 'rgba(145, 70, 255, 0.1)', borderRadius: '8px', border: '1px solid rgba(145, 70, 255, 0.3)'}}>
              <p style={{margin: 0, fontSize: '0.9rem', color: '#3900a0'}}>
                <strong>ℹ️ How it works:</strong> The bot checks Twitch every 60 seconds for live streams. When a tracked streamer goes live, a notification is posted to your announcement channel. VODs are checked every 5 minutes after streams end.
              </p>
            </div>
          </>
        )}
        </div>
      </div>

      {/* AI Configuration */}
      <div className="feature-card">
        <div className="feature-header">
          <span
            className="collapse-icon"
            onClick={() => toggleSectionCollapse('ai')}
            style={{ cursor: 'pointer', marginRight: '0.5rem', transition: 'transform 0.2s', display: 'inline-block', transform: collapsedSections.ai ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▶
          </span>
          <h2 className="feature-title"><img src="images/acosmibot-logo3.png" alt="" style={{height: '1.5em', width: 'auto', verticalAlign: 'middle', marginRight: '0.5em'}} /> AI Configuration</h2>
          <div
            className={`toggle-switch ${settings.ai?.enabled ? 'active' : ''}`}
            onClick={() => updateToggleAndCollapse('ai.enabled', !settings.ai?.enabled, 'ai')}
          />
        </div>
        <div className={`feature-content ${collapsedSections.ai ? 'collapsed' : ''}`} style={{ maxHeight: collapsedSections.ai ? '0' : '5000px', overflow: 'hidden', transition: 'max-height 0.3s ease-in-out' }}>
          {settings.ai?.enabled && (
          <>
            <div className="form-group">
              <label className="form-label">AI Model</label>
              <select
                value={settings.ai?.model || 'gpt-4o-mini'}
                onChange={(e) => updateSetting('ai.model', e.target.value)}
                className="form-control"
              >
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                {/*<option value="gpt-4o">GPT-4o (Recommended)</option>*/}
                {/*<option value="gpt-4-turbo">GPT-4 Turbo</option>*/}
                {/*<option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy)</option>*/}
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
              <label className="form-label">Channel Restrictions</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="channel_mode"
                    value="all"
                    checked={settings.ai?.channel_mode === 'all'}
                    onChange={(e) => updateSetting('ai.channel_mode', e.target.value)}
                  />
                  <span>All channels (AI works everywhere)</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="channel_mode"
                    value="specific"
                    checked={settings.ai?.channel_mode === 'specific'}
                    onChange={(e) => updateSetting('ai.channel_mode', e.target.value)}
                  />
                  <span>Specific channels only</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="channel_mode"
                    value="exclude"
                    checked={settings.ai?.channel_mode === 'exclude'}
                    onChange={(e) => updateSetting('ai.channel_mode', e.target.value)}
                  />
                  <span>Exclude channels (AI works everywhere except selected)</span>
                </label>
              </div>
            </div>

            {settings.ai?.channel_mode === 'specific' && (
              <div className="form-group">
                <label className="form-label">Allowed Channels</label>
                <ChannelSelector
                  selectedChannelIds={settings.ai?.allowed_channels || []}
                  availableChannels={availableChannels}
                  onChange={(newChannelIds) => updateSetting('ai.allowed_channels', newChannelIds)}
                />
                <p className="form-hint">AI will only respond in these channels</p>
              </div>
            )}

            {settings.ai?.channel_mode === 'exclude' && (
              <div className="form-group">
                <label className="form-label">Excluded Channels</label>
                <ChannelSelector
                  selectedChannelIds={settings.ai?.excluded_channels || []}
                  availableChannels={availableChannels}
                  onChange={(newChannelIds) => updateSetting('ai.excluded_channels', newChannelIds)}
                />
                <p className="form-hint">AI will not respond in these channels</p>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* Games */}
      <div className="feature-card">
        <div className="feature-header">
          <span
            className="collapse-icon"
            onClick={() => toggleSectionCollapse('games')}
            style={{ cursor: 'pointer', marginRight: '0.5rem', transition: 'transform 0.2s', display: 'inline-block', transform: collapsedSections.games ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▶
          </span>
          <h2 className="feature-title">🎮 Games</h2>
          <div
            className={`toggle-switch ${settings.games?.enabled ? 'active' : ''}`}
            onClick={() => updateToggleAndCollapse('games.enabled', !settings.games?.enabled, 'games')}
          />
        </div>
        <div className={`feature-content ${collapsedSections.games ? 'collapsed' : ''}`} style={{ maxHeight: collapsedSections.games ? '0' : '5000px', overflow: 'hidden', transition: 'max-height 0.3s ease-in-out' }}>
          {settings.games?.enabled && (
          <>
            {/* Slots Game */}
            <div className="nested-feature">
              <div className="feature-header">
                <h3 className="feature-title">🎰 Slots</h3>
                <div
                  className={`toggle-switch ${settings.games?.['slots-config']?.enabled ? 'active' : ''}`}
                  onClick={() => updateSetting('games.slots-config.enabled', !settings.games?.['slots-config']?.enabled)}
                />
              </div>

              {settings.games?.['slots-config']?.enabled && (
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
              )}
            </div>
          </>
        )}
        </div>
      </div>

      {/* Cross-Server Portal System */}
      <div className="feature-card">
        <div className="feature-header">
          <span
            className="collapse-icon"
            onClick={() => toggleSectionCollapse('cross_server_portal')}
            style={{ cursor: 'pointer', marginRight: '0.5rem', transition: 'transform 0.2s', display: 'inline-block', transform: collapsedSections.cross_server_portal ? 'rotate(0deg)' : 'rotate(90deg)' }}
          >
            ▶
          </span>
          <h2 className="feature-title">🌀 Cross-Server Portal</h2>
          <div
            className={`toggle-switch ${settings.cross_server_portal?.enabled ? 'active' : ''}`}
            onClick={() => updateToggleAndCollapse('cross_server_portal.enabled', !settings.cross_server_portal?.enabled, 'cross_server_portal')}
          />
        </div>
        <div className={`feature-content ${collapsedSections.cross_server_portal ? 'collapsed' : ''}`} style={{ maxHeight: collapsedSections.cross_server_portal ? '0' : '5000px', overflow: 'hidden', transition: 'max-height 0.3s ease-in-out' }}>
          {settings.cross_server_portal?.enabled && (
          <>
            <p className="feature-description">
              Enable temporary 2-minute portals between servers. Users can spend credits to open a portal
              and exchange messages with another server in real-time!
            </p>

            <div className="form-group">
              <label className="form-label">Portal Channel</label>
              <p className="form-help">Choose which channel portals will open in</p>
              <select
                value={settings.cross_server_portal?.channel_id || ''}
                onChange={(e) => updateSetting('cross_server_portal.channel_id', e.target.value)}
                className="form-control"
              >
                <option value="">Select a channel...</option>
                {availableChannels.map(channel => (
                  <option key={channel.id} value={channel.id}>#{channel.name}</option>
                ))}
              </select>
            </div>

            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={settings.cross_server_portal?.public_listing !== false}
                onChange={(e) => updateSetting('cross_server_portal.public_listing', e.target.checked)}
              />
              <span>Show in public portal search</span>
              <p className="form-help" style={{marginLeft: '24px', marginTop: '4px'}}>
                Allow other servers to find and connect to your server
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Display Name (Optional)</label>
              <p className="form-help">Custom name shown in portal search results. Leave blank to use server name.</p>
              <input
                type="text"
                value={settings.cross_server_portal?.display_name || ''}
                onChange={(e) => updateSetting('cross_server_portal.display_name', e.target.value)}
                className="form-control"
                placeholder={guildName || "Your Server Name"}
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Portal Cost (Credits)</label>
              <p className="form-help">How many credits users must spend to open a portal</p>
              <NumberInput
                value={settings.cross_server_portal?.portal_cost || 1000}
                min={100}
                max={100000}
                step={100}
                onChange={(e) => updateSetting('cross_server_portal.portal_cost', parseInt(e.target.value))}
              />
            </div>

            <div className="info-box" style={{marginTop: '1rem', padding: '1rem', background: 'rgba(88, 101, 242, 0.1)', borderRadius: '8px', border: '1px solid rgba(88, 101, 242, 0.3)'}}>
              <p style={{margin: 0, fontSize: '0.9rem', color: '#3900a0'}}>
                <strong>ℹ️ How it works:</strong> Users can use <code>/portal-search</code> to find servers, then <code>/portal-open</code> to create a 2-minute connection. Messages are limited to 100 characters and displayed in a shared embed.
              </p>
            </div>
          </>
        )}
        </div>
      </div>

      {/* Reaction Roles System */}
      <ReactionRolesCard
        settings={settings}
        setSettings={setSettings}
        collapsedSections={collapsedSections}
        showForm={showReactionRoleForm}
        editingId={editingReactionRoleId}
        toggleSectionCollapse={toggleSectionCollapse}
        updateToggleAndCollapse={updateToggleAndCollapse}
        updateSetting={updateSetting}
        availableRoles={availableRoles}
        availableChannels={availableChannels}
        availableEmojis={availableEmojis}
        showNotification={showNotification}
        onToggleForm={setShowReactionRoleForm}
        onSetEditingId={setEditingReactionRoleId}
        currentGuildId={guildId}
        token={getAuthToken()}
        onSaveConfig={handleSave}
        guildName={guildName}
      />


      <div className="dashboard-footer">
        <p>All changes are saved to the database and will take effect immediately.</p>
      </div>
    </div>
  );
};

// Render the application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<GuildDashboard />);