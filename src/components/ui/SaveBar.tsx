import React, { useEffect, useRef, useState } from 'react';
import { Check, TriangleAlert } from 'lucide-react';

interface SaveBarProps {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
  saveError?: Error | null;
  saveDisabled?: boolean;
  validationMessage?: string;
  dirtyTitle?: string;
  dirtyDescription?: string;
  validationTitle?: string;
  successMessage?: string;
}

export const SaveBar: React.FC<SaveBarProps> = ({
  isDirty,
  onSave,
  onDiscard,
  isSaving,
  saveError,
  saveDisabled = false,
  validationMessage,
  dirtyTitle = 'Unsaved server changes',
  dirtyDescription = 'Review and commit this configuration to Discord.',
  validationTitle = 'Resolve validation before saving',
  successMessage = 'Changes saved successfully',
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  // A failed save stays visible (with Try again / Discard) until the member
  // acts on it. It used to vanish after four seconds, leaving the generic
  // "unsaved" bar with no sign that the save had failed.
  const [failure, setFailure] = useState<string | null>(null);
  const wasSaving = useRef(false);

  useEffect(() => {
    const wasPreviouslySaving = wasSaving.current;
    wasSaving.current = isSaving;
    if (wasPreviouslySaving && !isSaving) {
      if (saveError) {
        setFailure(saveError.message || 'The server did not accept these changes.');
        return;
      }
      setFailure(null);
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, saveError]);

  // Discarding (or otherwise returning to a clean form) resolves the failure.
  useEffect(() => {
    if (!isDirty && !isSaving) setFailure(null);
  }, [isDirty, isSaving]);

  if (showSuccess) {
    return (
      <div
        className="server-save-bar is-success"
        role="status"
      >
        <Check size={20} aria-hidden="true" />
        <span>{successMessage}</span>
      </div>
    );
  }

  if (failure && isDirty && !isSaving) {
    return (
      <div
        className="server-save-bar is-error"
        role="alert"
      >
        <TriangleAlert size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
        <div className="server-save-bar__message">
          <span>Changes not saved</span>
          <small>{failure} Your edits are still here.</small>
        </div>
        <div className="server-save-bar__actions">
          <button className="btn" onClick={onDiscard}>
            Discard
          </button>
          <button
            className="btn primary"
            onClick={onSave}
            disabled={saveDisabled}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!isDirty && !isSaving) return null;

  return (
    <div
      className="server-save-bar is-dirty"
      role="status"
    >
      <div className="server-save-bar__message">
        <span>{saveDisabled ? validationTitle : dirtyTitle}</span>
        <small>{saveDisabled && validationMessage ? validationMessage : dirtyDescription}</small>
      </div>
      <div className="server-save-bar__actions">
        <button
          className="btn"
          onClick={onDiscard}
          disabled={isSaving}
        >
          Discard
        </button>
        <button
          className="btn primary"
          onClick={onSave}
          disabled={isSaving || saveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
