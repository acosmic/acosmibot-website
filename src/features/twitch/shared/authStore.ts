/**
 * Twitch session state (§11.2). Deliberately separate from the Discord
 * `useAuthStore`: the two sessions use different cookies, and nothing here
 * reads or writes the Discord store.
 *
 * Pure module (zustand only) so Node tests can import it.
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { ChannelAccess } from '../types.ts';

export interface TwitchUser {
  twitch_user_id: string;
  login: string;
  display_name: string;
  profile_image_url: string | null;
}

export interface TwitchMe {
  user: TwitchUser;
  channels: ChannelAccess[];
  own_channel: { broadcaster_id: string; onboarded: boolean };
}

export interface TwitchAuthState {
  me: TwitchMe | null;
  status: 'checking' | 'authenticated' | 'anonymous';
  /** True once the first session check has finished (kept during background re-checks). */
  isReady: boolean;
  setMe(me: TwitchMe): void;
  setChecking(): void;
  setAnonymous(): void;
}

export const useTwitchAuthStore: UseBoundStore<StoreApi<TwitchAuthState>> = create<TwitchAuthState>((set) => ({
  me: null,
  status: 'checking',
  isReady: false,
  setMe: (me) => set({ me, status: 'authenticated', isReady: true }),
  // Background revalidation (focus, visibility) keeps the mounted workspace:
  // only the first check holds pages behind the loading gate.
  setChecking: () => set({ status: 'checking' }),
  setAnonymous: () => set({ me: null, status: 'anonymous', isReady: true }),
}));

/** Convenience selectors. */
export const selectTwitchUser = (state: TwitchAuthState): TwitchUser | null => state.me?.user ?? null;
export const selectIsTwitchAuthenticated = (state: TwitchAuthState): boolean => state.me !== null;
