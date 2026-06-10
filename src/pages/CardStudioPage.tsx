import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { ScaledRankCard } from '@/cards/ScaledRankCard';
import { buildRankCardData } from '@/cards/buildRankCardData';
import { OG_FRAME_DATA_URI } from '@/cards/ogOrnament';
import type { RankCardData } from '@/cards/types';

/**
 * Card Studio (`/card-studio`) — owner-only cosmetics shop + live rank-card
 * preview. Users spend their global bank balance on value-based cosmetics
 * (accent / background / ring) and equip one loadout; the same `<RankCard>`
 * the Discord `/rank` card renders is shown live as they configure it.
 */

const SLOT_LABELS: Record<CosmeticType, string> = {
  accent: 'Accent',
  background: 'Background',
  ring: 'Avatar Ring',
};

const SLOT_ORDER: CosmeticType[] = ['accent', 'background', 'ring'];

const fmt = (n: number): string => n.toLocaleString('en-US');

/** Price after the active shop discount (matches the backend's ceil rounding). */
const discounted = (price: number, discount: number): number =>
  discount > 0 ? Math.max(Math.ceil(price * (1 - discount)), 0) : price;

/** Build the live preview payload from the user's real stats + selected loadout. */
function buildPreview(
  profile: PublicProfile | undefined,
  selected: Record<CosmeticType, Cosmetic | null>,
): RankCardData {
  return buildRankCardData(profile, {
    accentColor: selected.accent?.value,
    background: selected.background?.value,
    ringColor: selected.ring?.value,
    backgroundKey: selected.background?.achievement_key ?? undefined,
  });
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

  // Locally-selected cosmetic per slot — drives the live preview. Includes
  // "try-on" of unowned cosmetics so users can see them before buying.
  const [selected, setSelected] = useState<Record<CosmeticType, Cosmetic | null>>({
    accent: null,
    background: null,
    ring: null,
  });

  // A purchase confirmation pending the user's OK (custom modal), and a notice
  // (error/info) message shown in its own modal.
  const [pendingBuy, setPendingBuy] = useState<Cosmetic | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Seed the selection from the catalog's `equipped` flags ONCE. After that the
  // user's clicks drive `selected`, so a refetch (after equip/purchase) doesn't
  // clobber an in-progress try-on of an unowned cosmetic.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!catalog || seededRef.current) return;
    const next: Record<CosmeticType, Cosmetic | null> = { accent: null, background: null, ring: null };
    for (const c of catalog.cosmetics) {
      if (c.equipped) next[c.type] = c;
    }
    setSelected(next);
    seededRef.current = true;
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

  // Clicking a tile previews it. Owned cosmetics also persist the equip (so the
  // change reaches Discord); unowned ones are a local "try-on" only.
  const handleTileClick = (c: Cosmetic) => {
    const isSelected = selected[c.type]?.id === c.id;
    if (c.owned) {
      // Toggle: re-clicking the equipped one clears the slot back to default.
      const nextId = isSelected ? null : c.id;
      setSelected((s) => ({ ...s, [c.type]: isSelected ? null : c }));
      equipMutation.mutate({ type: c.type, cosmeticId: nextId });
    } else {
      // Try-on: preview locally without touching the server.
      setSelected((s) => ({ ...s, [c.type]: c }));
    }
  };

  // The Buy button opens the confirmation modal; the actual purchase runs on OK.
  const confirmBuy = async () => {
    const c = pendingBuy;
    setPendingBuy(null);
    if (!c) return;
    try {
      await purchaseMutation.mutateAsync(c.id);
      // Auto-equip the freshly bought cosmetic.
      setSelected((s) => ({ ...s, [c.type]: c }));
      await equipMutation.mutateAsync({ type: c.type, cosmeticId: c.id });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Purchase failed');
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
          <nav style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '14px' }}>
            {authUser?.username && (
              <Link to={`/u/${authUser.username}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
                ← Back to profile
              </Link>
            )}
            <Link to="/settings" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              Settings
            </Link>
          </nav>
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
              <BalanceBadge balance={catalog.bank_balance} discount={catalog.shop_discount} />
              {SLOT_ORDER.map((type) => (
                <SlotSection
                  key={type}
                  title={SLOT_LABELS[type]}
                  items={byType[type]}
                  selectedId={selected[type]?.id ?? null}
                  busy={equipMutation.isPending || purchaseMutation.isPending}
                  discount={catalog.shop_discount}
                  onTileClick={handleTileClick}
                  onBuy={setPendingBuy}
                />
              ))}
            </div>

            {/* Right — live preview (sticky on tall viewports) */}
            <div style={{ position: 'sticky', top: '24px' }}>
              <SectionTitle>Live Preview</SectionTitle>
              <ScaledRankCard data={preview} />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
                Click any tile to preview it here. Owned items equip instantly;
                locked items are a try-on until you buy them.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Purchase confirmation */}
      {pendingBuy && (
        <Modal onClose={() => setPendingBuy(null)}>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {pendingBuy.price === 0 ? 'Add to your collection' : 'Confirm purchase'}
          </h3>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            {pendingBuy.price === 0
              ? <>Get <strong>{pendingBuy.name}</strong> for free?</>
              : (catalog?.shop_discount ?? 0) > 0
                ? <>Buy <strong>{pendingBuy.name}</strong> for{' '}
                    <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{fmt(pendingBuy.price)}</span>{' '}
                    <strong>{fmt(discounted(pendingBuy.price, catalog!.shop_discount))}</strong> credits?{' '}
                    <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>({Math.round(catalog!.shop_discount * 100)}% off)</span></>
                : <>Buy <strong>{pendingBuy.name}</strong> for <strong>{fmt(pendingBuy.price)}</strong> credits?</>}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <ModalButton variant="ghost" onClick={() => setPendingBuy(null)}>Cancel</ModalButton>
            <ModalButton variant="primary" onClick={confirmBuy}>
              {pendingBuy.price === 0 ? 'Get it' : 'Buy'}
            </ModalButton>
          </div>
        </Modal>
      )}

      {/* Error / info notice */}
      {notice && (
        <Modal onClose={() => setNotice(null)}>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Something went wrong
          </h3>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>{notice}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ModalButton variant="primary" onClick={() => setNotice(null)}>OK</ModalButton>
          </div>
        </Modal>
      )}
    </div>
  );
};

const BalanceBadge: React.FC<{ balance: number; discount: number }> = ({ balance, discount }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
    <div style={{
      display: 'inline-flex', alignItems: 'baseline', gap: '8px',
      background: 'var(--bg-card)', border: '1px solid var(--border-cyan)',
      borderRadius: '12px', padding: '12px 16px',
    }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Bank balance</span>
      <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-color)' }}>{fmt(balance)}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>credits</span>
    </div>
    {discount > 0 && (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b',
        borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#f59e0b',
      }}>
        🧿 {Math.round(discount * 100)}% shop discount active
      </div>
    )}
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
  discount: number;
  onTileClick: (c: Cosmetic) => void;
  onBuy: (c: Cosmetic) => void;
}> = ({ title, items, selectedId, busy, discount, onTileClick, onBuy }) => (
  <div style={{ marginBottom: '24px' }}>
    <SectionTitle>{title}</SectionTitle>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
      {items.map((c) => (
        <Swatch key={c.id} cosmetic={c} selected={selectedId === c.id} busy={busy} discount={discount} onTileClick={onTileClick} onBuy={onBuy} />
      ))}
    </div>
  </div>
);

/**
 * A single cosmetic tile. Clicking the tile previews it (owned items equip
 * instantly; unowned ones are a local try-on). Locked items also show a Buy
 * action that opens the purchase confirmation.
 */
const Swatch: React.FC<{
  cosmetic: Cosmetic;
  selected: boolean;
  busy: boolean;
  discount: number;
  onTileClick: (c: Cosmetic) => void;
  onBuy: (c: Cosmetic) => void;
}> = ({ cosmetic, selected, busy, discount, onTileClick, onBuy }) => {
  const swatchStyle: React.CSSProperties =
    cosmetic.type === 'background' && /gradient/i.test(cosmetic.value)
      ? { background: cosmetic.value }
      : { backgroundColor: cosmetic.value };

  const hasDiscount = discount > 0 && cosmetic.price > 0;
  const finalPrice = discounted(cosmetic.price, discount);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTileClick(cosmetic)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTileClick(cosmetic); } }}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${selected ? 'var(--border-cyan)' : 'var(--border-light)'}`,
        boxShadow: selected ? '0 0 0 1px var(--border-cyan)' : 'none',
        borderRadius: '12px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        cursor: 'pointer',
      }}
    >
      {cosmetic.achievement_key === 'og_member' ? (
        // Preview the OG card's actual ornamentation: gold gradient + filigree
        // frame (scaled to the tile) + a small embossed "OG".
        <div style={{ ...swatchStyle, position: 'relative', height: '52px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <span style={{
            position: 'absolute', right: '8px', top: '50%',
            transform: 'translateY(-50%) rotate(-10deg)', transformOrigin: 'center',
            fontFamily: 'Urbanist, sans-serif', fontWeight: 800, fontSize: '30px', lineHeight: 1,
            color: '#b98e1f', opacity: 0.55, textShadow: '-1px -1px 0 rgba(255,240,176,0.6), 1px 1px 0 rgba(20,14,0,0.7)',
          }}>OG</span>
          <img src={OG_FRAME_DATA_URI} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>
      ) : (
        <div style={{ ...swatchStyle, position: 'relative', height: '52px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          {hasDiscount && !cosmetic.owned && (
            <span style={{
              position: 'absolute', top: '4px', right: '4px',
              background: '#f59e0b', color: '#1a1a1a', borderRadius: '6px',
              padding: '1px 6px', fontSize: '10px', fontWeight: 800,
            }}>-{Math.round(discount * 100)}%</span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{cosmetic.name}</span>
        {cosmetic.owned && selected && (
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-color)' }}>Equipped ✓</span>
        )}
      </div>

      {cosmetic.owned ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {selected ? 'Click to remove' : 'Owned — click to equip'}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); onBuy(cosmetic); }}
          style={{
            cursor: busy ? 'default' : 'pointer',
            border: '1px solid var(--border-cyan)', borderRadius: '8px', padding: '6px 10px',
            fontSize: '12px', fontWeight: 700, color: 'var(--primary-color)', background: 'transparent',
          }}
        >
          {cosmetic.price === 0 ? (
            'Get — Free'
          ) : hasDiscount ? (
            <>Buy — <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{fmt(cosmetic.price)}</span> {fmt(finalPrice)}</>
          ) : (
            `Buy — ${fmt(cosmetic.price)}`
          )}
        </button>
      )}
    </div>
  );
};

/** A lightweight centered modal with a dimmed backdrop (click-out to close). */
const Modal: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', borderRadius: '16px',
        padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      {children}
    </div>
  </div>
);

const ModalButton: React.FC<{ variant: 'primary' | 'ghost'; onClick: () => void; children: React.ReactNode }> = ({ variant, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      cursor: 'pointer', borderRadius: '10px', padding: '8px 18px', fontSize: '14px', fontWeight: 700,
      ...(variant === 'primary'
        ? { border: 'none', background: 'var(--primary-color)', color: '#001014' }
        : { border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-primary)' }),
    }}
  >
    {children}
  </button>
);

const Centered: React.FC<{ emoji: string; title: string; subtitle?: string }> = ({ emoji, title, subtitle }) => (
  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{emoji}</div>
    <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</h2>
    {subtitle && <p style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
  </div>
);

export default CardStudioPage;
