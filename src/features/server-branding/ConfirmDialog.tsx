import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A centered confirmation dialog for emoji pack actions (same pattern as the billing cancel dialog). */
export const ConfirmDialog: React.FC<{
  kicker: string;
  title: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  imageUrl?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ kicker, title, confirmLabel, tone = 'danger', imageUrl, pending = false, onConfirm, onClose, children }) => {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;
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
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div className="emoji-confirm-backdrop" role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}>
      <div ref={dialog} className="emoji-confirm" role="alertdialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1}>
        <button type="button" className="emoji-confirm__close" onClick={onClose} disabled={pending} aria-label="Close">
          <X aria-hidden="true" />
        </button>
        <div className="emoji-confirm__heading">
          {imageUrl && <img src={imageUrl} alt="" className="emoji-confirm__image" />}
          <div>
            <span>{kicker}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
        </div>
        <div id={bodyId} className="emoji-confirm__body">{children}</div>
        <div className="emoji-confirm__actions">
          <button ref={cancel} type="button" className="btn secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="button" className={`btn ${tone === 'danger' ? 'emoji-confirm__danger' : 'primary'}`}
            onClick={onConfirm} disabled={pending} aria-busy={pending}>
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.querySelector('.dashboard-shell') ?? document.body,
  );
};
