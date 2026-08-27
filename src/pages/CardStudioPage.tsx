/**
 * THESIS: Card Studio is a live material workbench, not a shop grid with a preview appended beside it.
 * OWN-WORLD: Observatory workbench, sticky card stage, three cosmetic trays, physical swatches, and literal ownership states.
 * STORY: Read balance, try a material, see the real rank card change, then commit a saved loadout or confirm a purchase.
 * FIRST VIEWPORT: The live equipped card holds the left stage while balance and the first material tray begin on the right.
 * FORM: Fourth-ranked sticky-preview workbench structure; established world; seed 0038e941.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgePercent, Check, Coins, Hourglass, Palette, TriangleAlert } from 'lucide-react';
import { CenteredMessage } from '@/components/ui/CenteredMessage';
import { SaveBar } from '@/components/ui/SaveBar';
import { MemberNav } from '@/components/profile/MemberNav';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useAuthStore } from '@/store/auth';
import { profileApi, type PublicProfile } from '@/api/profile';
import {
  cosmeticsApi,
  type Cosmetic,
  type CosmeticCatalog,
  type CosmeticType,
  type LoadoutSlots,
} from '@/api/cosmetics';
import { ScaledRankCard } from '@/cards/ScaledRankCard';
import { buildRankCardData } from '@/cards/buildRankCardData';
import { OG_FRAME_DATA_URI } from '@/cards/ogOrnament';
import type { RankCardData } from '@/cards/types';
import '@/styles/member.css';

const SLOT_LABELS: Record<CosmeticType, string> = {
  accent: 'Accent color',
  background: 'Card background',
  ring: 'Avatar ring',
};

const SLOT_NOTES: Record<CosmeticType, string> = {
  accent: 'Changes both the LVL number and XP bar fill.',
  background: 'Changes the full 800×250 card behind your rank details.',
  ring: 'Changes the border and glow around your Discord avatar.',
};

const SLOT_ORDER: CosmeticType[] = ['background', 'ring', 'accent'];
const EMPTY_LOADOUT: LoadoutSlots = { accent: null, background: null, ring: null };
const fmt = (value: number): string => value.toLocaleString('en-US');
const discounted = (price: number, discount: number): number =>
  discount > 0 ? Math.max(Math.ceil(price * (1 - discount)), 0) : price;

function buildEquippedLoadout(catalog: CosmeticCatalog | undefined): LoadoutSlots | undefined {
  if (!catalog) return undefined;
  const loadout = { ...EMPTY_LOADOUT };
  for (const cosmetic of catalog.cosmetics) {
    if (cosmetic.equipped) loadout[cosmetic.type] = cosmetic.id;
  }
  return loadout;
}

function buildPreview(
  profile: PublicProfile | undefined,
  selected: Record<CosmeticType, Cosmetic | null>,
): RankCardData {
  return buildRankCardData(profile, {
    accentColor: selected.accent?.value,
    background: selected.background?.value,
    backgroundImageUrl: selected.background?.asset_url ?? undefined,
    layoutPreset: selected.background?.layout_preset,
    ringColor: selected.ring?.value,
    backgroundKey: selected.background?.achievement_key ?? undefined,
  });
}

export const CardStudioPage: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();

  const profileQuery = useQuery<PublicProfile>({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMyProfile(),
    enabled: isAuthenticated,
  });

  const catalogQuery = useQuery<CosmeticCatalog>({
    queryKey: ['cosmetics', 'catalog'],
    queryFn: () => cosmeticsApi.getCatalog(),
    enabled: isAuthenticated,
  });

  const catalog = catalogQuery.data;
  const savedLoadout = useMemo(() => buildEquippedLoadout(catalog), [catalog]);
  const {
    form: draftLoadout,
    setForm: setDraftLoadout,
    isDirty,
    resetForm,
  } = useDirtyState(savedLoadout);
  const [pendingBuy, setPendingBuy] = useState<Cosmetic | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const [activeType, setActiveType] = useState<CosmeticType>('background');

  const saveMutation = useMutation({
    mutationFn: async ({
      draft,
      baseline,
    }: {
      draft: LoadoutSlots;
      baseline: LoadoutSlots;
    }) => {
      for (const type of SLOT_ORDER) {
        if (draft[type] !== baseline[type]) {
          await cosmeticsApi.equip(type, draft[type]);
        }
      }
      return draft;
    },
    onSuccess: (nextLoadout) => {
      queryClient.setQueryData<CosmeticCatalog>(['cosmetics', 'catalog'], (current) => (
        current
          ? {
              ...current,
              cosmetics: current.cosmetics.map((cosmetic) => ({
                ...cosmetic,
                equipped: nextLoadout[cosmetic.type] === cosmetic.id,
              })),
            }
          : current
      ));
      return queryClient.invalidateQueries({ queryKey: ['cosmetics'] });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['cosmetics'] }),
  });

  const purchaseMutation = useMutation({
    mutationFn: (cosmeticId: number) => cosmeticsApi.purchase(cosmeticId),
    onSuccess: (response, cosmeticId) => {
      queryClient.setQueryData<CosmeticCatalog>(['cosmetics', 'catalog'], (current) => (
        current
          ? {
              ...current,
              bank_balance: response.bank_balance,
              cosmetics: current.cosmetics.map((cosmetic) => (
                cosmetic.id === cosmeticId ? { ...cosmetic, owned: true } : cosmetic
              )),
            }
          : current
      ));
      return queryClient.invalidateQueries({ queryKey: ['cosmetics'] });
    },
  });

  const handlePreview = (cosmetic: Cosmetic) => {
    if (!draftLoadout) return;
    const update: Partial<LoadoutSlots> = {
      [cosmetic.type]: draftLoadout[cosmetic.type] === cosmetic.id ? null : cosmetic.id,
    };
    setDraftLoadout(update);
  };

  const confirmBuy = async () => {
    const cosmetic = pendingBuy;
    setPendingBuy(null);
    if (!cosmetic) return;
    try {
      await purchaseMutation.mutateAsync(cosmetic.id);
      const update: Partial<LoadoutSlots> = { [cosmetic.type]: cosmetic.id };
      setDraftLoadout(update);
      setNotice({
        title: 'Added to your collection',
        body: `${cosmetic.name} is ready in your preview. Save changes when you’re ready to equip it.`,
      });
    } catch (error) {
      setNotice({
        title: 'Purchase unavailable',
        body: error instanceof Error ? error.message : 'The purchase could not be completed.',
      });
    }
  };

  const selected = useMemo(() => {
    const selectedByType: Record<CosmeticType, Cosmetic | null> = {
      accent: null,
      background: null,
      ring: null,
    };
    const loadout = draftLoadout ?? savedLoadout ?? EMPTY_LOADOUT;
    for (const cosmetic of catalog?.cosmetics ?? []) {
      if (loadout[cosmetic.type] === cosmetic.id) selectedByType[cosmetic.type] = cosmetic;
    }
    return selectedByType;
  }, [catalog, draftLoadout, savedLoadout]);
  const preview = useMemo(
    () => buildPreview(profileQuery.data, selected),
    [profileQuery.data, selected],
  );
  const byType = useMemo(() => {
    const map: Record<CosmeticType, Cosmetic[]> = { accent: [], background: [], ring: [] };
    for (const cosmetic of catalog?.cosmetics ?? []) map[cosmetic.type].push(cosmetic);
    return map;
  }, [catalog]);

  const unownedSelections = SLOT_ORDER
    .map((type) => selected[type])
    .filter((cosmetic): cosmetic is Cosmetic => Boolean(cosmetic && !cosmetic.owned));
  const saveValidationMessage = unownedSelections.length > 0
    ? `Buy ${unownedSelections.map((cosmetic) => cosmetic.name).join(', ')} before saving this loadout.`
    : undefined;

  const handleSave = () => {
    if (!draftLoadout || !savedLoadout || unownedSelections.length > 0) return;
    saveMutation.mutate({
      draft: { ...draftLoadout },
      baseline: { ...savedLoadout },
    });
  };

  const busy = saveMutation.isPending || purchaseMutation.isPending;
  const studioLoading = catalogQuery.isLoading || profileQuery.isLoading || !draftLoadout;
  const studioError = catalogQuery.isError || profileQuery.isError;

  return (
    <div className="member-page studio-page">
      <PublicNav variant="observatory" />
      <MemberNav />

      <main className="member-main studio-main">
        <header className="member-header">
          <div>
            <p className="member-kicker">Rank-card workbench</p>
            <h1>Build your identity.</h1>
            <p>Customize your real <code>/rank</code> card and preview every change before you commit it to Discord.</p>
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
                <small>
                  {saveMutation.isPending
                    ? 'Saving…'
                    : purchaseMutation.isPending
                      ? 'Adding…'
                      : isDirty ? 'Unsaved preview' : 'Saved loadout'}
                </small>
              </div>
              <div className="studio-stage__card">
                <span className="studio-stage__orbit" aria-hidden="true" />
                <ScaledRankCard data={preview} />
              </div>
              <p className="studio-stage__instruction">
                Every choice updates this preview. Save when you’re ready to update your <code>/rank</code> card in Discord.
              </p>
              <dl className="studio-stage__loadout">
                {SLOT_ORDER.map((type) => (
                  <div key={type}>
                    <dt>{SLOT_LABELS[type]}</dt>
                    <dd>{selected[type]?.name ?? 'Card default'}</dd>
                  </div>
                ))}
              </dl>
            </aside>

            <section className="studio-materials" aria-label="Rank-card materials">
              <div className="studio-slot-tabs" role="tablist" aria-label="Choose a card area">
                {SLOT_ORDER.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    id={`studio-tab-${type}`}
                    aria-selected={activeType === type}
                    aria-controls="studio-material-panel"
                    className={activeType === type ? 'is-active' : ''}
                    onClick={() => setActiveType(type)}
                  >
                    <i className={`studio-slot-tabs__icon is-${type}`} aria-hidden="true" />
                    <span><strong>{SLOT_LABELS[type]}</strong><small>{byType[type].length} choices</small></span>
                    <em>{selected[type]?.name ?? 'Default'}</em>
                  </button>
                ))}
              </div>

              <SlotTray
                type={activeType}
                items={byType[activeType]}
                selectedId={selected[activeType]?.id ?? null}
                avatarUrl={preview.avatarUrl}
                busy={busy}
                discount={catalog.shop_discount}
                onPreview={handlePreview}
                onBuy={setPendingBuy}
              />
            </section>
            <SaveBar
              isDirty={isDirty}
              onSave={handleSave}
              onDiscard={resetForm}
              isSaving={saveMutation.isPending}
              saveError={saveMutation.error}
              saveDisabled={unownedSelections.length > 0}
              validationTitle="Purchase previewed materials before saving"
              validationMessage={saveValidationMessage}
              dirtyTitle="Unsaved card changes"
              dirtyDescription="Review this preview, then save it to your /rank card in Discord."
              successMessage="Rank card saved"
            />
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
  avatarUrl: string;
  busy: boolean;
  discount: number;
  onPreview: (cosmetic: Cosmetic) => void;
  onBuy: (cosmetic: Cosmetic) => void;
}> = ({ type, items, selectedId, avatarUrl, busy, discount, onPreview, onBuy }) => (
  <section
    className={`studio-tray is-${type}`}
    role="tabpanel"
    id="studio-material-panel"
    aria-labelledby={`studio-tab-${type}`}
  >
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
            equipped={cosmetic.equipped}
            avatarUrl={avatarUrl}
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
  equipped: boolean;
  avatarUrl: string;
  busy: boolean;
  discount: number;
  onPreview: (cosmetic: Cosmetic) => void;
  onBuy: (cosmetic: Cosmetic) => void;
}> = ({ cosmetic, selected, equipped, avatarUrl, busy, discount, onPreview, onBuy }) => {
  const hasDiscount = discount > 0 && cosmetic.price > 0;
  const finalPrice = discounted(cosmetic.price, discount);

  const materialPreview = cosmetic.type === 'accent' ? (
    <span className="studio-swatch__material studio-swatch__material--accent">
      <b style={{ color: cosmetic.value }}>LVL&nbsp; 34</b>
      <span className="studio-accent-demo__track">
        <span style={{ backgroundColor: cosmetic.value }} />
      </span>
    </span>
  ) : cosmetic.type === 'ring' ? (
    <span className="studio-swatch__material studio-swatch__material--ring">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{
            borderColor: cosmetic.value,
            boxShadow: `0 0 10px ${cosmetic.value}`,
          }}
        />
      ) : (
        <span
          className="studio-ring-demo__fallback"
          style={{ borderColor: cosmetic.value, boxShadow: `0 0 10px ${cosmetic.value}` }}
        />
      )}
      <small>Your avatar</small>
    </span>
  ) : (
    <span
      className="studio-swatch__material studio-swatch__material--background"
      style={cosmetic.asset_url
        ? {
            backgroundImage: `url("${cosmetic.asset_url}")`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }
        : /gradient/i.test(cosmetic.value)
          ? { background: cosmetic.value }
          : { backgroundColor: cosmetic.value }}
    >
      {cosmetic.achievement_key === 'og_member' && (
        <>
          <strong>OG</strong>
          <img src={OG_FRAME_DATA_URI} alt="" />
        </>
      )}
    </span>
  );

  return (
    <article className={`studio-swatch${selected ? ' is-selected' : ''}${cosmetic.owned ? ' is-owned' : ''}`}>
      <button
        type="button"
        className="studio-swatch__preview"
        disabled={busy}
        onClick={() => onPreview(cosmetic)}
        aria-pressed={selected}
      >
        {materialPreview}
        {hasDiscount && !cosmetic.owned && (
          <i className="studio-swatch__discount">-{Math.round(discount * 100)}%</i>
        )}
        <span className="studio-swatch__identity">
          <strong>{cosmetic.name}</strong>
          <small>{selected && !equipped ? 'Previewing' : equipped ? 'Equipped' : cosmetic.owned ? 'Owned' : cosmetic.rarity}</small>
        </span>
        {selected && <Check aria-hidden="true" />}
      </button>
      {cosmetic.owned ? (
        <small className="studio-swatch__hint">
          {selected
            ? equipped ? 'Saved on your card' : 'Selected for preview'
            : equipped ? 'Currently saved' : 'Select to preview'}
        </small>
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
