import React from 'react';

interface SaveBarProps {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}

export const SaveBar: React.FC<SaveBarProps> = ({
  isDirty,
  onSave,
  onDiscard,
  isSaving
}) => {
  if (!isDirty && !isSaving) return null;

  return (
    <div className="status show info d-flex justify-content-between align-items-center" style={{ 
      position: 'fixed', 
      bottom: '20px', 
      left: '20px', 
      right: '20px', 
      top: 'auto',
      transform: 'translateY(0)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-cyan)',
      boxShadow: '0 -10px 40px var(--shadow-cyan)',
      padding: '16px 32px',
      borderRadius: '16px',
      zIndex: 1000
    }}>
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
