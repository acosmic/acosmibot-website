/**
 * THESIS: AI Credits are a controlled wallet, so the page leads with spendable balance and consent—not a generic pricing grid.
 * OWN-WORLD: Observatory void, graphite ledger surfaces, cyan wallet signals, and restrained warning/success states.
 * STORY: See what is available, choose a prepaid pack, set personal guardrails, and verify fulfillment in one place.
 * FIRST VIEWPORT: A wallet readout occupies the left rail while the right side presents the three server-owned packs and their action.
 * FORM: Wallet-first operational dashboard extension of the established observatory; no new visual world or route-local shell.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ExternalLink,
  History,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { aiCreditsApi, type CreditPack, type CreditUserPolicy } from '@/api/aiCredits';
import { guildApi } from '@/api/guilds';
import { PublicNav } from '@/components/layout/PublicNav';
import { CreditCheckoutDialog } from '@/components/CreditCheckoutDialog';
import { LoadingSpinner } from '@/components/ui';
import { showToast } from '@/utils/toast';
import '@/styles/ai-credits.css';

const formatCredits = (value: number) => new Intl.NumberFormat('en-US').format(value);

const formatMoney = (cents: number, currency = 'usd') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency.toUpperCase(),
}).format(cents / 100);

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const statusLabel = (status: string) => status.replace(/_/g, ' ');
const purchaseAwaitingFulfillment = (status?: string) => (
  ['pending', 'checkout_created', 'processing', 'paid'].includes(status ?? '')
);

const purchaseTerminalTitle = (status: string) => {
  switch (status) {
    case 'failed': return 'Payment could not be completed.';
    case 'expired': return 'Checkout expired.';
    case 'partially_refunded': return 'Purchase partially refunded.';
    case 'refunded': return 'Purchase refunded.';
    case 'disputed': return 'Payment disputed.';
    default: return `Purchase status: ${statusLabel(status)}.`;
  }
};

const policyBoolean = (value: unknown, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return true;
};

const policyDefaults = (policy?: CreditUserPolicy) => ({
  allow_dm_spending: policyBoolean(policy?.allow_dm_spending),
  allow_guild_spending: policyBoolean(policy?.allow_guild_spending),
  personal_daily_credit_cap: policy?.personal_daily_credit_cap ?? 0,
  personal_monthly_credit_cap: policy?.personal_monthly_credit_cap ?? 0,
  low_balance_threshold: policy?.low_balance_threshold ?? 0,
  low_balance_notifications: policyBoolean(policy?.low_balance_notifications),
});

const CreditPackCard: React.FC<{
  pack: CreditPack;
  currency: string;
  salesEnabled: boolean;
  pending: boolean;
  onPurchase: () => void;
}> = ({ pack, currency, salesEnabled, pending, onPurchase }) => (
  <article className={`credits-pack credits-pack--${pack.sku}${pack.sku === 'fuel_cell_10k' ? ' is-featured' : ''}`}>
    {pack.sku === 'fuel_cell_10k' && <span className="credits-pack__signal">Most balanced</span>}
    {pack.sku === 'fuel_cell_25k' && <span className="credits-pack__signal">Best value</span>}
    <div className="credits-pack__header">
      <div>
        <span className="credits-pack__name">{pack.name}</span>
        <p>{pack.description}</p>
      </div>
      <div className="credits-pack__price">
        {pack.discount_percent > 0 && (
          <span className="credits-pack__list-price">{formatMoney(pack.list_amount_cents, currency)}</span>
        )}
        <strong>{formatMoney(pack.amount_cents, currency)}</strong>
        <span>{pack.discount_percent > 0 ? `save ${pack.discount_percent}%` : 'one time'}</span>
      </div>
    </div>
    <div className="credits-pack__amount">
      <CircleDollarSign aria-hidden="true" />
      <strong>{formatCredits(pack.credits)}</strong>
      <span>AI Credits</span>
    </div>
    <div className="credits-pack__footer">
      <span>
        {formatMoney(pack.amount_cents / (pack.credits / 1000), currency)} per 1,000
        {pack.discount_percent > 0 && <strong> · {pack.discount_percent}% pack savings</strong>}
      </span>
      <button
        type="button"
        className="credits-button credits-button--primary"
        disabled={!salesEnabled || pending}
        onClick={onPurchase}
      >
        {pending ? 'Opening checkout…' : salesEnabled ? 'Buy pack' : 'Sales paused'}
        {!pending && <ArrowRight aria-hidden="true" />}
      </button>
    </div>
  </article>
);

const PolicySwitch: React.FC<{
  id?: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  attentionMessage?: string;
}> = ({ id, label, description, checked, onChange, attentionMessage }) => (
  <label className={`credits-policy-switch${checked ? ' is-enabled' : ''}${attentionMessage ? ' needs-attention' : ''}`}>
    <span>
      <strong>{label}</strong>
      <small>{description}</small>
      {attentionMessage && (
        <span className="credits-policy-switch__attention" id={id ? `${id}-attention` : undefined}>
          <AlertTriangle aria-hidden="true" /> {attentionMessage}
        </span>
      )}
    </span>
    <input
      id={id}
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
      aria-describedby={attentionMessage && id ? `${id}-attention` : undefined}
    />
  </label>
);

export const AICreditsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const purchaseId = searchParams.get('purchase');
  const canceled = searchParams.get('canceled') === 'true';

  const catalogQuery = useQuery({
    queryKey: ['ai-credits', 'catalog'],
    queryFn: () => aiCreditsApi.getCatalog(),
    staleTime: 300_000,
    retry: false,
  });
  const personalQuery = useQuery({
    queryKey: ['ai-credits', 'personal'],
    queryFn: () => aiCreditsApi.getPersonal(),
    staleTime: 15_000,
    retry: false,
  });
  const guildsQuery = useQuery({
    queryKey: ['user', 'guilds'],
    queryFn: () => guildApi.getGuilds(),
    staleTime: 60_000,
    retry: false,
  });
  const ledgerQuery = useQuery({
    queryKey: ['ai-credits', 'personal', 'ledger'],
    queryFn: () => aiCreditsApi.getPersonalLedger(),
    staleTime: 15_000,
    retry: false,
  });
  const purchaseQuery = useQuery({
    queryKey: ['ai-credits', 'purchase', purchaseId],
    queryFn: () => aiCreditsApi.getPurchase(purchaseId!),
    enabled: Boolean(purchaseId),
    refetchInterval: (query) => {
      const status = query.state.data?.purchase.status;
      return purchaseAwaitingFulfillment(status) ? 2500 : false;
    },
    retry: false,
  });

  const [policyDraft, setPolicyDraft] = useState(policyDefaults());
  const [consentGuildId, setConsentGuildId] = useState('');
  const [consentEnabled, setConsentEnabled] = useState(false);
  const guilds = useMemo(() => guildsQuery.data ?? [], [guildsQuery.data]);
  const selectedConsentGuild = useMemo(
    () => guilds.find((guild) => guild.id === consentGuildId),
    [consentGuildId, guilds],
  );
  const consentQuery = useQuery({
    queryKey: ['ai-credits', 'consent', consentGuildId],
    queryFn: () => aiCreditsApi.getGuildConsent(consentGuildId),
    enabled: Boolean(consentGuildId),
    retry: false,
  });

  useEffect(() => {
    if (!consentGuildId && guilds[0]) setConsentGuildId(guilds[0].id);
  }, [consentGuildId, guilds]);

  useEffect(() => {
    if (consentQuery.data?.consent.guild_id === consentGuildId) {
      setConsentEnabled(consentQuery.data.consent.enabled);
    }
  }, [consentGuildId, consentQuery.data?.consent]);
  useEffect(() => {
    if (personalQuery.data?.policy) setPolicyDraft(policyDefaults(personalQuery.data.policy));
  }, [personalQuery.data?.policy]);

  useEffect(() => {
    const purchaseStatus = purchaseQuery.data?.purchase.status;
    if (purchaseStatus === 'fulfilled') {
      void queryClient.invalidateQueries({ queryKey: ['ai-credits', 'personal'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-credits', 'personal', 'ledger'] });
    }
  }, [purchaseQuery.data?.purchase.status, queryClient]);

  useEffect(() => {
    if (canceled) {
      showToast('Checkout canceled. Your wallet was not charged.', 'info');
      const next = new URLSearchParams(searchParams);
      next.delete('canceled');
      setSearchParams(next, { replace: true });
    }
  }, [canceled, searchParams, setSearchParams]);

  const checkout = useMutation({
    mutationFn: (packSku: string) => aiCreditsApi.createCheckout({
      pack_sku: packSku,
      target_type: 'personal',
      accepted_terms_version: catalogQuery.data?.catalog.terms_version ?? '',
    }),
    onSuccess: (result) => {
      window.location.assign(result.checkout_url);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not open AI Credits Checkout.', 'error');
    },
  });

  const policyMutation = useMutation({
    mutationFn: (draft: ReturnType<typeof policyDefaults>) => aiCreditsApi.updatePersonalPolicy({
      ...draft,
      expected_version: personalQuery.data?.policy.version,
    } as Partial<CreditUserPolicy> & { expected_version?: number }),
    onSuccess: async () => {
      showToast('AI Credits guardrails saved.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['ai-credits', 'personal'] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not save AI Credits guardrails.', 'error');
    },
  });

  const consentMutation = useMutation({
    mutationFn: () => aiCreditsApi.updateGuildConsent(consentGuildId, { enabled: consentEnabled }),
    onSuccess: async () => {
      showToast('Guild spending consent saved.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['ai-credits', 'consent', consentGuildId] });
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not save guild consent.', 'error');
    },
  });

  const catalog = catalogQuery.data?.catalog;
  const personal = personalQuery.data;
  const ledger = ledgerQuery.data?.entries ?? [];
  const rateRows = useMemo(
    () => (catalogQuery.data?.rate_card.rows ?? []).filter((row) => ['chat', 'tool_chat', 'image_generation'].includes(row.operation)),
    [catalogQuery.data?.rate_card.rows],
  );
  const purchase = purchaseQuery.data?.purchase;
  const savedConsentEnabled = consentQuery.data?.consent.guild_id === consentGuildId
    ? consentQuery.data.consent.enabled
    : undefined;
  const consentHasChanges = savedConsentEnabled !== undefined && consentEnabled !== savedConsentEnabled;
  const savedGuildFallbackEnabled = policyBoolean(personal?.policy.allow_guild_spending);
  const guildFallbackRequired = consentEnabled && !savedGuildFallbackEnabled;
  const guildFallbackAttention = guildFallbackRequired
    ? policyDraft.allow_guild_spending
      ? 'Save this guardrail before “Use my credits” can take effect.'
      : 'Required by the selected “Use my credits” server permission below.'
    : undefined;
  const purchaseIsPending = purchaseAwaitingFulfillment(purchase?.status);
  const pageLoading = catalogQuery.isLoading || personalQuery.isLoading;
  const pageError = catalogQuery.error || personalQuery.error;

  const enableGuildFallback = () => {
    const nextDraft = { ...policyDraft, allow_guild_spending: true };
    setPolicyDraft(nextDraft);
    policyMutation.mutate(nextDraft);
  };

  if (pageLoading) {
    return <div className="credits-page"><PublicNav variant="observatory" /><LoadingSpinner /></div>;
  }

  if (pageError || !catalog || !personal) {
    return (
      <div className="credits-page">
        <PublicNav variant="observatory" />
        <main className="credits-main credits-main--message">
          <section className="credits-message" role="alert">
            <LockKeyhole aria-hidden="true" />
            <h1>AI Credits are temporarily unavailable.</h1>
            <p>We could not read the wallet safely. Refresh the page or try again in a moment.</p>
            <button type="button" className="credits-button credits-button--secondary" onClick={() => window.location.reload()}>
              <RefreshCw aria-hidden="true" /> Try again
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="credits-page">
      <PublicNav variant="observatory" />
      <main className="credits-main">
        <header className="credits-header">
          <div>
            <span className="credits-kicker"><WalletCards aria-hidden="true" /> Personal wallet</span>
            <h1>AI Credits</h1>
            <p>Prepaid capacity for explicit AI work when included server quota is not enough.</p>
          </div>
          <div className="credits-header__links">
            <Link to="/servers" className="credits-text-link">Server wallets <ArrowRight aria-hidden="true" /></Link>
            <span className="credits-mode"><i /> {personal.mode} ledger</span>
          </div>
        </header>

        {purchase && (
          <section className={`credits-purchase-status is-${purchase.status}`} role="status" aria-live="polite">
            <div className="credits-purchase-status__icon" aria-hidden="true">
              {purchaseIsPending ? <Clock3 /> : purchase.status === 'fulfilled' ? <Check /> : <Info />}
            </div>
            <div>
              <strong>
                {purchaseIsPending
                  ? 'Payment received; confirming your wallet.'
                  : purchase.status === 'fulfilled'
                    ? purchase.target_owner_type === 'guild'
                      ? 'Credits added to the selected server wallet.'
                      : 'Credits added to your personal wallet.'
                    : purchaseTerminalTitle(purchase.status)}
              </strong>
              <p>
                {purchaseIsPending
                  ? 'Stripe fulfillment is idempotent and may take a few seconds. This page will update automatically.'
                  : purchase.status === 'fulfilled'
                    ? `${formatCredits(purchase.granted_credits)} credits are now available.`
                    : 'No balance change was recorded for this purchase.'}
              </p>
            </div>
            {purchaseIsPending && <RefreshCw className="credits-purchase-status__spin" aria-label="Checking purchase status" />}
          </section>
        )}

        <section className="credits-overview" aria-label="Wallet overview">
          <article className="credits-wallet-readout">
            <div className="credits-wallet-readout__topline">
              <span>Available now</span>
              <span className={`credits-status-chip is-${personal.wallet.status}`}>{statusLabel(personal.wallet.status)}</span>
            </div>
            <strong className="credits-wallet-readout__number">{formatCredits(personal.wallet.available_credits)}</strong>
            <span className="credits-wallet-readout__unit">AI Credits</span>
            <div className="credits-wallet-readout__bottomline">
              <span>{formatCredits(personal.wallet.reserved_credits)} reserved in active requests</span>
              <span>1 credit = $0.001</span>
            </div>
          </article>

          <div className="credits-overview__briefing">
            <div className="credits-briefing-line">
              <ShieldCheck aria-hidden="true" />
              <div><strong>Included quota comes first</strong><span>Credits only cover eligible, explicitly allowed overage.</span></div>
            </div>
            <div className="credits-briefing-line">
              <LockKeyhole aria-hidden="true" />
              <div><strong>No ambient spending</strong><span>Every paid action is bounded by your wallet policy and request cap.</span></div>
            </div>
            <div className="credits-briefing-line">
              <History aria-hidden="true" />
              <div><strong>Immutable ledger</strong><span>Purchases, reservations, charges, and reversals stay auditable.</span></div>
            </div>
          </div>
        </section>

        <section className="credits-section" aria-labelledby="credits-packs-title">
          <div className="credits-section__heading">
            <div>
              <span className="credits-section__label">Add capacity</span>
              <h2 id="credits-packs-title">Choose a prepaid pack.</h2>
            </div>
            <p>Purchased credits do not expire and cannot be transferred. Stripe checkout opens in a separate step.</p>
          </div>
          {!catalog.sales_enabled && (
            <div className="credits-notice" role="status">
              <Info aria-hidden="true" />
              <span>Sales are paused while the server-owned Stripe catalog is being verified. Your wallet remains readable.</span>
            </div>
          )}
          <div className="credits-pack-grid">
            {catalog.packs.map((pack) => (
              <CreditPackCard
                key={pack.sku}
                pack={pack}
                currency={catalog.currency}
                salesEnabled={catalog.sales_enabled}
                pending={checkout.isPending}
        onPurchase={() => setSelectedPack(pack)}
              />
            ))}
          </div>
        </section>

        <div className="credits-workspace">
          <section className="credits-panel credits-policy-panel" aria-labelledby="credits-policy-title">
            <div className="credits-panel__heading">
              <div><span className="credits-section__label">Guardrails</span><h2 id="credits-policy-title">Set your spending boundary.</h2></div>
              <ShieldCheck aria-hidden="true" />
            </div>
            <p className="credits-panel__intro">These controls are personal. A guild administrator must separately enable server policy and consent before your personal wallet can be used in that guild.</p>
            {!personal.spending_enabled && (
              <div className="credits-notice credits-notice--warning" role="status">
                <AlertTriangle aria-hidden="true" />
                <span><strong>AI Credit spending is currently paused.</strong> You can configure permissions now, but no wallet will be charged until Acosmibot enables spending.</span>
              </div>
            )}
            <div className="credits-policy-list">
              <PolicySwitch
                label="Allow DM spending"
                description="Permit explicit AI requests in your Discord DMs to use this wallet."
                checked={policyDraft.allow_dm_spending}
                onChange={(checked) => setPolicyDraft((draft) => ({ ...draft, allow_dm_spending: checked }))}
              />
              <PolicySwitch
                id="allow-guild-fallback"
                label="Allow guild fallback"
                description="Permit eligible server requests to use your wallet after included quota and any available server credits."
                checked={policyDraft.allow_guild_spending}
                onChange={(checked) => setPolicyDraft((draft) => ({ ...draft, allow_guild_spending: checked }))}
                attentionMessage={guildFallbackAttention}
              />
              <PolicySwitch
                label="Low-balance notifications"
                description="Notify you when available credits cross the configured personal threshold."
                checked={policyDraft.low_balance_notifications}
                onChange={(checked) => setPolicyDraft((draft) => ({ ...draft, low_balance_notifications: checked }))}
              />
            </div>
            <div className="credits-policy-fields">
              <label><span>Daily cap</span><input type="number" min="0" max="10000000" value={policyDraft.personal_daily_credit_cap} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, personal_daily_credit_cap: Math.max(0, Number(event.target.value) || 0) }))} /><small>0 = no personal cap</small></label>
              <label><span>Monthly cap</span><input type="number" min="0" max="10000000" value={policyDraft.personal_monthly_credit_cap} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, personal_monthly_credit_cap: Math.max(0, Number(event.target.value) || 0) }))} /><small>0 = no personal cap</small></label>
              <label><span>Low-balance alert</span><input type="number" min="0" max="10000000" value={policyDraft.low_balance_threshold} onChange={(event) => setPolicyDraft((draft) => ({ ...draft, low_balance_threshold: Math.max(0, Number(event.target.value) || 0) }))} /><small>Notify at or below this balance</small></label>
            </div>
            <button type="button" className="credits-button credits-button--secondary" disabled={policyMutation.isPending} onClick={() => policyMutation.mutate(policyDraft)}>
              {policyMutation.isPending ? 'Saving…' : 'Save guardrails'}
              {!policyMutation.isPending && <Check aria-hidden="true" />}
            </button>
          </section>

          <aside className="credits-panel credits-rate-panel" aria-labelledby="credits-rate-title">
            <div className="credits-panel__heading">
              <div><span className="credits-section__label">Rate card {catalogQuery.data?.rate_card.version}</span><h2 id="credits-rate-title">What a request can cost.</h2></div>
              <Sparkles aria-hidden="true" />
            </div>
            <p className="credits-panel__intro">The customer rate is provider-neutral. OpenAI or Gemini selection does not silently change a reserved charge.</p>
            <div className="credits-rate-list">
              {rateRows.map((row) => (
                <div key={row.operation} className="credits-rate-row">
                  <span>{row.operation.replace(/_/g, ' ')}</span>
                  <strong>{formatCredits(row.minimum_credits)}+ <small>credits</small></strong>
                </div>
              ))}
            </div>
            <Link to="/docs/ai" className="credits-text-link">Read AI usage guidance <ArrowRight aria-hidden="true" /></Link>
          </aside>
        </div>

        {guilds.length > 0 && (
          <section className="credits-panel credits-consent-panel" aria-labelledby="credits-consent-title">
            <div className="credits-panel__heading">
              <div><span className="credits-section__label">Server permissions</span><h2 id="credits-consent-title">Let a server use your personal credits.</h2></div>
              <ShieldCheck aria-hidden="true" />
            </div>
            <p className="credits-panel__intro" id="credits-consent-description">Choose whether your eligible AI requests in a server may use your personal credits after that server’s credits run out.</p>
            <div className="credits-consent-controls">
              <label className="credits-consent-server">
                <span>Discord server</span>
                <select value={consentGuildId} onChange={(event) => {
                  setConsentGuildId(event.target.value);
                  setConsentEnabled(false);
                }}>
                  {guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
                </select>
              </label>
              <fieldset className="credits-consent-choice" disabled={consentQuery.isLoading} aria-describedby="credits-consent-description credits-consent-requirements">
                <legend>Personal credit access</legend>
                {consentQuery.isLoading ? (
                  <div className="credits-consent-loading" role="status">Loading permission for {selectedConsentGuild?.name ?? 'this server'}…</div>
                ) : (
                  <div className="credits-consent-options">
                    <label className={!consentEnabled ? 'is-selected' : undefined}>
                      <input type="radio" name="guild-credit-consent" checked={!consentEnabled} onChange={() => setConsentEnabled(false)} />
                      <span><strong>Don’t use my credits</strong><small>Requests stop when the server has no credits available.</small></span>
                    </label>
                    <label className={consentEnabled ? 'is-selected' : undefined}>
                      <input type="radio" name="guild-credit-consent" checked={consentEnabled} onChange={() => setConsentEnabled(true)} />
                      <span><strong>Use my credits</strong><small>My eligible requests may continue using my personal balance.</small></span>
                    </label>
                  </div>
                )}
              </fieldset>
            </div>
            <div className="credits-consent-footer">
              {guildFallbackRequired ? (
                <div className="credits-consent-prerequisite" id="credits-consent-requirements" role="alert">
                  <AlertTriangle aria-hidden="true" />
                  <span>
                    <strong>Allow guild fallback is required.</strong>
                    This server permission cannot use your wallet while the master guardrail is off. Enabling it also activates any other server you explicitly set to “Use my credits.”
                  </span>
                  <button type="button" className="credits-button credits-button--secondary" disabled={policyMutation.isPending} onClick={enableGuildFallback}>
                    {policyMutation.isPending ? 'Enabling…' : 'Enable guild fallback'}
                  </button>
                </div>
              ) : (
                <p id="credits-consent-requirements"><Info aria-hidden="true" /> The server’s administrators must also permit personal fallback. They cannot see your personal balance.</p>
              )}
              <button type="button" className="credits-button credits-button--primary" disabled={!consentGuildId || !consentHasChanges || consentMutation.isPending || consentQuery.isLoading || guildFallbackRequired} onClick={() => consentMutation.mutate()}>
                {consentMutation.isPending ? 'Saving permission…' : 'Save server permission'}
                {!consentMutation.isPending && <Check aria-hidden="true" />}
              </button>
            </div>
          </section>
        )}

        <section className="credits-ledger" aria-labelledby="credits-ledger-title">
          <div className="credits-section__heading">
            <div><span className="credits-section__label">Audit trail</span><h2 id="credits-ledger-title">Recent wallet activity.</h2></div>
            <span className="credits-ledger__updated">Updated {formatDate(personal.wallet.updated_at)}</span>
          </div>
          {ledgerQuery.isLoading ? <LoadingSpinner /> : ledger.length === 0 ? (
            <div className="credits-empty"><History aria-hidden="true" /><strong>No wallet activity yet.</strong><span>Your first fulfilled pack or AI charge will appear here.</span></div>
          ) : (
            <div className="credits-ledger-list">
              {ledger.map((entry) => (
                <div className="credits-ledger-row" key={entry.id}>
                  <div className={`credits-ledger-row__mark is-${entry.direction}`} aria-hidden="true"><CircleDollarSign /></div>
                  <div className="credits-ledger-row__copy"><strong>{statusLabel(entry.direction)}</strong><span>{entry.operation || entry.purchase_id || entry.idempotency_key}</span></div>
                  <span className={`credits-ledger-row__delta${entry.available_delta + entry.reserved_delta < 0 ? ' is-negative' : ''}`}>{entry.available_delta + entry.reserved_delta > 0 ? '+' : ''}{formatCredits(entry.available_delta + entry.reserved_delta)}</span>
                  <span className="credits-ledger-row__date">{formatDate(entry.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="credits-footer-note">
          <CreditCard aria-hidden="true" />
          <span>Questions about a payment? Keep your Stripe receipt and contact support with the purchase ID from your ledger.</span>
          <a href="mailto:support@acosmibot.com">Contact support <ExternalLink aria-hidden="true" /></a>
        </footer>
      </main>
        {selectedPack && (
          <CreditCheckoutDialog
            pack={selectedPack}
            currency={catalog.currency}
            targetLabel="your personal wallet"
            targetType="personal"
            termsVersion={catalog.terms_version}
            isPending={checkout.isPending}
            onClose={() => setSelectedPack(null)}
            onConfirm={() => checkout.mutate(selectedPack.sku)}
          />
        )}
    </div>
  );
};

export default AICreditsPage;
