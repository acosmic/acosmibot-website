import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { ConfirmDialog, SaveBar } from '@/components/ui';
import type { SectionSettings } from '../useSectionSettings';

/* ── ConfirmTypeDialog ──────────────────────────────────────────────────── */

export interface ConfirmTypeDialogProps {
  kicker: string;
  title: string;
  /** The exact word to type, e.g. the channel login or `RESET`. */
  word: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Explain exactly what will happen. */
  children: React.ReactNode;
  /** Case-sensitive match (default true). Logins pass `false`. */
  caseSensitive?: boolean;
}

/**
 * `ConfirmDialog` for irreversible actions: the person types `word` before the
 * action runs. Escape closes and focus returns to the opener.
 */
export const ConfirmTypeDialog: React.FC<ConfirmTypeDialogProps> = ({
  kicker, title, word, confirmLabel, pending = false, onConfirm, onClose, children, caseSensitive = true,
}) => {
  const [typed, setTyped] = useState('');
  const [attempted, setAttempted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId().replace(/:/g, '');
  const matches = caseSensitive ? typed.trim() === word : typed.trim().toLowerCase() === word.toLowerCase();

  // ConfirmDialog focuses Cancel on mount; move focus to the input right after.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => input.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const confirm = () => {
    if (pending) return;
    if (!matches) {
      setAttempted(true);
      input.current?.focus();
      return;
    }
    onConfirm();
  };

  return (
    <ConfirmDialog kicker={kicker} title={title} confirmLabel={confirmLabel} pending={pending} onConfirm={confirm} onClose={onClose}>
      {children}
      <div className="tw-field tw-confirm-type">
        <label htmlFor={`tw-confirm-${inputId}`} className="form-label">
          Type <strong>{word}</strong> to confirm
        </label>
        <input
          ref={input}
          id={`tw-confirm-${inputId}`}
          className="form-control"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={typed}
          disabled={pending}
          aria-invalid={attempted && !matches ? true : undefined}
          aria-describedby={attempted && !matches ? `tw-confirm-${inputId}-error` : undefined}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              confirm();
            }
          }}
        />
        {attempted && !matches && (
          <p id={`tw-confirm-${inputId}-error`} className="tw-field__error" role="alert">
            Type {word} exactly to continue.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
};

/* ── SettingsSaveBar ────────────────────────────────────────────────────── */

export interface SettingsSaveBarProps<T extends object> {
  settings: SectionSettings<T>;
  /** Block saving with a reason (client-side validation). */
  validationMessage?: string;
}

/**
 * The existing `SaveBar` wired to `useSectionSettings`, plus the conflict
 * state: when someone else saved this section first, it offers Reload
 * instead of a save that would fail again. Renders nothing for read-only users.
 */
export function SettingsSaveBar<T extends object>({ settings, validationMessage }: SettingsSaveBarProps<T>) {
  if (!settings.canWrite) return null;

  if (settings.conflict) {
    return (
      <div className="server-save-bar is-error" role="alert">
        <TriangleAlert size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
        <div className="server-save-bar__message">
          <span>Changed elsewhere — reload</span>
          <small>Someone saved these settings after you started editing. Reload to see their version; your unsaved edits here will be replaced.</small>
        </div>
        <div className="server-save-bar__actions">
          <button type="button" className="btn" onClick={settings.discard}>Discard</button>
          <button type="button" className="btn primary" onClick={() => void settings.reload()}>Reload</button>
        </div>
      </div>
    );
  }

  return (
    <SaveBar
      isDirty={settings.isDirty}
      onSave={settings.save}
      onDiscard={settings.discard}
      isSaving={settings.saving}
      saveError={settings.error}
      saveDisabled={Boolean(validationMessage)}
      validationMessage={validationMessage}
      dirtyTitle="Unsaved channel settings"
      dirtyDescription="Save to apply these changes to Acosmibot in your Twitch chat."
      successMessage="Settings saved"
    />
  );
}

/* ── InlineConfirmation ─────────────────────────────────────────────────── */

/** Short-lived "Saved" text next to a per-row action. */
export const SavedTick: React.FC<{ show: boolean; label?: string }> = ({ show, label = 'Saved' }) => (
  <span className={`tw-saved${show ? ' is-visible' : ''}`} role="status" aria-live="polite">
    {show && <><Check aria-hidden="true" size={14} /> {label}</>}
  </span>
);
