/**
 * Readable one-line descriptions of channel activity, for both stored
 * activity rows (`GET /channels/:id/activity`, `TwitchBotActivity`
 * `to_api_dict()`) and live feed envelopes (`activity.*`, §9.4).
 * Names and messages are untrusted and are returned as plain strings for
 * React text nodes only.
 */

export interface ActivityRow {
  id: number;
  type: string;
  user_id?: string | null;
  login?: string | null;
  display_name?: string | null;
  amount?: number | null;
  tier?: string | null;
  message?: string | null;
  data_json?: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityLine {
  key: string;
  type: string;
  /** Who it was, or null for anonymous events (ad breaks, anonymous gifts). */
  actor: string | null;
  /** What happened, without the actor ("followed", "cheered 100 bits"). */
  text: string;
  /** Optional chat message the viewer attached. */
  message: string | null;
  at: string;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const tierLabel = (tier: unknown): string => {
  const value = str(tier) ?? (num(tier) !== null ? String(tier) : null);
  if (!value) return '';
  if (/prime/i.test(value)) return ' with Prime';
  const level = value.length === 4 && value.endsWith('000') ? value.charAt(0) : value;
  return ` at Tier ${level}`;
};

const plural = (count: number, word: string): string => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

function describe(type: string, data: Record<string, unknown>, amount: number | null): { actor: string | null; text: string } {
  const kind = type.replace(/^activity\./, '');
  const name = str(data.display_name) ?? str(data.login);
  switch (kind) {
    case 'follow':
      return { actor: name, text: 'followed' };
    case 'sub':
    case 'resub': {
      const months = num(data.cumulative_months) ?? num(data.months) ?? (kind === 'resub' ? amount : null);
      const base = kind === 'resub' || (months !== null && months > 1) ? 'resubscribed' : 'subscribed';
      return { actor: name, text: `${base}${tierLabel(data.tier)}${months && months > 1 ? ` (${plural(months, 'month')})` : ''}` };
    }
    case 'gift_sub': {
      const gifter = data.gifter as Record<string, unknown> | null | undefined;
      const recipient = data.recipient as Record<string, unknown> | null | undefined;
      const to = str(recipient?.display_name) ?? str(recipient?.login) ?? name;
      return { actor: str(gifter?.display_name) ?? (gifter === null ? 'An anonymous gifter' : null), text: `gifted a sub${to ? ` to ${to}` : ''}` };
    }
    case 'community_gift': {
      const gifter = data.gifter as Record<string, unknown> | null | undefined;
      const total = num(data.total) ?? amount ?? 0;
      return { actor: str(gifter?.display_name) ?? name ?? 'An anonymous gifter', text: `gifted ${plural(total, 'sub')} to the community` };
    }
    case 'cheer':
      return { actor: name, text: `cheered ${plural(num(data.bits) ?? amount ?? 0, 'bit')}` };
    case 'raid': {
      const raider = str(data.from_display_name) ?? str(data.from_login) ?? name;
      return { actor: raider, text: `raided with ${plural(num(data.viewers) ?? amount ?? 0, 'viewer')}` };
    }
    case 'redemption': {
      const reward = str(data.reward_title) ?? 'a reward';
      return { actor: name, text: `redeemed ${reward}` };
    }
    case 'hype_train': {
      const level = num(data.level);
      const phase = str(data.phase);
      return { actor: null, text: phase === 'end' ? `Hype Train ended${level ? ` at level ${level}` : ''}` : `Hype Train ${phase === 'begin' ? 'started' : 'in progress'}${level ? ` (level ${level})` : ''}` };
    }
    case 'ad_break': {
      const duration = num(data.duration_s) ?? amount;
      return { actor: null, text: `Ad break${duration ? ` for ${plural(duration, 'second')}` : ''}${data.is_automatic ? ' (automatic)' : ''}` };
    }
    case 'poll':
      return { actor: null, text: `Poll ended${str(data.title) ? `: ${str(data.title)}` : ''}` };
    case 'prediction':
      return { actor: null, text: `Prediction ended${str(data.title) ? `: ${str(data.title)}` : ''}` };
    case 'shoutout_received':
      return { actor: name, text: 'gave the channel a shoutout' };
    default:
      return { actor: name, text: kind.replace(/_/g, ' ') };
  }
}

/** A stored activity row. */
export function describeActivityRow(row: ActivityRow): ActivityLine {
  const data: Record<string, unknown> = {
    display_name: row.display_name,
    login: row.login,
    tier: row.tier,
    ...(row.data_json ?? {}),
  };
  const { actor, text } = describe(row.type, data, num(row.amount));
  return { key: `row-${row.id}`, type: row.type, actor, text, message: str(row.message), at: row.created_at };
}

/** A live `activity.*` feed envelope. */
export function describeActivityEvent(event: { id: string; type: string; ts: string; data: Record<string, unknown> }): ActivityLine {
  const { actor, text } = describe(event.type, event.data ?? {}, null);
  return { key: `feed-${event.id}`, type: event.type.replace(/^activity\./, ''), actor, text, message: str(event.data?.message), at: event.ts };
}
