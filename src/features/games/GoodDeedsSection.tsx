import React from 'react';
import { Flame, Gift, HandHeart, RotateCcw } from 'lucide-react';
import { ChannelMultiSelect, FeatureToggle, NumberInput } from '@/components/ui';
import { GoodDeedsConfig } from '@/types/features';

export function validateGoodDeeds(value: GoodDeedsConfig): string[] {
  const errors: string[] = [];
  if (value.enabled && value.channel_ids.length === 0) {
    errors.push('Choose at least one channel before enabling Good Deeds.');
  }
  if (value.channel_ids.length > 10) {
    errors.push('Choose no more than 10 channels.');
  }
  if (
    !Number.isInteger(value.min_cooldown_hours)
    || value.min_cooldown_hours < 1
    || value.min_cooldown_hours > 168
  ) {
    errors.push('Minimum cooldown must be a whole number from 1 to 168 hours.');
  }
  if (
    !Number.isInteger(value.max_cooldown_hours)
    || value.max_cooldown_hours < 1
    || value.max_cooldown_hours > 168
  ) {
    errors.push('Maximum cooldown must be a whole number from 1 to 168 hours.');
  }
  if (value.min_cooldown_hours > value.max_cooldown_hours) {
    errors.push('Minimum cooldown cannot be longer than maximum cooldown.');
  }
  return errors;
}

interface GoodDeedsSectionProps {
  guildId: string;
  value: GoodDeedsConfig;
  onChange: (updates: Partial<GoodDeedsConfig>) => void;
}

const rewardStyle: React.CSSProperties = {
  minWidth: 0,
  padding: '16px',
  borderRadius: 12,
  background: 'var(--bg-tertiary)',
};

export const GoodDeedsSection: React.FC<GoodDeedsSectionProps> = ({
  guildId,
  value,
  onChange,
}) => {
  const errors = validateGoodDeeds(value);
  const channelError = errors.find((error) => error.includes('channel'));
  const minimumError = errors.find((error) => (
    error.startsWith('Minimum cooldown')
    || error.startsWith('Minimum cooldown cannot')
  ));
  const maximumError = errors.find((error) => error.startsWith('Maximum cooldown'));

  return (
    <>
      <FeatureToggle
        label="Good Deeds Enabled"
        enabled={value.enabled}
        onChange={(enabled) => onChange({ enabled })}
        description="Post commandless mystery drops that reward the first member who claims and completes a public challenge."
      />

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Drop channels</h3>
        <p className="text-muted small mb-3" style={{ maxWidth: '70ch' }}>
          Each mystery chooses one configured text channel at random. Acosmibot needs permission to view the channel, send messages, embed links, and read message history.
        </p>
        <ChannelMultiSelect
          guildId={guildId}
          label="Eligible channels"
          value={value.channel_ids}
          onChange={(channel_ids) => onChange({ channel_ids })}
          placeholder="Choose 1–10 text channels…"
          maxSelections={10}
          error={channelError}
        />
        <div className="text-muted small">
          {value.channel_ids.length}/10 channels selected
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Cadence</h3>
        <p className="text-muted small mb-3" style={{ maxWidth: '70ch' }}>
          The next drop is scheduled randomly inside this window after the previous mystery closes.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <label className="form-label mb-2 d-block" htmlFor="good-deeds-min-cooldown">
              Minimum cooldown (hours)
            </label>
            <NumberInput
              id="good-deeds-min-cooldown"
              className={`form-control${minimumError ? ' is-invalid' : ''}`}
              min={1}
              max={168}
              step={1}
              value={value.min_cooldown_hours}
              onValueChange={(min_cooldown_hours) => onChange({ min_cooldown_hours })}
              aria-invalid={minimumError ? true : undefined}
              aria-describedby={minimumError ? 'good-deeds-min-error' : undefined}
            />
            {minimumError && (
              <div id="good-deeds-min-error" className="invalid-feedback d-block" role="alert">
                {minimumError}
              </div>
            )}
          </div>
          <div>
            <label className="form-label mb-2 d-block" htmlFor="good-deeds-max-cooldown">
              Maximum cooldown (hours)
            </label>
            <NumberInput
              id="good-deeds-max-cooldown"
              className={`form-control${maximumError ? ' is-invalid' : ''}`}
              min={1}
              max={168}
              step={1}
              value={value.max_cooldown_hours}
              onValueChange={(max_cooldown_hours) => onChange({ max_cooldown_hours })}
              aria-invalid={maximumError ? true : undefined}
              aria-describedby={maximumError ? 'good-deeds-max-error' : undefined}
            />
            {maximumError && (
              <div id="good-deeds-max-error" className="invalid-feedback d-block" role="alert">
                {maximumError}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>Fixed rewards</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <div style={rewardStyle}>
            <Gift size={20} color="var(--primary-color)" aria-hidden="true" />
            <div className="mt-2 text-muted small">Possible credits</div>
            <strong style={{ fontSize: 20 }}>500–50,000</strong>
          </div>
          <div style={rewardStyle}>
            <Flame size={20} color="var(--success-color, #00ff88)" aria-hidden="true" />
            <div className="mt-2 text-muted small">Possible Heat relief</div>
            <strong style={{ fontSize: 20 }}>2–20</strong>
          </div>
        </div>
        <p className="text-muted small mt-3 mb-0">
          Reward ranges are shared across every server and cannot be changed by server admins. Exact rewards stay hidden until a member succeeds.
        </p>
      </div>

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>What members see</h3>
        <div
          aria-label="Good Deed lifecycle"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}
        >
          <div style={rewardStyle}>
            <HandHeart size={18} aria-hidden="true" />
            <span className="text-muted small d-block mt-2">Step 1</span>
            <strong className="d-block">Claim</strong>
            <span className="text-muted small">A generic mystery card reveals no challenge or exact payout.</span>
          </div>
          <div style={rewardStyle}>
            <span className="text-muted small d-block">Step 2</span>
            <strong className="d-block">30-second attempt</strong>
            <span className="text-muted small">Only the claimant can use the controls; everyone can watch.</span>
          </div>
          <div style={rewardStyle}>
            <RotateCcw size={18} aria-hidden="true" />
            <span className="text-muted small d-block mt-2">Step 3</span>
            <strong className="d-block">Reopen or win</strong>
            <span className="text-muted small">A miss reopens the mystery for someone new. Success reveals and grants the rewards.</span>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="alert alert-danger mb-4" role="alert">
          <strong>Good Deeds can’t be saved yet.</strong>
          <ul className="mb-0 mt-2">
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}
    </>
  );
};
