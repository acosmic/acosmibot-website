import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { CreditCard, ExternalLink, Gem, Receipt, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { subscriptionsApi, type PremiumTier } from '@/api/subscriptions';
import { useGuildStore } from '@/store/guild';
import { LoadingSpinner } from '@/components/ui';
import { showToast } from '@/utils/toast';

const TIER_LABELS: Record<PremiumTier, string> = {
  free: 'Free',
  premium: 'Premium',
  premium_plus_ai: 'Premium + AI',
};

const TIER_PRICES: Record<PremiumTier, string> = {
  free: '$0',
  premium: '$4.99',
  premium_plus_ai: '$14.99',
};

const TIER_DESCRIPTIONS: Record<PremiumTier, string> = {
  free: 'Core community systems and starter limits.',
  premium: 'Higher limits for active community automation.',
  premium_plus_ai: 'Premium limits plus Acosmibot AI features.',
};

const normalizeTier = (tier: unknown): PremiumTier => {
  if (tier === 'premium' || tier === 'premium_plus_ai') return tier;
  return 'free';
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const BillingPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentGuild } = useGuildStore();

  const subscription = useQuery({
    queryKey: ['guild', guildId, 'subscription'],
    queryFn: () => subscriptionsApi.getGuildSubscription(guildId!),
    enabled: !!guildId,
    staleTime: 30_000,
    retry: false,
  });

  const openPortal = useMutation({
    mutationFn: () => subscriptionsApi.openPortal({
      guild_id: guildId!,
      return_url: window.location.href,
    }),
    onSuccess: (data) => {
      window.location.href = data.portal_url;
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Billing portal is unavailable.', 'error');
    },
  });

  const changeTier = useMutation({
    mutationFn: (tier: Exclude<PremiumTier, 'free'>) => subscriptionsApi.createCheckout({
      guild_id: guildId!,
      tier,
      success_url: `${window.location.origin}/server/${guildId}/billing?success=true`,
      cancel_url: `${window.location.origin}/server/${guildId}/billing?canceled=true`,
    }),
    onSuccess: async (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      showToast(data.message || 'Subscription updated.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'subscription'] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not update subscription.', 'error');
    },
  });

  const cancel = useMutation({
    mutationFn: () => subscriptionsApi.cancel({ guild_id: guildId!, immediately: false }),
    onSuccess: async (data) => {
      showToast(data.message || 'Subscription cancellation scheduled.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'subscription'] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not cancel subscription.', 'error');
    },
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      showToast('Subscription updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'subscription'] });
      navigate(`/server/${guildId}/billing`, { replace: true });
    }
    if (params.get('canceled') === 'true') {
      showToast('Checkout canceled.', 'info');
      navigate(`/server/${guildId}/billing`, { replace: true });
    }
  }, [guildId, navigate, queryClient]);

  if (subscription.isLoading) return <LoadingSpinner />;

  const tier = normalizeTier(subscription.data?.tier ?? currentGuild?.premium_tier);
  const status = subscription.data?.status ?? 'active';
  const record = subscription.data?.subscription ?? null;
  const hasPaidTier = tier !== 'free';
  const isCanceling = Boolean(record?.cancel_at_period_end || record?.cancel_at);

  const handleCancel = () => {
    if (!window.confirm('Cancel this subscription at the end of the current billing period?')) return;
    cancel.mutate();
  };

  return (
    <div>
      <div className="page-header text-start mt-0 mb-4">
        <h1>Billing</h1>
        <p>Manage this server's subscription.</p>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
              <div>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Gem size={20} />
                  <h3 className="mb-0">{TIER_LABELS[tier]}</h3>
                </div>
                <p className="text-muted mb-0">{TIER_DESCRIPTIONS[tier]}</p>
              </div>
              <div className="text-end">
                <div className="fs-4 fw-bold text-primary">{TIER_PRICES[tier]}</div>
                <div className="small text-muted">per month</div>
              </div>
            </div>

            <div className="row g-3 mt-4">
              <div className="col-sm-4">
                <div className="p-3 rounded bg-tertiary border border-light">
                  <div className="small text-muted">Status</div>
                  <div className="fw-bold text-capitalize">{status.replace(/_/g, ' ')}</div>
                </div>
              </div>
              <div className="col-sm-4">
                <div className="p-3 rounded bg-tertiary border border-light">
                  <div className="small text-muted">{isCanceling ? 'Access Ends' : 'Renews'}</div>
                  <div className="fw-bold">{formatDate(record?.cancel_at || record?.current_period_end)}</div>
                </div>
              </div>
              <div className="col-sm-4">
                <div className="p-3 rounded bg-tertiary border border-light">
                  <div className="small text-muted">Server</div>
                  <div className="fw-bold">{currentGuild?.name || 'Current server'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 mb-4">
            <h3 className="mb-4">Plans</h3>
            <div className="row g-3">
              {(['premium', 'premium_plus_ai'] as const).map((plan) => {
                const isCurrent = tier === plan;
                const action = tier === 'free'
                  ? `Upgrade to ${TIER_LABELS[plan]}`
                  : plan === 'premium_plus_ai'
                    ? 'Upgrade'
                    : 'Downgrade';

                return (
                  <div className="col-md-6" key={plan}>
                    <div className="p-3 rounded bg-tertiary border border-light h-100 d-flex flex-column gap-3">
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-2">
                          {plan === 'premium_plus_ai' ? <Sparkles size={18} /> : <ShieldCheck size={18} />}
                          <div className="fw-bold">{TIER_LABELS[plan]}</div>
                        </div>
                        <div className="fs-4 fw-bold text-primary">{TIER_PRICES[plan]}</div>
                        <div className="small text-muted">{TIER_DESCRIPTIONS[plan]}</div>
                      </div>
                      <button
                        type="button"
                        className="btn p-3 mt-auto"
                        disabled={isCurrent || changeTier.isPending || isCanceling}
                        onClick={() => changeTier.mutate(plan)}
                      >
                        {isCurrent ? 'Current Plan' : changeTier.isPending ? 'Working...' : action}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card p-4 mb-4">
            <h3 className="mb-4">Payment</h3>
            <div className="d-grid gap-2">
              <button
                type="button"
                className="btn text-start p-3 d-flex align-items-center gap-3"
                disabled={!hasPaidTier || openPortal.isPending}
                onClick={() => openPortal.mutate()}
              >
                <CreditCard size={20} />
                <div>
                  <div className="fw-bold">Payment Method</div>
                  <div className="small text-muted">Open Stripe billing</div>
                </div>
                <ExternalLink size={16} className="ms-auto" />
              </button>
              <button
                type="button"
                className="btn text-start p-3 d-flex align-items-center gap-3"
                disabled={!hasPaidTier || openPortal.isPending}
                onClick={() => openPortal.mutate()}
              >
                <Receipt size={20} />
                <div>
                  <div className="fw-bold">Invoices</div>
                  <div className="small text-muted">View receipts</div>
                </div>
                <ExternalLink size={16} className="ms-auto" />
              </button>
            </div>
          </div>

          <div className="card p-4 mb-4">
            <h3 className="mb-4">Subscription</h3>
            {hasPaidTier ? (
              <button
                type="button"
                className="btn text-start p-3 d-flex align-items-center gap-3 w-100"
                disabled={cancel.isPending || isCanceling}
                onClick={handleCancel}
              >
                <XCircle size={20} />
                <div>
                  <div className="fw-bold">{isCanceling ? 'Cancellation Scheduled' : 'Cancel Subscription'}</div>
                  <div className="small text-muted">Keep access through the paid period</div>
                </div>
              </button>
            ) : (
              <p className="text-muted mb-0">This server is on the Free plan.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
