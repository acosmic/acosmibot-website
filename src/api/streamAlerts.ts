import { api, UploadOptions } from './client';

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
  /** On a test sent for one look: a variation id, or "base". */
  variation?: string;
  /** Alert moderation: null while it is off, else where this alert stands. Older APIs leave it out. */
  moderation?: StreamAlertModeration | null;
}

/** Where a held alert stands. `released`: a hold ran out without a block, so it showed. */
export type StreamAlertModeration = 'pending' | 'approved' | 'blocked' | 'released';

export interface StreamAlertTestInput {
  type: StreamAlertType;
  name?: string;
  message?: string;
  value?: number;
  tier?: StreamAlertTier;
  amount_minor?: number;
  /** Forces one look: a variation id, or "base" for the alert's own look. */
  variation?: string;
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

/* ---- Media library and alert designs ---- */

export type StreamAlertAssetKind = 'video' | 'image' | 'sound' | 'font';
export type StreamAlertAssetStatus = 'queued' | 'processing' | 'ready' | 'failed';

/** One file in an account's media library. `url` is null until the file is `ready`. */
export interface StreamAlertAsset {
  id: number;
  kind: StreamAlertAssetKind;
  status: StreamAlertAssetStatus;
  original_name: string;
  url: string | null;
  content_type: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  has_alpha: boolean;
  has_audio: boolean;
  font_family: string | null;
  /** A plain sentence for the streamer when the file could not be used. */
  error: string | null;
  created_at: string;
  /** The alert kinds whose design uses this file. */
  in_use: StreamAlertType[];
}

export interface StreamAlertAssetQuota {
  used_bytes: number;
  max_bytes: number;
  count: number;
  max_count: number;
}

export interface StreamAlertAssets {
  success: boolean;
  /** Newest first. */
  assets: StreamAlertAsset[];
  quota: StreamAlertAssetQuota;
}

export type StreamAlertTextAlign = 'left' | 'center' | 'right';
export type StreamAlertTextEntrance = 'none' | 'fade' | 'typewriter';
export type StreamAlertTextFit = 'shrink' | 'none';

/** A text box drawn on the alert's media. Position and size are fractions of the media box. */
export interface StreamAlertDesignText {
  template: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** A font from the shared list, or "asset:<id>" for an uploaded font. */
  font: string;
  /** Pixels at the media's own size. */
  size: number;
  color: string;
  weight: 400 | 700;
  italic: boolean;
  align: StreamAlertTextAlign;
  shadow: boolean;
  appear_ms: number;
  /** null: shown until the alert ends. */
  disappear_ms: number | null;
  entrance: StreamAlertTextEntrance;
  fit: StreamAlertTextFit;
}

/** What `PUT /designs/<kind>` takes. `x` and `y` are the centre of the alert on the 1920x1080 screen. */
export interface StreamAlertDesign {
  video: number | null;
  image: number | null;
  sound: number | null;
  duration_ms: number;
  x: number;
  y: number;
  scale: number;
  volume: number;
  texts: StreamAlertDesignText[];
}

/** What the overlay is told about a media file in a resolved design. */
export interface StreamAlertMediaFacts {
  url: string;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  has_audio?: boolean;
  has_alpha?: boolean;
}

/** A design with asset ids replaced by facts, as the overlay and the preview get it. */
export interface StreamAlertResolvedDesign extends Omit<StreamAlertDesign, 'video' | 'image' | 'sound'> {
  video: StreamAlertMediaFacts | null;
  image: StreamAlertMediaFacts | null;
  sound: StreamAlertMediaFacts | null;
  fonts: { family: string; url: string }[];
}

export interface StreamAlertDesigns {
  success: boolean;
  designs: Partial<Record<StreamAlertType, StreamAlertDesign>>;
  resolved: Partial<Record<StreamAlertType, StreamAlertResolvedDesign>>;
  /** The font names a text box may use (besides uploaded fonts). */
  fonts: string[];
  /** The variables each kind's templates may use. */
  variables: Partial<Record<StreamAlertType, string[]>>;
  kinds: StreamAlertType[];
}

/* ---- Alert box: looks, variations, general settings and moderation ---- */

export type StreamAlertStyle = 'classic' | 'preset' | 'custom';
/** above: media above the text. over: text over the media. side: media left of the text. */
export type StreamAlertLayout = 'above' | 'over' | 'side';
/** "builtin" (the Acosmibot sound), "none", or a sound asset id. */
export type StreamAlertSound = 'builtin' | 'none' | number;

export interface StreamAlertLookFont {
  /** A font from the shared list, or "asset:<id>" for an uploaded font. */
  family: string;
  size: number;
  weight: number;
  color: string;
  /** The colour the template's variables are drawn in. */
  highlight: string;
  shadow: boolean;
}

/** How one alert (or one variation of it) looks and sounds. */
export interface StreamAlertLook {
  style: StreamAlertStyle;
  layout: StreamAlertLayout;
  /** Asset ids; a video wins over a picture. */
  media: { video: number | null; image: number | null };
  /** Percent of the media's own size, 10 to 200. */
  size: number;
  volume: number;
  sound: StreamAlertSound;
  sound_volume: number;
  template: string;
  show_message: boolean;
  /** null: as long as the video. */
  duration_ms: number | null;
  text_delay_ms: number;
  animation: { show: string; hide: string };
  text: { intro: string; loop: string; outro: string };
  font: StreamAlertLookFont;
  /** The phase 4 design, used by the custom style. */
  custom: StreamAlertDesign | null;
}

export type StreamAlertConditionType =
  | 'random' | 'viewer' | 'amount_at_least' | 'amount_exactly' | 'months_at_least' | 'months_exactly' | 'tier';

export interface StreamAlertCondition {
  type: StreamAlertConditionType;
  value: number | string;
}

/** Another look for the same alert, used when its condition matches. */
export interface StreamAlertVariation {
  /** "v_" and 8 lowercase hex digits. */
  id: string;
  name: string;
  enabled: boolean;
  condition: StreamAlertCondition;
  look: StreamAlertLook;
}

/** One alert kind's settings: on or off, its look, and up to 10 variations checked in order. */
export interface StreamAlertKindSettings {
  enabled: boolean;
  look: StreamAlertLook;
  variations: StreamAlertVariation[];
}

/** A look as the overlay gets it: asset ids replaced by facts, uploaded fonts given a family. */
export interface StreamAlertResolvedLook extends Omit<StreamAlertLook, 'media' | 'sound' | 'custom'> {
  media: { video: StreamAlertMediaFacts | null; image: StreamAlertMediaFacts | null };
  sound: 'builtin' | 'none' | { url: string; duration_ms?: number | null };
  fonts?: { family: string; url: string }[];
  custom: StreamAlertResolvedDesign | null;
}

export interface StreamAlertResolvedKind {
  enabled: boolean;
  look: StreamAlertResolvedLook;
  variations: Array<Omit<StreamAlertVariation, 'look'> & { look: StreamAlertResolvedLook }>;
}

export interface StreamAlertAnimationNames {
  show: string[];
  hide: string[];
  intro: string[];
  loop: string[];
  outro: string[];
}

export interface StreamAlertAlerts {
  success: boolean;
  alerts: Partial<Record<StreamAlertType, StreamAlertKindSettings>>;
  resolved: Partial<Record<StreamAlertType, StreamAlertResolvedKind>>;
  kinds: StreamAlertType[];
  variables: Partial<Record<StreamAlertType, string[]>>;
  fonts: string[];
  names: StreamAlertAnimationNames;
  conditions: Partial<Record<StreamAlertType, StreamAlertConditionType[]>>;
}

export type StreamAlertProfanityMode = 'off' | 'replace' | 'hide_message' | 'skip_alert';
export type StreamAlertModerationMode = 'off' | 'hold' | 'manual';
export type StreamAlertMinimumKind = 'cheer' | 'raid' | 'gift' | 'resub' | 'donation' | 'hypetrain';
export type StreamAlertMessageMinimumKind = 'cheer' | 'donation' | 'resub';

/** Settings for every alert of an account. */
export interface StreamAlertGeneral {
  profanity: { mode: StreamAlertProfanityMode; builtin: boolean; words: string[]; allow: string[] };
  minimums: Record<StreamAlertMinimumKind, number>;
  message_minimums: Record<StreamAlertMessageMinimumKind, number>;
  delay_ms: number;
  interrupt: boolean;
  moderation: { mode: StreamAlertModerationMode; seconds: number };
  /** The look "Global editing" copies parts of into every alert. */
  defaults: StreamAlertLook;
}

/** The look parts "Apply to all alerts" can copy from the defaults. */
export type StreamAlertDefaultsField =
  | 'layout' | 'size' | 'volume' | 'sound_volume' | 'duration_ms' | 'text_delay_ms' | 'animation' | 'text' | 'font';

export type StreamAlertModerationDecision = 'approve' | 'block';

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
  /** Sends one file to the media library. The API answers once it has the file; converting it happens afterwards. */
  uploadAsset: (accountId: number, file: File, removeBlack: boolean, options?: UploadOptions) => {
    const form = new FormData();
    form.append('file', file);
    if (removeBlack) form.append('remove_black', '1');
    return api.upload<{ success: boolean; asset: StreamAlertAsset }>(`${account(accountId)}/assets`, form, options);
  },

  getAssets: (accountId: number) =>
    api.fetch<StreamAlertAssets>(`${account(accountId)}/assets`),

  getAsset: (accountId: number, assetId: number) =>
    api.fetch<{ success: boolean; asset: StreamAlertAsset }>(`${account(accountId)}/assets/${assetId}`),

  /** Refused with 409 while an alert design uses the file. */
  deleteAsset: (accountId: number, assetId: number) =>
    api.fetch<{ success: boolean }>(`${account(accountId)}/assets/${assetId}`, { method: 'DELETE' }),

  getDesigns: (accountId: number) =>
    api.fetch<StreamAlertDesigns>(`${account(accountId)}/designs`),

  /** A 400 carries `field`, the path of the part of the design it is about. */
  saveDesign: (accountId: number, kind: StreamAlertType, design: StreamAlertDesign) =>
    api.fetch<{ success: boolean; design: StreamAlertDesign; resolved: StreamAlertResolvedDesign | null }>(`${account(accountId)}/designs/${kind}`, {
      method: 'PUT',
      body: JSON.stringify(design),
    }),

  /** Every kind's settings, what the overlay gets for them, and the names and limits the forms offer. */
  getAlerts: (accountId: number) =>
    api.fetch<StreamAlertAlerts>(`${account(accountId)}/alerts`),

  /** Saves one kind whole: enabled, look and variations. A 400 carries `field`, such as "variations[1].look.font.family". */
  saveAlert: (accountId: number, kind: StreamAlertType, alert: StreamAlertKindSettings) =>
    api.fetch<{ success: boolean; alert: StreamAlertKindSettings; resolved: StreamAlertResolvedKind | null }>(`${account(accountId)}/alerts/${kind}`, {
      method: 'PUT',
      body: JSON.stringify(alert),
    }),

  getAlertSettings: (accountId: number) =>
    api.fetch<{ success: boolean; general: StreamAlertGeneral }>(`${account(accountId)}/alert-settings`),

  /** Only the parts sent change. A 400 carries `field`. */
  saveAlertSettings: (accountId: number, general: Partial<StreamAlertGeneral>) =>
    api.fetch<{ success: boolean; general: StreamAlertGeneral }>(`${account(accountId)}/alert-settings`, {
      method: 'PUT',
      body: JSON.stringify(general),
    }),

  /** Copies the listed parts of the saved defaults into each kind's own look. Variations stay as they are. */
  applyDefaults: (accountId: number, fields: StreamAlertDefaultsField[], kinds?: StreamAlertType[]) =>
    api.fetch<{ success: boolean; alerts: Partial<Record<StreamAlertType, StreamAlertKindSettings>> }>(`${account(accountId)}/alerts/apply-defaults`, {
      method: 'POST',
      body: JSON.stringify(kinds ? { kinds, fields } : { fields }),
    }),

  /** Shows (approve) or drops (block) an alert that moderation is holding. */
  moderate: (accountId: number, alertId: string, decision: StreamAlertModerationDecision) =>
    api.fetch<{ success: boolean }>(`${account(accountId)}/moderation`, {
      method: 'POST',
      body: JSON.stringify({ alert_id: alertId, decision }),
    }),

  /** That kind goes back to the built-in card. */
  resetDesign: (accountId: number, kind: StreamAlertType) =>
    api.fetch<{ success: boolean }>(`${account(accountId)}/designs/${kind}`, { method: 'DELETE' }),
};
