import React from 'react';
import { TimerReset } from 'lucide-react';
import { FeatureToggle, LoadingSpinner, NumberInput } from '@/components/ui';
import { HeistCooldown } from '@/api/heist';
import { HeistConfig } from '@/types/features';
import { useHeistOverview, useHeistLeaderboard, useResetHeistCooldown } from '../heist/useHeistStats';

const FLAVOR_LABELS: Record<string, string> = {
  clean: '✅ Clean Getaway',
  jackpot: '💎 Jackpot',
  inside_man: '🤝 Inside Man',
  sloppy: '😅 Sloppy',
  dropped_bag: '💸 Dropped a Bag',
  silent_alarm: '🔕 Silent Alarm',
  caught_fine: '🚔 Caught',
  snitch: '🐀 Snitch',
  booby_trap: '💥 Booby-Trapped',
};

const fmt = (n: number) => (n ?? 0).toLocaleString();
const timeAgo = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-muted small">{label}</div>
    <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
  </div>
);

const CooldownRow: React.FC<{ guildId: string; cooldown: HeistCooldown }> = ({ guildId, cooldown }) => {
  const { reset, isResetting, error, didReset } = useResetHeistCooldown(guildId);
  const readyAt = cooldown.ready_at ? new Date(cooldown.ready_at) : null;

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 pt-3"
         style={{ borderTop: '1px solid var(--bs-border-color, rgba(255,255,255,0.08))' }}>
      <div>
        <div className="text-muted small">Cooldown</div>
        <div>
          {cooldown.is_ready
            ? <span className="text-success">Ready — <code>/heist start</code> can be run now.</span>
            : <>Next heist unlocks <strong>{readyAt?.toLocaleString()}</strong></>}
        </div>
        {error && <div className="text-danger small mt-1">{error}</div>}
        {didReset && !error && <div className="text-success small mt-1">Cooldown cleared.</div>}
      </div>
      <button
        type="button"
        className="btn btn-sm d-flex align-items-center gap-2"
        onClick={() => reset()}
        disabled={isResetting || cooldown.is_ready}
        title={cooldown.is_ready ? 'There is no cooldown to reset.' : 'Clear the cooldown so a heist can start now.'}
      >
        <TimerReset size={16} />
        {isResetting ? 'Resetting…' : 'Reset Cooldown'}
      </button>
    </div>
  );
};

const VaultWidget: React.FC<{ guildId: string }> = ({ guildId }) => {
  const { data, isLoading } = useHeistOverview(guildId);
  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const { vault_currency, summary, recent, cooldown } = data;
  const successRate = summary.total_heists
    ? Math.round((summary.successes / summary.total_heists) * 100)
    : 0;

  return (
    <div className="dashboard-workflow-section">
      <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>🏦 The Vault</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        <Stat label="Vault Balance" value={`${fmt(vault_currency)} credits`} />
        <Stat label="Heists Pulled" value={fmt(summary.total_heists)} />
        <Stat label="Success Rate" value={`${successRate}%`} />
        <Stat label="Biggest Score" value={`${fmt(summary.biggest_loot)} credits`} />
      </div>

      <h4 className="mt-4" style={{ fontSize: 15 }}>Recent Activity</h4>
      {recent.length === 0 ? (
        <p className="text-muted small mb-0">No heists yet. The vault sits untouched…</p>
      ) : (
        <ul className="list-unstyled mb-0">
          {recent.map((ev) => (
            <li key={ev.id} className="d-flex justify-content-between align-items-center py-2"
                style={{ borderTop: '1px solid var(--bs-border-color, rgba(255,255,255,0.08))' }}>
              <span>
                <strong>{ev.ringleader_name}</strong>
                <span className="text-muted small"> · {ev.crew_size} crew · {FLAVOR_LABELS[ev.flavor ?? ''] ?? (ev.success ? 'Success' : 'Failed')}</span>
              </span>
              <span className={ev.success ? 'text-success' : 'text-danger'}>
                {ev.success ? `+${fmt(ev.total_loot)}` : `-${fmt(ev.total_fines)}`}
                <span className="text-muted small ms-2">{timeAgo(ev.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {cooldown && <CooldownRow guildId={guildId} cooldown={cooldown} />}
    </div>
  );
};

const Leaderboard: React.FC<{ guildId: string }> = ({ guildId }) => {
  const { data, isLoading } = useHeistLeaderboard(guildId);
  if (isLoading) return <LoadingSpinner />;
  if (!data.length) return null;

  return (
    <div className="dashboard-workflow-section">
      <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>🦝 Top Crew</h3>
      <div className="table-responsive">
        <table className="table table-dark table-hover table-sm align-middle mb-0" style={{ background: 'transparent' }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Member</th>
              <th className="text-end">Heists</th>
              <th className="text-end">Success</th>
              <th className="text-end">Total Loot</th>
              <th className="text-end">Biggest</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.user_id}>
                <td>{e.rank}</td>
                <td>{e.name}</td>
                <td className="text-end">{e.heists}</td>
                <td className="text-end">{Math.round(e.success_rate * 100)}%</td>
                <td className="text-end">{fmt(e.total_loot)}</td>
                <td className="text-end">{fmt(e.biggest_loot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; hint: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="form-label mb-2 d-block">{label}</label>
    {children}
    <p className="text-muted small mt-2 mb-0">{hint}</p>
  </div>
);

interface HeistSectionProps {
  guildId: string;
  value: HeistConfig;
  onChange: (updates: Partial<HeistConfig>) => void;
}

export const HeistSection: React.FC<HeistSectionProps> = ({ guildId, value, onChange }) => {
  const num = (field: keyof HeistConfig, parsed: number, min = 0, max = Infinity) => {
    onChange({ [field]: Math.min(max, Math.max(min, parsed)) } as Partial<HeistConfig>);
  };
  // success fields are stored 0..1 but shown as percentages
  const pct = (field: keyof HeistConfig, parsed: number) => {
    onChange({ [field]: Math.max(0, Math.min(100, parsed)) / 100 } as Partial<HeistConfig>);
  };
  const asPct = (v: number) => Math.round(v * 100);

  return (
    <>
      <VaultWidget guildId={guildId} />
      <Leaderboard guildId={guildId} />

      <FeatureToggle
        enabled={value.enabled}
        onChange={(v) => onChange({ enabled: v })}
        description="Enable /heist start in this server."
      />

      <div className="dashboard-workflow-section">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Pacing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Cooldown (hours)" hint="Server-wide wait between heists.">
            <NumberInput className="form-control" min={0} step={0.5}
              value={value.cooldown_hours} onValueChange={(next) => num('cooldown_hours', next)} />
          </Field>
          <Field label="Join Window (seconds)" hint="How long the crew lobby stays open.">
            <NumberInput className="form-control" min={10}
              value={value.join_window_seconds} onValueChange={(next) => num('join_window_seconds', next, 10)} />
          </Field>
          <Field label="Max Crew" hint="Largest lobby allowed (recommended 5, hard cap 20).">
            <NumberInput className="form-control" min={1} max={20}
              value={value.max_crew} onValueChange={(next) => num('max_crew', next, 1)} />
          </Field>
          <Field label="Minimum Vault" hint="Vault must hold at least this to start a heist.">
            <NumberInput className="form-control" min={0}
              value={value.min_vault} onValueChange={(next) => num('min_vault', next)} />
          </Field>
        </div>
      </div>

      <div className="dashboard-workflow-section">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Active Phase (Minigames)</h3>
        <FeatureToggle
          enabled={value.minigames_enabled}
          onChange={(v) => onChange({ minigames_enabled: v })}
          description="After the lobby closes, the crew takes turns on a shared message — everyone watches each member play a random minigame. Passing jobs raises the crew's success; botching or stalling lowers it. Turn off for a pure RNG heist."
        />
        <div className="mt-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Briefing Length (seconds)" hint="Job-reveal + ready-up window before the jobs start. Begins early once everyone's ready. 10–120s.">
            <NumberInput className="form-control" min={10} max={120}
              value={value.briefing_seconds} onValueChange={(next) => num('briefing_seconds', next, 10, 120)} />
          </Field>
          <Field label="Turn Length (seconds)" hint="Time each member gets for their job before it's a bust.">
            <NumberInput className="form-control" min={5}
              value={value.turn_seconds} onValueChange={(next) => num('turn_seconds', next, 5)} />
          </Field>
          <Field label="Success per Job Passed (%)" hint="Added to the odds for each job the crew nails.">
            <NumberInput className="form-control" min={0} max={100}
              value={asPct(value.success_per_pass)} onValueChange={(next) => pct('success_per_pass', next)} />
          </Field>
          <Field label="Success per Job Failed (%)" hint="Removed from the odds for each botched or skipped job.">
            <NumberInput className="form-control" min={0} max={100}
              value={asPct(value.success_per_fail)} onValueChange={(next) => pct('success_per_fail', next)} />
          </Field>
          <Field label="Success Floor (%)" hint="Minimum success chance when minigames are on.">
            <NumberInput className="form-control" min={0} max={100}
              value={asPct(value.success_floor)} onValueChange={(next) => pct('success_floor', next)} />
          </Field>
        </div>
      </div>

      <div className="dashboard-workflow-section">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Odds</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Base Success (%)" hint="Solo success chance with one crew member.">
            <NumberInput className="form-control" min={0} max={100}
              value={asPct(value.base_success)} onValueChange={(next) => pct('base_success', next)} />
          </Field>
          <Field label="Per-Member Success (%)" hint="Added per extra crew member. Only used when minigames are OFF.">
            <NumberInput className="form-control" min={0} max={100}
              value={asPct(value.per_member_success)} onValueChange={(next) => pct('per_member_success', next)} />
          </Field>
          <Field label="Success Cap (%)" hint="Maximum possible success chance.">
            <NumberInput className="form-control" min={0} max={100}
              value={asPct(value.success_cap)} onValueChange={(next) => pct('success_cap', next)} />
          </Field>
        </div>
      </div>

      <div className="dashboard-workflow-section">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Loot &amp; Penalties</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Base Loot (% of vault)" hint="Solo take as a share of the vault.">
            <NumberInput className="form-control" min={0} max={100} step={0.5}
              value={value.base_loot_percent} onValueChange={(next) => num('base_loot_percent', next)} />
          </Field>
          <Field label="Pie Growth (k)" hint="How much the total loot grows per extra crew member.">
            <NumberInput className="form-control" min={0} step={0.05}
              value={value.pie_growth_k} onValueChange={(next) => num('pie_growth_k', next)} />
          </Field>
          <Field label="Max Loot (% of vault)" hint="Hard cap on a single heist's take.">
            <NumberInput className="form-control" min={0} max={100} step={0.5}
              value={value.max_loot_percent} onValueChange={(next) => num('max_loot_percent', next)} />
          </Field>
          <Field label="Fine (% of wallet)" hint="Charged to each member when caught; paid into the vault.">
            <NumberInput className="form-control" min={0} max={100} step={0.5}
              value={value.fine_percent} onValueChange={(next) => num('fine_percent', next)} />
          </Field>
        </div>
      </div>
    </>
  );
};
