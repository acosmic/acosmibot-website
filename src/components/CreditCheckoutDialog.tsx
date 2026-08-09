import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ExternalLink, ShieldCheck, X } from 'lucide-react';
import type { CreditPack } from '@/api/aiCredits';
import '@/styles/credit-checkout.css';

interface CreditCheckoutDialogProps {
  pack: CreditPack;
  currency: string;
  targetLabel: string;
  targetType: 'personal' | 'guild';
  termsVersion: string;
  isPending: boolean;
  contribution?: boolean;
  onClose: () => void;
  onConfirm: (anonymous: boolean) => void;
}

const formatMoney = (cents: number, currency: string) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency.toUpperCase(),
}).format(cents / 100);

const formatCredits = (value: number) => new Intl.NumberFormat('en-US').format(value);

export const CreditCheckoutDialog: React.FC<CreditCheckoutDialogProps> = ({
  pack,
  currency,
  targetLabel,
  targetType,
  termsVersion,
  isPending,
  contribution = false,
  onClose,
  onConfirm,
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [accepted, setAccepted] = React.useState(false);
  const [anonymous, setAnonymous] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const onCloseRef = React.useRef(onClose);
  const isPendingRef = React.useRef(isPending);
  onCloseRef.current = onClose;
  isPendingRef.current = isPending;

  React.useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const pageContent = document.querySelector<HTMLElement>('main');
    const pageWasInert = pageContent?.hasAttribute('inert') ?? false;
    const previousOverflow = document.body.style.overflow;
    pageContent?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPendingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ));
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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (!pageWasInert) pageContent?.removeAttribute('inert');
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="credit-checkout-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="credit-checkout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <button
          type="button"
          className="credit-checkout-dialog__close"
          onClick={onClose}
          disabled={isPending}
          aria-label="Close AI Credits checkout confirmation"
        >
          <X aria-hidden="true" />
        </button>

        <div className="credit-checkout-dialog__heading">
          <div className="credit-checkout-dialog__icon" aria-hidden="true"><ShieldCheck /></div>
          <div>
            <span>Checkout confirmation</span>
            <h2 id={titleId}>{contribution ? `Fuel ${targetLabel}?` : `Add ${pack.name} to ${targetType === 'guild' ? 'this guild' : 'your wallet'}?`}</h2>
          </div>
        </div>

        <p id={descriptionId} className="credit-checkout-dialog__copy">
          Stripe will open a one-time checkout for <strong>{formatMoney(pack.amount_cents, currency)}</strong> and
          grant <strong>{formatCredits(pack.credits)} AI Credits</strong> to <strong>{targetLabel}</strong> after the
          server verifies payment.
        </p>

        <dl className="credit-checkout-dialog__facts">
          <div><dt>Target</dt><dd>{targetLabel}</dd></div>
          <div><dt>Pack</dt><dd>{pack.name}</dd></div>
          <div><dt>Credits</dt><dd>{formatCredits(pack.credits)}</dd></div>
          <div><dt>Expiration</dt><dd>Purchased credits do not expire</dd></div>
          <div><dt>Terms</dt><dd>{termsVersion}</dd></div>
        </dl>

        {contribution && (
          <>
            <p className="credit-checkout-dialog__gift-notice">
              This is a permanent gift to <strong>{targetLabel}</strong>. Credits belong to the server after payment and cannot be transferred back to your wallet. A normal payment refund reverses the corresponding unused server credits.
            </p>
            <label className="credit-checkout-dialog__anonymous">
              <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
              <span>Contribute anonymously in the Server Boost Log</span>
            </label>
          </>
        )}

        <label className="credit-checkout-dialog__terms">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>I understand these are non-transferable service credits, not cash or virtual currency, and I accept the <a href="/terms-of-service" target="_blank" rel="noreferrer">AI Credits terms <ExternalLink aria-hidden="true" /></a> version {termsVersion}.</span>
        </label>

        <div className="credit-checkout-dialog__actions">
          <button type="button" className="credit-checkout-dialog__secondary" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            type="button"
            className="credit-checkout-dialog__primary"
            onClick={() => onConfirm(anonymous)}
            disabled={!accepted || isPending}
          >
            {isPending ? 'Opening Stripe…' : 'Continue to Stripe'}
            {!isPending && <Check aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
