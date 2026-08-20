import React from 'react';
import { FeatureToggle } from '@/components/ui';
import { BlackjackConfig } from '@/types/features';

// Mirrors CARD_SETS in acosmibot-core/acosmibot_core/entities/blackjack_game.py.
// To add a new deck later: upload the emoji to the bot, add the set in
// blackjack_game.py (CARD_SETS), then add an entry here with a matching `id`
// and a few preview card emoji markups (<:name:id>).
interface CardSet {
  id: string;
  label: string;
  description: string;
  preview: string[];
}

const CARD_SETS: CardSet[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Traditional red & black suits.',
    preview: [
      '<:acosmibot_acespadeblack:1522433637054939156>',
      '<:acosmibot_aceheartred:1522433646609301585>',
      '<:acosmibot_backcard:1522631971275149314>',
    ],
  },
  {
    id: 'cyan',
    label: 'Cyan Neon',
    description: 'Cyan-on-dark neon deck.',
    preview: [
      '<:aceblackspade:1523826170767081663>',
      '<:acecyanheart:1523826151661895761>',
      '<:backcard:1523826150017601636>',
    ],
  },
];

const DEFAULT_CARD_SET = 'classic';

/** Render a single custom-emoji card markup as its Discord CDN image. */
const CardEmoji: React.FC<{ markup: string }> = ({ markup }) => {
  const m = markup.match(/^<(a?):([^:]+):(\d+)>$/);
  if (!m) return <span>{markup}</span>;
  const animated = m[1] === 'a';
  const name = m[2];
  const id = m[3];
  const primary = animated ? 'gif' : 'png';
  return (
    <img
      src={`https://cdn.discordapp.com/emojis/${id}.${primary}`}
      alt={name}
      title={name}
      style={{ width: 40, height: 56, objectFit: 'contain' }}
      onError={(ev) => {
        const img = ev.currentTarget;
        if (!img.dataset.fallback) {
          img.dataset.fallback = '1';
          img.src = `https://cdn.discordapp.com/emojis/${id}.webp`;
        }
      }}
    />
  );
};

interface BlackjackSectionProps {
  value: BlackjackConfig;
  onChange: (updates: Partial<BlackjackConfig>) => void;
}

export const BlackjackSection: React.FC<BlackjackSectionProps> = ({ value, onChange }) => {
  const selected =
    (typeof value.card_set === 'string' && value.card_set) || DEFAULT_CARD_SET;
  const disabled = !value.enabled;

  return (
    <>
      <p className="text-muted" style={{ marginTop: 0 }}>
        Play blackjack against the dealer with <code>/games blackjack</code>.
      </p>
      <FeatureToggle
        enabled={value.enabled}
        onChange={(v) => onChange({ enabled: v })}
        description="Enable /games blackjack in this server."
      />

      <div
        style={{
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          transition: 'opacity 0.2s',
          marginTop: 12,
        }}
      >
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Card Design</h3>
        <p className="text-muted" style={{ marginTop: 0, fontSize: 13 }}>
          Choose the emoji deck used to render hands in this server.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {CARD_SETS.map((set) => {
            const isSelected = set.id === selected;
            return (
              <button
                key={set.id}
                type="button"
                onClick={() => onChange({ card_set: set.id })}
                className="card"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: 12,
                  minWidth: 200,
                  border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-light)'}`,
                  background: isSelected ? 'rgba(0,217,255,0.08)' : 'var(--bg-overlay)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong>{set.label}</strong>
                  {isSelected && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        color: 'var(--primary-color)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Selected
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                  {set.preview.map((mk, i) => (
                    <CardEmoji key={i} markup={mk} />
                  ))}
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {set.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
