import React from 'react';

interface FeatureToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  description?: string;
}

export const FeatureToggle: React.FC<FeatureToggleProps> = ({
  enabled,
  onChange,
  label = 'Enabled',
  description
}) => {
  return (
    <div className="card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <h3 className="mb-1">{label}</h3>
          {description && <p className="text-muted small mb-0">{description}</p>}
        </div>
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange(e.target.checked)}
            style={{ width: '3em', height: '1.5em', cursor: 'pointer' }}
          />
        </div>
      </div>
      <div className="mt-2">
        <span className={`badge ${enabled ? 'bg-success' : 'bg-secondary'}`}>
          {enabled ? 'Active' : 'Disabled'}
        </span>
      </div>
    </div>
  );
};
