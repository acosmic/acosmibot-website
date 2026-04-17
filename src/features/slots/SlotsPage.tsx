import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FeatureToggle, SaveBar, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { SlotsConfig, SlotsTier } from '@/types/features';
import { useSlotsConfig } from './useSlotsConfig';
import { EmojiPicker } from './EmojiPicker';

interface TierMeta {
  tier: SlotsTier;
  title: string;
  badge: string;
  description: string;
  limit: number;
  color: string;
}

const TIERS: TierMeta[] = [
  { tier: 'common',    title: 'Common Tier',    badge: 'Most Frequent',   description: 'These symbols appear most often on the reels.',            limit: 5, color: '#9e9e9e' },
  { tier: 'uncommon',  title: 'Uncommon Tier',  badge: 'Medium Frequency', description: 'These symbols appear moderately often.',                   limit: 3, color: '#4caf50' },
  { tier: 'rare',      title: 'Rare Tier',      badge: 'Less Frequent',   description: 'These symbols are harder to land.',                        limit: 1, color: '#2196f3' },
  { tier: 'legendary', title: 'Legendary Tier', badge: 'Very Rare',       description: 'These symbols rarely appear but give the biggest payouts.', limit: 2, color: '#ff9800' },
  { tier: 'scatter',   title: 'Scatter Tier',   badge: 'Special Symbol',  description: 'Scatter symbols can trigger bonus features.',              limit: 1, color: '#9c27b0' },
];

const isCustomEmoji = (v: string) => /^<a?:[^:]+:\d+>$/.test(v);

const renderEmoji = (value: string): React.ReactNode => {
  const m = value.match(/^<(a?):([^:]+):(\d+)>$/);
  if (m) {
    const animated = m[1] === 'a';
    const name = m[2];
    const id = m[3];
    const ext = animated ? 'gif' : 'png';
    return <img src={`https://cdn.discordapp.com/emojis/${id}.${ext}`} alt={name} title={name}
                style={{ width: 36, height: 36, objectFit: 'contain' }} />;
  }
  return <span>{value}</span>;
};

export const SlotsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, availableEmojis, isLoading, save, isSaving, saveError } = useSlotsConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<SlotsConfig>(data);

  const [pickerTier, setPickerTier] = useState<SlotsTier | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const allUsed = useMemo(() => {
    if (!form) return [] as string[];
    return TIERS.flatMap(t => form.tier_emojis[t.tier] ?? []);
  }, [form]);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  const openPickerAdd = (tier: SlotsTier) => {
    setPickerTier(tier);
    setReplaceIndex(null);
  };
  const openPickerReplace = (tier: SlotsTier, index: number) => {
    setPickerTier(tier);
    setReplaceIndex(index);
  };
  const closePicker = () => {
    setPickerTier(null);
    setReplaceIndex(null);
  };

  const handleSelectEmoji = (emoji: string) => {
    if (!pickerTier) return;
    const current = [...(form.tier_emojis[pickerTier] ?? [])];
    if (replaceIndex !== null) {
      current[replaceIndex] = emoji;
    } else {
      current.push(emoji);
    }
    setForm({
      tier_emojis: { ...form.tier_emojis, [pickerTier]: current },
    });
    closePicker();
  };

  const removeEmoji = (tier: SlotsTier, index: number) => {
    const current = [...(form.tier_emojis[tier] ?? [])];
    current.splice(index, 1);
    setForm({ tier_emojis: { ...form.tier_emojis, [tier]: current } });
  };

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Slots Machine</h1>
        <p>Configure the slot machine game for your server.</p>
      </div>

      <FeatureToggle
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="Enable the slots game in this server."
      />

      {TIERS.map(meta => {
        const emojis = form.tier_emojis[meta.tier] ?? [];
        const count = emojis.length;
        const full = count >= meta.limit;
        const sectionDisabled = !form.enabled;
        return (
          <div key={meta.tier} className="card mb-2" style={{ padding: '12px 16px', opacity: sectionDisabled ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{meta.title}</h3>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                background: hexToRgba(meta.color, 0.2), color: lighten(meta.color),
              }}>{meta.badge}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                · {meta.description}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 12 }}>
                {count} of {meta.limit}
              </span>
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8,
              background: 'rgba(0,0,0,0.2)', border: `1px solid ${meta.color}`,
              borderRadius: 6,
            }}>
              {emojis.map((e, i) => (
                <div
                  key={`${e}-${i}`}
                  onClick={() => !sectionDisabled && openPickerReplace(meta.tier, i)}
                  style={{
                    position: 'relative', width: 44, height: 44,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-overlay)', border: '1px solid var(--border-light)',
                    borderRadius: 8, fontSize: 22,
                    cursor: sectionDisabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(ev) => { if (!sectionDisabled) ev.currentTarget.style.borderColor = 'var(--primary-color)'; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = 'var(--border-light)'; }}
                >
                  {renderEmoji(e)}
                  <button
                    onClick={(ev) => { ev.stopPropagation(); if (!sectionDisabled) removeEmoji(meta.tier, i); }}
                    disabled={sectionDisabled}
                    title={isCustomEmoji(e) ? e : undefined}
                    style={{
                      position: 'absolute', top: -5, right: -5, width: 16, height: 16,
                      background: '#e74c3c', color: 'white', border: 'none',
                      borderRadius: '50%', fontSize: 11, lineHeight: 1,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => openPickerAdd(meta.tier)}
                disabled={full || sectionDisabled}
                style={{
                  width: 44, height: 44,
                  background: 'rgba(0,217,255,0.1)',
                  border: '1px dashed rgba(0,217,255,0.4)',
                  borderRadius: 8,
                  color: 'var(--primary-color)',
                  fontSize: 20, fontWeight: 600, lineHeight: 1,
                  cursor: (full || sectionDisabled) ? 'not-allowed' : 'pointer',
                  opacity: (full || sectionDisabled) ? 0.3 : 1,
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="Add emoji"
              >+</button>
            </div>
          </div>
        );
      })}

      <EmojiPicker
        open={pickerTier !== null}
        onClose={closePicker}
        onSelect={handleSelectEmoji}
        serverEmojis={availableEmojis}
        usedEmojis={allUsed}
      />

      <SaveBar
        isDirty={isDirty}
        onSave={() => save(form)}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function lighten(hex: string): string {
  const h = hex.replace('#', '');
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + 60);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + 60);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + 60);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
