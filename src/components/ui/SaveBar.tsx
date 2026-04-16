import React, { useEffect, useRef, useState } from 'react';

interface SaveBarProps {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
  saveError?: Error | null;
}

export const SaveBar: React.FC<SaveBarProps> = ({
  isDirty,
  onSave,
  onDiscard,
  isSaving,
  saveError
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

  const toastBase: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    right: '20px',
    padding: '16px 32px',
    borderRadius: '16px',
    zIndex: 1000,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  if (showSuccess) {
    return (
      <div
        className="status show success"
        style={{
          ...toastBase,
          background: 'var(--bg-card)',
          border: '1px solid var(--success-color, #3ecf8e)',
          boxShadow: '0 -10px 40px rgba(62, 207, 142, 0.25)',
          color: 'var(--success-color, #3ecf8e)',
        }}
      >
        <span style={{ fontSize: '20px' }}>✓</span>
        <span>Changes saved successfully</span>
      </div>
    );
  }

  if (showError) {
    return (
      <div
        className="status show error"
        style={{
          ...toastBase,
          background: 'var(--bg-card)',
          border: '1px solid var(--error-color, #ef4444)',
          boxShadow: '0 -10px 40px rgba(239, 68, 68, 0.25)',
          color: 'var(--error-color, #ef4444)',
        }}
      >
        <span style={{ fontSize: '20px' }}>⚠</span>
        <span>{saveError?.message || 'Failed to save changes'}</span>
      </div>
    );
  }

  if (!isDirty && !isSaving) return null;

  return (
    <div
      className="status show info d-flex justify-content-between align-items-center"
      style={{
        ...toastBase,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-cyan)',
        boxShadow: '0 -10px 40px var(--shadow-cyan)',
      }}
    >
      <div className="text-white fw-bold">Careful! You have unsaved changes.</div>
      <div className="d-flex gap-3">
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
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
