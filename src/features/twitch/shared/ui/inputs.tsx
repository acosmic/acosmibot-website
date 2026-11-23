import React, { useEffect, useId, useState } from 'react';
import { NumberInput } from '@/components/ui';
import type { Level } from '../../types';
import { levelLabel, useLevels } from '../useMeta';
import { describeDuration } from './format';

/* ── LevelSelect ────────────────────────────────────────────────────────── */

export interface LevelSelectProps {
  value: Level;
  onChange: (value: Level) => void;
  /** Hide levels below this one. */
  min?: Level;
  label?: string;
  hideLabel?: boolean;
  help?: string;
  disabled?: boolean;
  id?: string;
}

/** "Who can use it": chat user levels from `meta.levels` (fallback §3.3 values). */
export const LevelSelect: React.FC<LevelSelectProps> = ({ value, onChange, min, label = 'Who can use it', hideLabel, help, disabled, id }) => {
  const generated = useId().replace(/:/g, '');
  const selectId = id ?? `tw-level-${generated}`;
  const helpId = help ? `${selectId}-help` : undefined;
  const levels = useLevels().filter((level) => min === undefined || level.value >= min);
  const known = levels.some((level) => level.value === value);

  return (
    <div className="tw-field">
      <label htmlFor={selectId} className={`form-label${hideLabel ? ' visually-hidden' : ''}`}>{label}</label>
      <select
        id={selectId}
        className="form-select"
        value={value}
        disabled={disabled}
        aria-describedby={helpId}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {!known && <option value={value}>Level {value}</option>}
        {levels.map((level) => (
          <option key={level.value} value={level.value}>{levelLabel(level.name)}</option>
        ))}
      </select>
      {help && <p id={helpId} className="tw-field__help">{help}</p>}
    </div>
  );
};

/* ── DurationInput ──────────────────────────────────────────────────────── */

type DurationUnit = 's' | 'm' | 'h';
const UNIT_FACTOR: Record<DurationUnit, number> = { s: 1, m: 60, h: 3600 };
const UNIT_LABEL: Record<DurationUnit, string> = { s: 'seconds', m: 'minutes', h: 'hours' };

/** Largest unit that represents `seconds` exactly. Exported for tests. */
export const pickDurationUnit = (seconds: number, units: readonly DurationUnit[]): DurationUnit => {
  const ordered = [...units].sort((a, b) => UNIT_FACTOR[b] - UNIT_FACTOR[a]);
  return ordered.find((unit) => seconds > 0 && seconds % UNIT_FACTOR[unit] === 0) ?? ordered[ordered.length - 1] ?? 's';
};

export interface DurationInputProps {
  seconds: number;
  onChange: (seconds: number) => void;
  /** Inclusive bounds in seconds; out-of-range input shows a message and is not sent. */
  min: number;
  max: number;
  units?: DurationUnit[];
  label: string;
  help?: string;
  disabled?: boolean;
  id?: string;
}

/** Number plus unit (seconds / minutes / hours), always reported in seconds. */
export const DurationInput: React.FC<DurationInputProps> = ({ seconds, onChange, min, max, units = ['s', 'm', 'h'], label, help, disabled, id }) => {
  const generated = useId().replace(/:/g, '');
  const inputId = id ?? `tw-duration-${generated}`;
  const unitId = `${inputId}-unit`;
  const messageId = `${inputId}-message`;
  const [unit, setUnit] = useState<DurationUnit>(() => pickDurationUnit(seconds, units));
  const [outOfRange, setOutOfRange] = useState(false);

  // Follow external resets (discard, reload) without fighting the user's unit choice.
  useEffect(() => {
    if (seconds % UNIT_FACTOR[unit] !== 0) setUnit(pickDurationUnit(seconds, units));
    setOutOfRange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const factor = UNIT_FACTOR[unit];
  const display = Number.isInteger(seconds / factor) ? seconds / factor : Number((seconds / factor).toFixed(2));

  const commit = (amount: number, nextUnit: DurationUnit = unit) => {
    const total = Math.round(amount * UNIT_FACTOR[nextUnit]);
    if (total < min || total > max) {
      setOutOfRange(true);
      return;
    }
    setOutOfRange(false);
    onChange(total);
  };

  return (
    <div className={`tw-field${outOfRange ? ' is-invalid' : ''}`}>
      <label htmlFor={inputId} className="form-label">{label}</label>
      <div className="tw-duration">
        <NumberInput
          id={inputId}
          className="form-control"
          min={0}
          step="any"
          value={display}
          disabled={disabled}
          aria-invalid={outOfRange || undefined}
          aria-describedby={messageId}
          onValueChange={(amount) => commit(amount)}
          onBlur={() => setOutOfRange(false)}
        />
        <label htmlFor={unitId} className="visually-hidden">{label} unit</label>
        <select
          id={unitId}
          className="form-select"
          value={unit}
          disabled={disabled}
          onChange={(event) => {
            const nextUnit = event.target.value as DurationUnit;
            setUnit(nextUnit);
            commit(display, nextUnit);
          }}
        >
          {units.map((option) => <option key={option} value={option}>{UNIT_LABEL[option]}</option>)}
        </select>
      </div>
      <p id={messageId} className={outOfRange ? 'tw-field__error' : 'tw-field__help'} role={outOfRange ? 'alert' : undefined}>
        {outOfRange
          ? `Choose between ${describeDuration(min)} and ${describeDuration(max)}.`
          : help ?? `${describeDuration(seconds)}.`}
      </p>
    </div>
  );
};

/* ── UserLookupInput ────────────────────────────────────────────────────── */

export const LOGIN_PATTERN = /^[a-z0-9_]{1,25}$/;
/** Lowercase, trim and drop a leading `@` or a pasted twitch.tv URL prefix. */
export const normalizeLogin = (value: string): string =>
  value.trim().replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/^@/, '').toLowerCase();
export const isValidLogin = (value: string): boolean => LOGIN_PATTERN.test(normalizeLogin(value));

export interface UserLookupInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  help?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  /** Enter in the field with a valid login (e.g. "Add"). */
  onSubmit?: (login: string) => void;
}

/** Twitch login field: normalises `@Name` → `name` and validates `^[a-z0-9_]{1,25}$`. */
export const UserLookupInput: React.FC<UserLookupInputProps> = ({ value, onChange, label = 'Twitch username', help, placeholder = 'username', disabled, required, id, onSubmit }) => {
  const generated = useId().replace(/:/g, '');
  const inputId = id ?? `tw-login-${generated}`;
  const messageId = `${inputId}-message`;
  const [touched, setTouched] = useState(false);
  const normalized = normalizeLogin(value);
  const invalid = normalized.length > 0 && !LOGIN_PATTERN.test(normalized);
  const showError = invalid && touched;

  return (
    <div className={`tw-field${showError ? ' is-invalid' : ''}`}>
      <label htmlFor={inputId} className="form-label">{label}</label>
      <input
        id={inputId}
        className="form-control"
        type="text"
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        maxLength={60}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={showError || undefined}
        aria-describedby={showError || help ? messageId : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          setTouched(true);
          if (normalized !== value) onChange(normalized);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !onSubmit) return;
          event.preventDefault();
          setTouched(true);
          if (normalized && !invalid) onSubmit(normalized);
        }}
      />
      {(showError || help) && (
        <p id={messageId} className={showError ? 'tw-field__error' : 'tw-field__help'} role={showError ? 'alert' : undefined}>
          {showError ? 'Use the Twitch username: up to 25 letters, numbers or underscores.' : help}
        </p>
      )}
    </div>
  );
};
