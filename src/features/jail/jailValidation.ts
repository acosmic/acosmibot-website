import { JailConfig } from '@/types/features';

export const JAIL_BOUNDS = {
  required_votes: { min: 2, max: 25, label: 'required votes' },
  vote_window_seconds: { min: 60, max: 86400, label: 'ballot window' },
  sentence_minutes: { min: 1, max: 10080, label: 'sentence duration' },
  target_cooldown_minutes: { min: 0, max: 10080, label: 'failed-ballot cooldown' },
} as const;

const CUSTOM_EMOJI_RE = /^<a?:[A-Za-z0-9_]{1,32}:\d{1,20}>$/;

function isUnicodeEmoji(value: string): boolean {
  if (!value || value.length > 32 || /\s/.test(value) || /[<>@#&]/.test(value)) return false;
  if ([...value].some((character) => /[A-Za-z]/.test(character))) return false;
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 0x1f000 || /[\u2600-\u27bf]/u.test(character);
  });
}

export function validateJailConfig(config: Partial<JailConfig>): string | null {
  if (typeof config.enabled !== 'boolean') return 'Jail enabled state must be a boolean.';

  for (const [field, bounds] of Object.entries(JAIL_BOUNDS)) {
    const value = config[field as keyof typeof JAIL_BOUNDS] as unknown;
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return `Jail ${bounds.label} must be a whole number.`;
    }
    if (value < bounds.min || value > bounds.max) {
      return `Jail ${bounds.label} must be between ${bounds.min} and ${bounds.max}.`;
    }
  }

  if (!config.enabled) return null;
  if (!config.channel_id) return 'Choose an ordinary text channel for Jail before enabling it.';
  if (!config.trigger_emoji || (!CUSTOM_EMOJI_RE.test(config.trigger_emoji) && !isUnicodeEmoji(config.trigger_emoji))) {
    return 'Choose a Unicode or server custom emoji for the Jail reaction.';
  }
  if (config.allowed_channel_ids?.includes(config.channel_id)) {
    return 'The Jail channel cannot also be an eligible vote channel.';
  }
  return null;
}

export function isCustomJailEmoji(value: string): boolean {
  return CUSTOM_EMOJI_RE.test(value);
}
