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
    <div className="card p-4 mb-4" style={{ background: enabled ? 'var(--bg-overlay)' : 'var(--bg-card)', border: enabled ? '1px solid var(--border-cyan)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</h3>
          {description && <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{description}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            background: enabled ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            color: enabled ? 'var(--success-color)' : 'var(--text-muted)',
            border: `1px solid ${enabled ? 'rgba(0, 255, 136, 0.3)' : 'var(--border-light)'}`,
          }}>
            {enabled ? 'Active' : 'Disabled'}
          </span>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={enabled}
              onChange={(e) => onChange(e.target.checked)}
              style={{ width: '3em', height: '1.5em', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
