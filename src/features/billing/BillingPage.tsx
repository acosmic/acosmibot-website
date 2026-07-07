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
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
};

const TIER_PRICES: Record<PremiumTier, string> = {
  free: '$0',
  plus: '$4.99',
  pro: '$9.99',
  max: '$19.99',
};

const TIER_DESCRIPTIONS: Record<PremiumTier, string> = {
  free: 'Core community systems, starter limits, and basic AI chat.',
  plus: 'Higher automation limits with basic AI chat.',
  pro: 'Plus limits with AI tools, memory, and customization.',
  max: 'Higher AI limits for active AI servers.',
};

const normalizeTier = (tier: unknown): PremiumTier => {
  if (tier === 'premium') return 'plus';
  if (tier === 'premium_plus_ai') return 'pro';
  if (tier === 'plus' || tier === 'pro' || tier === 'max') return tier;
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

const formatMoney = (amountInCents: number, currency?: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
  }).format(amountInCents / 100);

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
      interval: 'monthly',
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

  const [pendingPlan, setPendingPlan] = React.useState<Exclude<PremiumTier, 'free'> | null>(null);

  const preview = useQuery({
    queryKey: ['guild', guildId, 'preview-change', pendingPlan],
    queryFn: () => subscriptionsApi.previewChange({
      guild_id: guildId!,
      tier: pendingPlan!,
      interval: 'monthly',
    }),
    enabled: Boolean(pendingPlan && guildId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
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

  const TIER_RANK: Record<PremiumTier, number> = { free: 0, plus: 1, pro: 2, max: 3 };

  const handleChangeTier = (plan: Exclude<PremiumTier, 'free'>) => {
    // Free -> paid goes through Stripe Checkout, which is its own confirmation.
    // An existing paid subscription is modified in place with proration and no
    // checkout step, so confirm via modal before we trigger a billing change.
    if (hasPaidTier) {
      setPendingPlan(plan);
      return;
    }
    changeTier.mutate(plan);
  };

  const pendingIsUpgrade = pendingPlan ? TIER_RANK[pendingPlan] > TIER_RANK[tier] : false;
  const pendingProration = pendingPlan
    ? pendingIsUpgrade
      ? `Your card will be charged the prorated difference for the rest of this billing period today, then ${TIER_PRICES[pendingPlan]}/month going forward.`
      : `You'll be credited the prorated difference to your account balance today, then billed ${TIER_PRICES[pendingPlan]}/month going forward.`
    : '';

  const confirmPendingChange = () => {
    if (!pendingPlan) return;
    changeTier.mutate(pendingPlan, { onSettled: () => setPendingPlan(null) });
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
              {(['plus', 'pro', 'max'] as const).map((plan) => {
                const isCurrent = tier === plan;
                const action = tier === 'free'
                  ? `Upgrade to ${TIER_LABELS[plan]}`
                  : 'Change Plan';

                return (
                  <div className="col-md-6" key={plan}>
                    <div className="p-3 rounded bg-tertiary border border-light h-100 d-flex flex-column gap-3">
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-2">
                          {plan === 'pro' || plan === 'max' ? <Sparkles size={18} /> : <ShieldCheck size={18} />}
                          <div className="fw-bold">{TIER_LABELS[plan]}</div>
                        </div>
                        <div className="fs-4 fw-bold text-primary">{TIER_PRICES[plan]}</div>
                        <div className="small text-muted">{TIER_DESCRIPTIONS[plan]}</div>
                      </div>
                      <button
                        type="button"
                        className="btn p-3 mt-auto"
                        disabled={isCurrent || changeTier.isPending || isCanceling}
                        onClick={() => handleChangeTier(plan)}
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

      {pendingPlan && (
        <div
          onClick={() => !changeTier.isPending && setPendingPlan(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1050,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', borderRadius: '16px',
              padding: '24px', maxWidth: '460px', width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div className="d-flex align-items-center gap-2 mb-3">
              {pendingIsUpgrade ? <Sparkles size={20} /> : <Gem size={20} />}
              <h3 className="mb-0" style={{ fontSize: '18px', fontWeight: 800 }}>
                {pendingIsUpgrade ? 'Upgrade' : 'Change'} {TIER_LABELS[tier]} → {TIER_LABELS[pendingPlan]}?
              </h3>
            </div>
            <p className="text-muted mb-3">{pendingProration}</p>
            <div
              className="p-3 rounded bg-tertiary border border-light mb-4"
              style={{ minHeight: '58px' }}
            >
              {preview.isLoading && (
                <div className="text-muted small">Calculating your prorated amount…</div>
              )}
              {!preview.isLoading && preview.data?.success && typeof preview.data.net_amount === 'number' && (
                <>
                  <div className="small text-muted">
                    {preview.data.is_charge ? 'Charged today' : 'Credited to your balance today'}
                  </div>
                  <div className="fs-4 fw-bold text-primary">
                    {preview.data.is_charge ? '' : '−'}
                    {formatMoney(preview.data.net_amount, preview.data.currency)}
                  </div>
                </>
              )}
              {!preview.isLoading && !(preview.data?.success && typeof preview.data?.net_amount === 'number') && (
                <div className="small text-muted">
                  Exact prorated amount will be calculated by Stripe when you confirm.
                </div>
              )}
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn p-3"
                disabled={changeTier.isPending}
                onClick={() => setPendingPlan(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn p-3"
                style={{ background: 'var(--primary-color)', color: '#000', border: 'none', fontWeight: 700 }}
                disabled={changeTier.isPending}
                onClick={confirmPendingChange}
              >
                {changeTier.isPending ? 'Working…' : `Confirm ${pendingIsUpgrade ? 'Upgrade' : 'Change'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
