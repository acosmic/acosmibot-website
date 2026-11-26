import { api } from './client';

export type StreamAlertType = 'donation' | 'follow' | 'sub' | 'resub' | 'gift' | 'cheer' | 'raid' | 'hypetrain';
export type StreamAlertTier = '1000' | '2000' | '3000' | 'prime';

/** One alert as the stream overlay receives it. `value` is the kind's number (months, subs, bits, raiders, level). */
export interface StreamAlert {
  id: string;
  type: StreamAlertType;
  name: string;
  message: string;
  created: number;
  test: boolean;
  sandbox: boolean;
  cursor?: string;
  value?: number;
  tier?: StreamAlertTier;
  amount_minor?: number;
  amount_display?: string;
  replay_of?: string;
  /** Set on an alert that came from the connected Twitch channel rather than a test or a donation. */
  source?: 'twitch';
}

export interface StreamAlertTestInput {
  type: StreamAlertType;
  name?: string;
  message?: string;
  value?: number;
  tier?: StreamAlertTier;
  amount_minor?: number;
}

/** Live overlay settings, owned by the API and applied by the OBS overlay. */
export interface StreamAlertSettings {
  paused: boolean;
  safe_mode: boolean;
  min_raid_viewers: number;
  min_cheer_bits: number;
}

export type StreamAlertControlAction = 'skip' | 'clear' | 'pause' | 'resume' | 'safe_mode_on' | 'safe_mode_off' | 'stop_effects';
export type StreamAlertClearScope = 'tests' | 'all';
/** The overlay's channel point effects, in the order the dashboard lists them. */
export type StreamEffectName = 'boop' | 'meteor' | 'news' | 'flood' | 'rewind';

export interface StreamEffectInput {
  effect: StreamEffectName;
  name?: string;
  message?: string;
}

export interface StreamEffectEntry {
  id: string;
  type: 'effect';
  effect: StreamEffectName;
  name: string;
  message: string;
  created: number;
  sandbox: boolean;
  test: boolean;
}

export type StreamAlertRole = 'owner' | 'editor';

/** One person's stream alerts: their own queue, settings, OBS link and editors. */
export interface StreamAlertAccount {
  id: number;
  owner_discord_id: string;
  owner_username: string;
  /** What the signed-in person is on this account. */
  role: StreamAlertRole;
  is_own: boolean;
  /** True for the account that drives the overlay copy already installed in the owner's OBS. */
  legacy_overlay: boolean;
  created_at: string;
}

export interface StreamAlertsMe {
  success: boolean;
  can_open: boolean;
  can_create: boolean;
  own_account_id: number | null;
  accounts: StreamAlertAccount[];
}

/** `reauth_required`: Twitch took the permission back, so the owner has to connect again. */
export type StreamAlertTwitchLinkStatus = 'connected' | 'reauth_required';

/** The Twitch channel an account is connected to, as the status route reports it. */
export interface StreamAlertTwitchChannel {
  login: string;
  display_name: string;
  status: StreamAlertTwitchLinkStatus;
}

export interface StreamAlertStatus {
  success: boolean;
  account: StreamAlertAccount;
  configured: boolean;
  available: boolean;
  overlay_last_seen: number | null;
  types: StreamAlertType[];
  settings: StreamAlertSettings;
  /** Null until the owner connects Twitch. An API from before Connect Twitch leaves it out. */
  twitch?: StreamAlertTwitchChannel | null;
}

/** One kind of Twitch event the API listens for. `status` is Twitch's own word ("enabled" when it works) or "failed". */
export interface StreamAlertTwitchSubscription {
  type: string;
  status: string;
}

export interface StreamAlertTwitchLink extends StreamAlertTwitchChannel {
  missing_scopes: string[];
  subscriptions: StreamAlertTwitchSubscription[];
}

export interface StreamAlertTwitchState {
  success: boolean;
  connected: boolean;
  /** Where the owner's browser goes to connect. Null for an editor. A page address, never something to fetch. */
  connect_url: string | null;
  twitch: StreamAlertTwitchLink | null;
}

/** When a mapped reward plays its effect: as soon as a viewer redeems it, or once a moderator marks it done. */
export type StreamRewardTrigger = 'redeemed' | 'fulfilled';

export interface StreamRewardMapping {
  effect: StreamEffectName;
  on: StreamRewardTrigger;
}

/** What a reward should do from now on. `effect: null` means nothing. */
export interface StreamRewardMappingInput {
  effect: StreamEffectName | null;
  on?: StreamRewardTrigger;
}

/** One channel point reward on the connected Twitch channel. */
export interface StreamReward {
  id: string;
  title: string;
  cost: number;
  is_enabled: boolean;
  is_paused: boolean;
  /** True for a reward Acosmibot created. */
  manageable: boolean;
  mapping: StreamRewardMapping | null;
}

export interface StreamRewardEffectOption {
  name: StreamEffectName;
  label: string;
}

export interface StreamRewards {
  success: boolean;
  effects: StreamRewardEffectOption[];
  rewards: StreamReward[];
}

export interface StreamAlertEditor {
  discord_id: string;
  username: string;
  added_by: string;
  created_at: string;
}

/** Someone the owner could add as an editor right now. */
export interface StreamAlertEditorCandidate {
  discord_id: string;
  username: string;
}

export interface StreamAlertEditors {
  success: boolean;
  editors: StreamAlertEditor[];
  candidates: StreamAlertEditorCandidate[];
}

/** The private OBS link. Never cache, store or log `url`: it carries the overlay key. */
export interface StreamAlertOverlayUrl {
  success: boolean;
  url: string;
}

const BASE = '/api/stream-alerts';
const account = (accountId: number) => `${BASE}/accounts/${accountId}`;

/** One function per route of the stream alert accounts API. Routes under an account take its id first. */
export const streamAlertsApi = {
  getMe: () =>
    api.fetch<StreamAlertsMe>(`${BASE}/me`),

  createAccount: () =>
    api.fetch<{ success: boolean; account: StreamAlertAccount }>(`${BASE}/accounts`, { method: 'POST' }),

  getStatus: (accountId: number) =>
    api.fetch<StreamAlertStatus>(`${account(accountId)}/status`),

  getRecent: (accountId: number, limit = 30) =>
    api.fetch<{ success: boolean; alerts: StreamAlert[] }>(`${account(accountId)}/recent?limit=${limit}`),

  /** Tidies the dashboard's recent list only; nothing in OBS or Stripe changes. */
  clearRecent: (accountId: number, scope: StreamAlertClearScope) =>
    api.fetch<{ success: boolean; scope: StreamAlertClearScope; removed: number }>(`${account(accountId)}/recent/clear`, {
      method: 'POST',
      body: JSON.stringify({ scope }),
    }),

  fireAlert: (accountId: number, payload: StreamAlertTestInput) =>
    api.fetch<{ success: boolean; alert: StreamAlert }>(`${account(accountId)}/test`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  fireEffect: (accountId: number, payload: StreamEffectInput) =>
    api.fetch<{ success: boolean; cursor: string; effect: StreamEffectEntry }>(`${account(accountId)}/effect`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  replayAlert: (accountId: number, id: string) =>
    api.fetch<{ success: boolean; alert: StreamAlert }>(`${account(accountId)}/replay`, {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),

  sendControl: (accountId: number, action: StreamAlertControlAction) =>
    api.fetch<{ success: boolean; action: StreamAlertControlAction; settings: StreamAlertSettings }>(`${account(accountId)}/control`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  updateSettings: (accountId: number, partial: Partial<Pick<StreamAlertSettings, 'min_raid_viewers' | 'min_cheer_bits'>>) =>
    api.fetch<{ success: boolean; settings: StreamAlertSettings }>(`${account(accountId)}/settings`, {
      method: 'PUT',
      body: JSON.stringify(partial),
    }),

  /** Owner only. Call it when the owner asks to see or copy the link, and keep the answer out of any cache. */
  getOverlayUrl: (accountId: number) =>
    api.fetch<StreamAlertOverlayUrl>(`${account(accountId)}/overlay-url`, { cache: 'no-store' }),

  /** Owner only. The old link stops working at once. */
  regenerateOverlayKey: (accountId: number) =>
    api.fetch<StreamAlertOverlayUrl>(`${account(accountId)}/overlay-key/regenerate`, { method: 'POST', cache: 'no-store' }),

  getEditors: (accountId: number) =>
    api.fetch<StreamAlertEditors>(`${account(accountId)}/editors`),

  addEditor: (accountId: number, discordId: string) =>
    api.fetch<{ success: boolean; editor: StreamAlertEditor }>(`${account(accountId)}/editors`, {
      method: 'POST',
      body: JSON.stringify({ discord_id: discordId }),
    }),

  removeEditor: (accountId: number, discordId: string) =>
    api.fetch<{ success: boolean }>(`${account(accountId)}/editors/${encodeURIComponent(discordId)}`, { method: 'DELETE' }),

  /** Owner only. Removes the account, its editors and its waiting alerts. */
  deleteAccount: (accountId: number) =>
    api.fetch<{ success: boolean }>(account(accountId), { method: 'DELETE' }),

  /** Whether Twitch is connected, and how. Connecting itself is a page visit to `connect_url`, not a call from here. */
  getTwitch: (accountId: number) =>
    api.fetch<StreamAlertTwitchState>(`${account(accountId)}/twitch`),

  /** Owner only. Stops listening to the channel and forgets what its rewards were set to do. */
  disconnectTwitch: (accountId: number) =>
    api.fetch<{ success: boolean }>(`${account(accountId)}/twitch`, { method: 'DELETE' }),

  /** Owner only. Sets up again the Twitch events that are missing or failed. */
  resubscribeTwitch: (accountId: number) =>
    api.fetch<{ success: boolean; subscriptions: StreamAlertTwitchSubscription[] }>(`${account(accountId)}/twitch/resubscribe`, { method: 'POST' }),

  /** The channel's rewards, read from Twitch each time. Fails when Twitch is not connected or does not answer. */
  getRewards: (accountId: number) =>
    api.fetch<StreamRewards>(`${account(accountId)}/rewards`),

  setRewardMapping: (accountId: number, rewardId: string, mapping: StreamRewardMappingInput) =>
    api.fetch<{ success: boolean; mapping: StreamRewardMapping | null }>(`${account(accountId)}/rewards/${encodeURIComponent(rewardId)}`, {
      method: 'PUT',
      body: JSON.stringify(mapping),
    }),

  /** Owner only. Creates the standard reward for an effect on the Twitch channel and maps it. */
  createReward: (accountId: number, effect: StreamEffectName) =>
    api.fetch<{ success: boolean; reward: StreamReward }>(`${account(accountId)}/rewards`, {
      method: 'POST',
      body: JSON.stringify({ effect }),
    }),
};
