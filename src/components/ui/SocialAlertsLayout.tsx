import React from 'react';
import {
  BellRing,
  CircleAlert,
  Pause,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import './SocialAlertsLayout.css';

export type SocialAlertState = 'active' | 'ready' | 'paused' | 'suspended' | 'unverified';

interface SocialAlertsKickerProps {
  icon: LucideIcon;
  children: React.ReactNode;
}

export const SocialAlertsKicker: React.FC<SocialAlertsKickerProps> = ({ icon: Icon, children }) => (
  <span className="social-alerts-kicker"><Icon aria-hidden="true" /> {children}</span>
);

interface SocialAlertsTelemetryProps {
  ariaLabel: string;
  items: Array<{ label: string; value: React.ReactNode }>;
}

export const SocialAlertsTelemetry: React.FC<SocialAlertsTelemetryProps> = ({ ariaLabel, items }) => (
  <section className="social-alerts-telemetry" aria-label={ariaLabel}>
    {items.map((item) => (
      <div key={item.label}>
        <span>{item.label}</span>
        <strong>{item.value}</strong>
      </div>
    ))}
  </section>
);

interface SocialAlertsPanelProps {
  titleId: string;
  kicker: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SocialAlertsPanel: React.FC<SocialAlertsPanelProps> = ({
  titleId,
  kicker,
  title,
  badge,
  children,
  className = '',
}) => (
  <section className={`social-alerts-panel${className ? ` ${className}` : ''}`} aria-labelledby={titleId}>
    <div className="social-alerts-panel__header">
      <div>
        <span className="social-alerts-kicker">{kicker}</span>
        <h2 id={titleId}>{title}</h2>
      </div>
      {badge !== undefined && <span className="social-alerts-capacity">{badge}</span>}
    </div>
    {children}
  </section>
);

interface SocialAlertsAddProps {
  label: string;
  labelFor: string;
  hint: React.ReactNode;
  error?: string | null;
  isBusy?: boolean;
  children: React.ReactNode;
}

export const SocialAlertsAdd: React.FC<SocialAlertsAddProps> = ({
  label,
  labelFor,
  hint,
  error,
  isBusy = false,
  children,
}) => (
  <div className="social-alerts-add" aria-busy={isBusy}>
    <label htmlFor={labelFor}>{label}</label>
    {children}
    <p id={`${labelFor}-hint`}>{hint}</p>
    {error && <div id={`${labelFor}-error`} className="social-alerts-field-error" role="alert">{error}</div>}
  </div>
);

interface SocialAlertsEmptyProps {
  icon: LucideIcon;
  title: React.ReactNode;
  description: React.ReactNode;
}

export const SocialAlertsEmpty: React.FC<SocialAlertsEmptyProps> = ({ icon: Icon, title, description }) => (
  <div className="social-alerts-empty">
    <Icon aria-hidden="true" />
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

const STATE_ICONS: Record<SocialAlertState, LucideIcon> = {
  active: BellRing,
  ready: Radio,
  paused: Pause,
  suspended: Pause,
  unverified: CircleAlert,
};

interface SocialAlertRecordProps {
  state: SocialAlertState;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  avatar: React.ReactNode;
  enabled: boolean;
  toggleLabel: string;
  onEnabledChange: (enabled: boolean) => void;
  actions: React.ReactNode;
  actionsLabel: string;
  leading?: React.ReactNode;
}

export const SocialAlertRecord: React.FC<SocialAlertRecordProps> = ({
  state,
  title,
  subtitle,
  avatar,
  enabled,
  toggleLabel,
  onEnabledChange,
  actions,
  actionsLabel,
  leading,
}) => {
  const StateIcon = STATE_ICONS[state];
  return (
    <li className={`social-alerts-record is-${state}${leading !== undefined ? ' has-leading' : ''}`}>
      {leading !== undefined && <span className="social-alerts-record__leading">{leading}</span>}
      <div className="social-alerts-record__avatar" aria-hidden="true">{avatar}</div>
      <div className="social-alerts-record__identity">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <span className={`social-alerts-record__state is-${state}`}>
        <StateIcon aria-hidden="true" />
        {state}
      </span>
      <label className="social-alerts-record__toggle">
        <span className="visually-hidden">{toggleLabel}</span>
        <input
          type="checkbox"
          role="switch"
          className="form-check-input"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
      </label>
      <div className="social-alerts-record__actions" role="group" aria-label={actionsLabel}>
        {actions}
      </div>
    </li>
  );
};

interface SocialAlertsNoticeProps {
  icon: LucideIcon;
  title: React.ReactNode;
  children: React.ReactNode;
  tone?: 'info' | 'warning';
  titleId?: string;
}

export const SocialAlertsNotice: React.FC<SocialAlertsNoticeProps> = ({
  icon: Icon,
  title,
  children,
  tone = 'info',
  titleId,
}) => (
  <aside
    className={`social-alerts-notice${tone === 'warning' ? ' is-warning' : ''}`}
    aria-labelledby={titleId}
    role={tone === 'warning' ? 'alert' : undefined}
  >
    <Icon aria-hidden="true" />
    <div>
      <strong id={titleId}>{title}</strong>
      <span>{children}</span>
    </div>
  </aside>
);
