import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { EmojiPack } from '@/api/emojiPacks';

/** A + button that opens a list of packs; picking one calls ``onPick``. */
export const PackPicker: React.FC<{
  label: string;
  packs: EmojiPack[];
  disabled?: boolean;
  className?: string;
  onPick: (pack: EmojiPack) => void;
}> = ({ label, packs, disabled, className, onPick }) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <span className={`pack-picker${className ? ` ${className}` : ''}`} ref={root}>
      <button type="button" className="server-images-icon-btn" disabled={disabled}
        aria-haspopup="menu" aria-expanded={open} aria-label={label} title="Add to a pack"
        onClick={() => setOpen((value) => !value)}>
        <Plus aria-hidden="true" />
      </button>
      {open && (
        <span className="pack-picker__list" role="menu" aria-label={label}>
          <span className="pack-picker__title">Add to pack</span>
          {packs.length ? packs.map((pack) => (
            <button key={pack.id} type="button" role="menuitem" onClick={() => {
              setOpen(false);
              onPick(pack);
            }}>
              <span>{pack.name}</span>
              <small>{pack.counts.total}</small>
            </button>
          )) : <span className="pack-picker__empty">No packs yet. Create one above.</span>}
        </span>
      )}
    </span>
  );
};
