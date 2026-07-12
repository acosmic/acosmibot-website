import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import { ArrowRight, BarChart3, Bot, Check, Gem, Radio, ShieldCheck, Sparkles, X } from 'lucide-react';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { guildApi } from '@/api/guilds';
import { subscriptionsApi, type BillingInterval, type PremiumTier } from '@/api/subscriptions';
import { showToast } from '@/utils/toast';
import { useAuthStore } from '@/store/auth';
import { startLogin, useHydrateAuthUser } from '@/lib/auth';
import type { Guild } from '@/types/guild';

const TIER_LABELS: Record<PremiumTier, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  max: 'Max',
};

const parsePriceAmount = (price: string) => Number(price.replace(/[^0-9.]/g, '')) || 0;

interface TierCardDef {
  tier: PremiumTier;
  monthlyPrice: string;
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
      { text: '1 Twitch streamer tracking' },
      { text: '1 YouTube streamer tracking' },
      { text: '1 Kick streamer tracking' },
      { text: '1 custom command' },
      { text: '1 reaction role message' },
      { text: '5 custom embeds' },
      { text: 'Basic AI chat - 3/day and 90/month' },
      { text: 'No AI tools, memories, or custom personalities', disabled: true },
    ],
  },
  {
    tier: 'plus',
    monthlyPrice: '$4.99',
    annualPrice: '$49',
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
      { text: 'Basic AI chat - 3/day and 90/month' },
      { text: 'Priority support' },
      { text: 'No AI tools, memories, or custom personalities', disabled: true },
    ],
  },
  {
    tier: 'pro',
    monthlyPrice: '$9.99',
    annualPrice: '$99',
    description: 'Plus limits with AI tools, memory, and clear usage caps.',
    fit: 'For servers that want AI built in',
    popular: true,
    icon: <span style={{ display: 'inline-flex', gap: 2 }}><Bot size={18} /><Gem size={18} /></span>,
    ctaLabel: 'Select Server',
    ctaNote: 'Billed per server',
    features: [
      { text: 'Everything in Plus, and:' },
      { text: 'AI chat - 100/day and 2,000/month' },
      { text: 'Custom AI personalities & instructions' },
      { text: 'Per-user AI memory' },
      { text: 'AI web search' },
      { text: 'Proactive ambient AI replies' },
      { text: '50 medium images/month' },
      { text: '100 vision analyses/month' },
    ],
  },
  {
    tier: 'max',
    monthlyPrice: '$19.99',
    annualPrice: '$199',
    description: 'Higher AI usage for servers with heavier assistant workflows.',
    fit: 'For AI-heavy communities',
    icon: <span style={{ display: 'inline-flex', gap: 2 }}><Sparkles size={18} /><Bot size={18} /></span>,
    ctaLabel: 'Select Server',
    ctaNote: 'Billed per server',
    features: [
      { text: 'Everything in Plus, and:' },
      { text: 'AI chat - 300/day and 6,000/month' },
      { text: 'Custom AI personalities & instructions' },
      { text: 'Per-user AI memory' },
      { text: 'AI web search' },
      { text: 'Proactive ambient AI replies' },
      { text: '100 medium images/month' },
      { text: '200 vision analyses/month' },
    ],
  },
];

export const PricingPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [searchParams, setSearchParams] = useSearchParams();
  useHydrateAuthUser();

  const [pickerTier, setPickerTier] = useState<Exclude<PremiumTier, 'free'> | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const preselectGuildId = searchParams.get('guild');

  // Admin-controlled kill switch; fails closed (coming soon) while loading
  // or if the API is unreachable.
  const billingStatus = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => subscriptionsApi.getBillingStatus(),
    staleTime: 60_000,
    retry: false,
  });
  const billingEnabled = billingStatus.data?.billing_enabled ?? false;

  const selectTier = (tier: Exclude<PremiumTier, 'free'>) => {
    if (!token) {
      startLogin();
      return;
    }
    if (!billingEnabled) {
      showToast('Pricing checkout is coming soon.', 'info');
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
    if (preselectGuildId && token && !pickerTier) {
      setPickerTier('pro');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectGuildId, token]);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={user} />

      <div style={{ flex: 1, padding: '48px 24px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '34px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(0,217,255,0.1)', border: '1px solid var(--border-cyan)',
            color: 'var(--primary-color)', borderRadius: '999px', padding: '6px 16px',
            fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em',
          }}>
            <Gem size={16} /> PRICING
          </span>
          <h1 style={{
            fontSize: '42px',
            lineHeight: 1.05,
            fontWeight: 900,
            color: 'var(--text-primary)',
            margin: '18px auto 12px',
            maxWidth: '860px',
          }}>
            Unlock the Full Power of Acosmibot
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '17px', lineHeight: 1.65, maxWidth: '690px', margin: '0 auto' }}>
            Upgrade stream alerts, custom commands, reaction roles, embeds, and AI tools without changing how your community already uses Discord.
          </p>
          <div style={{
            margin: '18px auto 0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
          }}>
            <span>Per-server subscriptions</span>
            <span style={{ color: 'var(--border-light)' }}>•</span>
            <span>{billingInterval === 'monthly' ? 'Monthly pricing shown' : 'Annual pricing shown'}</span>
          </div>
        </div>

        <div style={{
          margin: '0 auto 34px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
        }}>
          <PremiumStat icon={<Radio size={18} />} value="Twitch, YouTube, Kick" label="Live alerts for creator-led servers" />
          <PremiumStat icon={<BarChart3 size={18} />} value="Server analytics" label="Activity and member trends for admins" />
          <PremiumStat icon={<ShieldCheck size={18} />} value="Higher limits" label="More commands, role messages, and embeds" />
          <PremiumStat icon={<Sparkles size={18} />} value="AI tiers" label="AI starts on Pro with higher limits on Max" />
        </div>

        {/* Pricing cards */}
        <div className="pricing-plans-grid" style={{
          display: 'grid',
          gap: '20px', alignItems: 'stretch',
          overflow: 'visible',
          paddingTop: '16px',
          paddingBottom: '4px',
        }}>
          {TIERS.map((t) => (
            <TierCard
              key={t.tier}
              def={t.tier === 'free' || billingEnabled
                ? t
                : { ...t, ctaNote: 'Checkout opens after billing launch' }}
              interval={billingInterval}
              onIntervalChange={setBillingInterval}
              loggedIn={!!token}
              onSelect={t.tier === 'free' ? undefined : () => selectTier(t.tier as Exclude<PremiumTier, 'free'>)}
            />
          ))}
        </div>

        <div style={{
          marginTop: '28px',
          border: '1px solid var(--border-light)',
          borderRadius: '12px',
          background: 'var(--bg-card)',
          padding: '18px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}>
          <PremiumNote title="Best for growth" text="Plus is for servers hitting free limits on creator alerts, commands, roles, or embeds." />
          <PremiumNote title="Server insights" text="Every plan includes analytics views for checking community activity and member trends." />
          <PremiumNote title="AI tiers" text="Free and Plus include 3 basic chat messages per day (90/month). Pro and Max add tools, memory, personalities, and higher caps." />
          <PremiumNote
            title="Billing"
            text={billingEnabled
              ? "Subscriptions are billed per server through Stripe. Change plans, switch billing intervals, or cancel anytime from your server's billing page."
              : 'Checkout is paused while billing configuration is finalized.'}
          />
        </div>
      </div>

      {pickerTier && (
        <ServerPickerModal
          tier={pickerTier}
          interval={billingInterval}
          billingEnabled={billingEnabled}
          preselectGuildId={preselectGuildId}
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
  onIntervalChange: (interval: BillingInterval) => void;
  loggedIn: boolean;
  onSelect?: () => void;
}> = ({ def, interval, onIntervalChange, onSelect }) => (
  <div style={{
    position: 'relative',
    background: def.popular
      ? 'linear-gradient(180deg, rgba(0,217,255,0.08), var(--bg-card) 34%)'
      : 'var(--bg-card)',
    border: `1px solid ${def.popular ? 'var(--border-cyan)' : 'var(--border-light)'}`,
    borderRadius: '16px', padding: '30px 24px 24px',
    display: 'flex', flexDirection: 'column', gap: '16px',
    boxShadow: def.popular ? '0 16px 42px rgba(0, 217, 255, 0.12)' : 'none',
  }}>
    {def.popular && (
      <span style={{
        position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--primary-color)', color: '#000', borderRadius: '999px',
        padding: '3px 14px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}>
        MOST POPULAR
      </span>
    )}
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        minHeight: def.tier === 'free' ? 0 : 34,
      }}>
        <h3 style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0,
        }}>
          {TIER_LABELS[def.tier]}
          {def.icon && <span style={{ color: 'var(--primary-color)', display: 'inline-flex' }}>{def.icon}</span>}
        </h3>
        {def.tier !== 'free' && (
          <BillingToggle interval={interval} onChange={onIntervalChange} />
        )}
      </div>
      <div style={{ marginTop: '8px', overflow: 'hidden' }}>
        <AnimatedPrice price={interval === 'annual' && def.annualPrice ? def.annualPrice : def.monthlyPrice} />
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          {def.tier === 'free' ? '' : interval === 'annual' ? '/year' : '/month'}
        </span>
      </div>
      <div style={{
        marginTop: '8px',
        color: def.popular ? 'var(--primary-color)' : 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {def.fit}
      </div>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.45 }}>
        {def.description}
      </p>
    </div>

    <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {def.features.map((f) => (
        <li key={f.text} style={{
          display: 'flex', alignItems: 'flex-start', gap: '8px',
          fontSize: '13px',
          color: f.disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        }}>
          {f.disabled
            ? <X size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
            : <Check size={15} color="var(--success-color, #3ecf8e)" style={{ flexShrink: 0, marginTop: 2 }} />}
          <span>{f.text}</span>
        </li>
      ))}
    </ul>

    {onSelect ? (
      <>
        <button
          onClick={onSelect}
          style={{
            background: def.popular ? 'var(--primary-color)' : 'transparent',
            color: def.popular ? '#000' : 'var(--primary-color)',
            border: def.popular ? 'none' : '1px solid var(--border-cyan)',
            borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {def.ctaLabel ?? 'Select Server'}
          <ArrowRight size={16} />
        </button>
        {def.ctaNote && (
          <div style={{ minHeight: '16px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
            {def.ctaNote}
          </div>
        )}
      </>
    ) : (
      <button disabled style={{
        background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none',
        borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'default',
      }}>
        {def.ctaLabel ?? 'Current Plan'}
      </button>
    )}
  </div>
);

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

    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
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
    <span style={{ display: 'inline-block', fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', minWidth: '4ch' }}>
      {label}
    </span>
  );
};

const PremiumStat: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <div style={{
    border: '1px solid var(--border-light)',
    borderRadius: '12px',
    background: 'var(--bg-card)',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }}>
    <div style={{
      width: 36,
      height: 36,
      borderRadius: '10px',
      border: '1px solid var(--border-cyan)',
      color: 'var(--primary-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800 }}>{value}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.35 }}>{label}</div>
    </div>
  </div>
);

const PremiumNote: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div>
    <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800, marginBottom: '4px' }}>
      {title}
    </div>
    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.45 }}>
      {text}
    </div>
  </div>
);

const BillingToggle: React.FC<{
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
}> = ({ interval, onChange }) => (
  <div
    style={{
      display: 'inline-flex',
      border: '1px solid var(--border-light)',
      borderRadius: 8,
      padding: 3,
      background: 'rgba(0, 0, 0, 0.12)',
    }}
  >
    {(['monthly', 'annual'] as const).map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        aria-pressed={interval === option}
        style={{
          border: 'none',
          borderRadius: 6,
          padding: '4px 8px',
          minWidth: 58,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 800,
          lineHeight: 1.2,
          color: interval === option ? '#000' : 'var(--text-secondary)',
          background: interval === option ? 'var(--primary-color)' : 'transparent',
          textTransform: 'capitalize',
        }}
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
  onClose: () => void;
}> = ({ tier, interval, billingEnabled, preselectGuildId, onClose }) => {
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

  const checkout = useMutation({
    mutationFn: (guild: Guild) =>
      subscriptionsApi.createCheckout({
        guild_id: guild.id,
        tier,
        interval,
        success_url: `${window.location.origin}/pricing?success=true`,
        cancel_url: `${window.location.origin}/pricing?canceled=true`,
      }),
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
    checkout.mutate(guild);
  };

  // Guilds that already pay go to the billing page, which previews the
  // prorated amount and confirms before changing anything.
  const manage = (guild: Guild) => {
    navigate(`/server/${guild.id}/billing`);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', borderRadius: '16px',
          padding: '24px', maxWidth: '560px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Select a server to upgrade to {TIER_LABELS[tier]}
          </h3>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
          }}>
            <X size={20} />
          </button>
        </div>

        {guildsQuery.isLoading && (
          <p style={{ color: 'var(--text-secondary)' }}>Loading your servers…</p>
        )}
        {guildsQuery.isError && (
          <p style={{ color: 'var(--error-color, #ef4444)' }}>Failed to load servers. Please try again.</p>
        )}
        {guildsQuery.isSuccess && manageable.length === 0 && (
          <p style={{ color: 'var(--text-secondary)' }}>
            No servers found where you have admin permissions.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {manageable.map((g, i) => {
            const sub = subQueries[i]?.data;
            const guildTier = (sub?.tier ?? 'free') as PremiumTier;
            const hasPremium = guildTier !== 'free';
            const highlight = g.id === preselectGuildId;

            return (
              <div key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                background: 'var(--bg-secondary)',
                border: highlight ? '2px solid #ffd700' : '1px solid var(--border-light)',
                boxShadow: highlight ? '0 0 20px rgba(255,215,0,0.35)' : 'none',
                borderRadius: '12px', padding: '12px 14px',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                  backgroundImage: g.icon ? `url(https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128)` : 'none',
                  backgroundSize: 'cover', backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700,
                }}>
                  {!g.icon && g.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{g.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {(g.member_count ?? 0).toLocaleString()} members
                    <TierBadge tier={guildTier} />
                  </div>
                </div>
                {!hasPremium ? (
                  <button
                    onClick={() => upgrade(g)}
                    disabled={checkout.isPending}
                    style={{
                      background: 'var(--primary-color)', color: '#000', border: 'none',
                      borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700,
                      cursor: checkout.isPending ? 'default' : 'pointer',
                      opacity: checkout.isPending ? 0.7 : 1,
                    }}
                  >
                    {!billingEnabled ? 'Coming Soon' : checkout.isPending ? 'Opening…' : `Upgrade to ${TIER_LABELS[tier]}`}
                  </button>
                ) : (
                  <button
                    onClick={() => manage(g)}
                    style={{
                      background: 'transparent', color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Manage Billing
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TierBadge: React.FC<{ tier: PremiumTier }> = ({ tier }) => {
  if (tier === 'free') {
    return <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Free</span>;
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '11px', fontWeight: 700, color: 'var(--primary-color)',
    }}>
      {(tier === 'pro' || tier === 'max') && <Bot size={12} />}
      <Gem size={12} /> {TIER_LABELS[tier]}
    </span>
  );
};

export default PricingPage;
