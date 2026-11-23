/**
 * One place that turns channel state into a status chip, so the context bar,
 * channel picker and overview always agree. Pure functions.
 */
import type { ChannelReauth, ChannelStatus, ChannelSummary } from '../../types.ts';

export type StatusTone = 'active' | 'neutral' | 'warning' | 'error';

/** Days a channel's data is kept after Acosmibot lost access (core `DEAUTH_PURGE_GRACE_DAYS`). */
export const REAUTH_GRACE_DAYS = 7;

export interface StatusView {
  tone: StatusTone;
  label: string;
  /** One sentence explaining the state and what to do. */
  detail: string;
}

/** For `ChannelAccess.status` (picker, switcher), where bot health is unknown. */
export function channelStatusView(status: ChannelStatus): StatusView {
  switch (status) {
    case 'active':
      return { tone: 'active', label: 'Active', detail: 'Acosmibot is connected to this channel.' };
    case 'paused':
      return { tone: 'warning', label: 'Paused', detail: 'The broadcaster paused Acosmibot. It does not respond or act in chat until resumed.' };
    case 'reauth_required':
      return { tone: 'error', label: 'Reconnect needed', detail: `Acosmibot lost access to this channel on Twitch and left its chat. Its data is kept for ${REAUTH_GRACE_DAYS} days so the broadcaster can reconnect Acosmibot.` };
    case 'bot_banned':
      return { tone: 'error', label: 'Bot banned', detail: 'The bot account is banned from this chat. Unban it on Twitch, then rejoin.' };
    case 'removing':
      return { tone: 'neutral', label: 'Removing', detail: 'This channel is being removed and its data deleted.' };
    default:
      return { tone: 'neutral', label: 'Unknown', detail: 'Acosmibot reported a state this page does not recognise.' };
  }
}

/** Full health for a loaded `ChannelSummary` (context bar and overview). */
export function channelHealthView(channel: ChannelSummary): StatusView {
  if (channel.status !== 'active') return channelStatusView(channel.status);
  if (!channel.bot_online) {
    return { tone: 'warning', label: 'Bot offline', detail: 'The Acosmibot chat service is not responding. Settings still save and apply when it returns.' };
  }
  if (!channel.bot?.user_id) {
    return { tone: 'warning', label: 'No bot account', detail: 'No bot account is connected yet, so Acosmibot cannot chat in this channel.' };
  }
  if (channel.missing_scopes.length > 0) {
    return { tone: 'warning', label: 'Permissions missing', detail: 'Some features need permissions this channel has not granted. The broadcaster can reconnect to grant them.' };
  }
  if (!channel.bot.is_moderator) {
    return { tone: 'warning', label: 'Not a moderator', detail: 'Acosmibot is not a moderator here, so it shares a lower chat rate limit and acts through the broadcaster\'s permission.' };
  }
  return { tone: 'active', label: 'Bot online', detail: 'Acosmibot is in chat and has moderator status.' };
}

export function liveView(channel: Pick<ChannelSummary, 'live'>): StatusView {
  return channel.live?.live
    ? { tone: 'active', label: 'Live', detail: 'The channel is streaming now.' }
    : { tone: 'neutral', label: 'Offline', detail: 'The channel is not streaming.' };
}

/** Plain-words reason for `reauth_required` (`status_reason` from the bot). */
export function reauthReasonText(reason: string | null | undefined): string {
  switch (reason) {
    case 'authorization_revoked':
      return 'Acosmibot was disconnected from this channel on Twitch.';
    case 'token_revoked':
      return 'Twitch stopped accepting this channel’s permission, for example after a password change or a disconnect on Twitch.';
    case 'user_removed':
      return 'Twitch reports that this channel’s account is unavailable.';
    default:
      return 'Twitch no longer accepts this channel’s permission.';
  }
}

function dateText(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * The overview and settings explanation of `reauth_required`: why, that nothing has been deleted,
 * and the exact time the data is deleted unless the broadcaster reconnects first.
 */
export function reauthDetail(channel: { status_reason: string | null; reauth?: ChannelReauth | null },
                             formatDate: (value: string | null | undefined) => string | null = dateText): string {
  const reason = reauthReasonText(channel.reauth?.reason ?? channel.status_reason);
  const deadline = formatDate(channel.reauth?.purge_after);
  const keep = deadline
    ? `Reconnect Acosmibot before ${deadline} to keep them; after that they are deleted.`
    : `Reconnect Acosmibot within ${REAUTH_GRACE_DAYS} days of losing access to keep them; after that they are deleted.`;
  return `${reason} Acosmibot has left the chat but kept this channel’s settings and data. ${keep}`;
}
