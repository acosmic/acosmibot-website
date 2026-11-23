/**
 * One place that turns channel state into a status chip, so the context bar,
 * channel picker and overview always agree. Pure functions.
 */
import type { ChannelStatus, ChannelSummary } from '../../types';

export type StatusTone = 'active' | 'neutral' | 'warning' | 'error';

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
      return { tone: 'error', label: 'Reconnect needed', detail: 'Twitch no longer accepts this channel\'s permission. The broadcaster needs to reconnect it.' };
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
