import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Bot, Check, Gem, X } from 'lucide-react';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { guildApi } from '@/api/guilds';
import { subscriptionsApi, type PremiumTier } from '@/api/subscriptions';
import { showToast } from '@/utils/toast';
import { useAuthStore } from '@/store/auth';
import { startLogin, useHydrateAuthUser } from '@/lib/auth';
import type { Guild } from '@/types/guild';

// TEMPORARY: premium is gated to this user until it goes live.
// TODO: remove the allowlist when premium launches publicly.
const AUTHORIZED_USER_ID = '110637665128325120';

const TIER_LABELS: Record<PremiumTier, string> = {
  free: 'Free',
  premium: 'Premium',
  premium_plus_ai: 'Premium + AI',
};

interface TierCardDef {
  tier: PremiumTier;
  price: string;
  popular?: boolean;
  icon?: React.ReactNode;
  features: Array<{ text: string; disabled?: boolean }>;
}

const TIERS: TierCardDef[] = [
  {
    tier: 'free',
    price: '$0',
    features: [
      { text: 'Leveling & XP system' },
      { text: 'Economy, games & gambling' },
      { text: 'Server analytics' },
      { text: '1 Twitch streamer tracking' },
      { text: '1 YouTube streamer tracking' },
      { text: '1 custom command' },
      { text: '1 reaction role message' },
      { text: '5 custom embeds' },
      { text: 'No AI features', disabled: true },
      { text: 'No custom branding', disabled: true },
    ],
  },
  {
    tier: 'premium',
    price: '$4.99',
    popular: true,
    icon: <Gem size={18} />,
    features: [
      { text: 'Everything in Free, plus:' },
      { text: '5 Twitch streamers tracking' },
      { text: '5 YouTube streamers tracking' },
      { text: '25 custom commands' },
      { text: '10 reaction role messages' },
      { text: '100 custom embeds' },
      { text: 'Priority support' },
      { text: 'No AI features', disabled: true },
    ],
  },
  {
    tier: 'premium_plus_ai',
    price: '$9.99',
    icon: <span style={{ display: 'inline-flex', gap: 2 }}><Bot size={18} /><Gem size={18} /></span>,
    features: [
      { text: 'Everything in Premium, plus:' },
      { text: 'AI chat — mention the bot to talk (100 messages/day)' },
      { text: 'Custom AI personalities & instructions' },
      { text: 'Per-user AI memory' },
      { text: 'AI web search' },
      { text: 'Proactive ambient AI replies' },
      { text: 'AI image generation (50/month)' },
      { text: 'AI image analysis & vision (100/month)' },
    ],
  },
];

export const PremiumPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useHydrateAuthUser();

  const [pickerTier, setPickerTier] = useState<Exclude<PremiumTier, 'free'> | null>(null);
  const preselectGuildId = searchParams.get('guild');

  // TEMPORARY allowlist gate — everyone else bounces home with a notice.
  useEffect(() => {
    if (!token) return; // logged-out visitors can read the pricing page
    if (user && user.id !== AUTHORIZED_USER_ID) {
      showToast('Premium is not yet available.', 'info');
      navigate('/', { replace: true });
    }
  }, [user, token, navigate]);

  // Stripe return params
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      showToast('Premium upgrade successful! Your server now has access to all premium features.', 'success');
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('canceled') === 'true') {
      showToast('Upgrade canceled. You can upgrade anytime!', 'info');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // ?guild= deep link (e.g. from the AI page upsell) opens the picker directly.
  useEffect(() => {
    if (preselectGuildId && token && !pickerTier) {
      setPickerTier('premium_plus_ai');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectGuildId, token]);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={user} />

      <div style={{ flex: 1, padding: '48px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(0,217,255,0.1)', border: '1px solid var(--border-cyan)',
            color: 'var(--primary-color)', borderRadius: '999px', padding: '6px 16px',
            fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em',
          }}>
            <Gem size={16} /> PREMIUM
          </span>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', margin: '16px 0 8px' }}>
            Unlock the Full Power of Acosmibot
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '560px', margin: '0 auto' }}>
            Supercharge your Discord server with advanced features, unlimited AI capabilities, and priority support.
          </p>
        </div>

        {/* Pricing cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px', alignItems: 'stretch',
        }}>
          {TIERS.map((t) => (
            <TierCard
              key={t.tier}
              def={t}
              loggedIn={!!token}
              onSelect={t.tier === 'free' ? undefined : () => setPickerTier(t.tier as Exclude<PremiumTier, 'free'>)}
            />
          ))}
        </div>
      </div>

      {pickerTier && (
        <ServerPickerModal
          tier={pickerTier}
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
  loggedIn: boolean;
  onSelect?: () => void;
}> = ({ def, loggedIn, onSelect }) => (
  <div style={{
    position: 'relative',
    background: 'var(--bg-card)',
    border: `1px solid ${def.popular ? 'var(--border-cyan)' : 'var(--border-light)'}`,
    borderRadius: '16px', padding: '28px 24px',
    display: 'flex', flexDirection: 'column', gap: '16px',
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
      <h3 style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0,
      }}>
        {TIER_LABELS[def.tier]}
        {def.icon && <span style={{ color: 'var(--primary-color)', display: 'inline-flex' }}>{def.icon}</span>}
      </h3>
      <div style={{ marginTop: '8px' }}>
        <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>{def.price}</span>
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/month</span>
      </div>
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
          disabled={!loggedIn}
          onClick={onSelect}
          style={{
            background: def.popular ? 'var(--primary-color)' : 'transparent',
            color: def.popular ? '#000' : 'var(--primary-color)',
            border: def.popular ? 'none' : '1px solid var(--border-cyan)',
            borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700,
            cursor: loggedIn ? 'pointer' : 'default', opacity: loggedIn ? 1 : 0.5,
          }}
        >
          Select Server
        </button>
        {!loggedIn && (
          <button onClick={startLogin} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px',
            cursor: 'pointer', textDecoration: 'underline', padding: 0,
          }}>
            Please log in to select a server
          </button>
        )}
      </>
    ) : (
      <button disabled style={{
        background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none',
        borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'default',
      }}>
        Current Plan
      </button>
    )}
  </div>
);

/** Pick which admin/owner server to upgrade (or manage). */
const ServerPickerModal: React.FC<{
  tier: Exclude<PremiumTier, 'free'>;
  preselectGuildId: string | null;
  onClose: () => void;
}> = ({ tier, preselectGuildId, onClose }) => {
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

  const upgrade = (guild: Guild, targetTier: Exclude<PremiumTier, 'free'>) => {
    showToast('Premium checkout is coming soon.', 'info');

    // TODO: Re-enable Stripe checkout when premium billing is ready for production.
    // setBusyGuildId(guild.id);
    // try {
    //   showToast('Creating checkout session…', 'info');
    //   const res = await subscriptionsApi.createCheckout({
    //     guild_id: guild.id,
    //     tier: targetTier,
    //     success_url: `${window.location.origin}/premium?success=true&guild=${guild.id}`,
    //     cancel_url: `${window.location.origin}/premium?canceled=true`,
    //   });
    //   if (res.checkout_url) {
    //     window.location.href = res.checkout_url;
    //   } else {
    //     showToast(res.message || 'Failed to create checkout session', 'error');
    //     setBusyGuildId(null);
    //   }
    // } catch (e) {
    //   showToast(e instanceof Error ? e.message : 'Failed to create checkout session', 'error');
    //   setBusyGuildId(null);
    // }
    void guild;
    void targetTier;
  };

  const manage = (guild: Guild) => {
    showToast('Subscription management is coming soon.', 'info');

    // TODO: Re-enable Stripe billing portal when premium billing is ready for production.
    // setBusyGuildId(guild.id);
    // try {
    //   showToast('Opening subscription portal…', 'info');
    //   const res = await subscriptionsApi.openPortal({
    //     guild_id: guild.id,
    //     return_url: `${window.location.origin}/premium`,
    //   });
    //   if (res.portal_url) {
    //     window.location.href = res.portal_url;
    //   } else {
    //     showToast('Failed to open billing portal', 'error');
    //     setBusyGuildId(null);
    //   }
    // } catch {
    //   showToast('Failed to open billing portal', 'error');
    //   setBusyGuildId(null);
    // }
    void guild;
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

            // Premium server + Premium+AI selected → offer the upgrade path;
            // otherwise premium servers manage their existing subscription.
            const showUpgrade = !hasPremium || (guildTier === 'premium' && tier === 'premium_plus_ai');

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
                {showUpgrade ? (
                  <button
                    onClick={() => upgrade(g, guildTier === 'premium' ? 'premium_plus_ai' : tier)}
                    style={{
                      background: 'var(--primary-color)', color: '#000', border: 'none',
                      borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Coming Soon
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
                    Coming Soon
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
      {tier === 'premium_plus_ai' && <Bot size={12} />}
      <Gem size={12} /> {TIER_LABELS[tier]}
    </span>
  );
};

export default PremiumPage;
