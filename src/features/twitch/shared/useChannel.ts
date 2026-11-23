import { createContext, useContext } from 'react';
import type { ChannelSummary, Role } from '../types';

export interface ChannelContextValue {
  channelId: string;
  /** Latest `GET /channels/:id` summary. */
  channel: ChannelSummary;
  /** Role from the summary (§10.3). Presentation only: the API re-checks every request. */
  role: Role;
  /** Refetch the summary (after pause/resume, mod changes, feed `bot.status`). */
  refetch: () => Promise<unknown>;
}

/** Provided by `TwitchDashboardShell` around every section page. */
export const ChannelContext = createContext<ChannelContextValue | null>(null);

/** The open channel. Throws outside the dashboard shell so misuse is caught early. */
export function useChannel(): ChannelContextValue {
  const value = useContext(ChannelContext);
  if (!value) throw new Error('useChannel() must be used inside the Twitch dashboard shell.');
  return value;
}

/** Same as `useChannel()` but returns null outside the shell (shared widgets). */
export function useOptionalChannel(): ChannelContextValue | null {
  return useContext(ChannelContext);
}
