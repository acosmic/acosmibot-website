/**
 * Types, limits and pure helpers for the Song requests pages (§10.7.7, §12.7).
 *
 * No React and no `@/` imports, so Node tests can import this file directly.
 * The API and the bot are the authority; the checks here only save a round trip
 * and mirror `acosmibot_core.twitch_bot.youtube_songs` and the endpoint validation.
 */

// ── Constants ─────────────────────────────────────────────────────────────

export const SONG_LIMITS = { inputMax: 200, termMax: 100, historyPage: 50 } as const;

/** The only script the player page ever loads (YouTube's official IFrame API loader). */
export const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
/** The only host an embedded player is created on. */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube.com';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

/** `YT.PlayerState` values. */
export const PLAYER_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** How long a loaded song may stay un-started before the page says playback is blocked. */
export const START_TIMEOUT_MS = 8_000;
/** Minimum gap between two "start from idle" reports. */
export const IDLE_START_GAP_MS = 5_000;

// ── Resource shapes (§10.5) ───────────────────────────────────────────────

export type SongStatus = 'queued' | 'playing' | 'played' | 'skipped' | 'removed';
export type SongSource = 'chat' | 'dashboard' | 'fallback' | 'reward';

export interface SongRequest {
  id: number;
  broadcaster_id: string;
  video_id: string;
  title: string;
  channel_title: string;
  duration_s: number;
  requested_by_user_id: string | null;
  requested_by_login: string | null;
  status: SongStatus;
  source: SongSource;
  cost_paid: number;
  position: number;
  skip_votes: number;
  created_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface QueueResponse {
  success: true;
  current: SongRequest | null;
  items: SongRequest[];
  length: number;
}

export interface HistoryResponse {
  success: true;
  items: SongRequest[];
  next_before_id: number | null;
}

export type BlockKind = 'video' | 'channel' | 'term';

export interface SongBlock {
  id: number;
  broadcaster_id: string;
  kind: BlockKind;
  value: string;
  created_by_user_id: string | null;
  created_at: string | null;
}

export interface FallbackItem {
  id: number;
  broadcaster_id: string;
  video_id: string;
  title: string;
  channel_title: string;
  duration_s: number;
  sort_order: number;
  created_at: string | null;
}

/** `song_requests` settings section (§4.2). */
export interface SongSettings {
  enabled: boolean;
  cost: number;
  max_queue: number;
  max_per_user: number;
  max_duration_s: number;
  min_views: number;
  allow_search: boolean;
  region_code: string;
  voteskip_threshold: number;
  fallback_enabled: boolean;
  shuffle_fallback: boolean;
  announce_now_playing: boolean;
  now_playing_template: string;
  public_queue_page: boolean;
  player_volume: number;
}

export const SETTINGS_BOUNDS = {
  cost: { min: 0, max: 1_000_000 },
  max_queue: { min: 1, max: 200 },
  max_per_user: { min: 1, max: 20 },
  max_duration_s: { min: 30, max: 3600 },
  min_views: { min: 0, max: 1_000_000_000 },
  voteskip_threshold: { min: 2, max: 100 },
  player_volume: { min: 0, max: 100 },
  template: 500,
} as const;

export interface PublicSongsResponse {
  success: true;
  current: { title: string; channel_title: string; requested_by_display_name: string } | null;
  items: Array<{ position: number; title: string; duration_s: number; requested_by_display_name: string }>;
}

// ── Formatting ────────────────────────────────────────────────────────────

/** `213` → `3:33`, `3723` → `1:02:03`. */
export function formatSongDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(rest)}` : `${minutes}:${two(rest)}`;
}

/** Total queued length, e.g. `12 min` or `1 h 5 min`. */
export function describeQueueLength(items: ReadonlyArray<Pick<SongRequest, 'duration_s'>>): string {
  const minutes = Math.round(items.reduce((sum, item) => sum + item.duration_s, 0) / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function requesterLabel(row: Pick<SongRequest, 'requested_by_login' | 'source'>): string {
  if (row.requested_by_login) return row.requested_by_login;
  return row.source === 'fallback' ? 'Fallback playlist' : 'Unknown';
}

export function sourceLabel(source: SongSource): string {
  switch (source) {
    case 'chat': return 'Chat';
    case 'dashboard': return 'Dashboard';
    case 'fallback': return 'Fallback';
    case 'reward': return 'Channel points';
    default: return 'Other';
  }
}

export function describeStatus(status: SongStatus): string {
  switch (status) {
    case 'played': return 'Played';
    case 'skipped': return 'Skipped';
    case 'removed': return 'Removed';
    case 'playing': return 'Playing';
    default: return 'Queued';
  }
}

// ── Input checks ──────────────────────────────────────────────────────────

export const oneLine = (value: string): string => value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID_PATTERN.test(value);
}

/** A problem sentence for the "add a song" boxes, or `null` when the input may be sent. */
export function songInputProblem(raw: string): string | null {
  const text = oneLine(raw);
  if (!text) return 'Enter a YouTube link or an 11 character video id.';
  if (text.length > SONG_LIMITS.inputMax) return `Use at most ${SONG_LIMITS.inputMax} characters.`;
  return null;
}

export function blockProblem(kind: BlockKind, raw: string): string | null {
  const value = oneLine(raw);
  if (!value) return 'Enter a value.';
  if (kind === 'channel' && !CHANNEL_ID_PATTERN.test(value)) return 'A YouTube channel id starts with UC and is 24 characters long.';
  if (kind === 'term' && value.length > SONG_LIMITS.termMax) return `Use at most ${SONG_LIMITS.termMax} characters.`;
  if (kind === 'video' && value.length > SONG_LIMITS.inputMax) return `Use at most ${SONG_LIMITS.inputMax} characters.`;
  return null;
}

export const blockKindLabel = (kind: BlockKind): string => (kind === 'video' ? 'Video' : kind === 'channel' ? 'Channel' : 'Title word');

// ── Player ────────────────────────────────────────────────────────────────

/**
 * The embed URL for one validated video id, or `null` when the id is not an
 * 11 character YouTube id. The host is fixed and the id is the only variable
 * part, so a viewer-supplied URL can never reach the iframe.
 */
export function youtubeEmbedSrc(videoId: unknown, pageOrigin: string): string | null {
  if (!isVideoId(videoId)) return null;
  const params = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0', origin: pageOrigin });
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${videoId}?${params.toString()}`;
}

export interface PlayerErrorView {
  /** Short sentence shown in the player panel. */
  message: string;
  /** True when the error means this song can never play here (the bot skips it). */
  skip: boolean;
}

/** YouTube IFrame API `onError` codes: 2, 5, 100, 101, 150 (and 153 when the embedder sends no referrer). */
export function describePlayerError(code: number): PlayerErrorView {
  switch (code) {
    case 2: return { message: 'YouTube rejected the video id.', skip: true };
    case 5: return { message: 'The player hit an error. The song was skipped.', skip: true };
    case 100: return { message: 'The video was removed or is private. The song was skipped.', skip: true };
    case 101:
    case 150: return { message: 'The owner does not allow this video to play in embedded players. The song was skipped.', skip: true };
    case 153: return { message: 'YouTube refused the player because the page sent no referrer. The song was skipped.', skip: true };
    default: return { message: `The player reported error ${code}. The song was skipped.`, skip: true };
  }
}

export interface PlayerPlanInput {
  /** The user pressed Start player in this tab. */
  armed: boolean;
  current: Pick<SongRequest, 'id' | 'video_id' | 'source'> | null;
  queueLength: number;
  /** Fallback playlist is on and has songs (the dashboard may not know the count: pass true when unknown). */
  fallbackPossible: boolean;
  /** Request id the iframe currently has loaded. */
  loadedRequestId: number | null;
  now: number;
  lastIdleStartAt: number | null;
}

export type PlayerPlan =
  | { kind: 'wait' }
  | { kind: 'load'; requestId: number; videoId: string }
  | { kind: 'start' }
  | { kind: 'skip_fallback'; requestId: number };

/**
 * What an armed player tab should do next. Pure so it can be tested:
 * - a playing song that is not loaded yet is loaded (video id only);
 * - nothing playing but songs waiting (or a fallback playlist) asks the bot to start the queue,
 *   at most once per `IDLE_START_GAP_MS`;
 * - a fallback song that is playing while viewers' songs wait is skipped so the request goes next.
 */
export function planPlayer(input: PlayerPlanInput): PlayerPlan {
  if (!input.armed) return { kind: 'wait' };
  const { current } = input;
  if (current) {
    if (!isVideoId(current.video_id)) return { kind: 'wait' };
    if (current.source === 'fallback' && input.queueLength > 0 && input.loadedRequestId === current.id) {
      return { kind: 'skip_fallback', requestId: current.id };
    }
    if (input.loadedRequestId !== current.id) return { kind: 'load', requestId: current.id, videoId: current.video_id };
    return { kind: 'wait' };
  }
  if (input.queueLength > 0 || input.fallbackPossible) {
    if (input.lastIdleStartAt === null || input.now - input.lastIdleStartAt >= IDLE_START_GAP_MS) return { kind: 'start' };
  }
  return { kind: 'wait' };
}

// ── Queue ordering ────────────────────────────────────────────────────────

export type MoveDirection = 'up' | 'down' | 'top';

/**
 * The `before_id` for `PATCH /songs/queue/:id`: `{ before_id }` puts the song before that one,
 * `null` puts it last. Returns `undefined` when the move changes nothing.
 */
export function moveTarget(items: ReadonlyArray<Pick<SongRequest, 'id'>>, id: number, direction: MoveDirection): { before_id: number | null } | undefined {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  if (direction === 'up') return index === 0 ? undefined : { before_id: items[index - 1].id };
  if (direction === 'top') return index === 0 ? undefined : { before_id: items[0].id };
  if (index >= items.length - 1) return undefined;
  const after = items[index + 2];
  return { before_id: after ? after.id : null };
}

/** Moves one entry of an id list by `delta` places (fallback order); returns a new list. */
export function reorderIds(ids: readonly number[], index: number, delta: -1 | 1): number[] {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Plain-language reason for a failed add, from the API's code. */
export function addFailureMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'limit_reached': return 'The list is full.';
    case 'sr_unavailable': return fallback || 'Song requests are unavailable right now.';
    case 'name_taken': return 'That entry is already there.';
    default: return fallback;
  }
}
