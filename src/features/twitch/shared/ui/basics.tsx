/**
 * Small presentational building blocks for Twitch pages. See `index.ts` for
 * the catalogue. All text is rendered as React text nodes.
 */
import React, { useId, useState } from 'react';
import { Inbox, LockKeyhole } from 'lucide-react';
import type { Role } from '../../types';
import { hasRole, roleLabel } from '../roles';
import type { StatusTone } from './channelStatus';

/* ── StatusChip ─────────────────────────────────────────────────────────── */

export interface StatusChipProps {
  tone: StatusTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  /** Longer explanation exposed as a tooltip and to assistive technology. */
  title?: string;
}

/** Compact uppercase state label with literal status colours (DESIGN.md "Chips"). */
export const StatusChip: React.FC<StatusChipProps> = ({ tone, children, icon, title }) => (
  <span className={`tw-chip tw-chip--${tone}`} title={title}>
    {icon}
    <span>{children}</span>
    {title && <span className="visually-hidden">. {title}</span>}
  </span>
);

/* ── EmptyState ─────────────────────────────────────────────────────────── */

export interface EmptyStateProps {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

/** A real "nothing here yet" state. Never use it for a failed load (use `LoadFailed`). */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, icon }) => (
  <div className="tw-empty">
    <span className="tw-empty__icon" aria-hidden="true">{icon ?? <Inbox />}</span>
    <div className="tw-empty__copy">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
    {action && <div className="tw-empty__action">{action}</div>}
  </div>
);

/* ── RoleGate ───────────────────────────────────────────────────────────── */

export interface RoleGateProps {
  min: Role;
  role: Role | null | undefined;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Renders `children` only for `role >= min` (presentation only; the API enforces). */
export const RoleGate: React.FC<RoleGateProps> = ({ min, role, children, fallback = null }) => (
  <>{hasRole(role, min) ? children : fallback}</>
);

/* ── ReadOnlyNotice ─────────────────────────────────────────────────────── */

/** Inline note for a page the user can view but not change. */
export const ReadOnlyNotice: React.FC<{ required: Role; role: Role | null | undefined; what?: string }> = ({ required, role, what = 'these settings' }) => (
  <p className="tw-readonly" role="note">
    <LockKeyhole aria-hidden="true" />
    <span>
      You can view {what}. Changing them needs the {roleLabel(required)} role; you are {role ? `a ${roleLabel(role).toLowerCase()}` : 'not a manager'} on this channel.
    </span>
  </p>
);

/* ── ChannelAvatar ──────────────────────────────────────────────────────── */

export const ChannelAvatar: React.FC<{ src: string | null | undefined; name: string; size?: number; className?: string }> = ({ src, name, size = 40, className }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size } as React.CSSProperties;
  if (!src || failed) {
    return (
      <span className={`tw-avatar tw-avatar--initial${className ? ` ${className}` : ''}`} style={{ ...style, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
        {(name.trim().charAt(0) || '?').toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className={`tw-avatar${className ? ` ${className}` : ''}`}
      style={style}
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

/* ── TwitchMark / TwitchSignInButton ────────────────────────────────────── */

/** The Twitch glyph as platform identity (never as decoration). */
export const TwitchMark: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <span className="tw-twitch-mark" aria-hidden="true">
    <img src="/images/acosmibot_twitch-active.svg" alt="" width={size} height={size} />
  </span>
);

export const TwitchSignInButton: React.FC<{ onClick: () => void; label?: string; className?: string }> = ({ onClick, label = 'Sign in with Twitch', className }) => (
  <button type="button" className={`btn primary tw-signin${className ? ` ${className}` : ''}`} onClick={onClick}>
    <TwitchMark />
    <span>{label}</span>
  </button>
);

/* ── Field ──────────────────────────────────────────────────────────────── */

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export interface FieldProps {
  label: React.ReactNode;
  /** Help text under the control. */
  help?: React.ReactNode;
  /** Error text; also sets `aria-invalid` on the control. */
  error?: React.ReactNode;
  optional?: boolean;
  /** Pass your own id, or let Field create one. */
  id?: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  className?: string;
  /** Either a render function that receives the wiring, or a control that already uses `id`. */
  children: React.ReactNode | ((control: FieldControlProps) => React.ReactNode);
}

/**
 * Labelled form row: label, control, help and error with the ids wired up.
 *
 *   <Field label="Cooldown" help="Seconds between uses">
 *     {(control) => <input className="form-control" {...control} />}
 *   </Field>
 */
export const Field: React.FC<FieldProps> = ({ label, help, error, optional, id, hideLabel, className, children }) => {
  const generated = useId();
  const controlId = id ?? `tw-field-${generated.replace(/:/g, '')}`;
  const helpId = help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const control: FieldControlProps = { id: controlId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };

  return (
    <div className={`tw-field${error ? ' is-invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={controlId} className={`form-label${hideLabel ? ' visually-hidden' : ''}`}>
        {label}
        {optional && <span className="tw-field__optional"> (optional)</span>}
      </label>
      {typeof children === 'function' ? children(control) : children}
      {help && <p id={helpId} className="tw-field__help">{help}</p>}
      {error && <p id={errorId} className="tw-field__error" role="alert">{error}</p>}
    </div>
  );
};

/* ── Switch ─────────────────────────────────────────────────────────────── */

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Keep the label for screen readers only (e.g. inside a table row). */
  hideLabel?: boolean;
  id?: string;
}

/** Native checkbox with `role="switch"` and a 44px target, for per-row enable toggles. */
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, description, disabled, hideLabel, id }) => {
  const generated = useId();
  const inputId = id ?? `tw-switch-${generated.replace(/:/g, '')}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  return (
    <div className={`tw-switch form-switch${disabled ? ' is-disabled' : ''}`}>
      <input
        id={inputId}
        className="form-check-input tw-switch__input"
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={inputId} className={hideLabel ? 'visually-hidden' : 'tw-switch__label'}>{label}</label>
      {description && <span id={descriptionId} className="tw-switch__description">{description}</span>}
    </div>
  );
};
