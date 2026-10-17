import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import type { EmojiPack } from '@/api/emojiPacks';

const MENU_WIDTH = 200;

/** A + button that opens a list of packs; picking one calls ``onPick``. The list
 * floats above the page so scrolling grids and tile edges never clip it. */
export const PackPicker: React.FC<{
  label: string;
  packs: EmojiPack[];
  disabled?: boolean;
  onPick: (pack: EmojiPack) => void;
}> = ({ label, packs, disabled, onPick }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - MENU_WIDTH / 2), window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top: rect.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!button.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button ref={button} type="button" className="server-images-icon-btn" disabled={disabled}
        aria-haspopup="menu" aria-expanded={open} aria-label={label} title="Add to a pack"
        onClick={() => setOpen((value) => !value)}>
        <Plus aria-hidden="true" />
      </button>
      {open && position && createPortal(
        <span ref={list} className="pack-picker__list" role="menu" aria-label={label}
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}>
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
        </span>,
        document.querySelector('.dashboard-shell') ?? document.body,
      )}
    </>
  );
};
