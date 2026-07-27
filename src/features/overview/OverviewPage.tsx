import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useGuildStore } from '@/store/guild';
import { useOverviewStats } from './useOverviewStats';
import { LoadingSpinner } from '@/components/ui';
import { analyticsApi } from '@/api/analytics';
import { subscriptionsApi, type PremiumTier } from '@/api/subscriptions';
import { MemberFlowChart } from '@/features/analytics/charts';

const TIER_LABELS: Record<PremiumTier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
};

const normalizeTier = (tier: unknown): PremiumTier => {
  if (tier === 'premium') return 'plus';
  if (tier === 'premium_plus_ai') return 'pro';
  if (tier === 'plus' || tier === 'pro' || tier === 'max') return tier;
  return 'free';
};

export const OverviewPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentGuild } = useGuildStore();
  const { userStats, guildStats, isLoading } = useOverviewStats(guildId!, user?.id || '');

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
  const status = subscription.data?.status ?? 'active';
  const manageLabel = tier === 'free' ? 'Upgrade' : 'Manage';

  const handleManageSubscription = () => {
    navigate(`/server/${guildId}/billing`);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="overview-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Server Overview</h1>
        <p>Your stats and server activity at a glance.</p>
      </div>

      <div className="row">
        <div className="col-12">
          {currentGuild && (
            <div className="card p-4 mb-4 d-flex flex-row align-items-center justify-content-between gap-3 flex-wrap">
              <div className="d-flex flex-row align-items-center gap-3">
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundImage: currentGuild.icon
                    ? `url(https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.png)`
                    : 'none',
                  backgroundSize: 'cover',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: 'var(--text-primary)',
                  flexShrink: 0,
                }}>
                  {!currentGuild.icon && currentGuild.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="fw-bold fs-6">{currentGuild.name}</div>
                  <div className="small text-muted">{guildStats?.member_count?.toLocaleString() ?? '-'} members</div>
                </div>
              </div>

              <div className="d-flex flex-row align-items-center gap-3 flex-wrap">
                <div className="text-end">
                  <div className="fw-bold fs-6">{TIER_LABELS[tier]}</div>
                  <div className="small text-muted">
                    {subscription.isLoading ? 'Checking subscription…' : `Status: ${status.replace(/_/g, ' ')}`}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn p-3"
                  onClick={handleManageSubscription}
                >
                  {manageLabel}
                </button>
              </div>
            </div>
          )}

          <section className="mb-5">
            <h3 className="mb-4">Your Stats</h3>
            <div className="card p-4">
              <div className="d-flex align-items-center gap-4 mb-4">
                <div 
                  className="user-avatar-large" 
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    backgroundImage: user?.avatar ? `url(${user.avatar})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: 'var(--bg-tertiary)'
                  }}
                />
                <div>
                  <h2 className="mb-1">{user?.global_name || user?.username}</h2>
                  <p className="text-muted mb-0">Level {userStats?.level || 1} Community Member</p>
                </div>
              </div>

              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <div className="p-3 rounded bg-tertiary text-center border border-light">
                    <div className="fs-4 fw-bold text-primary">{userStats?.level || '-'}</div>
                    <div className="small text-muted">Level</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 rounded bg-tertiary text-center border border-light">
                    <div className="fs-4 fw-bold text-primary">{userStats?.currency?.toLocaleString() || '-'}</div>
                    <div className="small text-muted">Credits</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 rounded bg-tertiary text-center border border-light">
                    <div className="fs-4 fw-bold text-primary">{userStats?.messages?.toLocaleString() || '-'}</div>
                    <div className="small text-muted">Messages</div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="p-3 rounded bg-tertiary text-center border border-light">
                    <div className="fs-4 fw-bold text-primary">{userStats?.exp?.toLocaleString() || '-'}</div>
                    <div className="small text-muted">Total XP</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5">
            <h3 className="mb-4">Server Activity</h3>
            <div className="card p-4">
              <div className="row g-4">
                <div className="col-md-6">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Total Members</span>
                    <span className="fw-bold">{guildStats?.member_count?.toLocaleString() || '-'}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Active Members</span>
                    <span className="fw-bold text-success">{guildStats?.total_active_members?.toLocaleString() || '-'}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Total Messages</span>
                    <span className="fw-bold">{guildStats?.total_messages?.toLocaleString() || '-'}</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Total Reactions</span>
                    <span className="fw-bold">{guildStats?.total_reactions?.toLocaleString() || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5">
            <div className="d-flex justify-content-between align-items-baseline mb-4">
              <h3 className="mb-0">Member Growth</h3>
              {memberFlow.data?.totals && (
                <span className="small text-muted">
                  Last 30 days:{' '}
                  <span className="text-success">+{memberFlow.data.totals.joins}</span>{' / '}
                  <span style={{ color: 'var(--error-color)' }}>−{memberFlow.data.totals.departures}</span>{' '}
                  (net {memberFlow.data.totals.net >= 0 ? '+' : ''}{memberFlow.data.totals.net})
                </span>
              )}
            </div>
            <div className="card p-4">
              {memberFlow.isLoading ? (
                <span className="text-muted">Loading…</span>
              ) : (
                <MemberFlowChart data={memberFlow.data?.flow ?? []} />
              )}
            </div>
          </section>

          <div className="card p-4 mb-4">
            <h3 className="mb-4">Quick Links</h3>
            <div className="d-grid gap-2">
              <a href="/docs" className="btn text-start p-3 d-flex align-items-center gap-3">
                <BookOpen size={20} />
                <div>
                  <div className="fw-bold">Documentation</div>
                  <div className="small text-muted">Learn about features</div>
                </div>
              </a>
              <a href="https://discord.gg/hrj7WhCyEv" target="_blank" className="btn text-start p-3 d-flex align-items-center gap-3">
                <MessageCircle size={20} />
                <div>
                  <div className="fw-bold">Support Server</div>
                  <div className="small text-muted">Get help & updates</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
