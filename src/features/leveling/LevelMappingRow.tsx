import React, { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';

export interface LevelMappingRowProps {
  level: string;
  roleId: string;
  roles: { id: string; name: string }[];
  /** Returns an error message when the level cannot be used, otherwise null. */
  onCommitLevel: (nextLevel: string) => string | null;
  onRoleChange: (roleId: string) => void;
  onRemove: () => void;
}

/**
 * One level → role mapping. The level is edited in a local draft and only
 * committed on blur or Enter, so typing "15" never passes through level "1"
 * (which could replace an existing mapping) and the row never remounts while
 * the member is typing.
 */
export const LevelMappingRow: React.FC<LevelMappingRowProps> = ({
  level, roleId, roles, onCommitLevel, onRoleChange, onRemove,
}) => {
  const [draft, setDraft] = useState(level);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => { setDraft(level); }, [level]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === level) {
      setError(null);
      return;
    }
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0) {
      setError('Enter a whole level number of 0 or more.');
      setDraft(level);
      return;
    }
    const message = onCommitLevel(String(parsed));
    setError(message);
    if (message) setDraft(level);
  };

  return (
    <div className="mb-2">
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="number"
          inputMode="numeric"
          className={`form-control${error ? ' is-invalid' : ''}`}
          style={{ width: '100px', flexShrink: 0 }}
          min={0}
          step={1}
          value={draft}
          aria-label="Level"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => { setDraft(event.currentTarget.value); setError(null); }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
          placeholder="Level"
        />
        <select
          className="form-control"
          aria-label={`Role for level ${level}`}
          value={roleId}
          onChange={(event) => onRoleChange(event.target.value)}
        >
          <option value="">Select Role...</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          aria-label={`Remove level ${level} mapping`}
          title="Remove mapping"
          style={{ flexShrink: 0, padding: '8px 14px', color: 'var(--error-color)', borderColor: 'var(--error-color)' }}
          onClick={onRemove}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="small mt-1 mb-0" style={{ color: 'var(--error-color)' }}>
          {error}
        </p>
      )}
    </div>
  );
};
