/**
 * Shared types for the Twitch dashboard (`/twitch`) and public channel pages
 * (`/t/:login`). Resource shapes mirror TWITCH_BOT_SPEC.md §10.5 exactly; the
 * API is the authority and these types only describe what it returns.
 *
 * Type-only module: safe to import from Node tests (`import type`).
 */
import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';

/** Dashboard roles in rank order moderator (1) < editor (2) < broadcaster (3). */
export type Role = 'moderator' | 'editor' | 'broadcaster';

/** Sidebar groups, rendered in this order (§11.3). */
export type SectionGroup = 'overview' | 'chat' | 'moderation' | 'community' | 'stream' | 'channel';

/** `TwitchBotChannels.status` (§3.3). */
export type ChannelStatus = 'active' | 'paused' | 'reauth_required' | 'bot_banned' | 'removing';

/** Chat user levels (§3.3, §6.6): 0 everyone … 1000 broadcaster. */
export type Level = number;

/** `ChannelAccess` (§10.5): one entry of `/auth/twitch/me` and `GET /channels`. */
export interface ChannelAccess {
  broadcaster_id: string;
  login: string;
  display_name: string;
  profile_image_url: string | null;
  status: ChannelStatus;
  role: Role;
}

export interface ChannelLive {
  live: boolean;
  started_at?: string | null;
  title?: string | null;
  category_name?: string | null;
  viewer_count?: number | null;
}

export interface ChannelBotAccount {
  user_id: string | null;
  login: string | null;
  is_custom: boolean;
  is_moderator: boolean;
  is_vip: boolean;
}

/** `ChannelSummary` (§10.5): `GET /api/twitch-bot/channels/:id`. */
export interface ChannelSummary {
  broadcaster_id: string;
  login: string;
  display_name: string;
  profile_image_url: string | null;
  broadcaster_type: string;
  status: ChannelStatus;
  status_reason: string | null;
  role: Role;
  bot: ChannelBotAccount | null;
  bot_online: boolean;
  live: ChannelLive | null;
  missing_scopes: string[];
  config_version: number;
  joined_at: string | null;
  /** Set while `status` is `reauth_required` (lost authorization): data is kept until `purge_after`. */
  reauth?: ChannelReauth | null;
}

/**
 * Why and since when a channel needs re-authorization, and when its data is deleted unless the
 * broadcaster reconnects first (7 days after access was lost).
 */
export interface ChannelReauth {
  reason: string | null;
  since: string | null;
  purge_after: string | null;
}

/** `GET /channels/:id/status` result (§10.6). `status` is absent when the bot is offline. */
export interface ChannelRuntimeStatus {
  live: boolean;
  bot_privileged: boolean;
  /** Spec §10.6 shape; the bot runtime may omit it (W1(b2) note), so treat as optional. */
  subscriptions?: { expected: number; enabled: number };
  missing_scopes: string[];
  chat_queue: number;
  modules: Record<string, 'ok' | 'disabled'>;
}

/** Feed envelope (§9.4) delivered by the dashboard long poll. */
export interface FeedEnvelope<D = Record<string, unknown>> {
  id: string;
  type: string;
  ts: string;
  data: D;
}

/** Props every dashboard section page receives from the shell. */
export interface SectionProps {
  channelId: string;
  channel: ChannelSummary;
  role: Role;
}

/**
 * One sidebar entry. A slice exports `sections: TwitchSection[]` from
 * `src/features/twitch/<slice>/section.tsx`; the registry discovers it.
 */
export interface TwitchSection {
  /** URL segment `^[a-z0-9-]+$`, unique across all slices. */
  id: string;
  label: string;
  group: SectionGroup;
  order: number;
  icon: LucideIcon;
  minRole: Role;
  /** Lazily imported page; `section.tsx` must not import page code eagerly. */
  component: LazyExoticComponent<ComponentType<SectionProps>>;
  /**
   * Optional one-sentence description of what the section does today. When
   * present, the `/twitch` landing page lists it, so the public feature list
   * only ever shows sections that are actually built (PRODUCT.md).
   */
  summary?: string;
}

/** One public page under `/t/:login/<id>`, exported from `<slice>/public.tsx`. */
export interface TwitchPublicPage {
  /** URL segment under `/t/:login/`; must match a name in `GET /public/:login` `pages`. */
  id: string;
  label: string;
  order: number;
  component: LazyExoticComponent<ComponentType<{ login: string }>>;
  /** Optional one-line description shown on the channel's public home. */
  summary?: string;
}

/** `GET /api/twitch-bot/public/:login` (§10.6). */
export interface PublicChannelResponse {
  success: true;
  channel: {
    login: string;
    display_name: string;
    profile_image_url: string | null;
    live: ChannelLive | null;
  };
  pages: string[];
}

/** `GET /api/twitch-bot/meta` (§10.6). */
export interface MetaLevel { value: number; name: string }
export interface MetaVariable {
  name: string;
  aliases: string[];
  arg_mode: 'none' | 'raw' | 'tokens' | 'lazy';
  usage: string;
  description: string;
  provider: string;
  contexts: string[];
}
export interface MetaDefaultCommand {
  key: string;
  trigger: string;
  module: string;
  level: number;
  global_cooldown_s: number;
  user_cooldown_s: number;
  cost: number;
  aliases: string[];
  usage: string;
  description: string;
  subcommand_levels?: Record<string, number>;
  availability?: string;
  response_template?: string | null;
}
export interface MetaResponse {
  success: true;
  levels: MetaLevel[];
  variables: MetaVariable[];
  /** Settings field path (e.g. `chat_alerts.follow.template`) → extra names. */
  context_variables: Record<string, string[]>;
  default_commands: MetaDefaultCommand[];
  sections: Array<{ name: string; write_role: Role }>;
  limits: Record<string, number>;
  widgets: string[];
}

/** `GET /channels/:id/settings/:section`. */
export interface SettingsSectionResponse<T> {
  success: true;
  section: string;
  value: T;
  config_version: number;
}

/** `PUT /channels/:id/settings/:section` and `.../reset`. */
export interface SettingsSaveResponse<T> {
  success: true;
  value: T;
  config_version: number;
  live_applied: boolean;
}

/** Cursor pagination (§10.4). */
export interface CursorPage<T> { items: T[]; next_before_id: number | null }
/** Offset pagination (§10.4). */
export interface OffsetPage<T> { items: T[]; total: number }
