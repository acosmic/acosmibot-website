import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import { useUnsavedChanges } from '@/store/unsavedChanges';
import { focusableIn, portalRoot, trapTab } from './focus';

export interface EditorDrawerProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  /** Called after the user confirms leaving (when `dirty`) or directly when clean. */
  onClose: () => void;
  /** Form submit (Enter in a field or the primary button). */
  onSubmit: () => void;
  submitting: boolean;
  /** Server or validation error for the whole form; the user's input stays. */
  error?: string | null;
  /** Unsaved edits: closing asks first, and leaving the page is guarded. */
  dirty: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
  /** Left-aligned footer action, e.g. a Delete button. */
  secondaryAction?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Side drawer for creating or editing one record. Modal semantics, focus moves
 * into it and returns on close, Tab stays inside, Escape and the backdrop
 * close it (asking first when there are unsaved edits).
 */
export const EditorDrawer: React.FC<EditorDrawerProps> = ({
  open,
  title,
  description,
  onClose,
  onSubmit,
  submitting,
  error,
  dirty,
  submitLabel = 'Save',
  submitDisabled = false,
  secondaryAction,
  children,
}) => {
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closeAfterConfirm, setCloseAfterConfirm] = useState(false);
  const state = useRef({ dirty, submitting, confirmOpen, onClose });
  state.current = { dirty, submitting, confirmOpen, onClose };

  useUnsavedChanges(open && dirty);

  const requestClose = () => {
    if (state.current.submitting) return;
    if (state.current.dirty) setConfirmOpen(true);
    else state.current.onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      const first = focusableIn(body.current)[0] ?? focusableIn(panel.current)[0];
      (first ?? panel.current)?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      // A confirmation (ours or the navigation guard's) owns the keyboard while open.
      if (state.current.confirmOpen || document.querySelector('.confirm-dialog-backdrop')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      trapTab(event, panel.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setConfirmOpen(false);
      setCloseAfterConfirm(false);
    }
  }, [open]);

  // Close only after the confirmation has unmounted, so each layer restores
  // body scrolling and focus in the right order.
  useEffect(() => {
    if (!closeAfterConfirm || confirmOpen) return;
    setCloseAfterConfirm(false);
    state.current.onClose();
  }, [closeAfterConfirm, confirmOpen]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="tw-drawer-backdrop"
        role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      >
        <div
          ref={panel}
          className="tw-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
        >
          <form
            className="tw-drawer__form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!submitting && !submitDisabled) onSubmit();
            }}
          >
            <header className="tw-drawer__header">
              <div>
                <h2 id={titleId}>{title}</h2>
                {description && <p id={descriptionId}>{description}</p>}
              </div>
              <button type="button" className="tw-icon-button" onClick={requestClose} disabled={submitting} aria-label={`Close ${title}`}>
                <X aria-hidden="true" />
              </button>
            </header>
            <div ref={body} className="tw-drawer__body">{children}</div>
            <footer className="tw-drawer__footer">
              {error && <p className="tw-drawer__error" role="alert">{error}</p>}
              <div className="tw-drawer__actions">
                {secondaryAction && <div className="tw-drawer__secondary">{secondaryAction}</div>}
                <button type="button" className="btn" onClick={requestClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn primary" disabled={submitting || submitDisabled} aria-busy={submitting}>
                  {submitting ? 'Saving…' : submitLabel}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </div>
      {confirmOpen && (
        <ConfirmDialog
          kicker="Unsaved changes"
          title="Discard your changes?"
          confirmLabel="Discard changes"
          onConfirm={() => { setConfirmOpen(false); setCloseAfterConfirm(true); }}
          onClose={() => setConfirmOpen(false)}
        >
          <p>The edits in {title} have not been saved. Closing now loses them.</p>
        </ConfirmDialog>
      )}
    </>,
    portalRoot(),
  );
};
