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
}

export const SaveBar: React.FC<SaveBarProps> = ({
  isDirty,
  onSave,
  onDiscard,
  isSaving,
  saveError,
  saveDisabled = false,
  validationMessage,
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const wasSaving = useRef(false);

  useEffect(() => {
    const wasPreviouslySaving = wasSaving.current;
    wasSaving.current = isSaving;
    if (wasPreviouslySaving && !isSaving) {
      if (saveError) {
        setShowError(true);
        const timer = setTimeout(() => setShowError(false), 4000);
        return () => clearTimeout(timer);
      }
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, saveError]);

  if (showSuccess) {
    return (
      <div
        className="server-save-bar is-success"
        role="status"
      >
        <Check size={20} />
        <span>Changes saved successfully</span>
      </div>
    );
  }

  if (showError) {
    return (
      <div
        className="server-save-bar is-error"
        role="alert"
      >
        <TriangleAlert size={20} />
        <span>{saveError?.message || 'Failed to save changes'}</span>
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
        <span>{saveDisabled ? 'Resolve validation before saving' : 'Unsaved server changes'}</span>
        <small>{saveDisabled && validationMessage ? validationMessage : 'Review and commit this configuration to Discord.'}</small>
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
