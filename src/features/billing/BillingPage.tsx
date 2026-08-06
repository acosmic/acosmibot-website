import React from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  ExternalLink,
  Gem,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { subscriptionsApi, type BillingInterval, type PremiumTier, type SubscriptionCatalogRow } from '@/api/subscriptions';
import { useGuildStore } from '@/store/guild';
import { trackEvent } from '@/lib/analytics';
import { LoadingSpinner } from '@/components/ui';
import { showToast } from '@/utils/toast';
import './BillingPage.css';

const TIER_LABELS: Record<PremiumTier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
};

type PaidTier = Exclude<PremiumTier, 'free'>;

const INTERVAL_SUFFIX: Record<BillingInterval, string> = {
  monthly: '/month',
  annual: '/year',
};

const INTERVAL_NOUN: Record<BillingInterval, string> = {
  monthly: 'month',
  annual: 'year',
};

const TIER_DESCRIPTIONS: Record<PremiumTier, string> = {
  free: 'Core community systems, starter limits, and basic AI chat.',
  plus: 'Higher automation limits with basic AI chat.',
  pro: 'Plus limits with AI tools, memory, and customization.',
  max: 'Higher AI limits for active AI servers.',
};

const formatCatalogPrice = (row: SubscriptionCatalogRow | undefined) => {
  if (!row) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: row.currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(row.unit_amount_cents / 100);
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

interface CancelSubscriptionDialogProps {
  guildName: string;
  tier: PaidTier;
  accessEnd: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const CancelSubscriptionDialog: React.FC<CancelSubscriptionDialogProps> = ({
  guildName,
  tier,
  accessEnd,
  isPending,
  onClose,
  onConfirm,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const keepButtonRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const onCloseRef = React.useRef(onClose);
  const isPendingRef = React.useRef(isPending);
  onCloseRef.current = onClose;
  isPendingRef.current = isPending;

  React.useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const billingPage = document.querySelector<HTMLElement>('.billing-page');
    const pageWasInert = billingPage?.hasAttribute('inert') ?? false;
    const previousOverflow = document.body.style.overflow;

    billingPage?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    keepButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPendingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (!pageWasInert) billingPage?.removeAttribute('inert');
      previousFocus?.focus();
    };
  }, []);

  const portalTarget = document.querySelector('.dashboard-shell') ?? document.body;

  return createPortal(
    <div
      className="billing-cancel-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="billing-cancel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <button
          type="button"
          className="billing-cancel-dialog__close"
          onClick={onClose}
          disabled={isPending}
          aria-label="Close cancellation confirmation"
        >
          <X aria-hidden="true" />
        </button>

        <div className="billing-cancel-dialog__heading">
          <div className="billing-cancel-dialog__icon" aria-hidden="true">
            <CalendarClock />
          </div>
          <div>
            <span>Subscription control</span>
            <h2 id={titleId}>Schedule cancellation?</h2>
          </div>
        </div>

        <p id={descriptionId} className="billing-cancel-dialog__copy">
          Your subscription will not end today. <strong>{guildName}</strong> keeps all{' '}
          {TIER_LABELS[tier]} features through <strong>{accessEnd}</strong>, then moves to Free.
        </p>

        <dl className="billing-cancel-dialog__facts">
          <div>
            <dt>Server</dt>
            <dd>{guildName}</dd>
          </div>
          <div>
            <dt>Current plan</dt>
            <dd>{TIER_LABELS[tier]}</dd>
          </div>
          <div>
            <dt>Access ends</dt>
            <dd>{accessEnd}</dd>
          </div>
        </dl>

        <p className="billing-cancel-dialog__notice">
          Billing stops after the current paid period. You can resume the subscription before
          that date through Stripe billing.
        </p>

        <div className="billing-cancel-dialog__actions">
          <button
            ref={keepButtonRef}
            type="button"
            className="btn billing-cancel-dialog__keep"
            onClick={onClose}
            disabled={isPending}
          >
            Keep subscription
          </button>
          <button
            type="button"
            className="btn billing-cancel-dialog__confirm"
            onClick={onConfirm}
            disabled={isPending}
            aria-busy={isPending}
          >
            <XCircle aria-hidden="true" />
            {isPending ? 'Scheduling…' : 'Schedule cancellation'}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
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

  const catalogQuery = useQuery({
    queryKey: ['subscription-catalog'],
    queryFn: () => subscriptionsApi.getCatalog(),
    staleTime: 300_000,
    retry: false,
  });
  const catalog = catalogQuery.data?.catalog ?? [];
  const catalogReady = catalog.length === 6;
  const priceFor = (interval: BillingInterval, tier: PremiumTier) => {
    if (tier === 'free') return '$0';
    return formatCatalogPrice(catalog.find((row) => row.tier === tier && row.cadence === interval));
  };

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
    mutationFn: ({ tier, interval }: { tier: PaidTier; interval: BillingInterval }) => {
      trackEvent('begin_checkout', { plan: tier, interval, currency: 'usd' });
      return subscriptionsApi.createCheckout({
        guild_id: guildId!,
        tier,
        interval,
        success_url: `${window.location.origin}/server/${guildId}/billing?success=true`,
        cancel_url: `${window.location.origin}/server/${guildId}/billing?canceled=true`,
      });
    },
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

  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false);

  const cancel = useMutation({
    mutationFn: () => subscriptionsApi.cancel({ guild_id: guildId!, immediately: false }),
    onSuccess: async (data) => {
      setShowCancelConfirm(false);
      showToast(data.message || 'Subscription cancellation scheduled.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'subscription'] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not cancel subscription.', 'error');
    },
  });

  const resume = useMutation({
    mutationFn: () => subscriptionsApi.resume({ guild_id: guildId! }),
    onSuccess: async (data) => {
      showToast(data.message || 'Subscription resumed.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'subscription'] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not resume subscription.', 'error');
    },
  });

  const [pendingPlan, setPendingPlan] = React.useState<{ tier: PaidTier; interval: BillingInterval } | null>(null);
  const [planIntervalOverride, setPlanIntervalOverride] = React.useState<BillingInterval | null>(null);

  const preview = useQuery({
    queryKey: ['guild', guildId, 'preview-change', pendingPlan?.tier, pendingPlan?.interval],
    queryFn: () => subscriptionsApi.previewChange({
      guild_id: guildId!,
      tier: pendingPlan!.tier,
      interval: pendingPlan!.interval,
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

  const status = subscription.data?.status ?? 'active';
  const record = subscription.data?.subscription ?? null;
  const effectiveTier = normalizeTier(subscription.data?.tier ?? currentGuild?.premium_tier);
  const recordTier = normalizeTier(record?.tier);
  const isPaymentRecovery = (
    ['past_due', 'unpaid', 'incomplete'].includes(status)
    && recordTier !== 'free'
    && Boolean(record?.stripe_subscription_id)
  );
  // The API correctly removes paid entitlements while payment is unresolved,
  // but the billing screen still needs to identify the subscription to recover.
  const tier = isPaymentRecovery ? recordTier : effectiveTier;
  const hasPaidTier = tier !== 'free';
  const canOpenPortal = hasPaidTier && Boolean(record?.stripe_subscription_id);
  const isCanceling = Boolean(record?.cancel_at_period_end || record?.cancel_at);
  const currentInterval: BillingInterval = record?.billing_interval === 'annual' ? 'annual' : 'monthly';
  const planInterval = planIntervalOverride ?? currentInterval;

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const TIER_RANK: Record<PremiumTier, number> = { free: 0, plus: 1, pro: 2, max: 3 };

  const handleChangeTier = (plan: PaidTier, interval: BillingInterval) => {
    if (!catalogReady) {
      showToast('Pricing is temporarily unavailable. Please try again shortly.', 'info');
      return;
    }
    // Free -> paid goes through Stripe Checkout, which is its own confirmation.
    // An existing paid subscription is modified in place with proration and no
    // checkout step, so confirm via modal before we trigger a billing change.
    if (hasPaidTier) {
      setPendingPlan({ tier: plan, interval });
      return;
    }
    changeTier.mutate({ tier: plan, interval });
  };

  const pendingIsUpgrade = pendingPlan ? TIER_RANK[pendingPlan.tier] > TIER_RANK[tier] : false;
  const pendingIsIntervalSwitch = pendingPlan ? pendingPlan.tier === tier : false;
  const pendingGoingForward = pendingPlan
    ? `${priceFor(pendingPlan.interval, pendingPlan.tier)} per ${INTERVAL_NOUN[pendingPlan.interval]} going forward`
    : '';
  const pendingProration = pendingPlan
    ? pendingIsIntervalSwitch
      ? `Stripe will apply a prorated adjustment for the billing switch today, then ${pendingGoingForward}.`
      : pendingIsUpgrade
        ? `Stripe will apply the prorated difference for the rest of this billing period today, then ${pendingGoingForward}.`
        : `You'll be credited the prorated difference to your account balance today, then billed ${pendingGoingForward}.`
    : '';

  const confirmPendingChange = () => {
    if (!pendingPlan) return;
    changeTier.mutate(pendingPlan, { onSettled: () => setPendingPlan(null) });
  };

  return (
    <div className="feature-page billing-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Billing</h1>
        <p>Manage this server's subscription.</p>
      </div>

      {isPaymentRecovery && (
        <section className="billing-recovery" role="alert" aria-live="polite">
          <div className="billing-recovery__icon" aria-hidden="true">
            <AlertTriangle />
          </div>
          <div className="billing-recovery__copy">
            <span>Payment action needed</span>
            <h2>Restore {TIER_LABELS[tier]} access</h2>
            <p>
              The latest renewal did not complete, so paid features are paused. Open Stripe
              billing to authenticate the payment or update the payment method. Access returns
              automatically after Stripe confirms payment.
            </p>
          </div>
          <button
            type="button"
            className="btn billing-recovery__action"
            disabled={!canOpenPortal || openPortal.isPending}
            onClick={() => openPortal.mutate()}
          >
            {openPortal.isPending ? 'Opening Stripe…' : 'Resolve in Stripe'}
            <ExternalLink aria-hidden="true" />
          </button>
        </section>
      )}

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
                <div className="fs-4 fw-bold text-primary">{priceFor(currentInterval, tier)}</div>
                <div className="small text-muted">per {hasPaidTier ? INTERVAL_NOUN[currentInterval] : 'month'}</div>
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
            <div className="d-flex justify-content-between align-items-center mb-4 gap-3 flex-wrap">
              <h3 className="mb-0">Plans</h3>
              <div
                style={{
                  display: 'inline-flex',
                  border: '1px solid var(--border-light)',
                  borderRadius: 8,
                  padding: 3,
                  background: 'var(--bg-primary)',
                }}
              >
                {(['monthly', 'annual'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPlanIntervalOverride(option)}
                    aria-pressed={planInterval === option}
                    style={{
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 10px',
                      minWidth: 64,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      color: planInterval === option ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      background: planInterval === option ? 'var(--primary-color)' : 'transparent',
                      textTransform: 'capitalize',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="row g-3">
              {(['plus', 'pro', 'max'] as const).map((plan) => {
                const isCurrent = tier === plan && (!hasPaidTier || currentInterval === planInterval);
                const isIntervalSwitch = hasPaidTier && tier === plan && currentInterval !== planInterval;
                const action = tier === 'free'
                  ? `Upgrade to ${TIER_LABELS[plan]}`
                  : isIntervalSwitch
                    ? `Switch to ${planInterval === 'annual' ? 'Annual' : 'Monthly'}`
                    : 'Change Plan';

                return (
                  <div className="col-md-6" key={plan}>
                    <div className="p-3 rounded bg-tertiary border border-light h-100 d-flex flex-column gap-3">
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-2">
                          {plan === 'pro' || plan === 'max' ? <Sparkles size={18} /> : <ShieldCheck size={18} />}
                          <div className="fw-bold">{TIER_LABELS[plan]}</div>
                        </div>
                        <div className="fs-4 fw-bold text-primary">
                          {priceFor(planInterval, plan)}
                          <span className="small text-muted fw-normal">{INTERVAL_SUFFIX[planInterval]}</span>
                        </div>
                        <div className="small text-muted">{TIER_DESCRIPTIONS[plan]}</div>
                      </div>
                      <button
                        type="button"
                        className="btn p-3 mt-auto"
                        disabled={!catalogReady || isCurrent || changeTier.isPending || isCanceling || isPaymentRecovery}
                        onClick={() => handleChangeTier(plan, planInterval)}
                      >
                        {!catalogReady ? 'Pricing unavailable' : isCurrent ? 'Current Plan' : changeTier.isPending ? 'Working...' : action}
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
                disabled={!canOpenPortal || openPortal.isPending}
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
                disabled={!canOpenPortal || openPortal.isPending}
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
              isCanceling ? (
                <button
                  type="button"
                  className="btn billing-resume-action text-start p-3 d-flex align-items-center gap-3 w-100"
                  disabled={resume.isPending}
                  onClick={() => resume.mutate()}
                >
                  <RefreshCw size={20} aria-hidden="true" />
                  <div>
                    <div className="fw-bold">
                      {resume.isPending ? 'Resuming…' : 'Resume Subscription'}
                    </div>
                    <div className="small">
                      Keep {TIER_LABELS[tier]} and renew on {formatDate(record?.cancel_at || record?.current_period_end)}
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn text-start p-3 d-flex align-items-center gap-3 w-100"
                  disabled={cancel.isPending}
                  onClick={handleCancel}
                >
                  <XCircle size={20} aria-hidden="true" />
                  <div>
                    <div className="fw-bold">Cancel Subscription</div>
                    <div className="small text-muted">Keep access through the paid period</div>
                  </div>
                </button>
              )
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
            position: 'fixed', inset: 0, background: 'var(--server-backdrop)', zIndex: 1050,
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
                {pendingIsIntervalSwitch
                  ? `Switch ${TIER_LABELS[tier]} to ${pendingPlan.interval} billing?`
                  : `${pendingIsUpgrade ? 'Upgrade' : 'Change'} ${TIER_LABELS[tier]} → ${TIER_LABELS[pendingPlan.tier]}?`}
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
                  {preview.data.is_charge
                    && typeof preview.data.account_credit_applied === 'number'
                    && preview.data.account_credit_applied > 0
                    && typeof preview.data.invoice_total === 'number' && (
                      <div className="small text-muted mt-1">
                        {formatMoney(preview.data.account_credit_applied, preview.data.currency)}
                        {' '}account credit applied to the{' '}
                        {formatMoney(preview.data.invoice_total, preview.data.currency)}
                        {' '}prorated total.
                      </div>
                    )}
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
                style={{ background: 'var(--primary-color)', color: 'var(--bg-primary)', border: 'none', fontWeight: 700 }}
                disabled={changeTier.isPending}
                onClick={confirmPendingChange}
              >
                {changeTier.isPending ? 'Working…' : `Confirm ${pendingIsUpgrade ? 'Upgrade' : 'Change'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && hasPaidTier && (
        <CancelSubscriptionDialog
          guildName={currentGuild?.name || 'Current server'}
          tier={tier}
          accessEnd={formatDate(record?.cancel_at || record?.current_period_end)}
          isPending={cancel.isPending}
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={() => cancel.mutate()}
        />
      )}
    </div>
  );
};
