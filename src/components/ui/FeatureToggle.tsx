import React from 'react';

interface FeatureToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  description?: string;
  credits?: ReadonlyArray<{
    label: string;
    href: string;
  }>;
}

export const FeatureToggle: React.FC<FeatureToggleProps> = ({
  enabled,
  onChange,
  label = 'Enabled',
  description,
  credits,
}) => {
  return (
    <section className={`feature-toggle${enabled ? ' is-enabled' : ''}`}>
      <div className="feature-toggle__signal" aria-hidden="true"><span /></div>
      <div className="feature-toggle__content">
        <div className="feature-toggle__copy">
          <h2>{label}</h2>
          {description && <p>{description}</p>}
          {credits && credits.length > 0 && (
            <div className="feature-toggle__credits">
              Powered by{' '}
              {credits.map((credit, index) => (
                <React.Fragment key={credit.href}>
                  {index > 0 && ' · '}
                  <a
                    href={credit.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {credit.label} ↗
                  </a>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        <div className="feature-toggle__control">
          <span className="feature-toggle__state">
            {enabled ? 'Active' : 'Disabled'}
          </span>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              aria-label={label}
              checked={enabled}
              onChange={(e) => onChange(e.target.checked)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
