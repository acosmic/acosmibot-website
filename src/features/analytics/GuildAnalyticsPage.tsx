/**
 * THESIS: Analytics is a weekly operating brief, not a wall of disconnected rankings.
 * OWN-WORLD: One graphite ledger, cyan range controls, ranked signal rows, and literal health states.
 * STORY: Choose a window, understand community movement, then decide exactly what Discord should recap.
 * FIRST VIEWPORT: Plus entitlement and range sit above a configurable recap workflow, followed by one activity pulse.
 * FORM: Local extension of the established Server Control Matrix; operational ledger composition.
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  Clock3,
  Command,
  Link2,
  MessageCircleHeart,
  MessagesSquare,
  RadioTower,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { analyticsApi } from '@/api/analytics';
import type { TopReaction } from '@/api/profile';
import {
  ChannelSelect,
  FeatureToggle,
  LoadingSpinner,
  SaveBar,
  TimezoneSelect,
} from '@/components/ui';
import { detectBrowserTimezone } from '@/components/ui/TimezoneSelect';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useGuildStore } from '@/store/guild';
import { useRecapConfig, type RecapConfig } from './useRecapConfig';
import { getGuildTier, hasGuildAnalyticsAccess } from './entitlement';
import { MemberFlowChart } from './charts';

const RANGE_OPTIONS = [7, 30, 90] as const;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const RECAP_SECTIONS: ReadonlyArray<{
  key: keyof RecapConfig['sections'];
  label: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    key: 'commands',
    label: 'Top commands',
    description: 'The slash commands members used most.',
    Icon: Command,
  },
  {
    key: 'reactions',
    label: 'Reactions given',
    description: 'The emoji reactions members clicked most.',
    Icon: MessageCircleHeart,
  },
  {
    key: 'channels',
    label: 'Active channels',
    description: 'The busiest public conversation spaces.',
    Icon: MessagesSquare,
  },
  {
    key: 'members',
    label: 'Member growth',
    description: 'Joins, departures, and net community growth.',
    Icon: UsersRound,
  },
  {
    key: 'ai',
    label: 'AI activity',
    description: 'Public feature counts—never models, tokens, or spend.',
    Icon: Bot,
  },
  {
    key: 'social_embeds',
    label: 'Better Social Embeds',
    description: 'Successfully enhanced links and their networks.',
    Icon: Link2,
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X / Twitter',
  bluesky: 'Bluesky',
  tiktok: 'TikTok',
  reddit: 'Reddit',
};

const titleCase = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString()}`;

const formatScheduleTime = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value;
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2026, 0, 1, hour, minute));
};

/** Custom Discord emoji from the CDN, or the unicode character directly. */
export const EmojiBadge: React.FC<{ reaction: TopReaction; size?: number }> = ({ reaction, size = 20 }) => {
  if (reaction.emoji_id) {
    const extension = reaction.animated ? 'gif' : 'png';
    return (
      <img
        className="analytics-emoji"
        src={`https://cdn.discordapp.com/emojis/${reaction.emoji_id}.${extension}?size=32`}
        alt={reaction.emoji_display}
        title={`:${reaction.emoji_display}:`}
        style={{ width: size, height: size }}
      />
    );
  }
  return <span className="analytics-emoji analytics-emoji--unicode">{reaction.emoji_display}</span>;
};

const AnalyticsPanel: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, children, className = '' }) => (
  <section className={`analytics-panel ${className}`.trim()}>
    <header className="analytics-panel__header">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
    <div className="analytics-panel__body">{children}</div>
  </section>
);

const EmptySignal: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="analytics-empty">{children}</p>
);

const AnalyticsUpgrade: React.FC<{ guildId: string; tier: string }> = ({ guildId, tier }) => (
  <section className="analytics-upgrade" aria-labelledby="analytics-upgrade-title">
    <div className="analytics-upgrade__signal" aria-hidden="true">
      <BarChart3 />
      <span>PLUS</span>
    </div>
    <div className="analytics-upgrade__content">
      <div className="analytics-upgrade__heading">
        <div>
          <span className="analytics-upgrade__kicker">Community intelligence</span>
          <h2 id="analytics-upgrade-title">Turn server activity into a weekly operating brief.</h2>
        </div>
        <span className="analytics-upgrade__tier">{titleCase(tier)} plan</span>
      </div>
      <p>
        Plus unlocks the full analytics workspace and scheduled Discord recaps. Aggregate history
        continues collecting while access is paused, so an upgrade starts with real server context.
      </p>
      <ul className="analytics-upgrade__features" aria-label="Plus analytics features">
        <li><CalendarDays aria-hidden="true" /><span><strong>7, 30, and 90-day views</strong> across activity and growth</span></li>
        <li><Clock3 aria-hidden="true" /><span><strong>Local recap scheduling</strong> with day, time, and timezone controls</span></li>
        <li><Link2 aria-hidden="true" /><span><strong>Better Social Embeds reporting</strong> by network and delivery health</span></li>
        <li><ShieldCheck aria-hidden="true" /><span><strong>Privacy-safe AI counts</strong> without model, token, or spend telemetry</span></li>
      </ul>
      <Link to={`/pricing?guild=${guildId}`} className="btn primary">
        View Plus plans <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  </section>
);

export const GuildAnalyticsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const guild = useGuildStore((state) => state.guilds.find((item) => item.id === guildId));
  const tier = getGuildTier(guild);
  const hasAnalyticsAccess = hasGuildAnalyticsAccess(tier);
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);

  const commands = useQuery({
    queryKey: ['guild-analytics-commands', guildId, days],
    queryFn: () => analyticsApi.guildCommands(guildId!, days),
    enabled: !!guildId && hasAnalyticsAccess,
  });
  const reactions = useQuery({
    queryKey: ['guild-analytics-reactions', guildId, days],
    queryFn: () => analyticsApi.guildReactions(guildId!, days),
    enabled: !!guildId && hasAnalyticsAccess,
  });
  const aiUsage = useQuery({
    queryKey: ['guild-analytics-ai', guildId, days],
    queryFn: () => analyticsApi.guildAiUsage(guildId!, days),
    enabled: !!guildId && hasAnalyticsAccess,
  });
  const channels = useQuery({
    queryKey: ['guild-analytics-channels', guildId, days],
    queryFn: () => analyticsApi.guildChannels(guildId!, days),
    enabled: !!guildId && hasAnalyticsAccess,
  });
  const memberFlow = useQuery({
    queryKey: ['guild-analytics-member-flow', guildId, days],
    queryFn: () => analyticsApi.guildMemberFlow(guildId!, days),
    enabled: !!guildId && hasAnalyticsAccess,
  });
  const betterEmbeds = useQuery({
    queryKey: ['guild-analytics-better-embeds', guildId, days],
    queryFn: () => analyticsApi.guildBetterEmbeds(guildId!, days),
    enabled: !!guildId && hasAnalyticsAccess,
  });

  const {
    recap,
    isLoading: isRecapLoading,
    loadError: recapLoadError,
    refetch: refetchRecap,
    save: saveRecap,
    isSaving,
    saveError,
  } = useRecapConfig(guildId!, hasAnalyticsAccess);
  const {
    form: recapForm,
    setForm: setRecapForm,
    isDirty: recapDirty,
    resetForm: resetRecapForm,
  } = useDirtyState<RecapConfig>(recap);

  const topCommands = commands.data?.top_commands ?? [];
  const neverUsed = commands.data?.never_used ?? [];
  const topReactions = reactions.data?.top_reactions ?? [];
  const aiByType = Object.entries(aiUsage.data?.stats_by_type ?? {})
    .sort((left, right) => right[1].count - left[1].count);
  const aiTopUsers = aiUsage.data?.top_users ?? [];
  const channelList = channels.data?.channels ?? [];
  const memberTotals = memberFlow.data?.totals;
  const socialTotals = betterEmbeds.data?.totals;
  const socialPlatforms = (betterEmbeds.data?.platforms ?? [])
    .filter((item) => item.detected > 0 || item.replaced > 0)
    .sort((left, right) => right.replaced - left.replaced);

  const messageTotal = channelList.reduce((total, channel) => total + channel.count, 0);
  const aiTotal = aiByType.reduce((total, [, stat]) => total + stat.count, 0);

  if (!guildId) return null;

  if (!guild || tier === null) {
    return <div className="analytics-loading" role="status"><LoadingSpinner /><span>Loading server access…</span></div>;
  }

  if (!hasAnalyticsAccess) {
    return (
      <div className="feature-page analytics-page">
        <div className="page-header text-start mt-0 mb-4">
          <h1>Server Analytics</h1>
          <p>See what members use, where activity grows, and what deserves attention next.</p>
        </div>
        <AnalyticsUpgrade guildId={guildId} tier={tier} />
      </div>
    );
  }

  const isLoading = [commands, reactions, aiUsage, channels, memberFlow, betterEmbeds]
    .some((query) => query.isLoading) || isRecapLoading;
  const hasLoadError = [commands, reactions, aiUsage, channels, memberFlow, betterEmbeds]
    .some((query) => query.isError) || Boolean(recapLoadError);
  const retryLoads = () => {
    commands.refetch();
    reactions.refetch();
    aiUsage.refetch();
    channels.refetch();
    memberFlow.refetch();
    betterEmbeds.refetch();
    refetchRecap();
  };
  const selectedRecapSections = recapForm
    ? Object.values(recapForm.sections).filter(Boolean).length
    : 0;
  const recapValidation = recapForm?.enabled && !recapForm.channel_id
    ? 'Choose the Discord channel that should receive the recap.'
    : recapForm?.enabled && selectedRecapSections === 0
      ? 'Choose at least one section to include in the recap.'
      : undefined;

  const setRecapSection = (key: keyof RecapConfig['sections'], enabled: boolean) => {
    if (!recapForm) return;
    setRecapForm({
      sections: {
        ...recapForm.sections,
        [key]: enabled,
      },
    });
  };

  return (
    <div className="feature-page analytics-page">
      <div className="analytics-page-header">
        <div className="page-header text-start mt-0 mb-0">
          <div className="analytics-page-header__label"><RadioTower aria-hidden="true" /> Plus analytics</div>
          <h1>Server Analytics</h1>
          <p>See what members use, where activity grows, and what deserves attention next.</p>
        </div>
        <div className="analytics-range" role="group" aria-label="Analytics date range">
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              className={days === range ? 'is-active' : ''}
              onClick={() => setDays(range)}
            >
              {range} days
            </button>
          ))}
        </div>
      </div>

      {recapForm && (
        <section className="analytics-recap" aria-labelledby="weekly-recap-heading">
          <FeatureToggle
            enabled={recapForm.enabled}
            onChange={(enabled) => setRecapForm({ enabled })}
            label="Weekly Recap"
            description="Post the server signals you choose on a schedule that fits your community."
          />

          {recapForm.enabled && (
            <div className="analytics-recap__ledger">
              <section className="analytics-recap__delivery" aria-labelledby="recap-delivery-heading">
                <header>
                  <span><CalendarDays aria-hidden="true" /></span>
                  <div>
                    <h2 id="recap-delivery-heading">Delivery</h2>
                    <p>Choose where and when the seven-day recap arrives.</p>
                  </div>
                </header>
                <div className="analytics-recap__delivery-grid">
                  <ChannelSelect
                    guildId={guildId}
                    value={recapForm.channel_id}
                    onChange={(channelId) => setRecapForm({ channel_id: channelId })}
                    label="Recap channel"
                    placeholder="Select a channel…"
                  />
                  <div className="form-group">
                    <label className="form-label" htmlFor="recap-weekday">Day</label>
                    <select
                      id="recap-weekday"
                      className="form-control"
                      value={recapForm.weekday}
                      onChange={(event) => setRecapForm({ weekday: Number(event.target.value) })}
                    >
                      {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="recap-time">Time</label>
                    <input
                      id="recap-time"
                      className="form-control"
                      type="time"
                      value={recapForm.post_time}
                      onChange={(event) => setRecapForm({ post_time: event.target.value })}
                    />
                  </div>
                  <div className="form-group analytics-recap__timezone">
                    <div className="analytics-recap__field-heading">
                      <label className="form-label" htmlFor="recap-timezone">Timezone</label>
                      <button
                        type="button"
                        onClick={() => setRecapForm({ timezone: detectBrowserTimezone() })}
                      >
                        Use mine
                      </button>
                    </div>
                    <TimezoneSelect
                      id="recap-timezone"
                      value={recapForm.timezone}
                      onChange={(timezone) => setRecapForm({ timezone })}
                    />
                  </div>
                </div>
                <p className="analytics-recap__schedule-summary">
                  <Clock3 aria-hidden="true" /> Every {WEEKDAYS[recapForm.weekday]} at{' '}
                  {formatScheduleTime(recapForm.post_time)} in {recapForm.timezone.replace(/_/g, ' ')}.
                </p>
              </section>

              <fieldset className="analytics-recap__sections">
                <legend>Include in recap</legend>
                <p>Sections with no activity that week stay out automatically.</p>
                <div className="analytics-recap__section-grid">
                  {RECAP_SECTIONS.map(({ key, label, description, Icon }) => (
                    <label
                      key={key}
                      className={`analytics-recap-option${recapForm.sections[key] ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={recapForm.sections[key]}
                        onChange={(event) => setRecapSection(key, event.target.checked)}
                      />
                      <span className="analytics-recap-option__icon" aria-hidden="true"><Icon /></span>
                      <span>
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </span>
                      <span className="analytics-recap-option__state" aria-hidden="true">
                        {recapForm.sections[key] ? 'Included' : 'Off'}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </section>
      )}

      {hasLoadError && (
        <div className="analytics-load-error" role="alert">
          <span>Some analytics or recap settings could not be loaded.</span>
          <button type="button" className="btn" onClick={retryLoads}>Retry</button>
        </div>
      )}

      {isLoading ? (
        <div className="analytics-loading" role="status">
          <LoadingSpinner />
          <span>Reading the last {days} days…</span>
        </div>
      ) : (
        <>
          <dl className="analytics-pulse" aria-label={`Server activity over the last ${days} days`}>
            <div><dt>Messages</dt><dd>{messageTotal.toLocaleString()}</dd><dd className="analytics-pulse__note">across tracked channels</dd></div>
            <div><dt>Member growth</dt><dd className={(memberTotals?.net ?? 0) < 0 ? 'is-negative' : 'is-positive'}>{formatSigned(memberTotals?.net ?? 0)}</dd><dd className="analytics-pulse__note">{memberTotals?.joins ?? 0} joined · {memberTotals?.departures ?? 0} departed</dd></div>
            <div><dt>AI actions</dt><dd>{aiTotal.toLocaleString()}</dd><dd className="analytics-pulse__note">public feature activity</dd></div>
            <div><dt>Links enhanced</dt><dd>{(socialTotals?.links_replaced ?? 0).toLocaleString()}</dd><dd className="analytics-pulse__note">{socialTotals?.replacements_posted ?? 0} replacement posts</dd></div>
          </dl>

          <div className="analytics-grid">
            <AnalyticsPanel title="Most-used commands" description={`Ranked over the last ${days} days.`}>
              {topCommands.length === 0 ? <EmptySignal>No command usage recorded in this range.</EmptySignal> : (
                <ol className="analytics-ranking">
                  {topCommands.map((command, index) => (
                    <li key={command.name}>
                      <span className="analytics-ranking__position">{index + 1}</span>
                      <strong>/{command.name}</strong>
                      <span>{command.count.toLocaleString()} uses{command.users ? ` · ${command.users.toLocaleString()} members` : ''}</span>
                    </li>
                  ))}
                </ol>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel title="Top reactions given" description={`Emoji members clicked over the last ${days} days.`}>
              {topReactions.length === 0 ? <EmptySignal>No reactions recorded in this range.</EmptySignal> : (
                <ol className="analytics-ranking analytics-ranking--reactions">
                  {topReactions.map((reaction, index) => (
                    <li key={reaction.emoji_key}>
                      <span className="analytics-ranking__position">{index + 1}</span>
                      <strong><EmojiBadge reaction={reaction} /></strong>
                      <span>{reaction.count.toLocaleString()} reactions</span>
                    </li>
                  ))}
                </ol>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Active channels"
              description={`Message volume across the last ${days} days.`}
              className="analytics-panel--wide"
            >
              {channelList.length === 0 ? <EmptySignal>No channel activity recorded in this range.</EmptySignal> : (
                <ol className="analytics-ranking analytics-ranking--channels">
                  {channelList.slice(0, 15).map((channel, index) => (
                    <li key={channel.channel_id}>
                      <span className="analytics-ranking__position">{index + 1}</span>
                      <strong>#{channel.name}</strong>
                      <span>{channel.count.toLocaleString()} messages</span>
                    </li>
                  ))}
                </ol>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Member movement"
              description={`${memberTotals?.joins ?? 0} joined, ${memberTotals?.departures ?? 0} departed; net ${formatSigned(memberTotals?.net ?? 0)}.`}
              className="analytics-panel--wide"
            >
              <div className="analytics-flow" tabIndex={0} aria-label={`Scrollable ${days}-day member movement chart`}>
                <MemberFlowChart data={memberFlow.data?.flow ?? []} />
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel title="AI activity" description="User-facing actions only; owner cost telemetry stays private.">
              {aiByType.length === 0 ? <EmptySignal>No AI activity recorded in this range.</EmptySignal> : (
                <>
                  <dl className="analytics-breakdown">
                    {aiByType.map(([type, stat]) => (
                      <div key={type}><dt>{titleCase(type)}</dt><dd>{stat.count.toLocaleString()}</dd></div>
                    ))}
                  </dl>
                  {aiTopUsers.length > 0 && (
                    <div className="analytics-subsection">
                      <h3>Top AI members</h3>
                      <ol className="analytics-ranking analytics-ranking--compact">
                        {aiTopUsers.map((user, index) => (
                          <li key={user.user_id}>
                            <span className="analytics-ranking__position">{index + 1}</span>
                            <strong>{user.username}</strong>
                            <span>{user.total_usage.toLocaleString()} actions</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel
              title="Better Social Embeds"
              description={betterEmbeds.data?.tracking_started_at
                ? `Forward-only tracking since ${new Date(`${betterEmbeds.data.tracking_started_at}T00:00:00`).toLocaleDateString()}.`
                : 'Forward-only tracking begins with the first eligible social link.'}
            >
              {!socialTotals || socialTotals.eligible_messages === 0 ? (
                <EmptySignal>No eligible social links recorded in this range.</EmptySignal>
              ) : (
                <>
                  <dl className="analytics-social-health">
                    <div><dt>Completion</dt><dd>{Math.round(socialTotals.completion_rate * 100)}%</dd></div>
                    <div><dt>Permission blocks</dt><dd>{socialTotals.blocked_permissions.toLocaleString()}</dd></div>
                    <div><dt>Failed deliveries</dt><dd>{socialTotals.failed_transactions.toLocaleString()}</dd></div>
                  </dl>
                  <div className="analytics-subsection">
                    <h3>Links by network</h3>
                    <ol className="analytics-ranking analytics-ranking--compact">
                      {socialPlatforms.map((platform, index) => (
                        <li key={platform.platform}>
                          <span className="analytics-ranking__position">{index + 1}</span>
                          <strong>{PLATFORM_LABELS[platform.platform] ?? titleCase(platform.platform)}</strong>
                          <span>{platform.replaced.toLocaleString()} enhanced</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </AnalyticsPanel>

            {neverUsed.length > 0 && (
              <AnalyticsPanel
                title="Untapped commands"
                description="Commands this server has never used—candidates to introduce next."
                className="analytics-panel--wide"
              >
                <div className="analytics-command-cloud">
                  {neverUsed.map((name) => <span key={name}>/{name}</span>)}
                </div>
              </AnalyticsPanel>
            )}
          </div>
        </>
      )}

      <SaveBar
        isDirty={recapDirty}
        onSave={() => recapForm && saveRecap(recapForm)}
        onDiscard={resetRecapForm}
        isSaving={isSaving}
        saveError={saveError}
        saveDisabled={Boolean(recapValidation)}
        validationMessage={recapValidation}
        dirtyTitle="Unsaved weekly recap changes"
        dirtyDescription="Save the schedule and section selection for this server."
        successMessage="Weekly recap settings saved"
      />
    </div>
  );
};
