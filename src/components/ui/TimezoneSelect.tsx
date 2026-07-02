import React, { useMemo } from 'react';

/**
 * IANA timezone picker used by both the AI customization page (guild default)
 * and profile settings (per-user). The option list comes from the browser's
 * own `Intl.supportedValuesOf('timeZone')`, so it stays current without us
 * maintaining a hand-rolled list, and any value it offers is guaranteed valid
 * on the server's `zoneinfo` too.
 */

/** The browser's best guess at the current timezone, e.g. 'America/Los_Angeles'. */
export const detectBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const getSupportedTimezones = (): string[] => {
  try {
    // supportedValuesOf is ES2022+; guard for older engines.
    const values = (Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }).supportedValuesOf?.('timeZone');
    if (values && values.length) return values;
  } catch {
    /* fall through */
  }
  return ['UTC'];
};

interface TimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Label shown for the empty option (guild default vs. "no preference"). */
  emptyLabel?: string;
  /** When true, offers an empty "" choice (used for the optional per-user setting). */
  allowEmpty?: boolean;
  disabled?: boolean;
  id?: string;
}

export const TimezoneSelect: React.FC<TimezoneSelectProps> = ({
  value,
  onChange,
  emptyLabel = 'No preference',
  allowEmpty = false,
  disabled = false,
  id,
}) => {
  const zones = useMemo(getSupportedTimezones, []);

  // If a stored value isn't in the browser's list (e.g. a rarely-used zone),
  // surface it anyway so it stays selected instead of silently switching.
  const options = useMemo(
    () => (value && !zones.includes(value) ? [value, ...zones] : zones),
    [zones, value],
  );

  return (
    <select
      id={id}
      className="form-control"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ maxWidth: '420px' }}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {options.map((tz) => (
        <option key={tz} value={tz}>
          {tz.replace(/_/g, ' ')}
        </option>
      ))}
    </select>
  );
};
