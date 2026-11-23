/**
 * Pure helpers and types for the Managers, Import & export, Analytics and
 * Channel settings pages (TWITCH_BOT_SPEC.md §10.7.10, §11.4, §12.10).
 *
 * No React and only relative `.ts` imports, so Node tests import it directly
 * (`tests/twitch-admin.test.ts`). Every check here is presentation only: the
 * API validates and authorises each request again.
 */
import type { Role } from '../types.ts';

export const LOGIN_RE = /^[a-z0-9_]{1,25}$/;
export const IMPORT_MAX_BYTES = 1_048_576;
export const MAX_IGNORED_LOGINS = 100;
export const ANALYTICS_MAX_DAYS = 400;

export const normalizeLogin = (value: string): string => value.trim().replace(/^@+/, '').toLowerCase();

/* ── Managers ───────────────────────────────────────────────────────────── */

export type ManagerRole = 'editor' | 'moderator';

export interface ManualManager {
  user_id: string;
  login: string;
  role: ManagerRole;
  added_by_user_id: string | null;
  created_at: string | null;
}

export interface SyncedManager {
  user_id: string;
  login: string;
  role: ManagerRole;
  source: 'twitch_editor' | 'twitch_moderator';
  synced_at: string | null;
}

export interface ManagersResponse {
  success: true;
  manual: ManualManager[];
  synced: SyncedManager[];
  limit: number;
}

export const MANAGER_ROLE_HELP: Record<ManagerRole, string> = {
  moderator: 'Can view the dashboard and edit commands, timers, filters, quotes, giveaways, polls and queues.',
  editor: 'Everything a moderator can, plus the other settings, loyalty, store, overlays, imports and analytics.',
};

export const SYNCED_SOURCE_LABELS: Record<SyncedManager['source'], string> = {
  twitch_editor: 'Twitch editor',
  twitch_moderator: 'Twitch moderator',
};

/** Why a login cannot be added as a manager, or null. */
export function managerLoginProblem(raw: string, channelLogin: string): string | null {
  const login = normalizeLogin(raw);
  if (!login) return 'Enter a Twitch username.';
  if (!LOGIN_RE.test(login)) return 'Twitch usernames are 1 to 25 letters, numbers or _.';
  if (login === channelLogin.toLowerCase()) return 'That is your own channel; you already have full access.';
  return null;
}

/** Synced rows grouped by user, so a person who is both a Twitch editor and moderator shows once. */
export function groupSynced(rows: readonly SyncedManager[]): Array<{ user_id: string; login: string; sources: SyncedManager['source'][]; role: ManagerRole }> {
  const byUser = new Map<string, { user_id: string; login: string; sources: SyncedManager['source'][]; role: ManagerRole }>();
  for (const row of rows) {
    const entry = byUser.get(row.user_id) ?? { user_id: row.user_id, login: row.login, sources: [], role: row.role };
    if (!entry.sources.includes(row.source)) entry.sources.push(row.source);
    if (row.role === 'editor') entry.role = 'editor';
    byUser.set(row.user_id, entry);
  }
  return [...byUser.values()].sort((a, b) => a.login.localeCompare(b.login));
}

/* ── Import ─────────────────────────────────────────────────────────────── */

export type ImportSource = 'nightbot' | 'streamelements';
export type ImportInputKind = 'paste' | 'channel';
export type ImportStatus = 'ok' | 'warning' | 'error' | 'conflict';
export type OnConflict = 'skip' | 'overwrite';

export interface ImportItem {
  index: number;
  kind: 'command' | 'timer';
  name: string;
  status: ImportStatus;
  warnings: string[];
  errors: string[];
  translated: Record<string, unknown> | null;
  fetch_urls?: string[];
  original?: string;
  conflict?: { with: 'builtin' | 'command' | 'timer'; key?: string } | null;
  alias_of?: string;
}

export interface ImportSummary {
  total: number;
  commands: number;
  timers: number;
  ok: number;
  warning: number;
  error: number;
  conflict: number;
  fetch_urls: number;
}

export interface ImportPreviewResponse {
  success: true;
  job_id: number;
  summary: ImportSummary;
  items: ImportItem[];
}

export interface ApplyReportItem {
  index: number;
  kind: 'command' | 'timer';
  name: string;
  result: 'created' | 'updated' | 'skipped' | 'failed';
  reason: string | null;
}

export interface ApplySummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  builtins_disabled: string[];
  interrupted?: boolean;
}

export interface ImportApplyResponse {
  success: true;
  summary: ApplySummary;
  report: ApplyReportItem[];
  live_applied: boolean;
}

export interface ImportJob {
  id: number;
  source: ImportSource;
  input_kind: ImportInputKind;
  status: 'previewed' | 'applied' | 'failed';
  summary: Partial<ImportSummary & ApplySummary> & { state?: string };
  report: { items?: ApplyReportItem[] };
  created_at: string | null;
  applied_at: string | null;
}

export const SOURCE_LABELS: Record<ImportSource, string> = { nightbot: 'Nightbot', streamelements: 'StreamElements' };

export const STATUS_LABELS: Record<ImportStatus, string> = {
  ok: 'Ready', warning: 'Check', error: 'Cannot import', conflict: 'Name in use',
};

export const STATUS_TONES: Record<ImportStatus, 'active' | 'warning' | 'error' | 'neutral'> = {
  ok: 'active', warning: 'warning', error: 'error', conflict: 'neutral',
};

/** Nightbot can only be pasted (spec §12.10.3); StreamElements by channel name or paste. */
export const sourceAllowsChannel = (source: ImportSource): boolean => source === 'streamelements';

/** Whether an item can be applied with this conflict choice. */
export function isSelectable(item: ImportItem, onConflict: OnConflict): boolean {
  if (item.translated === null || item.status === 'error') return false;
  if (item.status === 'conflict') return onConflict === 'overwrite';
  return true;
}

/** The items a fresh preview starts with: everything importable, conflicts only when overwriting. */
export function defaultSelection(items: readonly ImportItem[], onConflict: OnConflict): number[] {
  return items.filter((item) => isSelectable(item, onConflict)).map((item) => item.index);
}

/** Keep the selection valid when the conflict choice changes. */
export function reconcileSelection(selected: readonly number[], items: readonly ImportItem[], onConflict: OnConflict): number[] {
  const allowed = new Set(items.filter((item) => isSelectable(item, onConflict)).map((item) => item.index));
  return selected.filter((index) => allowed.has(index));
}

/** Byte size of a paste (UTF-8), checked before sending. */
export const pasteBytes = (text: string): number => new TextEncoder().encode(text).length;

export function previewInputProblem(source: ImportSource, kind: ImportInputKind, paste: string, channelLogin: string): string | null {
  if (kind === 'channel') {
    if (!sourceAllowsChannel(source)) return 'Nightbot commands can only be imported from a pasted export.';
    const login = normalizeLogin(channelLogin);
    if (!login) return 'Enter the StreamElements channel name.';
    if (!LOGIN_RE.test(login)) return 'Channel names are 1 to 25 letters, numbers or _.';
    return null;
  }
  if (!paste.trim()) return 'Paste the exported JSON first.';
  if (pasteBytes(paste) > IMPORT_MAX_BYTES) return 'The paste is larger than 1 MB.';
  return null;
}

export function previewBody(source: ImportSource, kind: ImportInputKind, paste: string, channelLogin: string): Record<string, unknown> {
  return kind === 'channel'
    ? { source, input_kind: 'channel', channel_login: normalizeLogin(channelLogin) }
    : { source, input_kind: 'paste', data: paste };
}

export function describeConflict(item: ImportItem): string | null {
  if (!item.conflict) return null;
  if (item.conflict.with === 'builtin') return `${item.name} is a built-in command. Overwriting turns that built-in off.`;
  if (item.conflict.with === 'timer') return `A timer named ${item.name} exists. Overwriting replaces it.`;
  return `A command named ${item.name} exists. Overwriting replaces its response and settings.`;
}

export function describePreview(summary: ImportSummary): string {
  const parts = [`${summary.total} item${summary.total === 1 ? '' : 's'}`];
  if (summary.ok) parts.push(`${summary.ok} ready`);
  if (summary.warning) parts.push(`${summary.warning} to check`);
  if (summary.conflict) parts.push(`${summary.conflict} with a name in use`);
  if (summary.error) parts.push(`${summary.error} that cannot be imported`);
  return parts.join(', ') + '.';
}

export function describeApply(summary: ApplySummary): string {
  const parts: string[] = [];
  if (summary.created) parts.push(`${summary.created} created`);
  if (summary.updated) parts.push(`${summary.updated} replaced`);
  if (summary.skipped) parts.push(`${summary.skipped} skipped`);
  if (summary.failed) parts.push(`${summary.failed} failed`);
  const text = parts.length ? parts.join(', ') : 'Nothing was imported';
  return summary.interrupted ? `${text}. The import stopped part way; the list below shows what was saved.` : `${text}.`;
}

/** Text shown for a translated item: its response or timer message. */
export function translatedText(item: ImportItem): string {
  const value = item.translated?.[item.kind === 'command' ? 'response' : 'message'];
  return typeof value === 'string' ? value : '';
}

/* ── Analytics ──────────────────────────────────────────────────────────── */

export interface AnalyticsDay {
  day: string;
  messages: number;
  unique_chatters: number;
  commands_used: number;
  new_followers: number;
  subs: number;
  gift_subs: number;
  bits: number;
  raids_received: number;
  points_awarded: number;
  points_spent: number;
  stream_minutes: number;
  peak_viewers: number;
  song_requests: number;
  moderation_actions: number;
}

export type AnalyticsMetric = Exclude<keyof AnalyticsDay, 'day'>;

export interface AnalyticsResponse {
  success: true;
  from: string;
  to: string;
  days: AnalyticsDay[];
  totals: Record<AnalyticsMetric, number> & { days_recorded: number };
}

export interface StreamRow {
  id: number;
  started_at: string | null;
  ended_at: string | null;
  title: string | null;
  category_name: string | null;
  peak_viewers: number;
  duration_minutes: number | null;
}

/** The charts on the page (§11.4: messages, chatters, followers, subs, bits, points). */
export const CHART_METRICS: ReadonlyArray<{ key: AnalyticsMetric; label: string; totalLabel: string; max?: boolean }> = [
  { key: 'messages', label: 'Chat messages', totalLabel: 'messages' },
  { key: 'unique_chatters', label: 'Unique chatters', totalLabel: 'on the busiest day', max: true },
  { key: 'new_followers', label: 'New followers', totalLabel: 'followers' },
  { key: 'subs', label: 'Subscriptions', totalLabel: 'subs and resubs' },
  { key: 'gift_subs', label: 'Gifted subs', totalLabel: 'gifted' },
  { key: 'bits', label: 'Bits', totalLabel: 'bits' },
  { key: 'points_awarded', label: 'Points awarded', totalLabel: 'points' },
  { key: 'commands_used', label: 'Commands used', totalLabel: 'commands' },
];

export type RangePreset = '7' | '30' | '90';
export const RANGE_PRESETS: ReadonlyArray<{ id: RangePreset; label: string }> = [
  { id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 90 days' },
];

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (date: Date): string => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export const parseDay = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || isoDay(date) !== value ? null : date;
};

/** `{from, to}` (UTC days, inclusive) for a preset ending today. */
export function presetRange(preset: RangePreset, now: Date = new Date()): { from: string; to: string } {
  const days = Number(preset);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { from: isoDay(start), to: isoDay(end) };
}

/** Every day of the range with the recorded value, or null where the bot recorded nothing. */
export function daySeries(from: string, to: string, days: readonly AnalyticsDay[], metric: AnalyticsMetric): Array<{ day: string; value: number | null }> {
  const start = parseDay(from);
  const end = parseDay(to);
  if (!start || !end || start > end) return [];
  const byDay = new Map(days.map((day) => [day.day, day]));
  const out: Array<{ day: string; value: number | null }> = [];
  for (let t = start.getTime(), n = 0; t <= end.getTime() && n < ANALYTICS_MAX_DAYS; t += 86_400_000, n += 1) {
    const day = isoDay(new Date(t));
    const row = byDay.get(day);
    out.push({ day, value: row ? Math.max(0, Number(row[metric]) || 0) : null });
  }
  return out;
}

/** A "nice" axis maximum ≥ the largest value (1, 2, 5 × 10^n), never 0. */
export function niceMax(values: ReadonlyArray<number | null>): number {
  const largest = Math.max(0, ...values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)));
  if (largest <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(largest));
  for (const step of [1, 2, 5, 10]) {
    if (step * power >= largest) return step * power;
  }
  return 10 * power;
}

export const hasAnyValue = (series: ReadonlyArray<{ value: number | null }>): boolean =>
  series.some((point) => typeof point.value === 'number' && point.value > 0);

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Short axis label for a UTC day: "Nov 3". */
export function shortDay(day: string): string {
  const date = parseDay(day);
  if (!date) return day;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/* ── Channel settings ───────────────────────────────────────────────────── */

export interface GeneralSettings {
  command_prefix: string;
  timezone: string;
  silent: boolean;
  reply_style: 'plain' | 'mention' | 'reply';
  shared_chat_mode: 'ignore' | 'commands';
  ignore_known_bots: boolean;
  ignored_logins: string[];
  max_messages_per_response: number;
}

export const PREFIX_CHOICES = ['!', '#', '$', '%', '&', '*', '+', '-', '.', '?', '~'] as const;

export const REPLY_STYLES: ReadonlyArray<{ id: GeneralSettings['reply_style']; label: string; example: string }> = [
  { id: 'mention', label: 'Mention the viewer', example: '@Viewer The stream has been live for 2 hours.' },
  { id: 'reply', label: 'Reply in a thread', example: 'Shown as a Twitch reply to the viewer’s message.' },
  { id: 'plain', label: 'Plain message', example: 'The stream has been live for 2 hours.' },
];

/** Split a typed list of usernames (commas, spaces or new lines). */
export function parseLoginList(text: string): { logins: string[]; invalid: string[] } {
  const logins: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    if (!raw) continue;
    const login = normalizeLogin(raw);
    if (!LOGIN_RE.test(login)) {
      if (!invalid.includes(raw)) invalid.push(raw);
    } else if (!logins.includes(login)) {
      logins.push(login);
    }
  }
  return { logins, invalid };
}

export function generalSettingsProblem(form: GeneralSettings, ignoredText: string): string | null {
  const { logins, invalid } = parseLoginList(ignoredText);
  if (invalid.length) return `Not a Twitch username: ${invalid.slice(0, 3).join(', ')}.`;
  if (logins.length > MAX_IGNORED_LOGINS) return `At most ${MAX_IGNORED_LOGINS} ignored users.`;
  if (!form.timezone) return 'Choose a time zone.';
  if (!(PREFIX_CHOICES as readonly string[]).includes(form.command_prefix)) return 'Choose a command prefix.';
  return null;
}

/** Why a login cannot be connected as this channel's custom bot account, or null. */
export function customBotLoginProblem(raw: string, channelLogin: string, sharedBotLogin: string | null): string | null {
  const login = normalizeLogin(raw);
  if (!login) return 'Enter the username of the bot account.';
  if (!LOGIN_RE.test(login)) return 'Twitch usernames are 1 to 25 letters, numbers or _.';
  if (login === channelLogin.toLowerCase()) return 'Use a separate account, not your own channel.';
  if (sharedBotLogin && login === sharedBotLogin.toLowerCase()) return 'That is the shared Acosmibot account. Choose your own bot account.';
  return null;
}

/* ── Deletion status ────────────────────────────────────────────────────── */

export interface DeletionRequest {
  id: number;
  status: 'pending' | 'running' | 'done' | 'failed';
  created_at: string | null;
  completed_at: string | null;
}

export type DeletionView = 'none' | 'queued' | 'running' | 'retrying' | 'completed';

/**
 * `GET /channels/:id/deletion`: `request: null` → none; once the purge has run the
 * channel row is gone and the endpoint answers 404, which means completed (W1(c) note).
 */
export function deletionView(result: { request: DeletionRequest | null } | 'not_found' | null): DeletionView {
  if (result === 'not_found') return 'completed';
  if (!result || !result.request) return 'none';
  switch (result.request.status) {
    case 'running': return 'running';
    case 'failed': return 'retrying';
    case 'done': return 'completed';
    default: return 'queued';
  }
}

export const DELETION_COPY: Record<DeletionView, string> = {
  none: '',
  queued: 'Removal requested. Acosmibot has left your chat and will delete this channel’s data within 15 minutes.',
  running: 'Deleting this channel’s data now.',
  retrying: 'Deleting this channel’s data hit a problem and will be retried automatically.',
  completed: 'All Acosmibot data for this channel has been deleted.',
};

/** Who may use what on the settings page (presentation only). */
export function settingsCapabilities(role: Role): { editGeneral: boolean; broadcasterTools: boolean } {
  return { editGeneral: role === 'editor' || role === 'broadcaster', broadcasterTools: role === 'broadcaster' };
}
