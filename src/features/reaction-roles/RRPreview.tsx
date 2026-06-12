import React from 'react';
import { DiscordEmbedPreview, type EmbedConfig } from '@/components/ui/DiscordEmbedPreview';
import type { RRButtonConfig, RRDropdownConfig, RREmbedConfig, RRInteractionType } from '@/api/reactionRoles';

/** Renders a unicode emoji as-is, or a custom Discord emoji (<a:name:id>) as its CDN image. */
export const EmojiDisplay: React.FC<{ emoji: string }> = ({ emoji }) => {
  const match = emoji.match(/<(a?):([^:]+):(\d+)>/);
  if (match) {
    const [, animated, name, id] = match;
    const ext = animated === 'a' ? 'gif' : 'webp';
    return (
      <img
        className="discord-emoji-img"
        src={`https://cdn.discordapp.com/emojis/${id}.${ext}`}
        alt={name}
        title={name}
      />
    );
  }
  return <>{emoji}</>;
};

/** Map the RR flat embed config onto the shared DiscordEmbedPreview shape. */
const toEmbedConfig = (cfg?: RREmbedConfig | null): EmbedConfig => {
  if (!cfg || (!cfg.title && !cfg.description)) return {};
  return {
    title: cfg.title || undefined,
    description: cfg.description || undefined,
    color: cfg.color ? parseInt(String(cfg.color).replace('#', ''), 16) : 0x5865f2,
    thumbnail: cfg.thumbnail ? { url: cfg.thumbnail } : undefined,
    image: cfg.image ? { url: cfg.image } : undefined,
    footer: cfg.footer ? { text: cfg.footer } : undefined,
  };
};

const BUTTON_STYLE_CLASSES: Record<number, string> = {
  1: 'discord-button-primary',
  2: 'discord-button-secondary',
  3: 'discord-button-success',
  4: 'discord-button-danger',
};

export const RRPreview: React.FC<{
  textContent?: string | null;
  embedConfig?: RREmbedConfig | null;
  interactionType: RRInteractionType;
  emojiMappings?: Record<string, string[]>;
  buttonConfigs?: RRButtonConfig[];
  dropdownConfig?: RRDropdownConfig;
}> = ({ textContent, embedConfig, interactionType, emojiMappings, buttonConfigs, dropdownConfig }) => (
  <DiscordEmbedPreview
    config={toEmbedConfig(embedConfig)}
    messageText={textContent ?? ''}
    showCharCount={false}
  >
    {interactionType === 'emoji' && emojiMappings && Object.keys(emojiMappings).length > 0 && (
      <div className="discord-reactions">
        {Object.keys(emojiMappings).map((emoji) => (
          <div key={emoji} className="discord-reaction">
            <span className="discord-reaction-emoji"><EmojiDisplay emoji={emoji} /></span>
            <span className="discord-reaction-count">0</span>
          </div>
        ))}
      </div>
    )}

    {interactionType === 'button' && (buttonConfigs?.length ?? 0) > 0 && (
      <div className="discord-buttons">
        <div className="discord-button-row">
          {buttonConfigs!.map((b, i) => (
            <button key={i} type="button" className={`discord-button ${BUTTON_STYLE_CLASSES[b.style] ?? 'discord-button-secondary'}`}>
              {b.emoji && <span><EmojiDisplay emoji={b.emoji} /></span>}
              {b.label || 'Button'}
            </button>
          ))}
        </div>
      </div>
    )}

    {interactionType === 'dropdown' && (dropdownConfig?.options?.length ?? 0) > 0 && (
      <div className="discord-select-menu">{dropdownConfig!.placeholder || 'Select roles...'}</div>
    )}
  </DiscordEmbedPreview>
);
