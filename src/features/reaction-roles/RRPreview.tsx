import React from 'react';
import { DiscordEmbedPreview, type EmbedConfig } from '@/components/ui/DiscordEmbedPreview';
import { EmojiDisplay } from '@/components/ui/EmojiDisplay';
import type { RRButtonConfig, RRDropdownConfig, RREmbedConfig, RRInteractionType } from '@/api/reactionRoles';

/** Map the RR flat embed config onto the shared DiscordEmbedPreview shape. */
const toEmbedConfig = (cfg?: RREmbedConfig | null): EmbedConfig => {
  if (!cfg || ![cfg.title, cfg.description, cfg.thumbnail, cfg.image, cfg.footer].some(Boolean)) return {};
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

/** Show role mentions (<@&id>) the way Discord will render them. */
const resolveRoleMentions = (text: string, roleNames?: Record<string, string>): string =>
  text.replace(/<@&(\d+)>/g, (_, id) => `@${roleNames?.[id] ?? 'role'}`);

export const RRPreview: React.FC<{
  textContent?: string | null;
  embedConfig?: RREmbedConfig | null;
  interactionType: RRInteractionType;
  emojiMappings?: Record<string, string[]>;
  buttonConfigs?: RRButtonConfig[];
  dropdownConfig?: RRDropdownConfig;
  roleNames?: Record<string, string>;
}> = ({ textContent, embedConfig, interactionType, emojiMappings, buttonConfigs, dropdownConfig, roleNames }) => (
  <DiscordEmbedPreview
    config={toEmbedConfig(embedConfig)}
    messageText={resolveRoleMentions(textContent ?? '', roleNames)}
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
