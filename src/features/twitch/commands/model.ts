/**
 * Commands slice model (§10.5, §10.7.1, §12.1): resource types, editor drafts,
 * client-side hints and the plain-language "what this command does" preview.
 *
 * Pure module (no React, type-only imports) so `tests/twitch-commands.test.ts`
 * can import it under `node --test`. The API stays the authority: these
 * checks only give earlier, friendlier feedback with the same limits.
 */

export type MatchMode = 'trigger' | 'keyword';
export type SendMode = 'say' | 'reply' | 'announce';
export type AnnounceColor = 'primary' | 'blue' | 'green' | 'orange' | 'purple';
export type Availability = 'always' | 'online' | 'offline';

/** §10.5 `Command`. */
export interface Command {
  id: number;
  name: string;
  aliases: string[];
  match_mode: MatchMode;
  response: string;
  send_mode: SendMode;
  announce_color: AnnounceColor | null;
  level: number;
  global_cooldown_s: number;
  user_cooldown_s: number;
  cost: number;
  availability: Availability;
  hidden: boolean;
  enabled: boolean;
  use_count: number;
  description: string | null;
  source: string;
  created_at: string | null;
  updated_at: string | null;
}

/** §10.7.1 `CommandInput`. */
export type CommandInput = Pick<Command,
  'name' | 'aliases' | 'match_mode' | 'response' | 'send_mode' | 'announce_color' | 'level' | 'global_cooldown_s'
  | 'user_cooldown_s' | 'cost' | 'availability' | 'hidden' | 'enabled' | 'description'>;

export interface CommandListResponse {
  success: true;
  items: Command[];
  count: number;
  limit: number;
  keyword_count?: number;
  keyword_limit?: number;
  /** The channel's `general.command_prefix` (for built-in triggers). */
  prefix?: string;
}

export interface TemplateIssue {
  code: string;
  message: string;
  position?: number;
  severity?: 'error' | 'warning' | string;
}

export interface DefaultCommandValues {
  level: number;
  global_cooldown_s: number;
  user_cooldown_s: number;
  cost: number;
  aliases: string[];
}

/** §10.5 `DefaultCommandState`. */
export interface DefaultCommandState {
  key: string;
  trigger: string;
  module: string;
  usage: string;
  description: string;
  availability?: Availability;
  subcommand_levels?: Record<string, number>;
  defaults: DefaultCommandValues & { response: string | null };
  override: {
    enabled: boolean;
    level: number | null;
    global_cooldown_s: number | null;
    user_cooldown_s: number | null;
    cost: number | null;
    aliases: string[];
    response_override: string | null;
  } | null;
  effective: DefaultCommandValues & { enabled: boolean };
}

export interface DefaultCommandsResponse { success: true; items: DefaultCommandState[]; prefix?: string }

export interface DefaultCommandInput {
  enabled: boolean;
  level: number | null;
  global_cooldown_s: number | null;
  user_cooldown_s: number | null;
  cost: number | null;
  aliases: string[];
  response_override: string | null;
}

export interface Regular { user_id: string; login: string; source: string; created_at: string | null }
export interface RegularsResponse { success: true; items: Regular[]; count: number; limit: number }

export interface CommandsSettings {
  enabled: boolean;
  chat_editing_enabled: boolean;
  cooldown_bypass_level: number;
  reply_on_cooldown: boolean;
  reply_on_level_denied: boolean;
  reply_on_insufficient_points: boolean;
  public_list_enabled: boolean;
}

export interface PublicCustomCommand { name: string; aliases: string[]; level_name: string; description: string | null; response: string }
export interface PublicDefaultCommand { trigger: string; aliases: string[]; usage: string; level_name: string; description: string }
export interface PublicCommandsResponse { success: true; custom: PublicCustomCommand[]; defaults: PublicDefaultCommand[] }

/* ── Limits (mirror limits.py / CommandInput) ────────────────────────────── */

export const COMMAND_LIMITS = {
  nameMax: 50,
  aliasesMax: 10,
  responseMax: 1000,
  overrideMax: 500,
  descriptionMax: 200,
  cooldownMax: 86_400,
  costMax: 1_000_000,
  commandsMax: 500,
  keywordMax: 25,
  keywordMinCooldown: 30,
  regularsMax: 1000,
} as const;

export const PREFIX_CHARS = '!#$%&*+-.?~';
/** `COMMAND_NAME_PATTERN` (Python `\w` is Unicode, so letters and digits of any script). */
export const COMMAND_NAME_RE = /^[!#$%&*+\-.?~]?[\p{L}\p{N}\p{M}_-]{1,48}$/u;
export const BUILTIN_ALIAS_RE = /^[a-z0-9_]{1,30}$/;
export const ANNOUNCE_COLORS: AnnounceColor[] = ['primary', 'blue', 'green', 'orange', 'purple'];
export const COLOR_LABELS: Record<AnnounceColor, string> = {
  primary: 'Channel colour', blue: 'Blue', green: 'Green', orange: 'Orange', purple: 'Purple',
};
export const SEND_MODE_LABELS: Record<SendMode, string> = {
  say: 'Chat message', reply: 'Reply to the viewer', announce: 'Announcement',
};
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  always: 'Always', online: 'Only while live', offline: 'Only while offline',
};
export const MODULE_LABELS: Record<string, string> = {
  commands: 'Commands', moderation: 'Moderation', loyalty: 'Loyalty', store: 'Store', games: 'Games',
  giveaways: 'Giveaways', polls: 'Polls', viewer_queue: 'Viewer queue', song_requests: 'Song requests',
  stream_tools: 'Stream tools', quotes: 'Quotes', counters: 'Counters',
};

/* ── Names and aliases ───────────────────────────────────────────────────── */

export const normalizeName = (value: string): string => value.trim().toLowerCase();

export const isValidName = (value: string): boolean => {
  const name = normalizeName(value);
  return name.length > 0 && name.length <= COMMAND_LIMITS.nameMax && COMMAND_NAME_RE.test(name);
};

/** "!dc, !discord2  !x" → ["!dc", "!discord2", "!x"] (lowercased, unique, without the command's own name). */
export const parseAliases = (text: string, ownName = ''): string[] => {
  const own = normalizeName(ownName);
  const out: string[] = [];
  for (const part of text.split(/[\s,]+/)) {
    const alias = normalizeName(part);
    if (alias && alias !== own && !out.includes(alias)) out.push(alias);
  }
  return out;
};

/** Built-in aliases are stored without the prefix: "!Up" → "up". */
export const parseBuiltinAliases = (text: string, trigger = ''): string[] => {
  const out: string[] = [];
  for (const part of text.split(/[\s,]+/)) {
    let alias = part.trim().toLowerCase();
    if (alias && PREFIX_CHARS.includes(alias[0])) alias = alias.slice(1);
    if (alias && alias !== trigger && !out.includes(alias)) out.push(alias);
  }
  return out;
};

/** Words a keyword command looks for: its name without a leading prefix character. */
export const keywordWords = (name: string): string[] => {
  const body = name && PREFIX_CHARS.includes(name[0]) ? name.slice(1) : name;
  return body.toLocaleLowerCase().match(/[\p{L}\p{N}\p{M}_]+/gu) ?? [];
};

export const startsLikeChatCommand = (response: string): boolean => /^\s*[/.]/.test(response);

/* ── Editor draft ────────────────────────────────────────────────────────── */

export interface CommandDraft {
  name: string;
  aliasesText: string;
  match_mode: MatchMode;
  response: string;
  send_mode: SendMode;
  announce_color: AnnounceColor;
  level: number;
  global_cooldown_s: number;
  user_cooldown_s: number;
  cost: number;
  availability: Availability;
  hidden: boolean;
  enabled: boolean;
  description: string;
}

export const emptyDraft = (prefix = '!'): CommandDraft => ({
  name: prefix,
  aliasesText: '',
  match_mode: 'trigger',
  response: '',
  send_mode: 'say',
  announce_color: 'primary',
  level: 0,
  global_cooldown_s: 5,
  user_cooldown_s: 15,
  cost: 0,
  availability: 'always',
  hidden: false,
  enabled: true,
  description: '',
});

export const toDraft = (command: Command): CommandDraft => ({
  name: command.name,
  aliasesText: command.aliases.join(', '),
  match_mode: command.match_mode,
  response: command.response,
  send_mode: command.send_mode,
  announce_color: command.announce_color ?? 'primary',
  level: command.level,
  global_cooldown_s: command.global_cooldown_s,
  user_cooldown_s: command.user_cooldown_s,
  cost: command.cost,
  availability: command.availability,
  hidden: command.hidden,
  enabled: command.enabled,
  description: command.description ?? '',
});

export const fromDraft = (draft: CommandDraft): CommandInput => {
  const name = normalizeName(draft.name);
  return {
    name,
    aliases: draft.match_mode === 'keyword' ? [] : parseAliases(draft.aliasesText, name),
    match_mode: draft.match_mode,
    response: draft.response.trim(),
    send_mode: draft.send_mode,
    announce_color: draft.send_mode === 'announce' ? draft.announce_color : null,
    level: draft.level,
    global_cooldown_s: draft.global_cooldown_s,
    user_cooldown_s: draft.user_cooldown_s,
    cost: draft.cost,
    availability: draft.availability,
    hidden: draft.hidden,
    enabled: draft.enabled,
    description: draft.description.trim() || null,
  };
};

export const sameDraft = (a: CommandDraft, b: CommandDraft): boolean =>
  JSON.stringify(fromDraft(a)) === JSON.stringify(fromDraft(b)) && a.name.trim() === b.name.trim();

export type DraftField = 'name' | 'aliases' | 'response' | 'global_cooldown_s' | 'user_cooldown_s' | 'cost' | 'description';

/** Problems the API would refuse, keyed by field (fixed sentences). */
export const draftProblems = (draft: CommandDraft): Partial<Record<DraftField, string>> => {
  const problems: Partial<Record<DraftField, string>> = {};
  const name = normalizeName(draft.name);
  if (!isValidName(name)) {
    problems.name = 'Use letters, numbers, _ or -, optionally after one of ! # $ % & * + - . ? ~ (up to 49 characters).';
  } else if (draft.match_mode === 'keyword' && keywordWords(name).length === 0) {
    problems.name = 'A keyword command needs at least one word in its name.';
  }
  const aliases = parseAliases(draft.aliasesText, name);
  if (draft.match_mode === 'trigger') {
    if (aliases.length > COMMAND_LIMITS.aliasesMax) problems.aliases = `At most ${COMMAND_LIMITS.aliasesMax} aliases.`;
    else if (aliases.some((alias) => !isValidName(alias))) problems.aliases = 'Aliases follow the same rules as names.';
  }
  const response = draft.response.trim();
  if (!response) problems.response = 'Write what Acosmibot should say.';
  else if (response.length > COMMAND_LIMITS.responseMax) problems.response = `At most ${COMMAND_LIMITS.responseMax} characters.`;
  else if (startsLikeChatCommand(response)) problems.response = 'Responses cannot start with / or . (Twitch chat commands are not run by bots).';
  for (const field of ['global_cooldown_s', 'user_cooldown_s'] as const) {
    const value = draft[field];
    if (!Number.isInteger(value) || value < 0 || value > COMMAND_LIMITS.cooldownMax) {
      problems[field] = `Between 0 and ${COMMAND_LIMITS.cooldownMax.toLocaleString('en-US')} seconds.`;
    }
  }
  if (!Number.isInteger(draft.cost) || draft.cost < 0 || draft.cost > COMMAND_LIMITS.costMax) {
    problems.cost = `Between 0 and ${COMMAND_LIMITS.costMax.toLocaleString('en-US')}.`;
  }
  if (draft.description.trim().length > COMMAND_LIMITS.descriptionMax) {
    problems.description = `At most ${COMMAND_LIMITS.descriptionMax} characters.`;
  }
  return problems;
};

/* ── Plain-language preview ──────────────────────────────────────────────── */

export interface AccessPreview {
  trigger: string;
  who: string;
  cooldown: string;
  cost: string;
  when: string;
  how: string;
}

const seconds = (value: number): string => {
  if (value <= 0) return 'no wait';
  if (value % 3600 === 0) return `${value / 3600} hour${value === 3600 ? '' : 's'}`;
  if (value % 60 === 0) return `${value / 60} minute${value === 60 ? '' : 's'}`;
  return `${value} second${value === 1 ? '' : 's'}`;
};

const quoteList = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;

/**
 * One sentence per aspect of a command: what starts it, who may use it, how
 * often, what it costs, when it works and how the answer is sent.
 * `levelLabel(500)` → "Moderators"; `currency` is the loyalty currency name.
 */
export const describeCommand = (
  input: Pick<CommandInput, 'name' | 'aliases' | 'match_mode' | 'level' | 'global_cooldown_s' | 'user_cooldown_s'
    | 'cost' | 'availability' | 'send_mode' | 'announce_color'>,
  levelLabel: (level: number) => string,
  currency = 'points',
): AccessPreview => {
  const name = normalizeName(input.name) || '…';
  let trigger: string;
  if (input.match_mode === 'keyword') {
    const words = keywordWords(name);
    trigger = words.length
      ? `Runs when a chat message contains the word${words.length > 1 ? 's' : ''} “${words.join(' ')}” anywhere.`
      : 'Runs when a chat message contains the words of its name.';
  } else {
    trigger = `Runs when a chat message starts with ${quoteList([name, ...input.aliases])}.`;
  }
  const who = input.level <= 0
    ? 'Everyone in chat can use it.'
    : input.level >= 1000
      ? 'Only the broadcaster can use it.'
      : `${levelLabel(input.level)} and everyone above them can use it.`;
  const global = input.match_mode === 'keyword'
    ? Math.max(COMMAND_LIMITS.keywordMinCooldown, input.global_cooldown_s)
    : input.global_cooldown_s;
  let cooldown: string;
  if (global <= 0 && input.user_cooldown_s <= 0) cooldown = 'No cooldown: it can run on every message.';
  else {
    const parts: string[] = [];
    if (global > 0) parts.push(`${seconds(global)} between uses in the channel`);
    if (input.user_cooldown_s > 0) parts.push(`${seconds(input.user_cooldown_s)} between uses by the same viewer`);
    cooldown = `Waits ${parts.join(', and ')}.`;
    if (input.match_mode === 'keyword' && input.global_cooldown_s < COMMAND_LIMITS.keywordMinCooldown) {
      cooldown += ` Keyword commands always wait at least ${COMMAND_LIMITS.keywordMinCooldown} seconds.`;
    }
  }
  const cost = input.cost > 0
    ? `Costs ${input.cost.toLocaleString('en-US')} ${currency} per use, refunded if the command fails.`
    : 'Free to use.';
  const when = input.availability === 'online'
    ? 'Works only while the stream is live.'
    : input.availability === 'offline'
      ? 'Works only while the stream is offline.'
      : 'Works whether or not the stream is live.';
  const how = input.send_mode === 'reply'
    ? 'Acosmibot replies to the viewer’s message.'
    : input.send_mode === 'announce'
      ? `Acosmibot posts it as an announcement (${COLOR_LABELS[input.announce_color ?? 'primary'].toLowerCase()}).`
      : 'Acosmibot posts it as a normal chat message.';
  return { trigger, who, cooldown, cost, when, how };
};

/** Short "5s / 15s" cell text. */
export const cooldownSummary = (global: number, user: number): string => `${global}s / ${user}s`;

/* ── Server issues ───────────────────────────────────────────────────────── */

/** Issue lines for the TemplateField: errors block saving, warnings are notes. */
export const issueMessages = (issues: TemplateIssue[] | undefined): string[] =>
  (issues ?? []).map((issue) => (issue.severity === 'error' ? issue.message : `Note: ${issue.message}`));

/** Template issues of one field from a 400 `validation_failed` body (`details.templates`). */
export const templateIssuesFrom = (details: unknown, field: string): TemplateIssue[] => {
  const templates = (details as { templates?: unknown } | undefined)?.templates;
  if (!Array.isArray(templates)) return [];
  const entry = templates.find((item) => (item as { field?: unknown })?.field === field) as { issues?: unknown } | undefined;
  return Array.isArray(entry?.issues)
    ? (entry!.issues as unknown[]).filter((issue): issue is TemplateIssue =>
      typeof (issue as TemplateIssue)?.message === 'string')
    : [];
};

/* ── Lists ───────────────────────────────────────────────────────────────── */

export const filterCommands = <T extends { name: string; aliases: string[]; response?: string; description?: string | null }>(
  items: T[], query: string,
): T[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) =>
    item.name.toLowerCase().includes(needle)
    || item.aliases.some((alias) => alias.toLowerCase().includes(needle))
    || (item.response ?? '').toLowerCase().includes(needle)
    || (item.description ?? '').toLowerCase().includes(needle));
};

/** Trim a response for a table cell. */
export const shorten = (text: string, max = 90): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/* ── Built-in override drafts ────────────────────────────────────────────── */

export interface DefaultDraft {
  enabled: boolean;
  level: number;
  global_cooldown_s: number;
  user_cooldown_s: number;
  cost: number;
  aliasesText: string;
  response: string;
}

export const toDefaultDraft = (state: DefaultCommandState): DefaultDraft => ({
  enabled: state.effective.enabled,
  level: state.effective.level,
  global_cooldown_s: state.effective.global_cooldown_s,
  user_cooldown_s: state.effective.user_cooldown_s,
  cost: state.effective.cost,
  aliasesText: state.effective.aliases.join(', '),
  response: state.override?.response_override ?? '',
});

/** Values equal to the built-in default are sent as `null` ("use the default"). */
export const fromDefaultDraft = (state: DefaultCommandState, draft: DefaultDraft): DefaultCommandInput => {
  const keep = (value: number, fallback: number): number | null => (value === fallback ? null : value);
  return {
    enabled: draft.enabled,
    level: keep(draft.level, state.defaults.level),
    global_cooldown_s: keep(draft.global_cooldown_s, state.defaults.global_cooldown_s),
    user_cooldown_s: keep(draft.user_cooldown_s, state.defaults.user_cooldown_s),
    cost: keep(draft.cost, state.defaults.cost),
    aliases: parseBuiltinAliases(draft.aliasesText, state.trigger),
    response_override: state.defaults.response !== null && draft.response.trim() ? draft.response.trim() : null,
  };
};

export const defaultDraftProblems = (state: DefaultCommandState, draft: DefaultDraft): Partial<Record<'aliases' | 'response' | 'global_cooldown_s' | 'user_cooldown_s' | 'cost', string>> => {
  const problems: Partial<Record<'aliases' | 'response' | 'global_cooldown_s' | 'user_cooldown_s' | 'cost', string>> = {};
  const aliases = parseBuiltinAliases(draft.aliasesText, state.trigger);
  if (aliases.length > COMMAND_LIMITS.aliasesMax) problems.aliases = `At most ${COMMAND_LIMITS.aliasesMax} aliases.`;
  else if (aliases.some((alias) => !BUILTIN_ALIAS_RE.test(alias))) problems.aliases = 'Use letters, numbers and _ (up to 30 characters).';
  const response = draft.response.trim();
  if (response.length > COMMAND_LIMITS.overrideMax) problems.response = `At most ${COMMAND_LIMITS.overrideMax} characters.`;
  else if (response && startsLikeChatCommand(response)) problems.response = 'Responses cannot start with / or . (Twitch chat commands are not run by bots).';
  for (const field of ['global_cooldown_s', 'user_cooldown_s'] as const) {
    if (!Number.isInteger(draft[field]) || draft[field] < 0 || draft[field] > COMMAND_LIMITS.cooldownMax) {
      problems[field] = `Between 0 and ${COMMAND_LIMITS.cooldownMax.toLocaleString('en-US')} seconds.`;
    }
  }
  if (!Number.isInteger(draft.cost) || draft.cost < 0 || draft.cost > COMMAND_LIMITS.costMax) {
    problems.cost = `Between 0 and ${COMMAND_LIMITS.costMax.toLocaleString('en-US')}.`;
  }
  return problems;
};

/** "!so <user>" with the channel's prefix instead of "!". */
export const withPrefix = (text: string, prefix: string): string =>
  prefix === '!' ? text : text.replace(/(^|[^\w!])!(?=\w)/g, (_match, before: string) => `${before}${prefix}`);
