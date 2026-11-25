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

export interface StreamAlertStatus {
  success: boolean;
  account: StreamAlertAccount;
  configured: boolean;
  available: boolean;
  overlay_last_seen: number | null;
  types: StreamAlertType[];
  settings: StreamAlertSettings;
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
};
