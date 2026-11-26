import React from 'react';
import type { StreamAlertTier, StreamAlertType } from '@/api/streamAlerts';
import { SampleValues, variableLabel, variablesFor } from '@/utils/streamAlertDesigns';
import { TIERS } from '@/utils/streamAlertBox';

const NUMBERS = ['months', 'count', 'bits', 'viewers', 'level'];

/** The made-up viewer, amounts and message that previews and test alerts use. */
export const SampleValuesForm: React.FC<{
  kind: StreamAlertType;
  samples: SampleValues;
  onChange: (next: SampleValues) => void;
}> = ({ kind, samples, onChange }) => (
  <fieldset className="stream-designs__samples">
    <legend>Sample values for the preview and tests</legend>
    <div className="stream-designs__sample-grid">
      {variablesFor(kind).map((name) => {
        if (name === 'name' && kind === 'hypetrain') {
          return <p key={name} className="stream-props__hint">A hype train has no viewer, so {'{name}'} shows &quot;Hype Train&quot;.</p>;
        }
        if (name === 'tier') {
          return (
            <label key={name} className="stream-props__field">
              <span>{variableLabel(name)}</span>
              <select className="form-control" value={samples.tier} onChange={(event) => onChange({ ...samples, tier: event.target.value as StreamAlertTier })}>
                {TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
              </select>
            </label>
          );
        }
        if (!(name in samples)) return null;
        const key = name as keyof SampleValues;
        const numeric = NUMBERS.includes(name);
        return (
          <label key={name} className="stream-props__field">
            <span>{variableLabel(name)}</span>
            <input
              className="form-control"
              type={numeric ? 'number' : 'text'}
              inputMode={numeric ? 'numeric' : undefined}
              min={numeric ? 1 : undefined}
              maxLength={numeric ? undefined : name === 'message' ? 200 : 32}
              value={samples[key]}
              onChange={(event) => onChange({ ...samples, [key]: event.target.value })}
            />
          </label>
        );
      })}
    </div>
  </fieldset>
);
