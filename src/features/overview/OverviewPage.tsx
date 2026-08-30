import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowUpRight, BookOpen, Eye, Mail, MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useGuildStore } from '@/store/guild';
import { useOverviewStats } from './useOverviewStats';
import {
  LoadingSpinner,
  PremiumTierIcon,
  PREMIUM_TIER_LABELS as TIER_LABELS,
  normalizePremiumTier as normalizeTier,
} from '@/components/ui';
import { analyticsApi } from '@/api/analytics';
import { subscriptionsApi } from '@/api/subscriptions';
import { MemberFlowChart } from '@/features/analytics/charts';

const formatStat = (value: number | null | undefined) => value?.toLocaleString() ?? '—';

interface MetricProps {
  label: string;
  value: number | null | undefined;
  accent?: boolean;
}

const Metric: React.FC<MetricProps> = ({ label, value, accent = false }) => (
  <div className="overview-metric">
    <dt>{label}</dt>
    <dd className={accent ? 'is-positive' : undefined}>{formatStat(value)}</dd>
  </div>
);

export const OverviewPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentGuild } = useGuildStore();
  const {
    userStats,
    guildStats,
    isLoading,
    isFetching,
    error: statsError,
    refetch: refetchStats,
  } = useOverviewStats(guildId!, user?.id || '');

  const memberFlow = useQuery({
    queryKey: ['guild', guildId, 'member-flow', 30],
    queryFn: () => analyticsApi.guildMemberFlow(guildId!, 30),
    enabled: !!guildId,
  });

  const subscription = useQuery({
    queryKey: ['guild', guildId, 'subscription'],
    queryFn: () => subscriptionsApi.getGuildSubscription(guildId!),
    enabled: !!guildId,
    staleTime: 60_000,
    retry: false,
  });

  const tier = normalizeTier(subscription.data?.tier ?? currentGuild?.premium_tier);
  const subscriptionStatus = subscription.isLoading
    ? 'Checking subscription…'
    : subscription.isError
      ? 'Subscription status unavailable'
      : `Status: ${(subscription.data?.status ?? 'unknown').replace(/_/g, ' ')}`;
  const manageLabel = tier === 'free' ? 'Upgrade' : 'Manage';
  const memberName = user?.global_name || user?.username || 'Community member';

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="overview-page">
      <div className="page-header text-start mt-0">
        <h1>Server Overview</h1>
        <p>Your stats and server activity at a glance.</p>
      </div>

      {currentGuild && (
        <section className="overview-server-summary" aria-label="Current server and subscription">
          <div className="overview-server-summary__identity">
            {currentGuild.icon ? (
              <img
                className="overview-server-summary__avatar"
                src={`https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png`}
                alt=""
              />
            ) : (
              <span className="overview-server-summary__avatar" aria-hidden="true">
                {currentGuild.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="overview-server-summary__copy">
              <h2>{currentGuild.name}</h2>
              <p>{formatStat(guildStats?.member_count)} members</p>
            </div>
          </div>

          <div className="overview-server-summary__controls">
            <div className="overview-server-summary__plan">
              <PremiumTierIcon tier={tier} size={38} />
              <div>
                <strong>{TIER_LABELS[tier]}</strong>
                <span>{subscriptionStatus}</span>
              </div>
            </div>
            <div className="overview-server-summary__actions">
              <button type="button" className="btn" onClick={() => navigate(`/server/${guildId}`)}>
                <Eye aria-hidden="true" /> View member page
              </button>
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/server/${guildId}/billing`)}>
                {manageLabel}
              </button>
            </div>
          </div>
        </section>
      )}

      {statsError && (
        <div className="overview-inline-state is-error" role="alert">
          <AlertCircle aria-hidden="true" />
          <div>
            <strong>Some overview stats could not be loaded.</strong>
            <span>Check your connection, then try again.</span>
          </div>
          <button type="button" className="btn" disabled={isFetching} onClick={() => void refetchStats()}>
            {isFetching ? 'Retrying…' : 'Retry stats'}
          </button>
        </div>
      )}

      <section className="overview-section" aria-labelledby="personal-stats-title">
        <header className="overview-section__header">
          <h2 id="personal-stats-title">Your stats</h2>
          <p>Your current standing in this community.</p>
        </header>

        <div className="overview-personal">
          <div className="overview-personal__identity">
            {user?.avatar ? (
              <img className="overview-personal__avatar" src={user.avatar} alt="" />
            ) : (
              <span className="overview-personal__avatar" aria-hidden="true">
                {memberName.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <strong>{memberName}</strong>
              <span>Level {userStats?.level ?? 1} community member</span>
            </div>
          </div>

          <dl className="overview-metric-grid" aria-label="Personal statistics">
            <Metric label="Level" value={userStats?.level} />
            <Metric label="Acosmicoins" value={userStats?.currency} />
            <Metric label="Messages" value={userStats?.messages} />
            <Metric label="Total XP" value={userStats?.exp} />
          </dl>
        </div>
      </section>

      <section className="overview-section" aria-labelledby="server-activity-title">
        <header className="overview-section__header">
          <h2 id="server-activity-title">Server activity</h2>
          <p>Community totals and the last 30 days of member movement.</p>
        </header>

        <div className="overview-analytics">
          <dl className="overview-metric-grid overview-metric-grid--server" aria-label="Server statistics">
            <Metric label="Total members" value={guildStats?.member_count} />
            <Metric label="Active members" value={guildStats?.total_active_members} accent />
            <Metric label="Total messages" value={guildStats?.total_messages} />
            <Metric label="Total reactions" value={guildStats?.total_reactions} />
          </dl>

          <div className="overview-growth">
            <div className="overview-growth__header">
              <h3>Member growth</h3>
              {memberFlow.data?.totals && (
                <p>
                  Last 30 days:{' '}
                  <span className="is-positive">+{memberFlow.data.totals.joins}</span>{' / '}
                  <span className="is-negative">−{memberFlow.data.totals.departures}</span>{' '}
                  (net {memberFlow.data.totals.net >= 0 ? '+' : ''}{memberFlow.data.totals.net})
                </p>
              )}
            </div>

            {memberFlow.isLoading ? (
              <div className="overview-chart-state" role="status">Loading member growth…</div>
            ) : memberFlow.isError ? (
              <div className="overview-chart-state is-error" role="alert">
                <span>Member growth could not be loaded.</span>
                <button type="button" className="btn" onClick={() => void memberFlow.refetch()}>
                  Try again
                </button>
              </div>
            ) : (
              <div className="overview-flow-chart" tabIndex={0} aria-label="Scrollable 30-day member growth chart">
                <MemberFlowChart data={memberFlow.data?.flow ?? []} />
              </div>
            )}
          </div>
        </div>
      </section>

      <nav className="overview-links" aria-labelledby="overview-links-title">
        <div className="overview-section__header">
          <h2 id="overview-links-title">Resources</h2>
          <p>Documentation, updates, and direct support.</p>
        </div>
        <div className="overview-link-rail">
          <Link to="/docs" className="overview-link">
            <BookOpen aria-hidden="true" />
            <span><strong>Documentation</strong><small>Learn about features</small></span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <a href="https://discord.gg/hrj7WhCyEv" target="_blank" rel="noopener noreferrer" className="overview-link">
            <MessageCircle aria-hidden="true" />
            <span><strong>Support server</strong><small>Get help and updates</small></span>
            <ArrowUpRight aria-hidden="true" />
          </a>
          <a href="mailto:support@acosmibot.com" className="overview-link">
            <Mail aria-hidden="true" />
            <span><strong>Email support</strong><small>support@acosmibot.com</small></span>
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </nav>
    </div>
  );
};
