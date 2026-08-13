import React from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CreditCard,
  ExternalLink,
  Info,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { aiCreditsApi, type CreditGuildPolicy, type CreditPack } from '@/api/aiCredits';
import { CreditCheckoutDialog } from '@/components/CreditCheckoutDialog';
import { Link } from 'react-router-dom';
import { subscriptionsApi, type BillingInterval, type PremiumTier, type SubscriptionCatalogRow } from '@/api/subscriptions';
import { useGuildStore } from '@/store/guild';
import { trackEvent } from '@/lib/analytics';
import {
  ChannelMultiSelect,
  ChannelSelect,
  LoadingSpinner,
  PremiumTierIcon,
  PREMIUM_TIER_LABELS as TIER_LABELS,
  RoleMultiSelect,
  normalizePremiumTier as normalizeTier,
} from '@/components/ui';
import { showToast } from '@/utils/toast';
import './BillingPage.css';

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

const GRANT_SOURCE_LABELS: Record<string, string> = {
  support_server: 'Support server',
  partner: 'Partner',
  promotion: 'Promotion',
  giveaway: 'Giveaway',
  internal: 'Internal',
  test: 'Test access',
};

const formatCatalogPrice = (row: SubscriptionCatalogRow | undefined) => {
  if (!row) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: row.currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(row.unit_amount_cents / 100);
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

const formatCredits = (value: number) => new Intl.NumberFormat('en-US').format(value);

const policyBoolean = (value: unknown, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return true;
};

const creditPolicyDefaults = (policy?: {
  server_pool_enabled: boolean;
  personal_fallback_allowed: boolean;
  allowed_operations: Record<string, boolean> | null;
  guild_daily_credit_cap: number;
  member_daily_credit_cap: number;
  maximum_credits_per_request: number;
  role_mode: CreditGuildPolicy['role_mode'];
  role_ids: string[] | null;
  channel_mode: CreditGuildPolicy['channel_mode'];
  channel_ids: string[] | null;
  low_balance_threshold: number;
  notifications_enabled: boolean;
  notification_channel_id: string | null;
  member_contributions_enabled: boolean;
  public_contribution_log_enabled: boolean;
}) => ({
  server_pool_enabled: policyBoolean(policy?.server_pool_enabled),
  personal_fallback_allowed: policyBoolean(policy?.personal_fallback_allowed),
  allowed_operations: {
    chat: policyBoolean(policy?.allowed_operations?.chat),
    tool_chat: policyBoolean(policy?.allowed_operations?.tool_chat),
    image_generation: policyBoolean(policy?.allowed_operations?.image_generation),
    image_analysis: policyBoolean(policy?.allowed_operations?.image_analysis),
  },
  guild_daily_credit_cap: policy?.guild_daily_credit_cap ?? 0,
  member_daily_credit_cap: policy?.member_daily_credit_cap ?? 0,
  maximum_credits_per_request: policy?.maximum_credits_per_request ?? 0,
  role_mode: policy?.role_mode ?? 'all',
  role_ids: policy?.role_ids ?? [],
  channel_mode: policy?.channel_mode ?? 'all',
  channel_ids: policy?.channel_ids ?? [],
  low_balance_threshold: policy?.low_balance_threshold ?? 0,
  notifications_enabled: policyBoolean(policy?.notifications_enabled),
  notification_channel_id: policy?.notification_channel_id ?? null,
  member_contributions_enabled: policyBoolean(policy?.member_contributions_enabled, true),
  public_contribution_log_enabled: policyBoolean(policy?.public_contribution_log_enabled, true),
});

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
            <dd className="billing-cancel-dialog__tier">
              <PremiumTierIcon tier={tier} size={22} />
              {TIER_LABELS[tier]}
            </dd>
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

const GuildAICreditsPanel: React.FC<{ guildId: string; guildName: string }> = ({ guildId, guildName }) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchase');
  const creditsQuery = useQuery({
    queryKey: ['guild', guildId, 'ai-credits'],
    queryFn: () => aiCreditsApi.getGuild(guildId),
    staleTime: 15_000,
    retry: false,
  });
  const catalogQuery = useQuery({
    queryKey: ['ai-credits', 'catalog'],
    queryFn: () => aiCreditsApi.getCatalog(),
    staleTime: 300_000,
    retry: false,
  });
  const ledgerQuery = useQuery({
    queryKey: ['guild', guildId, 'ai-credits', 'ledger'],
    queryFn: () => aiCreditsApi.getGuildLedger(guildId),
    staleTime: 15_000,
    retry: false,
  });
  const purchaseQuery = useQuery({
    queryKey: ['ai-credits', 'purchase', purchaseId],
    queryFn: () => aiCreditsApi.getPurchase(purchaseId!),
    enabled: Boolean(purchaseId),
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.purchase.status;
      return status === 'pending' || status === 'processing' || status === 'checkout_created' ? 2500 : false;
    },
  });
  const [policyDraft, setPolicyDraft] = React.useState(creditPolicyDefaults());
  const [selectedPack, setSelectedPack] = React.useState<CreditPack | null>(null);

  React.useEffect(() => {
    if (creditsQuery.data?.policy) setPolicyDraft(creditPolicyDefaults(creditsQuery.data.policy));
  }, [creditsQuery.data?.policy]);

  React.useEffect(() => {
    if (purchaseQuery.data?.purchase.status !== 'fulfilled') return;
    void queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'ai-credits'] });
    void queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'ai-credits', 'ledger'] });
  }, [guildId, purchaseQuery.data?.purchase.status, queryClient]);

  const policyMutation = useMutation({
    mutationFn: () => aiCreditsApi.updateGuildPolicy(guildId, {
      ...policyDraft,
      allowed_operations: policyDraft.allowed_operations,
      expected_version: creditsQuery.data?.policy.version,
    } as Parameters<typeof aiCreditsApi.updateGuildPolicy>[1] & { expected_version?: number }),
    onSuccess: async () => {
      showToast('Guild AI Credits policy saved.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'ai-credits'] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not save guild AI Credits policy.', 'error');
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (packSku: string) => aiCreditsApi.createCheckout({
      pack_sku: packSku,
      target_type: 'guild',
      guild_id: guildId,
      accepted_terms_version: catalogQuery.data?.catalog.terms_version ?? '',
    }),
    onSuccess: (result) => {
      window.location.assign(result.checkout_url);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not open guild AI Credits Checkout.', 'error');
    },
  });

  if (creditsQuery.isLoading) {
    return <section className="billing-ai-credits card p-4 mb-4"><LoadingSpinner /></section>;
  }

  if (creditsQuery.error || !creditsQuery.data) {
    return (
      <section className="billing-ai-credits card p-4 mb-4" aria-live="polite">
        <div className="billing-ai-credits__heading">
          <div><WalletCards aria-hidden="true" /><div><span>AI Credits</span><h3>Guild wallet unavailable</h3></div></div>
        </div>
        <p className="billing-ai-credits__muted">The wallet could not be read safely right now. Subscription billing remains available.</p>
      </section>
    );
  }

  const { wallet, policy, usage } = creditsQuery.data;
  const catalog = catalogQuery.data?.catalog;
  const salesEnabled = catalog?.sales_enabled ?? false;
  const ledger = ledgerQuery.data?.entries ?? [];
  const purchase = purchaseQuery.data?.purchase;
  const operationLabels: Record<string, string> = {
    chat: 'Chat',
    tool_chat: 'Tool chat',
    image_generation: 'Images',
    image_analysis: 'Vision',
  };

  return (
    <>
      <section className="billing-ai-credits card p-4 mb-4" aria-labelledby="billing-ai-credits-title">
      <div className="billing-ai-credits__heading">
        <div>
          <div className="billing-ai-credits__title"><WalletCards aria-hidden="true" /><span>Usage wallet</span></div>
          <h3 id="billing-ai-credits-title">AI Credits for {guildName}</h3>
          <p>Fund the guild pool for explicit AI requests after included quota.</p>
        </div>
        <Link to="/credits" className="billing-ai-credits__link">Personal wallet <ArrowRight aria-hidden="true" /></Link>
      </div>

      <div className="billing-ai-credits__stats">
        <div><span>Available</span><strong>{formatCredits(wallet.available_credits)}</strong><small>AI Credits</small></div>
        <div><span>Reserved</span><strong>{formatCredits(wallet.reserved_credits)}</strong><small>Active requests</small></div>
        <div><span>30-day spend</span><strong>{formatCredits(usage.total_credits || 0)}</strong><small>{usage.total_calls || 0} calls</small></div>
      </div>

      {purchase && (
        <div className={`billing-ai-credits__purchase-status is-${purchase.status}`} role="status" aria-live="polite">
          <div>
            <strong>{purchase.status === 'fulfilled' ? 'Guild credits are ready.' : `Checkout ${purchase.status.replace(/_/g, ' ')}.`}</strong>
            <span>{purchase.status === 'fulfilled' ? `${formatCredits(purchase.granted_credits)} credits were added to ${guildName}.` : 'This page will update while Stripe fulfillment completes.'}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('purchase');
              setSearchParams(next, { replace: true });
            }}
            aria-label="Dismiss checkout status"
          ><X aria-hidden="true" /></button>
        </div>
      )}

      <div className="billing-ai-credits__purchase">
        <div><strong>Add to guild wallet</strong><span>Only guild owners and administrators can purchase.</span></div>
        <div className="billing-ai-credits__packs">
          {(catalog?.packs ?? []).map((pack) => (
            <button
              type="button"
              className="billing-ai-credits__pack"
              key={pack.sku}
              disabled={!salesEnabled || checkoutMutation.isPending}
              onClick={() => setSelectedPack(pack)}
            >
              <span>{pack.name}</span>
              <strong>{formatMoney(pack.amount_cents, catalog?.currency)} · {formatCredits(pack.credits)}</strong>
            </button>
          ))}
        </div>
      </div>
      {!salesEnabled && <p className="billing-ai-credits__notice"><Info aria-hidden="true" /> Sales are paused until the Stripe catalog passes readiness checks.</p>}

      <div className="billing-ai-credits__policy">
        <div className="billing-ai-credits__policy-heading">
          <div><strong>Guild spending policy</strong><span>Included quota is always evaluated first. These switches control paid fallback.</span></div>
          <ShieldCheck aria-hidden="true" />
        </div>
        <div className="billing-ai-credits__switches">
          <label><input type="checkbox" role="switch" checked={policyDraft.server_pool_enabled} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, server_pool_enabled: event.target.checked }))} /><span>Enable server pool</span></label>
          <label><input type="checkbox" role="switch" checked={policyDraft.personal_fallback_allowed} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, personal_fallback_allowed: event.target.checked }))} /><span>Allow member personal fallback</span></label>
        </div>
        <div className="billing-ai-credits__switches">
          <label><input type="checkbox" role="switch" checked={policyDraft.member_contributions_enabled} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, member_contributions_enabled: event.target.checked }))} /><span>Allow member Fuel Cell contributions</span></label>
          <label><input type="checkbox" role="switch" checked={policyDraft.public_contribution_log_enabled} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, public_contribution_log_enabled: event.target.checked }))} /><span>Show the public Server Boost Log</span></label>
        </div>
        <div className="billing-ai-credits__operations" aria-label="Allowed paid operations">
          {Object.entries(policyDraft.allowed_operations).map(([operation, enabled]) => (
            <label key={operation}><input type="checkbox" checked={enabled} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, allowed_operations: { ...draft.allowed_operations, [operation]: event.target.checked } }))} /><span>{operationLabels[operation] ?? operation}</span></label>
          ))}
        </div>
        <div className="billing-ai-credits__caps">
          <label><span>Guild daily cap</span><input type="number" min="0" max="10000000" value={policyDraft.guild_daily_credit_cap} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, guild_daily_credit_cap: Math.max(0, Number(event.target.value) || 0) }))} /></label>
          <label><span>Member daily cap</span><input type="number" min="0" max="10000000" value={policyDraft.member_daily_credit_cap} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, member_daily_credit_cap: Math.max(0, Number(event.target.value) || 0) }))} /></label>
          <label><span>Max per request</span><input type="number" min="0" max="10000000" value={policyDraft.maximum_credits_per_request} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, maximum_credits_per_request: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        </div>
        <div className="billing-ai-credits__scope-grid">
          <div>
            <label className="billing-ai-credits__field-label" htmlFor="credit-role-mode">Role access</label>
            <select id="credit-role-mode" className="form-control" value={policyDraft.role_mode} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, role_mode: event.target.value as CreditGuildPolicy['role_mode'] }))}>
              <option value="all">All roles</option>
              <option value="allow">Only selected roles</option>
              <option value="deny">All except selected roles</option>
            </select>
            {policyDraft.role_mode !== 'all' && (
              <RoleMultiSelect guildId={guildId} label="Selected roles" value={policyDraft.role_ids} onChange={(role_ids) => setPolicyDraft((draft) => ({ ...draft, role_ids }))} />
            )}
          </div>
          <div>
            <label className="billing-ai-credits__field-label" htmlFor="credit-channel-mode">Channel access</label>
            <select id="credit-channel-mode" className="form-control" value={policyDraft.channel_mode} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, channel_mode: event.target.value as CreditGuildPolicy['channel_mode'] }))}>
              <option value="all">All allowed AI channels</option>
              <option value="allow">Only selected channels</option>
              <option value="deny">All except selected channels</option>
            </select>
            {policyDraft.channel_mode !== 'all' && (
              <ChannelMultiSelect guildId={guildId} label="Selected channels" value={policyDraft.channel_ids} onChange={(channel_ids) => setPolicyDraft((draft) => ({ ...draft, channel_ids }))} maxSelections={100} />
            )}
          </div>
        </div>
        <div className="billing-ai-credits__notifications">
          <label><input type="checkbox" role="switch" checked={policyDraft.notifications_enabled} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, notifications_enabled: event.target.checked }))} /><span>Low-balance alerts</span></label>
          <label><span>Alert below</span><input type="number" min="0" max="10000000" value={policyDraft.low_balance_threshold} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, low_balance_threshold: Math.max(0, Number(event.target.value) || 0) }))} /></label>
          {policyDraft.notifications_enabled && (
            <ChannelSelect guildId={guildId} label="Notification channel" value={policyDraft.notification_channel_id} onChange={(notification_channel_id) => setPolicyDraft((draft) => ({ ...draft, notification_channel_id }))} placeholder="Choose an alert channel" />
          )}
        </div>
        <button type="button" className="btn billing-ai-credits__save" disabled={policyMutation.isPending} onClick={() => policyMutation.mutate()}>
          {policyMutation.isPending ? 'Saving…' : 'Save paid-overage policy'}
          {!policyMutation.isPending && <Check aria-hidden="true" />}
        </button>
        <small className="billing-ai-credits__version">Policy version {policy.version} · mode {wallet.stripe_mode}</small>
      </div>
      <div className="billing-ai-credits__ledger">
        <div className="billing-ai-credits__ledger-heading"><strong>Recent wallet activity</strong><span>Charges and reservations never expose member personal-wallet details.</span></div>
        {ledgerQuery.isLoading ? <LoadingSpinner /> : ledgerQuery.error ? (
          <p className="billing-ai-credits__muted">Wallet history could not be loaded. Refresh to try again.</p>
        ) : ledger.length === 0 ? (
          <p className="billing-ai-credits__muted">No guild wallet activity yet.</p>
        ) : (
          <div className="billing-ai-credits__ledger-list">
            {ledger.slice(0, 8).map((entry) => (
              <div key={entry.id}>
                <span>{entry.direction.replace(/_/g, ' ')}</span>
                <strong>{entry.available_delta + entry.reserved_delta > 0 ? '+' : ''}{formatCredits(entry.available_delta + entry.reserved_delta)}</strong>
                <small>{formatDate(entry.created_at)}</small>
              </div>
            ))}
          </div>
        )}
      </div>
      </section>
      {selectedPack && (
        <CreditCheckoutDialog
          pack={selectedPack}
          currency={catalog?.currency ?? 'usd'}
          targetLabel={guildName}
          targetType="guild"
          termsVersion={catalog?.terms_version ?? ''}
          isPending={checkoutMutation.isPending}
          onClose={() => setSelectedPack(null)}
          onConfirm={() => checkoutMutation.mutate(selectedPack.sku)}
        />
      )}
    </>
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
  const launchPromotion = catalogQuery.data?.launch_promotion;
  const launchPromotionActive = Boolean(
    launchPromotion?.active && launchPromotion.eligible_cadences.includes('monthly'),
  );
  const catalogReady = catalog.length === 6;
  const priceFor = (interval: BillingInterval, tier: PremiumTier) => {
    if (tier === 'free') return '$0';
    return formatCatalogPrice(catalog.find((row) => row.tier === tier && row.cadence === interval));
  };
  const launchPriceFor = (tier: PaidTier) => {
    const amount = launchPromotion?.discounted_monthly_amounts_cents[tier];
    const currency = catalog.find((row) => row.tier === tier && row.cadence === 'monthly')?.currency;
    return amount === undefined ? null : formatMoney(amount, currency);
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

  const cancelScheduledChange = useMutation({
    mutationFn: () => subscriptionsApi.cancelScheduledChange({ guild_id: guildId! }),
    onSuccess: async (data) => {
      showToast(data.message || 'Scheduled plan change canceled.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['guild', guildId, 'subscription'] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not cancel the scheduled change.', 'error');
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
  const entitlement = subscription.data?.entitlement;
  const isComplimentary = Boolean(entitlement?.complimentary);
  const effectiveTier = normalizeTier(subscription.data?.tier ?? currentGuild?.premium_tier);
  const recordTier = normalizeTier(record?.tier);
  const stripeStatus = record?.status ?? status;
  const isPaymentRecovery = (
    ['past_due', 'unpaid', 'incomplete'].includes(stripeStatus)
    && recordTier !== 'free'
    && Boolean(record?.stripe_subscription_id)
  );
  // The API correctly removes paid entitlements while payment is unresolved,
  // but the billing screen still needs to identify the subscription to recover.
  const tier = isPaymentRecovery && !isComplimentary ? recordTier : effectiveTier;
  const hasPaidTier = tier !== 'free';
  const hasStripeSubscription = recordTier !== 'free' && Boolean(record?.stripe_subscription_id);
  const canOpenPortal = hasStripeSubscription;
  const isCanceling = Boolean(record?.cancel_at_period_end || record?.cancel_at);
  const hasPendingPlanChange = Boolean(record?.pending_tier && record?.pending_change_at);
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
      ? `Your current billing cadence and AI allowance continue through renewal. Then ${pendingGoingForward}.`
      : pendingIsUpgrade
        ? `Stripe will apply the prorated difference for the rest of this billing period today, then ${pendingGoingForward}.`
        : `Your current plan and AI allowance continue through renewal. Then ${pendingGoingForward}. Unused included quota has no cash value.`
    : '';

  const confirmPendingChange = () => {
    if (!pendingPlan) return;
    changeTier.mutate(pendingPlan, { onSettled: () => setPendingPlan(null) });
  };

  return (
    <div className="feature-page billing-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Billing</h1>
        <p>{isComplimentary ? 'Review this server’s complimentary access.' : 'Manage this server’s subscription.'}</p>
      </div>

      {isPaymentRecovery && (
        <section className="billing-recovery" role="alert" aria-live="polite">
          <div className="billing-recovery__icon" aria-hidden="true">
            <AlertTriangle />
          </div>
          <div className="billing-recovery__copy">
            <span>Payment action needed</span>
            <h2>{isComplimentary ? `Fix the separate ${TIER_LABELS[recordTier]} subscription` : `Restore ${TIER_LABELS[tier]} access`}</h2>
            <p>
              {isComplimentary
                ? `Complimentary ${TIER_LABELS[tier]} access remains active, but the separate Stripe renewal did not complete. Open Stripe billing to authenticate the payment, update the payment method, or cancel that subscription.`
                : 'The latest renewal did not complete, so paid features are paused. Open Stripe billing to authenticate the payment or update the payment method. Access returns automatically after Stripe confirms payment.'}
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
          {guildId && <GuildAICreditsPanel guildId={guildId} guildName={currentGuild?.name || 'this server'} />}
          <div className="card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
              <div>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <PremiumTierIcon tier={tier} size={34} />
                  <h3 className="mb-0">{isComplimentary ? `Complimentary ${TIER_LABELS[tier]}` : TIER_LABELS[tier]}</h3>
                </div>
                <p className="text-muted mb-0">{TIER_DESCRIPTIONS[tier]}</p>
              </div>
              <div className="text-end">
                <div className="fs-4 fw-bold text-primary">{isComplimentary ? 'Granted access' : priceFor(currentInterval, tier)}</div>
                <div className="small text-muted">{isComplimentary ? 'No Stripe renewal' : `per ${hasPaidTier ? INTERVAL_NOUN[currentInterval] : 'month'}`}</div>
              </div>
            </div>

            <div className="row g-3 mt-4">
              <div className="col-sm-4">
                <div className="p-3 rounded bg-tertiary border border-light">
                  <div className="small text-muted">Status</div>
                  <div className="fw-bold text-capitalize">{isComplimentary ? 'Complimentary' : status.replace(/_/g, ' ')}</div>
                </div>
              </div>
              <div className="col-sm-4">
                <div className="p-3 rounded bg-tertiary border border-light">
                  <div className="small text-muted">{isComplimentary ? (entitlement?.permanent ? 'Access' : 'Access Ends') : isCanceling ? 'Access Ends' : 'Renews'}</div>
                  <div className="fw-bold">{isComplimentary ? (entitlement?.permanent ? 'Permanent' : formatDate(entitlement?.expires_at)) : formatDate(record?.cancel_at || record?.current_period_end)}</div>
                </div>
              </div>
              <div className="col-sm-4">
                <div className="p-3 rounded bg-tertiary border border-light">
                  <div className="small text-muted">Server</div>
                  <div className="fw-bold">{currentGuild?.name || 'Current server'}</div>
                </div>
              </div>
            </div>
            {isComplimentary && (
              <div className="billing-complimentary mt-3" role="status">
                <ShieldCheck size={19} aria-hidden="true" />
                <div>
                  <strong>{GRANT_SOURCE_LABELS[entitlement?.grant_source ?? ''] ?? 'Complimentary access'}</strong>
                  <span>
                    This access is managed by Acosmibot and does not renew through Stripe.
                    {entitlement?.permanent ? ' It has no expiration date.' : ` It ends ${formatDate(entitlement?.expires_at)}.`}
                  </span>
                </div>
              </div>
            )}
            {hasPendingPlanChange && !isComplimentary && (
              <div className="billing-pending-change mt-3" role="status">
                <CalendarClock size={18} aria-hidden="true" />
                <div>
                  <strong>
                    {TIER_LABELS[normalizeTier(record?.pending_tier)]}
                    {' · '}
                    {record?.pending_billing_interval === 'annual' ? 'Annual' : 'Monthly'}
                  </strong>
                  <span>
                    Scheduled for {formatDate(record?.pending_change_at)}. Your current plan and
                    allowance remain active until then.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={cancelScheduledChange.isPending}
                  onClick={() => cancelScheduledChange.mutate()}
                >
                  {cancelScheduledChange.isPending ? 'Canceling…' : 'Keep current plan'}
                </button>
              </div>
            )}
          </div>

          {!isComplimentary && <div className="card p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-4 gap-3 flex-wrap">
              <div>
                <h3 className="mb-0">Plans</h3>
                {tier === 'free' && launchPromotionActive && (
                  <p className="billing-launch-offer mb-0 mt-1">
                    <Sparkles aria-hidden="true" />
                    <span>
                      <strong>{launchPromotion?.percent_off}% off</strong> the first{' '}
                      {launchPromotion?.duration_in_months} monthly payments. Applied automatically.
                    </span>
                  </p>
                )}
              </div>
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
                const launchPrice = tier === 'free' && planInterval === 'monthly' && launchPromotionActive
                  ? launchPriceFor(plan)
                  : null;
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
                          <PremiumTierIcon tier={plan} size={32} />
                          <div className="fw-bold">{TIER_LABELS[plan]}</div>
                        </div>
                        <div className="fs-4 fw-bold text-primary">
                          {launchPrice ?? priceFor(planInterval, plan)}
                          <span className="small text-muted fw-normal">{INTERVAL_SUFFIX[planInterval]}</span>
                        </div>
                        {launchPrice && (
                          <div className="billing-plan-launch-copy">
                            First {launchPromotion?.duration_in_months} months, then{' '}
                            {priceFor('monthly', plan)}/month
                          </div>
                        )}
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
          </div>}
        </div>

        <div className="col-lg-4">
          {hasStripeSubscription && <div className="card p-4 mb-4">
            <h3 className="mb-4">Payment</h3>
            {isComplimentary && (
              <p className="small text-muted mt-n2 mb-3">
                These controls belong to the separate {TIER_LABELS[recordTier]} Stripe subscription.
              </p>
            )}
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
          </div>}

          <div className="card p-4 mb-4">
            <h3 className="mb-4">Subscription</h3>
            {hasStripeSubscription ? (
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
                      Keep {TIER_LABELS[recordTier]} and renew on {formatDate(record?.cancel_at || record?.current_period_end)}
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
                    <div className="small text-muted">
                      {isComplimentary
                        ? `Cancel the separate ${TIER_LABELS[recordTier]} Stripe plan`
                        : 'Keep access through the paid period'}
                    </div>
                  </div>
                </button>
              )
            ) : isComplimentary ? (
              <div className="billing-complimentary-summary">
                <ShieldCheck size={20} aria-hidden="true" />
                <p className="mb-0">Complimentary access has no Stripe subscription to manage.</p>
              </div>
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
              <PremiumTierIcon tier={pendingPlan.tier} size={32} />
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
              {!preview.isLoading && preview.data?.change_kind === 'scheduled' && (
                <>
                  <div className="small text-muted">Effective at renewal</div>
                  <div className="fs-5 fw-bold text-primary">
                    {formatDate(preview.data.effective_at || record?.current_period_end)}
                  </div>
                  <div className="small text-muted mt-1">
                    No charge or credit today. Included quota does not carry cash value.
                  </div>
                </>
              )}
              {!preview.isLoading && preview.data?.change_kind !== 'scheduled' && preview.data?.success && typeof preview.data.net_amount === 'number' && (
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
              {!preview.isLoading && preview.data?.change_kind !== 'scheduled' && !(preview.data?.success && typeof preview.data?.net_amount === 'number') && (
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
                {changeTier.isPending
                  ? 'Working…'
                  : pendingIsUpgrade
                    ? 'Confirm Upgrade'
                    : 'Schedule Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && hasStripeSubscription && (
        <CancelSubscriptionDialog
          guildName={currentGuild?.name || 'Current server'}
          tier={recordTier as PaidTier}
          accessEnd={formatDate(record?.cancel_at || record?.current_period_end)}
          isPending={cancel.isPending}
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={() => cancel.mutate()}
        />
      )}
    </div>
  );
};
