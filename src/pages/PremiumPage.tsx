/**
 * THESIS: Pricing is an orbit-selection instrument, not a stack of isolated sales cards.
 * OWN-WORLD: Observatory void, cyan trajectories, compact telemetry, and four plan stations.
 * STORY: See the shared free core, compare added capacity, then select a server for checkout.
 * FIRST VIEWPORT: Offer copy and billing control sit beside a live four-station orbit diagram.
 * FORM: Fourth-ranked “plan trajectory” structure; established constellation world; seed 65fbf8bd.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import { Activity, ArrowRight, BarChart3, Bot, Check, Gem, Radio, ShieldCheck, Sparkles, X } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { guildApi } from '@/api/guilds';
import { subscriptionsApi, type BillingInterval, type PremiumTier, type SubscriptionCatalogRow, type SubscriptionQuotaCatalog } from '@/api/subscriptions';
import { showToast } from '@/utils/toast';
import { useAuthStore } from '@/store/auth';
import { trackEvent } from '@/lib/analytics';
import { startLogin } from '@/lib/auth';
import type { Guild } from '@/types/guild';
import '@/styles/pricing.css';

const TIER_LABELS: Record<PremiumTier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
};

const parsePriceAmount = (price: string) => Number(price.replace(/[^0-9.]/g, '')) || 0;

const AcosmibotRocketIcon: React.FC = () => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 2.5c-4.3 3.7-6.7 8.1-6.7 13.4v6.8L16 26l6.7-3.3v-6.8C22.7 10.6 20.3 6.2 16 2.5Z" />
    <path d="m9.4 16.2-4.1 3.9v5.5l4.7-2.2M22.6 16.2l4.1 3.9v5.5L22 23.4" />
    <path d="M12 13.8c1.1-1.2 2.4-1.8 4-1.8s2.9.6 4 1.8v5.4c-1.1 1-2.4 1.5-4 1.5s-2.9-.5-4-1.5v-5.4Z" fill="currentColor" />
    <circle cx="14.2" cy="16.4" r="1" fill="var(--tier-color)" stroke="none" />
    <circle cx="17.8" cy="16.4" r="1" fill="var(--tier-color)" stroke="none" />
    <path d="m13.2 24.6 2.8 5 2.8-5M13.5 8.6c.8-.5 1.6-.8 2.5-.8s1.7.3 2.5.8" />
  </svg>
);

interface TierCardDef {
  tier: PremiumTier;
  monthlyPrice?: string;
  monthlyIntroPrice?: string;
  launchOfferMonths?: number;
  launchOfferPercent?: number;
  annualPrice?: string;
  description: string;
  fit: string;
  popular?: boolean;
  icon?: React.ReactNode;
  ctaLabel?: string;
  ctaNote?: string;
  features: Array<{ text: string; disabled?: boolean }>;
}

const TIERS: TierCardDef[] = [
  {
    tier: 'free',
    monthlyPrice: '$0',
    description: 'Core community systems for getting started.',
    fit: 'For new or casual servers',
    ctaLabel: 'Current Plan',
    features: [
      { text: 'Leveling & XP system' },
      { text: 'Economy, games & gambling' },
      { text: 'Server analytics' },
      { text: 'Better Social Embeds' },
      { text: '1 Twitch streamer tracking' },
      { text: '1 YouTube streamer tracking' },
      { text: '1 Kick streamer tracking' },
      { text: '1 custom command' },
      { text: '1 reaction role message' },
      { text: '5 custom embeds' },
      { text: 'No AI tools, memories, or custom personalities', disabled: true },
    ],
  },
  {
    tier: 'plus',
    description: 'More automation capacity for active community servers.',
    fit: 'Best for growing Discords',
    icon: <Gem size={18} />,
    ctaLabel: 'Select Server',
    ctaNote: 'Billed per server',
    features: [
      { text: 'Everything in Free, and:' },
      { text: '5 Twitch streamers tracking' },
      { text: '5 YouTube streamers tracking' },
      { text: '5 Kick streamers tracking' },
      { text: '25 custom commands' },
      { text: '10 reaction role messages' },
      { text: '100 custom embeds' },
      { text: 'Priority support' },
      { text: 'No AI tools, memories, or custom personalities', disabled: true },
    ],
  },
  {
    tier: 'pro',
    description: 'Plus limits with AI tools, memory, and clear usage caps.',
    fit: 'For servers that want AI built in',
    popular: true,
    icon: <span className="pricing-icon-cluster"><Bot /><Gem /></span>,
    ctaLabel: 'Select Server',
    ctaNote: 'Billed per server',
    features: [
      { text: 'Everything in Plus, and:' },
      { text: 'Custom AI personalities & instructions' },
      { text: 'Per-user AI memory' },
      { text: 'AI web search' },
      { text: 'Ambient AI replies' },
    ],
  },
  {
    tier: 'max',
    description: 'Higher AI usage for servers with heavier assistant workflows.',
    fit: 'For AI-heavy communities',
    icon: <span className="pricing-icon-cluster"><Sparkles /><Bot /></span>,
    ctaLabel: 'Select Server',
    ctaNote: 'Billed per server',
    features: [
      { text: 'Everything in Plus, and:' },
      { text: 'Custom AI personalities & instructions' },
      { text: 'Per-user AI memory' },
      { text: 'AI web search' },
      { text: 'Ambient AI replies' },
    ],
  },
];

const formatCurrency = (amountCents: number | undefined, currency: string | undefined) => {
  if (amountCents === undefined || !currency) return undefined;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
};

const formatCatalogPrice = (row: SubscriptionCatalogRow | undefined) => {
  if (!row) return undefined;
  return formatCurrency(row.unit_amount_cents, row.currency);
};

const catalogRowsForTier = (catalog: SubscriptionCatalogRow[], tier: PremiumTier) =>
  catalog.filter((row) => row.tier === tier);

const buildCatalogFeatures = (def: TierCardDef, catalog: SubscriptionCatalogRow[], quotasByTier: SubscriptionQuotaCatalog) => {
  const rows = catalogRowsForTier(catalog, def.tier);
  const quotas = quotasByTier[def.tier] ?? rows[0]?.quotas;
  if (!quotas) return def.features;
  const aiChatFeature = {
    text: `AI chat - ${quotas.daily_ai_actions.toLocaleString()}/day and ${quotas.monthly_ai_actions.toLocaleString()}/month`,
  };
  const features = [...def.features];
  const firstUnavailableFeature = features.findIndex((feature) => feature.disabled);

  if (firstUnavailableFeature >= 0) features.splice(firstUnavailableFeature, 0, aiChatFeature);
  else features.push(aiChatFeature);

  if (def.tier === 'pro' || def.tier === 'max') {
    features.push(
      { text: `${quotas.image_monthly_limit.toLocaleString()} medium images/month` },
      { text: `${quotas.image_analysis_monthly_limit.toLocaleString()} vision analyses/month` },
    );
  }
  return features;
};

export const PricingPage: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [searchParams, setSearchParams] = useSearchParams();

  const [pickerTier, setPickerTier] = useState<Exclude<PremiumTier, 'free'> | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const preselectGuildId = searchParams.get('guild');

  const catalogQuery = useQuery({
    queryKey: ['subscription-catalog'],
    queryFn: () => subscriptionsApi.getCatalog(),
    staleTime: 300_000,
    retry: false,
  });
  const catalog = catalogQuery.data?.catalog ?? [];
  const quotasByTier = catalogQuery.data?.quotas ?? {};
  const launchPromotion = catalogQuery.data?.launch_promotion;
  const launchPromotionActive = Boolean(
    launchPromotion?.active && launchPromotion.eligible_cadences.includes('monthly'),
  );
  const pricingAvailable = catalog.length === 6;
  const displayTiers = TIERS.map((def) => {
    const rows = catalogRowsForTier(catalog, def.tier);
    const monthlyRow = rows.find((row) => row.cadence === 'monthly');
    const introAmount = def.tier === 'free'
      ? undefined
      : launchPromotion?.discounted_monthly_amounts_cents[def.tier];
    return {
      ...def,
      monthlyPrice: def.tier === 'free' ? '$0' : formatCatalogPrice(monthlyRow),
      monthlyIntroPrice: launchPromotionActive
        ? formatCurrency(introAmount, monthlyRow?.currency)
        : undefined,
      launchOfferMonths: launchPromotionActive ? launchPromotion?.duration_in_months : undefined,
      launchOfferPercent: launchPromotionActive ? launchPromotion?.percent_off : undefined,
      annualPrice: def.tier === 'free' ? undefined : formatCatalogPrice(rows.find((row) => row.cadence === 'annual')),
      features: buildCatalogFeatures(def, catalog, quotasByTier),
    };
  });

  // Admin-controlled kill switch; fails closed (coming soon) while loading
  // or if the API is unreachable.
  const billingStatus = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => subscriptionsApi.getBillingStatus(),
    staleTime: 60_000,
    retry: false,
  });
  const billingEnabled = billingStatus.data?.billing_enabled ?? false;
  const checkoutAvailable = billingEnabled && pricingAvailable;

  const selectTier = (tier: Exclude<PremiumTier, 'free'>) => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (!checkoutAvailable) {
      showToast(pricingAvailable ? 'Pricing checkout is coming soon.' : 'Pricing is temporarily unavailable.', 'info');
      return;
    }
    setPickerTier(tier);
  };

  // Stripe return params
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      showToast('Upgrade successful! Your server subscription is active.', 'success');
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('canceled') === 'true') {
      showToast('Upgrade canceled. You can upgrade anytime!', 'info');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // ?guild= deep link (e.g. from the AI page upsell) opens the picker directly.
  useEffect(() => {
    if (preselectGuildId && isAuthenticated && !pickerTier) {
      setPickerTier('pro');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectGuildId, isAuthenticated]);

  return (
    <div className="pricing-page">
      <PublicNav variant="observatory" />

      <main className="pricing-main">
        <section className="pricing-hero">
          <div className="pricing-hero__copy">
            <span className="pricing-kicker"><Gem aria-hidden="true" /> Choose your orbit</span>
            <h1>One community core. Four ways to power it.</h1>
            <p>
              Start with every essential system, then add capacity for creator alerts,
              community tools, and AI when your server is ready.
            </p>
            <div className="pricing-hero__meta" aria-label="Subscription details">
              <span>Per-server plans</span>
              <i />
              <span>Monthly or annual</span>
              <i />
              <span>{launchPromotionActive ? `${launchPromotion?.percent_off}% launch offer` : 'Free core included'}</span>
            </div>
          </div>
          <PricingOrbit interval={billingInterval} plans={displayTiers} />
        </section>

        <section className="pricing-control-deck" aria-label="Billing interval">
          <div>
            <span className="pricing-control-deck__label">Billing frequency</span>
            <strong>{billingInterval === 'monthly'
              ? launchPromotionActive
                ? `${launchPromotion?.percent_off}% off your first ${launchPromotion?.duration_in_months} months`
                : 'Flexible monthly orbit'
              : 'Annual orbit · save up to 18%'}</strong>
          </div>
          <BillingToggle interval={billingInterval} onChange={setBillingInterval} />
          <span className={`pricing-billing-status${checkoutAvailable ? ' is-live' : ''}`}>
            <i />
            {checkoutAvailable ? 'Checkout online' : pricingAvailable ? 'Checkout coming soon' : 'Catalog unavailable'}
          </span>
        </section>

        <section className="pricing-credits-bridge" aria-labelledby="pricing-credits-title">
          <div className="pricing-credits-bridge__mark" aria-hidden="true"><Sparkles /></div>
          <div>
            <span>Prepaid AI capacity</span>
            <h2 id="pricing-credits-title">Keep the core free. Add AI Credits only when you need them.</h2>
            <p>One-time packs cover explicit AI overage after included quota. Personal wallets work in DMs and only fall back in guilds with administrator consent.</p>
          </div>
          <Link to="/credits" className="pricing-credits-bridge__action">Open AI Credits <ArrowRight aria-hidden="true" /></Link>
        </section>

        <section className="pricing-plans" id="plans" aria-labelledby="pricing-plans-title">
          <div className="pricing-plans__heading">
            <div>
              <span>Plan trajectory</span>
              <h2 id="pricing-plans-title">Every tier keeps the same connected core.</h2>
            </div>
            <p>Capacity grows along the path. AI tools, memory, and personalities enter the system at Pro.</p>
          </div>

          <div className="pricing-plan-track" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
          <div className="pricing-plans-grid">
            {displayTiers.map((tier) => (
              <TierCard
                key={tier.tier}
                def={tier.tier === 'free' || checkoutAvailable
                  ? tier
                  : { ...tier, ctaNote: 'Checkout opens after billing launch' }}
                interval={billingInterval}
                onSelect={tier.tier === 'free' || !pricingAvailable ? undefined : () => selectTier(tier.tier as Exclude<PremiumTier, 'free'>)}
              />
            ))}
          </div>
        </section>

        <section className="pricing-briefing" aria-labelledby="pricing-briefing-title">
          <div className="pricing-briefing__intro">
            <span>Signal briefing</span>
            <h2 id="pricing-briefing-title">Pick the pressure point you need to relieve.</h2>
            <p>No feature maze: Plus raises operating limits. Pro activates the complete AI layer. Max expands AI capacity.</p>
          </div>
          <div className="pricing-briefing__signals">
            <PremiumNote icon={<Radio />} title="Creator growth" text="Plus expands Twitch, YouTube, and Kick tracking from one creator per platform to five." />
            <PremiumNote icon={<ShieldCheck />} title="Community operations" text="Plus raises custom commands to 25, reaction-role messages to 10, and custom embeds to 100." />
            <PremiumNote icon={<Sparkles />} title="AI systems" text="Pro adds tools, memory, personalities, web search, ambient replies, images, and vision. Max raises the usage ceilings." />
            <PremiumNote
              icon={<BarChart3 />}
              title="Billing control"
              text={checkoutAvailable
                ? "Subscriptions are billed per server through Stripe. Change plans, switch intervals, or cancel from your server's billing page. Billing questions go to support@acosmibot.com."
                : 'Checkout stays paused while billing configuration is finalized.'}
            />
          </div>
        </section>

        <section className="pricing-close">
          <div className="pricing-close__mark" aria-hidden="true">
            <span /><span />
            <img src="/images/acosmibot-logo.png" alt="" />
          </div>
          <div>
            <span>Not ready to upgrade?</span>
            <h2>Start free. Your community core is already online.</h2>
          </div>
          <a href="#plans">Compare plans <ArrowRight aria-hidden="true" /></a>
        </section>
      </main>

      {pickerTier && (
        <ServerPickerModal
          tier={pickerTier}
          interval={billingInterval}
                billingEnabled={checkoutAvailable}
                preselectGuildId={preselectGuildId}
                plans={displayTiers}
          onClose={() => {
            setPickerTier(null);
            if (preselectGuildId) setSearchParams({}, { replace: true });
          }}
        />
      )}

      <SiteFooter />
    </div>
  );
};

const TierCard: React.FC<{
  def: TierCardDef;
  interval: BillingInterval;
  onSelect?: () => void;
}> = ({ def, interval, onSelect }) => {
  const hasLaunchOffer = interval === 'monthly' && Boolean(def.monthlyIntroPrice);
  const price = (interval === 'annual' && def.annualPrice
    ? def.annualPrice
    : def.monthlyIntroPrice ?? def.monthlyPrice) ?? '—';
  const monthlyTotal = parsePriceAmount(def.monthlyPrice ?? '') * 12;
  const annualTotal = def.annualPrice ? parsePriceAmount(def.annualPrice) : 0;
  const annualSavings = annualTotal ? Math.round((1 - annualTotal / monthlyTotal) * 100) : 0;

  return (
  <article className={`pricing-tier pricing-tier--${def.tier}${def.popular ? ' is-primary' : ''}${hasLaunchOffer ? ' has-launch-offer' : ''}`}>
    {hasLaunchOffer && def.tier !== 'free' && (
      <div className="pricing-tier__launch-signal">
        <span className="pricing-tier__launch-beacon" aria-hidden="true">
          <AcosmibotRocketIcon />
        </span>
        <span className="pricing-tier__launch-copy">
          <strong>{def.launchOfferPercent}% off</strong>
          <span>Launch offer</span>
          <small>{def.popular ? `${def.launchOfferMonths} months · top pick` : `first ${def.launchOfferMonths} months`}</small>
        </span>
      </div>
    )}
    {def.popular && !hasLaunchOffer && (
      <span className="pricing-tier__recommendation">Recommended orbit</span>
    )}
    <div className="pricing-tier__header">
      <div className="pricing-tier__station" aria-hidden="true">
        {def.icon ?? <Activity />}
      </div>
      <div>
        <span className="pricing-tier__sequence">Orbit {String(TIERS.findIndex((tier) => tier.tier === def.tier) + 1).padStart(2, '0')}</span>
        <h3>{TIER_LABELS[def.tier]}</h3>
      </div>
    </div>

    <div className="pricing-tier__price">
      <div className="pricing-tier__price-main">
        <div className="pricing-tier__price-amount">
          <AnimatedPrice price={price} />
          <span>{def.tier === 'free' ? 'forever' : interval === 'annual' ? '/year' : '/month'}</span>
        </div>
        {hasLaunchOffer && (
          <small>
            First {def.launchOfferMonths} months, then {def.monthlyPrice}/month
          </small>
        )}
      </div>
      {!hasLaunchOffer && interval === 'annual' && annualSavings > 0 && <em>Save {annualSavings}%</em>}
    </div>

    <div className="pricing-tier__fit">{def.fit}</div>
    <p className="pricing-tier__description">{def.description}</p>

    <ul className="pricing-tier__features">
      {def.features.map((f) => (
        <li key={f.text} className={f.disabled ? 'is-disabled' : undefined}>
          {f.disabled
            ? <X aria-hidden="true" />
            : <Check aria-hidden="true" />}
          <span>{f.text}</span>
        </li>
      ))}
    </ul>

    {onSelect ? (
      <>
        <button
          type="button"
          onClick={onSelect}
          className="pricing-tier__action"
        >
          {def.ctaLabel ?? 'Select Server'}
          <ArrowRight aria-hidden="true" />
        </button>
        {def.ctaNote && (
          <div className="pricing-tier__note">{def.ctaNote}</div>
        )}
      </>
    ) : (
      <button type="button" className="pricing-tier__action pricing-tier__action--free" disabled>
        Included by default
      </button>
    )}
  </article>
  );
};

const AnimatedPrice: React.FC<{ price: string }> = ({ price }) => {
  const target = parsePriceAmount(price);
  const previous = useRef(target);
  const frame = useRef<number | null>(null);
  const [displayAmount, setDisplayAmount] = useState(target);

  useEffect(() => {
    const start = previous.current;
    const delta = target - start;
    const duration = 360;
    const startedAt = performance.now();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
    }

    if (reducedMotion) {
      previous.current = target;
      setDisplayAmount(target);
      return;
    }

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + delta * eased;
      setDisplayAmount(next);

      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }

      previous.current = target;
      setDisplayAmount(target);
      frame.current = null;
    };

    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [target]);

  const settled = Math.abs(displayAmount - target) < 0.005;
  const label = settled ? price : `$${displayAmount.toFixed(2)}`;

  return (
    <span className="pricing-animated-price">
      {label}
    </span>
  );
};

const PremiumNote: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <article className="pricing-signal">
    <div className="pricing-signal__icon" aria-hidden="true">{icon}</div>
    <div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  </article>
);

const PricingOrbit: React.FC<{ interval: BillingInterval; plans: TierCardDef[] }> = ({ interval, plans }) => (
  <div className="pricing-orbit" aria-label={`Four pricing tiers with ${interval} billing selected`}>
    <div className="pricing-orbit__rings" aria-hidden="true"><span /><span /><span /></div>
    <div className="pricing-orbit__core">
      <img src="/images/acosmibot-logo.png" alt="" />
      <span>Core</span>
    </div>
    {plans.map((tier, index) => (
      <div
        key={tier.tier}
        className={`pricing-orbit__station pricing-orbit__station--${tier.tier}`}
        style={{ '--station-index': index } as React.CSSProperties}
      >
        <i aria-hidden="true">{tier.icon ?? <Activity />}</i>
        <span>{TIER_LABELS[tier.tier]}</span>
        <strong>{interval === 'annual' && tier.annualPrice
          ? tier.annualPrice
          : tier.monthlyIntroPrice ?? tier.monthlyPrice}</strong>
      </div>
    ))}
    <div className="pricing-orbit__readout" aria-hidden="true">
      <span>4 plans</span><i /> <span>1 connected core</span>
    </div>
  </div>
);

const BillingToggle: React.FC<{
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
}> = ({ interval, onChange }) => (
  <div className="pricing-toggle">
    {(['monthly', 'annual'] as const).map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        aria-pressed={interval === option}
      >
        {option}
      </button>
    ))}
  </div>
);

/** Pick which admin/owner server to upgrade (or manage). */
const ServerPickerModal: React.FC<{
  tier: Exclude<PremiumTier, 'free'>;
  interval: BillingInterval;
  billingEnabled: boolean;
  preselectGuildId: string | null;
  plans: TierCardDef[];
  onClose: () => void;
}> = ({ tier, interval, billingEnabled, preselectGuildId, plans, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [checkoutGuild, setCheckoutGuild] = useState<Guild | null>(null);

  const guildsQuery = useQuery({
    queryKey: ['guilds'],
    queryFn: () => guildApi.getGuilds(),
  });

  const manageable = (guildsQuery.data ?? []).filter(
    (g) => g.owner || g.permissions?.includes('administrator'),
  );

  const subQueries = useQueries({
    queries: manageable.map((g) => ({
      queryKey: ['guild', g.id, 'subscription'],
      queryFn: () => subscriptionsApi.getGuildSubscription(g.id),
      staleTime: 60_000,
      retry: false,
    })),
  });

  const navigate = useNavigate();
  const selectedPlan = plans.find((plan) => plan.tier === tier);
  const selectedPrice = interval === 'annual'
    ? selectedPlan?.annualPrice
    : selectedPlan?.monthlyIntroPrice ?? selectedPlan?.monthlyPrice;
  const selectedPlanHasLaunchOffer = interval === 'monthly' && Boolean(selectedPlan?.monthlyIntroPrice);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.querySelectorAll<HTMLElement>(
      '.pricing-page > main, .pricing-page > footer, .pricing-page > nav, .pricing-page > aside, .pricing-page > .public-nav__backdrop',
    ));
    background.forEach((element) => element.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';

    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const focusFrame = window.requestAnimationFrame(() => {
      getFocusable()[0]?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
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
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      background.forEach((element) => element.removeAttribute('inert'));
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    if (!checkoutGuild) return;
    const focusFrame = window.requestAnimationFrame(() => continueButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [checkoutGuild]);

  const checkout = useMutation({
    mutationFn: (guild: Guild) => {
      trackEvent('begin_checkout', { plan: tier, interval, currency: 'usd' });
      return subscriptionsApi.createCheckout({
        guild_id: guild.id,
        tier,
        interval,
        success_url: `${window.location.origin}/pricing?success=true`,
        cancel_url: `${window.location.origin}/pricing?canceled=true`,
      });
    },
    onSuccess: (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      showToast(data.message || 'Subscription updated.', 'success');
      onClose();
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : 'Could not start checkout.', 'error');
    },
  });

  const upgrade = (guild: Guild) => {
    if (!billingEnabled) {
      showToast('Pricing checkout is coming soon.', 'info');
      return;
    }
    setCheckoutGuild(guild);
  };

  // Guilds that already pay go to the billing page, which previews the
  // prorated amount and confirms before changing anything.
  const manage = (guild: Guild) => {
    navigate(`/server/${guild.id}/billing`);
  };

  return (
    <div
      className="pricing-dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="pricing-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-server-picker-title"
        aria-describedby="pricing-server-picker-description"
        tabIndex={-1}
      >
        <div className="pricing-dialog__header">
          <div className="pricing-dialog__title">
            <span><Radio aria-hidden="true" /> Server uplink</span>
            <h3 id="pricing-server-picker-title">
              {checkoutGuild
                ? 'Confirm your server and plan'
                : `Select a server to upgrade to ${TIER_LABELS[tier]}`}
            </h3>
            <p id="pricing-server-picker-description">
              {checkoutGuild
                ? 'This subscription applies only to the Discord server shown below.'
                : 'Choose a server where you are the owner or have administrator permission.'}
            </p>
          </div>
          <button type="button" className="pricing-dialog__close" onClick={onClose} aria-label="Close server picker">
            <X aria-hidden="true" />
          </button>
        </div>

        {checkoutGuild ? (
          <div className="pricing-checkout-confirmation">
            <div className="pricing-checkout-confirmation__server">
              <div
                className="pricing-server__avatar"
                style={{
                  backgroundImage: checkoutGuild.icon
                    ? `url(https://cdn.discordapp.com/icons/${checkoutGuild.id}/${checkoutGuild.icon}.png?size=128)`
                    : 'none',
                }}
              >
                {!checkoutGuild.icon && checkoutGuild.name.charAt(0).toUpperCase()}
              </div>
              <div className="pricing-server__copy">
                <span>Discord server</span>
                <strong>{checkoutGuild.name}</strong>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>

            <dl className="pricing-checkout-confirmation__plan">
              <div>
                <dt>Plan</dt>
                <dd>Acosmibot {TIER_LABELS[tier]}</dd>
              </div>
              <div>
                <dt>Billing</dt>
                <dd>{interval === 'annual' ? 'Annual' : 'Monthly'}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{selectedPrice ?? '—'}{interval === 'annual' ? '/year' : '/month'}</dd>
              </div>
              {selectedPlanHasLaunchOffer && (
                <div>
                  <dt>Launch offer</dt>
                  <dd>
                    First {selectedPlan?.launchOfferMonths} months, then {selectedPlan?.monthlyPrice}/month
                  </dd>
                </div>
              )}
            </dl>

            <p className="pricing-checkout-confirmation__note">
              Stripe will securely collect payment. The selected server is also attached to the
              Checkout Session for automatic activation.
            </p>

            <div className="pricing-checkout-confirmation__actions">
              <button
                type="button"
                className="pricing-server__action pricing-server__action--quiet"
                onClick={() => setCheckoutGuild(null)}
                disabled={checkout.isPending}
              >
                Back
              </button>
              <button
                ref={continueButtonRef}
                type="button"
                className="pricing-server__action"
                onClick={() => checkout.mutate(checkoutGuild)}
                disabled={checkout.isPending}
                aria-busy={checkout.isPending}
              >
                {checkout.isPending ? 'Opening Stripe…' : 'Continue to Stripe'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {guildsQuery.isLoading && (
              <p className="pricing-dialog__state">Scanning your servers…</p>
            )}
            {guildsQuery.isError && (
              <p className="pricing-dialog__state is-error">Failed to load servers. Close this window and try again.</p>
            )}
            {guildsQuery.isSuccess && manageable.length === 0 && (
              <p className="pricing-dialog__state">
                No servers found where you have admin permissions.
              </p>
            )}

            <div className="pricing-server-list">
              {manageable.map((g, i) => {
                const sub = subQueries[i]?.data;
                const guildTier = (sub?.tier ?? 'free') as PremiumTier;
                const hasPremium = guildTier !== 'free';
                const highlight = g.id === preselectGuildId;

                return (
                  <div
                    key={g.id}
                    className={`pricing-server${highlight ? ' is-highlighted' : ''}`}
                  >
                    <div
                      className="pricing-server__avatar"
                      style={{ backgroundImage: g.icon ? `url(https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128)` : 'none' }}
                    >
                      {!g.icon && g.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="pricing-server__copy">
                      <strong>{g.name}</strong>
                      <span>
                        {(g.member_count ?? 0).toLocaleString()} members
                        <TierBadge tier={guildTier} />
                      </span>
                    </div>
                    {!hasPremium ? (
                      <button
                        type="button"
                        onClick={() => upgrade(g)}
                        className="pricing-server__action"
                      >
                        {!billingEnabled ? 'Coming Soon' : `Upgrade to ${TIER_LABELS[tier]}`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => manage(g)}
                        className="pricing-server__action pricing-server__action--quiet"
                      >
                        Manage Billing
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TierBadge: React.FC<{ tier: PremiumTier }> = ({ tier }) => {
  if (tier === 'free') {
    return <span className="pricing-tier-badge pricing-tier-badge--free">Free</span>;
  }
  return (
    <span className={`pricing-tier-badge pricing-tier-badge--${tier}`}>
      {(tier === 'pro' || tier === 'max') && <Bot aria-hidden="true" />}
      <Gem aria-hidden="true" /> {TIER_LABELS[tier]}
    </span>
  );
};

export default PricingPage;
