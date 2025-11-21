// Reaction Role Frontend Components
// These components are used by guild-dashboard.js to manage reaction role configurations

const { useState, useEffect, useRef } = React;

// Add marked.js for markdown rendering
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
document.head.appendChild(script);

// ===== MARKDOWN PREVIEW COMPONENT =====
const MarkdownPreview = ({ content }) => {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (content && typeof marked !== 'undefined') {
      const renderedHtml = marked.parse(content);
      setHtml(renderedHtml);
    } else if (content) {
      // Fallback if marked not loaded yet
      setHtml(content);
    }
  }, [content]);

  return (
    <div
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        lineHeight: '1.5',
        wordWrap: 'break-word'
      }}
    />
  );
};

// ===== INSERT EMOJI BUTTON =====
const InsertEmojiButton = ({ inputRef, availableEmojis = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('custom');
  const dropdownRef = useRef(null);

  const standardEmojiCategories = {
    people: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😌', '😔', '😑', '😐', '🤐', '🤨', '😬', '🤥'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', '💋', '💯', '💢', '💥', '💫', '⭐', '🌟', '✨', '⚡'],
    nature: ['🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🌍', '🌎', '🌏', '💐', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️'],
    food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝', '🥑', '🍆', '🍅', '🌶️', '🌽', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🧀', '🥚']
  };

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

  const handleEmojiSelect = (emoji) => {
    if (inputRef && inputRef.current) {
      const textarea = inputRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + emoji + text.substring(end);

      // Update the textarea value
      textarea.value = newText;

      // Trigger change event
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      // Set cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
    setIsOpen(false);
  };

  const filteredEmojis = category === 'custom'
    ? availableEmojis.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : Object.values(standardEmojiCategories).flat().filter((e, i, arr) => arr.indexOf(e) === i);

  return (
    <div className="insert-emoji-button-wrapper" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', marginLeft: '8px' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Insert emoji"
        style={{
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-light)',
          padding: '6px 10px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        😀
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          padding: '12px',
          marginTop: '4px',
          zIndex: 1000,
          minWidth: '300px',
          maxHeight: '400px',
          overflow: 'auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {availableEmojis.length > 0 && (
              <button
                type="button"
                onClick={() => { setCategory('custom'); setSearchQuery(''); }}
                style={{
                  background: category === 'custom' ? 'var(--primary)' : 'var(--bg-overlay)',
                  color: category === 'custom' ? 'white' : 'var(--text-primary)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Custom ({availableEmojis.length})
              </button>
            )}
            {Object.keys(standardEmojiCategories).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => { setCategory(cat); setSearchQuery(''); }}
                style={{
                  background: category === cat ? 'var(--primary)' : 'var(--bg-overlay)',
                  color: category === cat ? 'white' : 'var(--text-primary)',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textTransform: 'capitalize'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {category === 'custom' && (
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px',
                marginBottom: '8px',
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                color: 'var(--text-primary)'
              }}
            />
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '4px'
          }}>
            {filteredEmojis.map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const emojiValue = category === 'custom' ? emoji.emoji : emoji;
                  handleEmojiSelect(emojiValue);
                }}
                title={category === 'custom' ? emoji.name : ''}
                style={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-light)',
                  padding: '8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: '1'
                }}
              >
                {category === 'custom' ? emoji.emoji : emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ===== COLOR PICKER COMPONENT =====
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

// ===== EMOJI SELECTOR COMPONENT =====
const EmojiSelector = ({ value, onSelect, availableEmojis = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('standard');
  const dropdownRef = useRef(null);

  // Standard emoji categories
  const standardEmojiCategories = {
    people: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😌', '😔', '😑', '😐', '🤐', '🤨', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤮', '🤢', '🤮', '🤮', '🤮'],
    nature: ['🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🎍', '🎎', '🎏', '🎐', '🎑', '🌍', '🌎', '🌏', '💐', '🌐', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️'],
    food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥑', '🍆', '🍅', '🌶️', '🌽', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🍰', '🎂', '🧁', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🍯', '🥛', '🍼', '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎳', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '⛸️', '🎣', '🎽', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🎯', '🪀', '🪃', '🎪', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '🧩', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🏎️', '🛵', '🦯', '🦽', '🦼', '🛺', '🚲', '🛴', '🛹', '🛼', '🚏', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '⛵', '🚤', '🛳️', '⛴️', '🛥️', '🛩️', '💺', '🛰️', '🚁', '🛶', '⛺', '⛱️', '🏝️', '🏖️', '🏜️', '🌍', '🌎', '🌏', '⛰️', '⛰️', '🌋', '⛰️', '🗻', '🏔️', '🗾', '🌅', '🌄', '🌠', '🎇', '🎆', '🏙️', '🌇', '🌆', '🏞️', '🌉', '🌁', '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '🧮', '🎥', '🎬', '📺', '📷', '📸', '📹', '🎞️', '📽️', '🎦', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '🧾', '✉️', '📩', '📨', '📤', '📥', '📦', '🏷️', '🧧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧐', '🎓', '🎬', '🎤', '🎧', '🎼', '🎹', '🎻', '📖', '📝', '📁', '📂', '📅', '📆', '🗒️', '🗓️', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📐', '📏', '🧮', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📰', '🗞️', '📄', '📃', '📑', '🧾', '📜', '🏷️', '💰', '🧧', '🎁', '🎀', '🎊', '🎉', '🎎', '🏆', '🏅', '🥇', '🥈', '🥉', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '🌪️', '🌈'],
  };

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

  const getDisplayEmoji = () => {
    if (!value) return '😀';
    // Check if it's a custom emoji ID
    if (value.includes(':')) {
      const match = value.match(/:(\d+)>/);
      if (match) {
        return `<:custom:${match[1]}>`;
      }
    }
    return value;
  };

  const filteredEmojis = category === 'custom'
    ? availableEmojis.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : Object.values(standardEmojiCategories).flat().filter((e, i, arr) => arr.indexOf(e) === i);

  return (
    <div className="emoji-selector-wrapper" ref={dropdownRef}>
      <div
        className={`emoji-selector-display ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="emoji-display">{getDisplayEmoji()}</span>
        <span className="emoji-label">{value || 'Select emoji'}</span>
      </div>

      {isOpen && (
        <div className="emoji-selector-dropdown">
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
                Custom ({availableEmojis.length})
              </button>
            )}
          </div>

          {category === 'custom' && (
            <input
              type="text"
              placeholder="Search custom emojis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="emoji-search"
            />
          )}

          <div className="emoji-grid">
            {(category === 'custom' ? availableEmojis : filteredEmojis).map((emoji, idx) => (
              <button
                key={idx}
                className={`emoji-item ${value === (emoji.emoji || emoji) ? 'selected' : ''}`}
                onClick={() => {
                  const emojiValue = category === 'custom' ? emoji.emoji : emoji;
                  onSelect(emojiValue);
                  setIsOpen(false);
                }}
                title={category === 'custom' ? emoji.name : ''}
              >
                {category === 'custom' ? emoji.emoji : emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ===== EMBED BUILDER COMPONENT =====
const EmbedBuilder = ({ value, onChange, availableEmojis = [], channelName = null }) => {
  const [previewMode, setPreviewMode] = useState(false);
  const descriptionRef = useRef(null);
  const fieldValueRefs = useRef({});

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
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Description (supports Markdown)</span>
              <InsertEmojiButton inputRef={descriptionRef} availableEmojis={availableEmojis} />
            </label>
            <textarea
              ref={descriptionRef}
              maxLength="4096"
              value={embed.description || ''}
              onChange={(e) => updateEmbedField('description', e.target.value)}
              placeholder="Embed description (supports **bold**, *italic*, __underline__, etc.)"
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
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Field Value (supports Markdown)</span>
                    <InsertEmojiButton inputRef={fieldValueRefs.current[idx]} availableEmojis={availableEmojis} />
                  </label>
                  <textarea
                    ref={(el) => { fieldValueRefs.current[idx] = el; }}
                    value={field.value || ''}
                    onChange={(e) => updateField(idx, 'value', e.target.value)}
                    placeholder="Field value (supports **bold**, *italic*, etc.)"
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
          {channelName && (
            <div style={{
              padding: '12px',
              background: 'var(--bg-overlay)',
              borderRadius: '8px',
              marginBottom: '12px',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)'
            }}>
              📍 Channel: <strong>#{channelName}</strong>
            </div>
          )}
          <div className="discord-embed">
            {embed.color && <div className="embed-color-bar" style={{ backgroundColor: embed.color }}></div>}
            <div className="embed-content">
              {embed.title && <div className="embed-title">{embed.title}</div>}
              {embed.description && (
                <div className="embed-description">
                  <MarkdownPreview content={embed.description} />
                </div>
              )}
              {embed.fields && embed.fields.map((field, idx) => (
                <div key={idx} className="embed-field-preview">
                  <div className="field-name">{field.name}</div>
                  <div className="field-value">
                    <MarkdownPreview content={field.value} />
                  </div>
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

// ===== BUTTON CONFIG COMPONENT =====
const ButtonConfigBuilder = ({ buttons, onChange, availableEmojis }) => {
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

// ===== DROPDOWN CONFIG COMPONENT =====
const DropdownConfigBuilder = ({ config, onChange, availableEmojis }) => {
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

// ===== REACTION ROLE MODAL COMPONENT =====
const ReactionRoleModal = ({
  config,
  availableRoles,
  availableChannels,
  availableEmojis,
  onSave,
  onCancel
}) => {
  const textContentRef = useRef(null);
  const [formData, setFormData] = useState(config || {
    message_id: '',
    channel_id: '',
    interaction_type: 'emoji',
    text_content: '',
    embed_config: null,
    allow_removal: true,
    emoji_role_mappings: {},
    button_configs: [],
    dropdown_config: {}
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.message_id || formData.message_id.trim() === '') {
      newErrors.message_id = 'Message ID is required';
    }
    if (!formData.channel_id || formData.channel_id.trim() === '') {
      newErrors.channel_id = 'Channel is required';
    }

    // At least one of text or embed
    if (!formData.text_content && !formData.embed_config) {
      newErrors.content = 'Either message text or embed is required';
    }

    // Type-specific validations
    if (formData.interaction_type === 'emoji') {
      if (!formData.emoji_role_mappings || Object.keys(formData.emoji_role_mappings).length === 0) {
        newErrors.emoji = 'At least one emoji with roles is required';
      }
    } else if (formData.interaction_type === 'button') {
      if (!formData.button_configs || formData.button_configs.length === 0) {
        newErrors.buttons = 'At least one button is required';
      }
      for (let i = 0; i < (formData.button_configs || []).length; i++) {
        const btn = formData.button_configs[i];
        if (!btn.label || !btn.role_ids || btn.role_ids.length === 0) {
          newErrors.buttons = 'All buttons must have a label and at least one role';
          break;
        }
      }
    } else if (formData.interaction_type === 'dropdown') {
      if (!formData.dropdown_config || !formData.dropdown_config.options || formData.dropdown_config.options.length === 0) {
        newErrors.dropdown = 'At least one dropdown option is required';
      }
      for (let i = 0; i < (formData.dropdown_config.options || []).length; i++) {
        const opt = formData.dropdown_config.options[i];
        if (!opt.label || !opt.role_ids || opt.role_ids.length === 0) {
          newErrors.dropdown = 'All options must have a label and at least one role';
          break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
        borderRadius: '16px',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '24px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
            {config?.message_id ? 'Edit Reaction Role' : 'Create Reaction Role Message'}
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Display errors */}
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

        {/* Message ID & Channel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div className="form-group">
            <label>Message ID *</label>
            <input
              type="text"
              value={formData.message_id}
              onChange={(e) => updateFormField('message_id', e.target.value)}
              placeholder="Enter Discord message ID"
              className="form-control"
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Post message in Discord first, then copy ID
            </p>
          </div>

          <div className="form-group">
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
        </div>

        {/* Interaction Type */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>Interaction Type *</label>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {['emoji', 'button', 'dropdown'].map(type => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="interaction_type"
                  value={type}
                  checked={formData.interaction_type === type}
                  onChange={(e) => updateFormField('interaction_type', e.target.value)}
                />
                <span style={{ textTransform: 'capitalize' }}>
                  {type === 'emoji' ? '😀 Emoji' : type === 'button' ? '🔘 Button' : '📋 Dropdown'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Message Content */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Message Content (at least one required)</h3>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Text Message (Optional, supports Markdown)</span>
              <InsertEmojiButton inputRef={textContentRef} availableEmojis={availableEmojis} />
            </label>
            <textarea
              ref={textContentRef}
              value={formData.text_content || ''}
              onChange={(e) => updateFormField('text_content', e.target.value)}
              placeholder="Optional: Add text above the embed (supports **bold**, *italic*, etc.)"
              className="form-control"
              rows="3"
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
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
              availableEmojis={availableEmojis}
              channelName={availableChannels?.find(ch => ch.id === formData.channel_id)?.name}
            />
          )}
        </div>

        {/* Role Removal Option */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.allow_removal}
              onChange={(e) => updateFormField('allow_removal', e.target.checked)}
            />
            <span>Allow users to remove roles by removing their reaction</span>
          </label>
        </div>

        {/* Type-Specific Config */}
        {formData.interaction_type === 'emoji' && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Emoji → Role Mapping</h3>
            <ButtonConfigBuilder
              buttons={[{ label: 'Demo', role_ids: [] }]}
              onChange={() => {}}
              availableEmojis={availableEmojis}
            />
          </div>
        )}

        {formData.interaction_type === 'button' && (
          <ButtonConfigBuilder
            buttons={formData.button_configs || []}
            onChange={(buttons) => updateFormField('button_configs', buttons)}
            availableEmojis={availableEmojis}
          />
        )}

        {formData.interaction_type === 'dropdown' && (
          <DropdownConfigBuilder
            config={formData.dropdown_config}
            onChange={(config) => updateFormField('dropdown_config', config)}
            availableEmojis={availableEmojis}
          />
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
          <button
            className="btn-secondary"
            onClick={onCancel}
            disabled={saving}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              background: saving ? 'var(--bg-overlay)' : 'var(--primary)',
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : config?.message_id ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
