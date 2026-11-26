/**
 * Plain-language lines for the Activity feed on the stream alerts page: how long ago an alert
 * happened, and a sentence that says what happened ("Nova has raided you with a party of 42.").
 * Pure functions so the wording is unit tested.
 */
import type { StreamAlert } from '../api/streamAlerts';

/** One piece of a sentence. `strong` pieces are the viewer's name and the numbers. */
export interface ActivityPart {
  text: string;
  strong?: boolean;
}

/** "now", "45s", "12m", "3h", "4d", "2mo", "1yr": the time since `createdSeconds`. */
export function relativeTime(createdSeconds: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor(nowMs / 1000 - createdSeconds));
  if (seconds < 10) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}yr`;
}

const TIER_TEXT: Record<string, string> = { '1000': 'Tier 1', '2000': 'Tier 2', '3000': 'Tier 3', prime: 'Prime' };

/** "Tier 1", "Tier 3" or "Prime"; empty when the alert has no tier. */
export function tierText(tier: string | undefined | null): string {
  return tier ? TIER_TEXT[String(tier)] ?? '' : '';
}

const count = (value: number | undefined, fallback: number) => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return number.toLocaleString('en-US');
};

/** What happened, as sentence parts. The viewer's message is not part of it; the feed shows it on its own line. */
export function eventSentence(alert: Pick<StreamAlert, 'type' | 'name' | 'value' | 'tier' | 'amount_display'>): ActivityPart[] {
  const name: ActivityPart = { text: alert.name?.trim() || 'Someone', strong: true };
  const tier = tierText(alert.tier);
  switch (alert.type) {
    case 'follow':
      return [name, { text: ' has followed.' }];
    case 'sub':
      return [name, { text: tier === 'Prime' ? ' has subscribed with Prime.' : ` has subscribed${tier ? ` (${tier})` : ''}.` }];
    case 'resub':
      return [name, { text: ` has resubscribed${tier ? ` (${tier})` : ''} for ` }, { text: count(alert.value, 1), strong: true }, { text: Number(alert.value) === 1 ? ' month.' : ' months.' }];
    case 'gift': {
      const gifts = Number(alert.value) || 1;
      return [name, { text: ' has gifted ' }, { text: count(alert.value, 1), strong: true }, { text: `${gifts === 1 ? ' sub' : ' subs'}${tier ? ` (${tier})` : ''}.` }];
    }
    case 'cheer':
      return [name, { text: ' has cheered ' }, { text: count(alert.value, 0), strong: true }, { text: Number(alert.value) === 1 ? ' bit.' : ' bits.' }];
    case 'raid':
      return [name, { text: ' has raided you with a party of ' }, { text: count(alert.value, 0), strong: true }, { text: '.' }];
    case 'hypetrain':
      return [{ text: 'A hype train reached level ' }, { text: count(alert.value, 1), strong: true }, { text: '.' }];
    case 'donation':
      return alert.amount_display
        ? [name, { text: ' has donated ' }, { text: alert.amount_display, strong: true }, { text: '.' }]
        : [name, { text: ' has donated.' }];
    default:
      return [name, { text: ` sent a ${String(alert.type)} alert.` }];
  }
}

/** The whole sentence as plain text, for screen readers and button labels. */
export function eventText(alert: Pick<StreamAlert, 'type' | 'name' | 'value' | 'tier' | 'amount_display'>): string {
  return eventSentence(alert).map((part) => part.text).join('');
}

/** Where the alert came from, for the small mark at the start of a row. */
export function eventSource(alert: Pick<StreamAlert, 'type' | 'test' | 'sandbox' | 'source'>): 'test' | 'twitch' | 'donation' | 'other' {
  if (alert.test || alert.sandbox) return 'test';
  if (alert.type === 'donation') return 'donation';
  if (alert.source === 'twitch') return 'twitch';
  return 'other';
}
