import React from 'react';
import '@/styles/discord-embed.css';

/**
 * Discord-style embed preview — React port of the legacy
 * public/scripts/shared/embed-preview.js. Shared by the Embeds and
 * Reaction Roles builders.
 */

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedConfig {
  author?: { name?: string; url?: string; icon_url?: string };
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: EmbedField[];
  footer?: { text?: string; icon_url?: string };
  timestamp?: boolean;
}

export interface EmbedButton {
  label: string;
  url: string;
  emoji?: string;
}

// Discord API character limits
export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footerText: 2048,
  authorName: 256,
  totalChars: 6000,
};

export const embedTotalChars = (config: EmbedConfig): number => {
  let total = 0;
  total += config.title?.length ?? 0;
  total += config.description?.length ?? 0;
  total += config.author?.name?.length ?? 0;
  total += config.footer?.text?.length ?? 0;
  for (const f of config.fields ?? []) {
    total += (f.name?.length ?? 0) + (f.value?.length ?? 0);
  }
  return total;
};

export const validateEmbed = (config: EmbedConfig): string[] => {
  const errors: string[] = [];
  const check = (value: string | undefined, label: string, limit: number) => {
    if (value && value.length > limit) errors.push(`${label} exceeds ${limit} characters (${value.length}/${limit})`);
  };
  check(config.title, 'Title', EMBED_LIMITS.title);
  check(config.description, 'Description', EMBED_LIMITS.description);
  check(config.author?.name, 'Author name', EMBED_LIMITS.authorName);
  check(config.footer?.text, 'Footer text', EMBED_LIMITS.footerText);
  (config.fields ?? []).forEach((f, i) => {
    check(f.name, `Field ${i + 1} name`, EMBED_LIMITS.fieldName);
    check(f.value, `Field ${i + 1} value`, EMBED_LIMITS.fieldValue);
  });
  const total = embedTotalChars(config);
  if (total > EMBED_LIMITS.totalChars) {
    errors.push(`Total embed characters exceed ${EMBED_LIMITS.totalChars} (currently ${total})`);
  }
  return errors;
};

const colorHex = (color?: number): string =>
  color !== undefined && color !== null ? `#${color.toString(16).padStart(6, '0')}` : '#00D9FF';

export const DiscordEmbedPreview: React.FC<{
  config: EmbedConfig;
  buttons?: EmbedButton[];
  messageText?: string;
  showCharCount?: boolean;
  /** Extra rows under the embed (e.g. reaction-role mappings preview). */
  children?: React.ReactNode;
}> = ({ config, buttons = [], messageText = '', showCharCount = true, children }) => {
  const charCount = embedTotalChars(config);
  const overLimit = charCount > EMBED_LIMITS.totalChars;
  const visibleButtons = buttons.filter((b) => b.label && b.url);

  // Group buttons in rows of 5 like Discord does.
  const buttonRows: EmbedButton[][] = [];
  for (let i = 0; i < visibleButtons.length; i += 5) {
    buttonRows.push(visibleButtons.slice(i, i + 5));
  }

  const hasEmbedContent =
    config.author?.name || config.title || config.description ||
    (config.fields?.length ?? 0) > 0 || config.thumbnail?.url || config.image?.url ||
    config.footer?.text || config.timestamp;

  return (
    <div className="discord-message-preview">
      {messageText.trim() && <div className="discord-message-text">{messageText}</div>}

      {hasEmbedContent && (
        <div className="discord-embed">
          <div className="discord-embed-color-bar" style={{ backgroundColor: colorHex(config.color) }} />
          <div className="discord-embed-content">
            {config.author?.name && (
              <div className="discord-embed-author">
                {config.author.icon_url && (
                  <img className="discord-embed-author-icon" src={config.author.icon_url} alt="" />
                )}
                {config.author.url ? (
                  <a href={config.author.url} target="_blank" rel="noopener noreferrer">
                    <span className="discord-embed-author-name">{config.author.name}</span>
                  </a>
                ) : (
                  <span className="discord-embed-author-name">{config.author.name}</span>
                )}
              </div>
            )}

            {config.title && (
              <div className="discord-embed-title">
                {config.url
                  ? <a href={config.url} target="_blank" rel="noopener noreferrer">{config.title}</a>
                  : config.title}
              </div>
            )}

            {config.description && (
              <div className="discord-embed-description">{config.description}</div>
            )}

            {(config.fields?.length ?? 0) > 0 && (
              <div className="discord-embed-fields">
                {config.fields!.filter((f) => f.name && f.value).map((f, i) => (
                  <div key={i} className={f.inline ? 'discord-embed-field discord-embed-field-inline' : 'discord-embed-field'}>
                    <div className="discord-embed-field-name">{f.name}</div>
                    <div className="discord-embed-field-value">{f.value}</div>
                  </div>
                ))}
              </div>
            )}

            {config.thumbnail?.url && (
              <div className="discord-embed-thumbnail"><img src={config.thumbnail.url} alt="" /></div>
            )}

            {config.image?.url && (
              <div className="discord-embed-image"><img src={config.image.url} alt="" /></div>
            )}

            {(config.footer?.text || config.timestamp) && (
              <div className="discord-embed-footer">
                {config.footer?.icon_url && (
                  <img className="discord-embed-footer-icon" src={config.footer.icon_url} alt="" />
                )}
                <span className="discord-embed-footer-text">
                  {[config.footer?.text, config.timestamp ? new Date().toLocaleString() : null]
                    .filter(Boolean).join(' • ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {buttonRows.length > 0 && (
        <div className="discord-buttons">
          {buttonRows.map((row, i) => (
            <div key={i} className="discord-button-row">
              {row.map((b, j) => (
                <div key={j} className="discord-button discord-button-link">
                  {b.emoji && <span className="discord-button-emoji">{b.emoji}</span>}
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {children}

      {showCharCount && (
        <div className="embed-char-indicator" style={{ color: overLimit ? '#FF4444' : '#B0B0B0' }}>
          {charCount} of {EMBED_LIMITS.totalChars} characters
        </div>
      )}
    </div>
  );
};
