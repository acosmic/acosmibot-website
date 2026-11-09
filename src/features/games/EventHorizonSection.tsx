import React from 'react';
import { Trophy } from 'lucide-react';
import { ChannelSelect, FeatureToggle } from '@/components/ui';
import { EventHorizonSettings } from '@/types/features';

// Mirrors EventHorizonDao.DAILY_PRIZES / DAILY_PRIZE_FULL_PILOTS in acosmibot-core.
const DAILY_PRIZES = [250_000, 150_000, 100_000, 60_000, 40_000];
const FULL_PILOTS = 5;

export function validateEventHorizon(value: EventHorizonSettings): string[] {
  return value.daily_results_enabled && !value.daily_results_channel_id
    ? ['Choose a channel for Daily Challenge results.']
    : [];
}

interface EventHorizonSectionProps {
  guildId: string;
  value: EventHorizonSettings;
  onChange: (updates: Partial<EventHorizonSettings>) => void;
}

const placeStyle: React.CSSProperties = {
  minWidth: 0,
  padding: '12px 14px',
  borderRadius: 12,
  background: 'var(--bg-tertiary)',
};

export const EventHorizonSection: React.FC<EventHorizonSectionProps> = ({ guildId, value, onChange }) => {
  const [channelError] = validateEventHorizon(value);
  return (
    <>
      <div className="dashboard-workflow-section">
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Daily Challenge prizes</h3>
        <p className="text-muted small mb-3" style={{ maxWidth: '70ch' }}>
          Every day everyone in this server flies the same Daily Challenge course. At 00:00 UTC the top {DAILY_PRIZES.length} are
          paid Acosmicoins to their bank. With fewer than {FULL_PILOTS} pilots, every prize is cut in proportion
          (3 pilots get 3/{FULL_PILOTS} of each prize). Prizes are always on; this setting only controls the results post.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {DAILY_PRIZES.map((amount, index) => (
            <div key={amount} style={placeStyle}>
              <Trophy size={18} color="var(--primary-color)" aria-hidden="true" />
              <div className="mt-1 text-muted small">#{index + 1}</div>
              <strong style={{ fontSize: 18 }}>{amount.toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </div>

      <FeatureToggle
        label="Post Daily Challenge results"
        enabled={value.daily_results_enabled}
        onChange={(daily_results_enabled) => onChange({ daily_results_enabled })}
        description="When the day's prizes are paid, post a results card with the winners and their prizes. Winners are named without being pinged."
      />

      <div className="dashboard-workflow-section">
        <ChannelSelect
          guildId={guildId}
          value={value.daily_results_channel_id}
          onChange={(daily_results_channel_id) => onChange({ daily_results_channel_id })}
          label="Results channel"
          placeholder="Choose a text or announcement channel…"
        />
        {channelError && value.daily_results_enabled && (
          <div className="invalid-feedback d-block" role="alert">{channelError}</div>
        )}
      </div>
    </>
  );
};
