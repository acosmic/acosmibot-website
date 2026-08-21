import React, { useEffect, useMemo, useRef, useState } from 'react';
import { STANDARD_EMOJI_CATEGORIES } from './emojiData';
import { GuildEmoji } from '@/hooks/useGuildEmojis';
import type { SlotCatalogEmoji } from '../games/slotSets';

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  serverEmojis: GuildEmoji[];
  applicationEmojis?: SlotCatalogEmoji[];
  usedEmojis: string[];
}

type Tab = 'acosmibot' | 'standard' | 'custom';

const buildCustomEmojiValue = (e: GuildEmoji): string =>
  `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;

const FALLBACK_EXTS: Record<string, string[]> = {
  gif: ['webp', 'png'],
  webp: ['png', 'gif'],
  png: ['webp', 'gif'],
};

const customEmojiUrl = (e: GuildEmoji, ext: string): string =>
  `https://cdn.discordapp.com/emojis/${e.id}.${ext}${ext === 'webp' && e.animated ? '?animated=true' : ''}`;

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  open, onClose, onSelect, serverEmojis, applicationEmojis = [], usedEmojis,
}) => {
  const [tab, setTab] = useState<Tab>(applicationEmojis.length > 0 ? 'acosmibot' : 'standard');
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKey);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [open]);

  const usedSet = useMemo(() => new Set(usedEmojis), [usedEmojis]);

  const filteredServer = useMemo(() => {
    if (!query) return serverEmojis;
    const q = query.toLowerCase();
    return serverEmojis.filter(e => e.name.toLowerCase().includes(q));
  }, [serverEmojis, query]);

  const filteredApplication = useMemo(() => {
    if (!query) return applicationEmojis;
    const lowered = query.toLowerCase();
    return applicationEmojis.filter(emoji => emoji.name.toLowerCase().includes(lowered));
  }, [applicationEmojis, query]);

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emoji-picker-title"
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
          <h3 id="emoji-picker-title" style={{ margin: 0, fontSize: '18px' }}>Select Emoji</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close emoji picker"
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              fontSize: '24px', cursor: 'pointer', width: 44, height: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
          >×</button>
        </div>

        <div
          role="tablist"
          aria-label="Emoji sources"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}
        >
          {([
            ...(applicationEmojis.length > 0 ? ['acosmibot' as Tab] : []),
            'standard' as Tab,
            'custom' as Tab,
          ]).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={{
                minHeight: 44, padding: '8px 16px',
                background: tab === t ? 'var(--primary-color)' : 'transparent',
                border: '1px solid ' + (tab === t ? 'var(--primary-color)' : 'var(--border-light)'),
                borderRadius: 8,
                color: tab === t ? 'var(--bg-primary)' : 'var(--text-secondary)',
                fontSize: 14, cursor: 'pointer',
              }}
            >
              {t === 'acosmibot' ? 'Acosmibot' : t === 'standard' ? 'Standard' : 'Server Emojis'}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <input
            ref={searchRef}
            type="text"
            aria-label="Search emojis"
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
          {tab === 'acosmibot' ? (
            <ApplicationGrid
              emojis={filteredApplication}
              usedSet={usedSet}
              onSelect={onSelect}
            />
          ) : tab === 'standard' ? (
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

interface ApplicationGridProps {
  emojis: SlotCatalogEmoji[];
  usedSet: Set<string>;
  onSelect: (value: string) => void;
}

const ApplicationGrid: React.FC<ApplicationGridProps> = ({ emojis, usedSet, onSelect }) => {
  if (emojis.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
      No Acosmibot symbols match your search
    </div>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
      {emojis.map(emoji => {
        const used = usedSet.has(emoji.value);
        return (
          <button
            key={emoji.value}
            type="button"
            onClick={() => !used && onSelect(emoji.value)}
            disabled={used}
            title={emoji.name}
            style={{
              minHeight: 68, padding: 8,
              background: 'var(--bg-overlay)', border: '1px solid var(--border-light)', borderRadius: 10,
              cursor: used ? 'not-allowed' : 'pointer', opacity: used ? 0.35 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
              color: 'var(--text-secondary)', fontSize: 10,
            }}
          >
            <img src={emoji.image} alt="" width={34} height={34} style={{ objectFit: 'contain' }} />
            <span>{emoji.name}</span>
          </button>
        );
      })}
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
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 4,
          }}>
            {cat.emojis.map(emoji => {
              const used = usedSet.has(emoji);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => !used && onSelect(emoji)}
                  disabled={used}
                  title={emoji}
                  style={{
                    width: '100%', minWidth: 44, height: 44, fontSize: 24,
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 4 }}>
      {emojis.map(e => {
        const value = buildCustomEmojiValue(e);
        const used = usedSet.has(value);
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => !used && onSelect(value)}
            disabled={used}
            title={e.name}
            style={{
              width: '100%', minWidth: 44, height: 44,
              background: 'transparent', border: 'none', borderRadius: 8,
              cursor: used ? 'not-allowed' : 'pointer',
              opacity: used ? 0.3 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
            onMouseEnter={(ev) => { if (!used) ev.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
          >
            <img
              src={customEmojiUrl(e, e.animated ? 'gif' : 'webp')}
              alt={e.name}
              style={{ width: 28, height: 28, objectFit: 'contain' }}
              onError={(ev) => {
                const img = ev.currentTarget;
                const primary = e.animated ? 'gif' : 'webp';
                const tried = (img.dataset.tried ?? primary).split(',');
                const next = FALLBACK_EXTS[primary]?.find(ext => !tried.includes(ext));
                if (next) {
                  img.dataset.tried = [...tried, next].join(',');
                  img.src = customEmojiUrl(e, next);
                } else if (img.src !== e.url) {
                  img.src = e.url;
                }
              }}
            />
          </button>
        );
      })}
    </div>
  );
};
