import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  LockKeyhole,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { FeatureToggle } from '@/components/ui';
import { GuildEmoji } from '@/hooks/useGuildEmojis';
import { SlotSymbolSet, SlotsConfig, SlotsTier } from '@/types/features';
import { EmojiPicker } from '../slots/EmojiPicker';
import {
  ACOSMIBOT_SLOT_CATALOG,
  ACOSMIBOT_SLOT_SET_ID,
  MAX_CUSTOM_SLOT_SETS,
  SLOT_TIER_LIMITS,
  SLOT_TIERS,
  cloneSlotTiers,
  createAcosmibotSlotSet,
  getAcosmibotSlotEmoji,
  uniqueSlotSetIdentity,
} from './slotSets';

interface TierMeta {
  tier: SlotsTier;
  title: string;
  badge: string;
  description: string;
}

const TIERS: TierMeta[] = [
  { tier: 'common', title: 'Common', badge: 'Most frequent', description: 'The reel’s everyday signals.' },
  { tier: 'uncommon', title: 'Uncommon', badge: 'Medium frequency', description: 'Stronger symbols with better matching value.' },
  { tier: 'rare', title: 'Rare', badge: 'Less frequent', description: 'Harder to land and worth more.' },
  { tier: 'legendary', title: 'Legendary', badge: 'Very rare', description: 'The set’s highest-value signature symbol.' },
  { tier: 'scatter', title: 'Scatter', badge: 'Bonus trigger', description: 'Consecutive scatters can open free spins.' },
];

const FALLBACK_EXTS: Record<string, string[]> = {
  gif: ['webp', 'png'],
  png: ['webp', 'gif'],
};

const isCustomEmoji = (value: string): boolean => /^<a?:[^:]+:\d+>$/.test(value);

const SlotGlyph: React.FC<{ value: string; size?: number }> = ({ value, size = 36 }) => {
  const catalogEmoji = getAcosmibotSlotEmoji(value);
  if (catalogEmoji) {
    return <img src={catalogEmoji.image} alt={catalogEmoji.name} title={catalogEmoji.name} width={size} height={size} />;
  }

  const match = value.match(/^<(a?):([^:]+):(\d+)>$/);
  if (match) {
    const animated = match[1] === 'a';
    const name = match[2];
    const id = match[3];
    const primary = animated ? 'gif' : 'png';
    const url = (ext: string) =>
      `https://cdn.discordapp.com/emojis/${id}.${ext}${ext === 'webp' && animated ? '?animated=true' : ''}`;
    return (
      <img
        src={url(primary)}
        alt={name}
        title={name}
        width={size}
        height={size}
        onError={(event) => {
          const image = event.currentTarget;
          const tried = (image.dataset.tried ?? primary).split(',');
          const next = FALLBACK_EXTS[primary]?.find(extension => !tried.includes(extension));
          if (next) {
            image.dataset.tried = [...tried, next].join(',');
            image.src = url(next);
          }
        }}
      />
    );
  }
  return <span className="slot-glyph__unicode" aria-label={value}>{value}</span>;
};

const previewValues = (set: SlotSymbolSet): string[] => [
  ...set.tier_emojis.common.slice(0, 2),
  ...set.tier_emojis.uncommon.slice(0, 1),
  ...set.tier_emojis.rare.slice(0, 1),
  ...set.tier_emojis.legendary.slice(0, 1),
  ...set.tier_emojis.scatter.slice(0, 1),
].slice(0, 6);

interface SlotsSectionProps {
  value: SlotsConfig;
  onChange: (updates: Partial<SlotsConfig>) => void;
  availableEmojis: GuildEmoji[];
}

export const SlotsSection: React.FC<SlotsSectionProps> = ({ value, onChange, availableEmojis }) => {
  const [selectedSetId, setSelectedSetId] = useState(value.active_set_id);
  const [pickerTier, setPickerTier] = useState<SlotsTier | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    if (!value.symbol_sets.some(set => set.id === selectedSetId)) {
      setSelectedSetId(value.active_set_id);
    }
  }, [selectedSetId, value.active_set_id, value.symbol_sets]);

  useEffect(() => setDeleteArmed(false), [selectedSetId]);

  const selectedSet = value.symbol_sets.find(set => set.id === selectedSetId)
    ?? value.symbol_sets[0]
    ?? createAcosmibotSlotSet();
  const isBuiltIn = selectedSet.id === ACOSMIBOT_SLOT_SET_ID || selectedSet.built_in;
  const isActive = value.active_set_id === selectedSet.id;
  const customSetCount = value.symbol_sets.filter(set => !set.built_in).length;
  const editorDisabled = !value.enabled || isBuiltIn;

  const allUsed = useMemo(
    () => SLOT_TIERS.flatMap(tier => selectedSet.tier_emojis[tier] ?? []),
    [selectedSet],
  );

  const nameError = useMemo(() => {
    if (isBuiltIn) return '';
    const trimmed = selectedSet.name.trim();
    if (!trimmed) return 'Give this set a name.';
    if (trimmed.length > 40) return 'Set names can be up to 40 characters.';
    const duplicate = value.symbol_sets.some(
      set => set.id !== selectedSet.id && set.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    return duplicate ? 'Set names must be unique.' : '';
  }, [isBuiltIn, selectedSet.id, selectedSet.name, value.symbol_sets]);

  const updateSet = (setId: string, updates: Partial<SlotSymbolSet>) => {
    onChange({
      symbol_sets: value.symbol_sets.map(set => set.id === setId ? { ...set, ...updates } : set),
    });
  };

  const createSetFrom = (source: SlotSymbolSet, baseName: string) => {
    if (customSetCount >= MAX_CUSTOM_SLOT_SETS) return;
    const identity = uniqueSlotSetIdentity(baseName, value.symbol_sets);
    const created: SlotSymbolSet = {
      ...identity,
      built_in: false,
      tier_emojis: cloneSlotTiers(source.tier_emojis),
    };
    onChange({ symbol_sets: [...value.symbol_sets, created] });
    setSelectedSetId(created.id);
  };

  const createNewSet = () => createSetFrom(
    value.symbol_sets[0] ?? createAcosmibotSlotSet(),
    'Custom Set',
  );

  const duplicateSelected = () => createSetFrom(selectedSet, `${selectedSet.name} Copy`);

  const deleteSelected = () => {
    if (isBuiltIn) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    const nextSets = value.symbol_sets.filter(set => set.id !== selectedSet.id);
    onChange({
      symbol_sets: nextSets,
      active_set_id: isActive ? ACOSMIBOT_SLOT_SET_ID : value.active_set_id,
    });
    setSelectedSetId(ACOSMIBOT_SLOT_SET_ID);
    setDeleteArmed(false);
  };

  const openPickerAdd = (tier: SlotsTier) => {
    if (editorDisabled) return;
    setPickerTier(tier);
    setReplaceIndex(null);
  };

  const openPickerReplace = (tier: SlotsTier, index: number) => {
    if (editorDisabled) return;
    setPickerTier(tier);
    setReplaceIndex(index);
  };

  const closePicker = () => {
    setPickerTier(null);
    setReplaceIndex(null);
  };

  const handleSelectEmoji = (emoji: string) => {
    if (!pickerTier || editorDisabled) return;
    const tierEmojis = [...selectedSet.tier_emojis[pickerTier]];
    if (replaceIndex !== null) tierEmojis[replaceIndex] = emoji;
    else tierEmojis.push(emoji);
    updateSet(selectedSet.id, {
      tier_emojis: { ...selectedSet.tier_emojis, [pickerTier]: tierEmojis },
    });
    closePicker();
  };

  const removeEmoji = (tier: SlotsTier, index: number) => {
    if (editorDisabled) return;
    const tierEmojis = [...selectedSet.tier_emojis[tier]];
    tierEmojis.splice(index, 1);
    updateSet(selectedSet.id, {
      tier_emojis: { ...selectedSet.tier_emojis, [tier]: tierEmojis },
    });
  };

  return (
    <div className="slots-workspace">
      <FeatureToggle
        enabled={value.enabled}
        onChange={(enabled) => onChange({ enabled })}
        description="Enable the slots game in this server. Symbol sets remain saved while the game is off."
      />

      <section className="slot-set-library" aria-labelledby="slot-set-library-title">
        <div className="slot-set-library__heading">
          <div>
            <h3 id="slot-set-library-title">Symbol sets</h3>
            <p>Choose the reel identity now, or keep multiple sets ready for future events.</p>
          </div>
          <button
            type="button"
            className="btn slot-set-library__create"
            onClick={createNewSet}
            disabled={!value.enabled || customSetCount >= MAX_CUSTOM_SLOT_SETS}
          >
            <Plus size={17} aria-hidden="true" />
            New set
          </button>
        </div>

        <div className="slot-set-grid" role="list" aria-label="Saved slot symbol sets">
          {value.symbol_sets.map(set => {
            const active = set.id === value.active_set_id;
            const selected = set.id === selectedSet.id;
            return (
              <article
                key={set.id}
                className={`slot-set-card${selected ? ' is-selected' : ''}${active ? ' is-active' : ''}`}
                role="listitem"
              >
                <button
                  type="button"
                  className="slot-set-card__select"
                  onClick={() => setSelectedSetId(set.id)}
                  aria-pressed={selected}
                >
                  <span className="slot-set-card__topline">
                    <strong>{set.name}</strong>
                    <span className="slot-set-card__badges">
                      {set.built_in && <span className="slot-set-badge is-default">Default</span>}
                      {active && <span className="slot-set-badge is-active"><Radio size={11} /> Active</span>}
                    </span>
                  </span>
                  <span className="slot-set-card__preview" aria-hidden="true">
                    {previewValues(set).map((emoji, index) => (
                      <span key={`${emoji}-${index}`} className="slot-set-card__glyph">
                        <SlotGlyph value={emoji} size={28} />
                      </span>
                    ))}
                  </span>
                  <span className="slot-set-card__meta">
                    {set.built_in ? 'Bot-owned catalog · always available' : 'Custom server set'}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
        <p className="slot-set-library__count">
          {customSetCount} of {MAX_CUSTOM_SLOT_SETS} custom sets saved in this draft
        </p>
      </section>

      <section className="slot-set-editor" aria-labelledby="slot-set-editor-title">
        <div className="slot-set-editor__header">
          <div className="slot-set-editor__identity">
            {isBuiltIn ? (
              <>
                <span className="slot-set-editor__icon"><Sparkles size={20} aria-hidden="true" /></span>
                <div>
                  <h3 id="slot-set-editor-title">Acosmibot</h3>
                  <p><LockKeyhole size={13} aria-hidden="true" /> Protected core set · duplicate it to customize</p>
                </div>
              </>
            ) : (
              <div className="slot-set-name-field">
                <label htmlFor={`slot-set-name-${selectedSet.id}`}>Set name</label>
                <input
                  id={`slot-set-name-${selectedSet.id}`}
                  value={selectedSet.name}
                  onChange={(event) => updateSet(selectedSet.id, { name: event.target.value })}
                  maxLength={40}
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? 'slot-set-name-error' : undefined}
                />
                {nameError && <span id="slot-set-name-error" className="slot-set-name-error">{nameError}</span>}
              </div>
            )}
          </div>

          <div className="slot-set-editor__actions">
            {!isActive && (
              <button
                type="button"
                className="btn primary"
                onClick={() => onChange({ active_set_id: selectedSet.id })}
                disabled={!value.enabled || Boolean(nameError)}
              >
                <Radio size={16} aria-hidden="true" />
                Use this set
              </button>
            )}
            {isActive && (
              <span className="slot-set-editor__active"><Check size={16} aria-hidden="true" /> Active set</span>
            )}
            <button
              type="button"
              className="btn"
              onClick={duplicateSelected}
              disabled={!value.enabled || customSetCount >= MAX_CUSTOM_SLOT_SETS}
            >
              <Copy size={16} aria-hidden="true" />
              Duplicate
            </button>
            {!isBuiltIn && (
              <>
                <button
                  type="button"
                  className={`btn slot-set-delete${deleteArmed ? ' is-armed' : ''}`}
                  onClick={deleteSelected}
                  disabled={!value.enabled}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {deleteArmed ? 'Confirm delete' : 'Delete set'}
                </button>
                {deleteArmed && (
                  <button type="button" className="btn" onClick={() => setDeleteArmed(false)}>
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {!isActive && (
          <div className="slot-set-editor__notice" role="status">
            Editing this saved set will not change live reels until you choose “Use this set” and save.
          </div>
        )}

        <div className={`slot-tier-list${!value.enabled ? ' is-disabled' : ''}`}>
          {TIERS.map(meta => {
            const emojis = selectedSet.tier_emojis[meta.tier] ?? [];
            const limit = SLOT_TIER_LIMITS[meta.tier];
            const full = emojis.length >= limit;
            return (
              <section key={meta.tier} className={`slot-tier slot-tier--${meta.tier}`}>
                <div className="slot-tier__heading">
                  <div>
                    <span className="slot-tier__titleline">
                      <h4>{meta.title}</h4>
                      <span className="slot-tier__badge">{meta.badge}</span>
                    </span>
                    <p>{meta.description}</p>
                  </div>
                  <span className="slot-tier__count">{emojis.length} / {limit}</span>
                </div>

                <div className="slot-tier__symbols">
                  {emojis.map((emoji, index) => (
                    <div key={`${emoji}-${index}`} className="slot-symbol">
                      {editorDisabled ? (
                        <div className="slot-symbol__locked" title={getAcosmibotSlotEmoji(emoji)?.name ?? emoji}>
                          <SlotGlyph value={emoji} />
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="slot-symbol__replace"
                            onClick={() => openPickerReplace(meta.tier, index)}
                            title={`Replace ${getAcosmibotSlotEmoji(emoji)?.name ?? (isCustomEmoji(emoji) ? 'server emoji' : emoji)}`}
                          >
                            <SlotGlyph value={emoji} />
                          </button>
                          <button
                            type="button"
                            className="slot-symbol__remove"
                            onClick={() => removeEmoji(meta.tier, index)}
                            aria-label={`Remove symbol ${index + 1} from ${meta.title}`}
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {!isBuiltIn && (
                    <button
                      type="button"
                      className="slot-symbol-add"
                      onClick={() => openPickerAdd(meta.tier)}
                      disabled={full || !value.enabled}
                      aria-label={`Add symbol to ${meta.title}`}
                    >
                      <Plus size={19} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <EmojiPicker
        open={pickerTier !== null}
        onClose={closePicker}
        onSelect={handleSelectEmoji}
        serverEmojis={availableEmojis}
        applicationEmojis={ACOSMIBOT_SLOT_CATALOG}
        usedEmojis={allUsed}
      />
    </div>
  );
};
