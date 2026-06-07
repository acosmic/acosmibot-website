import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import { profileApi, type PublicProfile } from '@/api/profile';
import {
  cosmeticsApi,
  type Cosmetic,
  type CosmeticCatalog,
  type CosmeticType,
} from '@/api/cosmetics';
import { RankCard, CARD_WIDTH, CARD_HEIGHT } from '@/cards/RankCard';
import type { RankCardData } from '@/cards/types';

/**
 * Card Studio (`/card-studio`) — owner-only cosmetics shop + live rank-card
 * preview. Users spend their global bank balance on value-based cosmetics
 * (accent / background / ring) and equip one loadout; the same `<RankCard>`
 * the Discord `/rank` card renders is shown live as they configure it.
 */

// Mirrors the bot's leveling math (exp_for_level = level^2 * 100) so the preview
// XP bar reflects the user's real progress within their current level.
const expForLevel = (level: number): number => level * level * 100;

const SLOT_LABELS: Record<CosmeticType, string> = {
  accent: 'Accent',
  background: 'Background',
  ring: 'Avatar Ring',
};

const SLOT_ORDER: CosmeticType[] = ['accent', 'background', 'ring'];

const fmt = (n: number): string => n.toLocaleString('en-US');

/** Build the live preview payload from the user's real stats + selected loadout. */
function buildPreview(
  profile: PublicProfile | undefined,
  selected: Record<CosmeticType, Cosmetic | null>,
): RankCardData {
  const top = profile?.guilds?.[0] ?? null;
  const level = top?.level ?? profile?.global.level ?? 1;
  const totalExp = top?.exp ?? profile?.global.exp ?? 0;
  const rank = top?.rank ?? 1;

  const currentLevelExp = expForLevel(level);
  const nextLevelExp = expForLevel(level + 1);

  return {
    username: profile?.username ?? 'you',
    displayName: profile?.global_name || profile?.username || 'You',
    avatarUrl: profile?.avatar_url ?? '',
    guildName: top?.guild_name ?? 'your servers',
    rank,
    level,
    globalLevel: profile?.global.level ?? 0,
    currentExp: totalExp,
    expProgress: Math.max(0, totalExp - currentLevelExp),
    expNeeded: Math.max(1, nextLevelExp - currentLevelExp),
    loadout: {
      accentColor: selected.accent?.value,
      background: selected.background?.value,
      ringColor: selected.ring?.value,
    },
  };
}

export const CardStudioPage: React.FC = () => {
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useHydrateAuthUser();

  // Owner-only: bounce signed-out visitors home.
  useEffect(() => {
    if (!token) navigate('/', { replace: true });
  }, [token, navigate]);

  const { data: profile } = useQuery<PublicProfile>({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMyProfile(),
    enabled: !!token,
  });

  const {
    data: catalog,
    isLoading,
    isError,
  } = useQuery<CosmeticCatalog>({
    queryKey: ['cosmetics', 'catalog'],
    queryFn: () => cosmeticsApi.getCatalog(),
    enabled: !!token,
  });

  // Locally-selected cosmetic per slot, seeded from whatever is equipped.
  const [selected, setSelected] = useState<Record<CosmeticType, Cosmetic | null>>({
    accent: null,
    background: null,
    ring: null,
  });

  // Seed selection from the catalog's `equipped` flags once it loads.
  useEffect(() => {
    if (!catalog) return;
    const next: Record<CosmeticType, Cosmetic | null> = { accent: null, background: null, ring: null };
    for (const c of catalog.cosmetics) {
      if (c.equipped) next[c.type] = c;
    }
    setSelected(next);
  }, [catalog]);

  const equipMutation = useMutation({
    mutationFn: ({ type, cosmeticId }: { type: CosmeticType; cosmeticId: number | null }) =>
      cosmeticsApi.equip(type, cosmeticId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cosmetics'] });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: (cosmeticId: number) => cosmeticsApi.purchase(cosmeticId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cosmetics'] });
    },
  });

  const handleEquip = (c: Cosmetic) => {
    // Toggle off if it's already the selected one; otherwise equip it.
    const isSelected = selected[c.type]?.id === c.id;
    const nextId = isSelected ? null : c.id;
    setSelected((s) => ({ ...s, [c.type]: isSelected ? null : c }));
    equipMutation.mutate({ type: c.type, cosmeticId: nextId });
  };

  const handleBuy = async (c: Cosmetic) => {
    if (!window.confirm(`Buy "${c.name}" for ${fmt(c.price)} credits?`)) return;
    try {
      await purchaseMutation.mutateAsync(c.id);
      // Auto-equip the freshly bought cosmetic.
      setSelected((s) => ({ ...s, [c.type]: c }));
      await equipMutation.mutateAsync({ type: c.type, cosmeticId: c.id });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Purchase failed');
    }
  };

  const preview = useMemo(() => buildPreview(profile, selected), [profile, selected]);

  const byType = useMemo(() => {
    const map: Record<CosmeticType, Cosmetic[]> = { accent: [], background: [], ring: [] };
    for (const c of catalog?.cosmetics ?? []) map[c.type].push(c);
    return map;
  }, [catalog]);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={authUser} />

      <div style={{ flex: 1, padding: '32px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        <header style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Card Studio
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '14px' }}>
            Customize your <code>/rank</code> card. Changes apply instantly to Discord.
          </p>
        </header>

        {isLoading && <Centered emoji="⏳" title="Loading the shop…" />}
        {isError && <Centered emoji="⚠️" title="Couldn’t load cosmetics" subtitle="Try refreshing, or sign in again." />}

        {catalog && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
            {/* Left — configurator */}
            <div>
              <BalanceBadge balance={catalog.bank_balance} />
              {SLOT_ORDER.map((type) => (
                <SlotSection
                  key={type}
                  title={SLOT_LABELS[type]}
                  items={byType[type]}
                  selectedId={selected[type]?.id ?? null}
                  busy={equipMutation.isPending || purchaseMutation.isPending}
                  onEquip={handleEquip}
                  onBuy={handleBuy}
                />
              ))}
            </div>

            {/* Right — live preview (sticky on tall viewports) */}
            <div style={{ position: 'sticky', top: '24px' }}>
              <SectionTitle>Live Preview</SectionTitle>
              <CardPreview data={preview} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BalanceBadge: React.FC<{ balance: number }> = ({ balance }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'baseline', gap: '8px',
    background: 'var(--bg-card)', border: '1px solid var(--border-cyan)',
    borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
  }}>
    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Bank balance</span>
    <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-color)' }}>{fmt(balance)}</span>
    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>credits</span>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>{children}</h2>
);

const SlotSection: React.FC<{
  title: string;
  items: Cosmetic[];
  selectedId: number | null;
  busy: boolean;
  onEquip: (c: Cosmetic) => void;
  onBuy: (c: Cosmetic) => void;
}> = ({ title, items, selectedId, busy, onEquip, onBuy }) => (
  <div style={{ marginBottom: '24px' }}>
    <SectionTitle>{title}</SectionTitle>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
      {items.map((c) => (
        <Swatch key={c.id} cosmetic={c} selected={selectedId === c.id} busy={busy} onEquip={onEquip} onBuy={onBuy} />
      ))}
    </div>
  </div>
);

/** A single cosmetic tile: owned items click-to-equip, locked items show price + Buy. */
const Swatch: React.FC<{
  cosmetic: Cosmetic;
  selected: boolean;
  busy: boolean;
  onEquip: (c: Cosmetic) => void;
  onBuy: (c: Cosmetic) => void;
}> = ({ cosmetic, selected, busy, onEquip, onBuy }) => {
  const swatchStyle: React.CSSProperties =
    cosmetic.type === 'background' && /gradient/i.test(cosmetic.value)
      ? { background: cosmetic.value }
      : { backgroundColor: cosmetic.value };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${selected ? 'var(--border-cyan)' : 'var(--border-light)'}`,
        borderRadius: '12px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ ...swatchStyle, height: '52px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{cosmetic.name}</div>

      {cosmetic.owned ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onEquip(cosmetic)}
          style={{
            cursor: busy ? 'default' : 'pointer',
            border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 700,
            color: selected ? '#001014' : 'var(--text-primary)',
            background: selected ? 'var(--primary-color)' : 'var(--bg-tertiary)',
          }}
        >
          {selected ? 'Equipped ✓' : 'Equip'}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onBuy(cosmetic)}
          style={{
            cursor: busy ? 'default' : 'pointer',
            border: '1px solid var(--border-cyan)', borderRadius: '8px', padding: '6px 10px',
            fontSize: '12px', fontWeight: 700, color: 'var(--primary-color)', background: 'transparent',
          }}
        >
          {cosmetic.price === 0 ? 'Get — Free' : `Buy — ${fmt(cosmetic.price)}`}
        </button>
      )}
    </div>
  );
};

/** Scales the fixed-size 800×250 RankCard down to fit the preview column. */
const CardPreview: React.FC<{ data: RankCardData }> = ({ data }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / CARD_WIDTH));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: CARD_HEIGHT * scale, overflow: 'hidden' }}>
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <RankCard data={data} />
      </div>
    </div>
  );
};

const Centered: React.FC<{ emoji: string; title: string; subtitle?: string }> = ({ emoji, title, subtitle }) => (
  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{emoji}</div>
    <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</h2>
    {subtitle && <p style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
  </div>
);

export default CardStudioPage;
