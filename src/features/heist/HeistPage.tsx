import React from 'react';
import { useParams } from 'react-router-dom';
import { FeatureToggle, LoadingSpinner, SaveBar } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useGuildPermissions } from '@/hooks/useGuildPermissions';
import { HeistConfig } from '@/types/features';
import { useHeistConfig } from './useHeistConfig';
import { useHeistOverview, useHeistLeaderboard } from './useHeistStats';

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
const timeAgo = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString();
};

const VaultWidget: React.FC<{ guildId: string }> = ({ guildId }) => {
  const { data, isLoading } = useHeistOverview(guildId);
  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  const { vault_currency, summary, recent } = data;
  const successRate = summary.total_heists
    ? Math.round((summary.successes / summary.total_heists) * 100)
    : 0;

  return (
    <div className="card p-4 mb-4">
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
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-muted small">{label}</div>
    <div style={{ fontSize: 20, fontWeight: 600 }}>{value}</div>
  </div>
);

const Leaderboard: React.FC<{ guildId: string }> = ({ guildId }) => {
  const { data, isLoading } = useHeistLeaderboard(guildId);
  if (isLoading) return <LoadingSpinner />;
  if (!data.length) return null;

  return (
    <div className="card p-4 mb-4">
      <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>🦝 Top Ringleaders</h3>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Ringleader</th>
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
                <td className="text-end">{e.heists_led}</td>
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

const ConfigForm: React.FC<{ guildId: string }> = ({ guildId }) => {
  const { data, isLoading, isError, save, isSaving, saveError } = useHeistConfig(guildId);
  const { form, setForm, isDirty, resetForm } = useDirtyState<HeistConfig>(data);

  if (isLoading) return <LoadingSpinner />;
  // config-hybrid is admin-gated; a 403 means the viewer can't manage settings.
  if (isError || !form) return null;

  const num = (field: keyof HeistConfig, value: string, min = 0) => {
    const parsed = parseFloat(value);
    setForm({ [field]: Number.isFinite(parsed) ? Math.max(min, parsed) : min } as Partial<HeistConfig>);
  };
  // success fields are stored 0..1 but shown as percentages
  const pct = (field: keyof HeistConfig, value: string) => {
    const parsed = parseFloat(value);
    setForm({ [field]: Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) / 100 : 0 } as Partial<HeistConfig>);
  };
  const asPct = (v: number) => Math.round(v * 100);

  return (
    <>
      <div className="page-header text-start mt-4 mb-3">
        <h2 style={{ fontSize: 20 }}>Heist Settings</h2>
        <p className="text-muted mb-0">Tune the odds, payouts, and pacing of <code>/heist</code> for this server.</p>
      </div>

      <FeatureToggle
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="Enable the /heist command in this server."
      />

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Pacing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Cooldown (hours)" hint="Per-user wait between heists.">
            <input className="form-control" type="number" min={0} step={0.5}
              value={form.cooldown_hours} onChange={(e) => num('cooldown_hours', e.target.value)} />
          </Field>
          <Field label="Join Window (seconds)" hint="How long the crew lobby stays open.">
            <input className="form-control" type="number" min={10}
              value={form.join_window_seconds} onChange={(e) => num('join_window_seconds', e.target.value, 10)} />
          </Field>
          <Field label="Minimum Vault" hint="Vault must hold at least this to start a heist.">
            <input className="form-control" type="number" min={0}
              value={form.min_vault} onChange={(e) => num('min_vault', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Odds</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Base Success (%)" hint="Solo success chance with one crew member.">
            <input className="form-control" type="number" min={0} max={100}
              value={asPct(form.base_success)} onChange={(e) => pct('base_success', e.target.value)} />
          </Field>
          <Field label="Per-Member Success (%)" hint="Added to success chance per extra crew member.">
            <input className="form-control" type="number" min={0} max={100}
              value={asPct(form.per_member_success)} onChange={(e) => pct('per_member_success', e.target.value)} />
          </Field>
          <Field label="Success Cap (%)" hint="Maximum possible success chance.">
            <input className="form-control" type="number" min={0} max={100}
              value={asPct(form.success_cap)} onChange={(e) => pct('success_cap', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Loot &amp; Penalties</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <Field label="Base Loot (% of vault)" hint="Solo take as a share of the vault.">
            <input className="form-control" type="number" min={0} max={100} step={0.5}
              value={form.base_loot_percent} onChange={(e) => num('base_loot_percent', e.target.value)} />
          </Field>
          <Field label="Pie Growth (k)" hint="How much the total loot grows per extra crew member.">
            <input className="form-control" type="number" min={0} step={0.05}
              value={form.pie_growth_k} onChange={(e) => num('pie_growth_k', e.target.value)} />
          </Field>
          <Field label="Max Loot (% of vault)" hint="Hard cap on a single heist's take.">
            <input className="form-control" type="number" min={0} max={100} step={0.5}
              value={form.max_loot_percent} onChange={(e) => num('max_loot_percent', e.target.value)} />
          </Field>
          <Field label="Fine (% of wallet)" hint="Charged to each member when caught; paid into the vault.">
            <input className="form-control" type="number" min={0} max={100} step={0.5}
              value={form.fine_percent} onChange={(e) => num('fine_percent', e.target.value)} />
          </Field>
        </div>
      </div>

      <SaveBar
        isDirty={isDirty}
        onSave={() => save(form)}
        onDiscard={resetForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </>
  );
};

const Field: React.FC<{ label: string; hint: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="form-label mb-2 d-block">{label}</label>
    {children}
    <p className="text-muted small mt-2 mb-0">{hint}</p>
  </div>
);

export const HeistPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { canManage } = useGuildPermissions(guildId);

  if (!guildId) return <div>No server selected.</div>;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Bank Heist</h1>
        <p>Members rally a crew to crack the server vault — bigger crews, better odds, bigger loot.</p>
      </div>

      <VaultWidget guildId={guildId} />
      <Leaderboard guildId={guildId} />
      {canManage && <ConfigForm guildId={guildId} />}
    </div>
  );
};
