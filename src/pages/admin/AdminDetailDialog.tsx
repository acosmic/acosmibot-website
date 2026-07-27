import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface AdminDetailDialogProps {
  title: string;
  label?: string;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const AdminDetailDialog: React.FC<AdminDetailDialogProps> = ({
  title,
  label,
  className = '',
  onClose,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const adminPage = document.querySelector<HTMLElement>('.admin-page');
    const pageWasInert = adminPage?.hasAttribute('inert') ?? false;
    const previousOverflow = document.body.style.overflow;

    adminPage?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (!pageWasInert) adminPage?.removeAttribute('inert');
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="admin-detail-backdrop admin-detail-backdrop--observatory"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`admin-detail-panel ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={label}
      >
        <div className="admin-detail-header">
          <h4 id={titleId}>{title}</h4>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={`Close ${label ?? title}`}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
};
