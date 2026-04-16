import React, { useEffect, useMemo, useState } from 'react';
import { STANDARD_EMOJI_CATEGORIES } from './emojiData';
import { GuildEmoji } from './useSlotsConfig';

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  serverEmojis: GuildEmoji[];
  usedEmojis: string[];
}

type Tab = 'standard' | 'custom';

const buildCustomEmojiValue = (e: GuildEmoji): string =>
  `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  open, onClose, onSelect, serverEmojis, usedEmojis,
}) => {
  const [tab, setTab] = useState<Tab>('standard');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const usedSet = useMemo(() => new Set(usedEmojis), [usedEmojis]);

  const filteredServer = useMemo(() => {
    if (!query) return serverEmojis;
    const q = query.toLowerCase();
    return serverEmojis.filter(e => e.name.toLowerCase().includes(q));
  }, [serverEmojis, query]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
          borderRadius: '16px', width: '480px', maxWidth: '92vw', maxHeight: '82vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid var(--border-light)',
        }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Select Emoji</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              fontSize: '24px', cursor: 'pointer', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
          >×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
          {(['standard', 'custom'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px',
                background: tab === t ? 'var(--primary-color)' : 'transparent',
                border: '1px solid ' + (tab === t ? 'var(--primary-color)' : 'var(--border-light)'),
                borderRadius: 8,
                color: tab === t ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontSize: 14, cursor: 'pointer',
              }}
            >
              {t === 'standard' ? 'Standard' : 'Server Emojis'}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <input
            type="text"
            placeholder={tab === 'standard' ? 'Search emojis…' : 'Search by name…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-light)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 14,
            }}
          />
        </div>

        <div style={{ overflowY: 'auto', padding: 12, flex: 1 }}>
          {tab === 'standard' ? (
            <StandardGrid
              query={query}
              usedSet={usedSet}
              onSelect={onSelect}
            />
          ) : (
            <ServerGrid
              emojis={filteredServer}
              usedSet={usedSet}
              onSelect={onSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface StandardGridProps {
  query: string;
  usedSet: Set<string>;
  onSelect: (e: string) => void;
}

const StandardGrid: React.FC<StandardGridProps> = ({ query, usedSet, onSelect }) => {
  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    if (!q) return STANDARD_EMOJI_CATEGORIES;
    return STANDARD_EMOJI_CATEGORIES
      .map(c => ({ ...c, emojis: c.emojis.filter(e => e.includes(q)) }))
      .filter(c => c.emojis.length > 0);
  }, [q]);

  if (categories.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
      No emojis match your search
    </div>;
  }

  return (
    <>
      {categories.map(cat => (
        <div key={cat.name} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.5px', color: 'var(--text-secondary)',
            padding: '4px 6px 8px',
          }}>{cat.name}</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4,
          }}>
            {cat.emojis.map(emoji => {
              const used = usedSet.has(emoji);
              return (
                <button
                  key={emoji}
                  onClick={() => !used && onSelect(emoji)}
                  disabled={used}
                  title={emoji}
                  style={{
                    width: 40, height: 40, fontSize: 24,
                    background: 'transparent', border: 'none', borderRadius: 8,
                    cursor: used ? 'not-allowed' : 'pointer',
                    opacity: used ? 0.3 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!used) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >{emoji}</button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
};

interface ServerGridProps {
  emojis: GuildEmoji[];
  usedSet: Set<string>;
  onSelect: (e: string) => void;
}

const ServerGrid: React.FC<ServerGridProps> = ({ emojis, usedSet, onSelect }) => {
  if (emojis.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
      No custom emojis available
    </div>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
      {emojis.map(e => {
        const value = buildCustomEmojiValue(e);
        const used = usedSet.has(value);
        return (
          <button
            key={e.id}
            onClick={() => !used && onSelect(value)}
            disabled={used}
            title={e.name}
            style={{
              width: 40, height: 40,
              background: 'transparent', border: 'none', borderRadius: 8,
              cursor: used ? 'not-allowed' : 'pointer',
              opacity: used ? 0.3 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
            onMouseEnter={(ev) => { if (!used) ev.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
          >
            <img src={e.url} alt={e.name} style={{ width: 28, height: 28, objectFit: 'contain' }} />
          </button>
        );
      })}
    </div>
  );
};
