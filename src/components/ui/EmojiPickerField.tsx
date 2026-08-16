import React from 'react';
import { X } from 'lucide-react';
import { EmojiDisplay } from './EmojiDisplay';

interface EmojiPickerFieldProps {
  value?: string;
  onPick: () => void;
  onClear: () => void;
}

/** Shared non-typeable emoji field; selection is constrained to EmojiPicker values. */
export const EmojiPickerField: React.FC<EmojiPickerFieldProps> = ({ value, onPick, onClear }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <button
      type="button"
      className="btn btn-sm"
      onClick={onPick}
      aria-haspopup="dialog"
      aria-label={value ? 'Change selected emoji' : 'Pick an emoji'}
      style={{
        border: '1px solid var(--border-light)', background: 'var(--bg-tertiary)',
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
      }}
    >
      {value ? (
        <>
          <span style={{ fontSize: 20, lineHeight: 1 }}><EmojiDisplay emoji={value} /></span>
          Change
        </>
      ) : 'Pick an emoji…'}
    </button>
    {value && (
      <button
        type="button"
        onClick={onClear}
        title="Clear emoji"
        aria-label="Clear emoji"
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 8 }}
      >
        <X size={16} />
      </button>
    )}
  </div>
);
