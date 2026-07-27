/**
 * THESIS: Card Studio is a live material workbench, not a shop grid with a preview appended beside it.
 * OWN-WORLD: Observatory workbench, sticky card stage, three cosmetic trays, physical swatches, and literal ownership states.
 * STORY: Read balance, try a material, see the real rank card change, then equip owned pieces or confirm a purchase.
 * FIRST VIEWPORT: The live equipped card holds the left stage while balance and the first material tray begin on the right.
 * FORM: Fourth-ranked sticky-preview workbench structure; established world; seed 0038e941.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, Check, Coins, Hourglass, Palette, TriangleAlert } from 'lucide-react';
import { CenteredMessage } from '@/components/ui/CenteredMessage';
import { MemberNav } from '@/components/profile/MemberNav';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
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
import '@/styles/member.css';

const SLOT_LABELS: Record<CosmeticType, string> = {
  accent: 'Accent signals',
  background: 'Background fields',
  ring: 'Avatar rings',
};

const SLOT_NOTES: Record<CosmeticType, string> = {
  accent: 'Sets the primary signal color throughout the card.',
  background: 'Changes the card field while keeping data legible.',
  ring: 'Frames the member identity at the center of the card.',
};

const SLOT_ORDER: CosmeticType[] = ['accent', 'background', 'ring'];
const fmt = (value: number): string => value.toLocaleString('en-US');
const discounted = (price: number, discount: number): number =>
  discount > 0 ? Math.max(Math.ceil(price * (1 - discount)), 0) : price;

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
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) navigate('/', { replace: true });
  }, [token, navigate]);

  const profileQuery = useQuery<PublicProfile>({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMyProfile(),
    enabled: !!token,
  });

  const catalogQuery = useQuery<CosmeticCatalog>({
    queryKey: ['cosmetics', 'catalog'],
    queryFn: () => cosmeticsApi.getCatalog(),
    enabled: !!token,
  });

  const [selected, setSelected] = useState<Record<CosmeticType, Cosmetic | null>>({
    accent: null,
    background: null,
    ring: null,
  });
  const [pendingBuy, setPendingBuy] = useState<Cosmetic | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!catalogQuery.data || seededRef.current) return;
    const next: Record<CosmeticType, Cosmetic | null> = {
      accent: null,
      background: null,
      ring: null,
    };
    for (const cosmetic of catalogQuery.data.cosmetics) {
      if (cosmetic.equipped) next[cosmetic.type] = cosmetic;
    }
    setSelected(next);
    seededRef.current = true;
  }, [catalogQuery.data]);

  const equipMutation = useMutation({
    mutationFn: ({ type, cosmeticId }: { type: CosmeticType; cosmeticId: number | null }) =>
      cosmeticsApi.equip(type, cosmeticId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cosmetics'] }),
  });

  const purchaseMutation = useMutation({
    mutationFn: (cosmeticId: number) => cosmeticsApi.purchase(cosmeticId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cosmetics'] }),
  });

  const handlePreview = async (cosmetic: Cosmetic) => {
    const isSelected = selected[cosmetic.type]?.id === cosmetic.id;
    if (cosmetic.owned) {
      const previous = selected[cosmetic.type];
      const next = isSelected ? null : cosmetic;
      setSelected((current) => ({
        ...current,
        [cosmetic.type]: next,
      }));
      try {
        await equipMutation.mutateAsync({
          type: cosmetic.type,
          cosmeticId: next?.id ?? null,
        });
      } catch (error) {
        setSelected((current) => (
          current[cosmetic.type]?.id === next?.id
            ? { ...current, [cosmetic.type]: previous }
            : current
        ));
        setNotice({
          title: 'Couldn’t update your loadout',
          body: error instanceof Error ? error.message : 'The cosmetic could not be equipped.',
        });
      }
    } else {
      setSelected((current) => ({ ...current, [cosmetic.type]: cosmetic }));
    }
  };

  const confirmBuy = async () => {
    const cosmetic = pendingBuy;
    setPendingBuy(null);
    if (!cosmetic) return;
    const previous = selected[cosmetic.type];
    let purchased = false;
    try {
      await purchaseMutation.mutateAsync(cosmetic.id);
      purchased = true;
      setSelected((current) => ({ ...current, [cosmetic.type]: cosmetic }));
      await equipMutation.mutateAsync({ type: cosmetic.type, cosmeticId: cosmetic.id });
    } catch (error) {
      if (purchased) {
        setSelected((current) => (
          current[cosmetic.type]?.id === cosmetic.id
            ? { ...current, [cosmetic.type]: previous }
            : current
        ));
      }
      setNotice({
        title: purchased ? 'Purchased, but not equipped' : 'Purchase unavailable',
        body: purchased
          ? `${cosmetic.name} is now in your collection, but it could not be equipped. Try selecting it again.`
          : error instanceof Error ? error.message : 'The purchase could not be completed.',
      });
    }
  };

  const catalog = catalogQuery.data;
  const preview = useMemo(
    () => buildPreview(profileQuery.data, selected),
    [profileQuery.data, selected],
  );
  const byType = useMemo(() => {
    const map: Record<CosmeticType, Cosmetic[]> = { accent: [], background: [], ring: [] };
    for (const cosmetic of catalog?.cosmetics ?? []) map[cosmetic.type].push(cosmetic);
    return map;
  }, [catalog]);

  const busy = equipMutation.isPending || purchaseMutation.isPending;
  const studioLoading = catalogQuery.isLoading || profileQuery.isLoading;
  const studioError = catalogQuery.isError || profileQuery.isError;

  return (
    <div className="member-page studio-page">
      <PublicNav variant="observatory" />
      <MemberNav />

      <main className="member-main studio-main">
        <header className="member-header">
          <div>
            <p className="member-kicker">Rank-card workbench</p>
            <h1>Build your visible identity.</h1>
            <p>Try materials against your real <code>/rank</code> card. Owned pieces equip immediately in Discord.</p>
          </div>
          {catalog && <BalanceReadout balance={catalog.bank_balance} discount={catalog.shop_discount} />}
        </header>

        {studioLoading ? (
          <CenteredMessage icon={<Hourglass size={48} />} title="Loading the studio…" />
        ) : studioError ? (
          <section className="member-error">
            <TriangleAlert aria-hidden="true" />
            <h2>Couldn’t load the live studio.</h2>
            <p>Your profile and cosmetic catalog both need to be available before changes can be applied.</p>
            <button
              type="button"
              onClick={() => {
                profileQuery.refetch();
                catalogQuery.refetch();
              }}
            >
              Retry studio
            </button>
          </section>
        ) : catalog && profileQuery.data ? (
          <div className="studio-workbench">
            <aside className="studio-stage">
              <div className="studio-stage__heading">
                <span><Palette aria-hidden="true" /></span>
                <div><p>Live output</p><h2>Your rank card</h2></div>
                <small>{busy ? 'Applying…' : 'Preview ready'}</small>
              </div>
              <div className="studio-stage__card">
                <span className="studio-stage__orbit" aria-hidden="true" />
                <ScaledRankCard data={preview} />
              </div>
              <p>
                Select any material to preview it. Owned items equip immediately;
                unowned pieces remain a local try-on until purchase.
              </p>
              <dl>
                {SLOT_ORDER.map((type) => (
                  <div key={type}>
                    <dt>{SLOT_LABELS[type]}</dt>
                    <dd>{selected[type]?.name ?? 'Card default'}</dd>
                  </div>
                ))}
              </dl>
            </aside>

            <section className="studio-trays" aria-label="Cosmetic materials">
              {SLOT_ORDER.map((type) => (
                <SlotTray
                  key={type}
                  type={type}
                  items={byType[type]}
                  selectedId={selected[type]?.id ?? null}
                  busy={busy}
                  discount={catalog.shop_discount}
                  onPreview={handlePreview}
                  onBuy={setPendingBuy}
                />
              ))}
            </section>
          </div>
        ) : null}
      </main>

      {pendingBuy && (
        <StudioDialog
          title={pendingBuy.price === 0 ? 'Add to your collection' : 'Confirm purchase'}
          onClose={() => setPendingBuy(null)}
        >
          <p>
            {pendingBuy.price === 0
              ? <>Get <strong>{pendingBuy.name}</strong> for free?</>
              : (catalog?.shop_discount ?? 0) > 0
                ? <>Buy <strong>{pendingBuy.name}</strong> for{' '}
                    <del>{fmt(pendingBuy.price)}</del>{' '}
                    <strong>{fmt(discounted(pendingBuy.price, catalog!.shop_discount))}</strong> credits?
                  </>
                : <>Buy <strong>{pendingBuy.name}</strong> for <strong>{fmt(pendingBuy.price)}</strong> credits?</>}
          </p>
          <div className="studio-dialog__actions">
            <button type="button" onClick={() => setPendingBuy(null)}>Cancel</button>
            <button type="button" className="is-primary" onClick={confirmBuy}>
              {pendingBuy.price === 0 ? 'Get it' : 'Buy'}
            </button>
          </div>
        </StudioDialog>
      )}

      {notice && (
        <StudioDialog title={notice.title} onClose={() => setNotice(null)}>
          <p>{notice.body}</p>
          <div className="studio-dialog__actions">
            <button type="button" className="is-primary" onClick={() => setNotice(null)}>Close</button>
          </div>
        </StudioDialog>
      )}
      <SiteFooter />
    </div>
  );
};

const BalanceReadout: React.FC<{ balance: number; discount: number }> = ({ balance, discount }) => (
  <div className="studio-balance">
    <Coins aria-hidden="true" />
    <div><small>Bank balance</small><strong>{fmt(balance)} credits</strong></div>
    {discount > 0 && <span><BadgePercent aria-hidden="true" /> {Math.round(discount * 100)}% off</span>}
  </div>
);

const SlotTray: React.FC<{
  type: CosmeticType;
  items: Cosmetic[];
  selectedId: number | null;
  busy: boolean;
  discount: number;
  onPreview: (cosmetic: Cosmetic) => void;
  onBuy: (cosmetic: Cosmetic) => void;
}> = ({ type, items, selectedId, busy, discount, onPreview, onBuy }) => (
  <section className="studio-tray">
    <header>
      <div><p>{SLOT_NOTES[type]}</p><h2>{SLOT_LABELS[type]}</h2></div>
      <span>{items.length} materials</span>
    </header>
    {items.length > 0 ? (
      <div className="studio-tray__grid">
        {items.map((cosmetic) => (
          <CosmeticSwatch
            key={cosmetic.id}
            cosmetic={cosmetic}
            selected={selectedId === cosmetic.id}
            busy={busy}
            discount={discount}
            onPreview={onPreview}
            onBuy={onBuy}
          />
        ))}
      </div>
    ) : (
      <p className="studio-tray__empty">No materials are available for this slot.</p>
    )}
  </section>
);

const CosmeticSwatch: React.FC<{
  cosmetic: Cosmetic;
  selected: boolean;
  busy: boolean;
  discount: number;
  onPreview: (cosmetic: Cosmetic) => void;
  onBuy: (cosmetic: Cosmetic) => void;
}> = ({ cosmetic, selected, busy, discount, onPreview, onBuy }) => {
  const swatchStyle: React.CSSProperties =
    cosmetic.type === 'background' && /gradient/i.test(cosmetic.value)
      ? { background: cosmetic.value }
      : { backgroundColor: cosmetic.value };
  const hasDiscount = discount > 0 && cosmetic.price > 0;
  const finalPrice = discounted(cosmetic.price, discount);

  return (
    <article className={`studio-swatch${selected ? ' is-selected' : ''}${cosmetic.owned ? ' is-owned' : ''}`}>
      <button
        type="button"
        className="studio-swatch__preview"
        disabled={busy}
        onClick={() => onPreview(cosmetic)}
        aria-pressed={selected}
      >
        <span className="studio-swatch__material" style={swatchStyle}>
          {cosmetic.achievement_key === 'og_member' && (
            <>
              <strong>OG</strong>
              <img src={OG_FRAME_DATA_URI} alt="" />
            </>
          )}
          {hasDiscount && !cosmetic.owned && <i>-{Math.round(discount * 100)}%</i>}
        </span>
        <span className="studio-swatch__identity">
          <strong>{cosmetic.name}</strong>
          <small>{cosmetic.owned ? (selected ? 'Equipped' : 'Owned') : cosmetic.rarity}</small>
        </span>
        {selected && <Check aria-hidden="true" />}
      </button>
      {cosmetic.owned ? (
        <small className="studio-swatch__hint">{selected ? 'Select again to clear' : 'Select to equip'}</small>
      ) : (
        <button
          type="button"
          className="studio-swatch__buy"
          disabled={busy}
          onClick={() => onBuy(cosmetic)}
          aria-label={
            cosmetic.price === 0
              ? `Get ${cosmetic.name} free`
              : `Buy ${cosmetic.name} for ${fmt(finalPrice)} credits`
          }
        >
          {cosmetic.price === 0
            ? 'Get free'
            : hasDiscount
              ? <><del>{fmt(cosmetic.price)}</del> {fmt(finalPrice)} credits</>
              : `${fmt(cosmetic.price)} credits`}
        </button>
      )}
    </article>
  );
};

const StudioDialog: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="studio-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
};

export default CardStudioPage;
