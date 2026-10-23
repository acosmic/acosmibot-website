import { Link } from 'react-router-dom';
import './SavedFeaturePlan.css';

export function UpgradeRestoreLink({ guildId }: { guildId: string }) {
  return <Link className="saved-feature-upgrade" to={`/server/${guildId}/billing`}>Upgrade to restore all</Link>;
}

export interface SavedFeatureStats {
  tier: string;
  active_count: number;
  active_limit: number;
  saved_limit: number;
}

export function SavedFeaturePlan({ guildId, saved, stats, noun }: {
  guildId: string; saved: number; stats: SavedFeatureStats; noun: string;
}) {
  return (
    <div className="mb-4" aria-label={`${noun} plan allowance`}>
      <p className="mb-1">
        <strong>{stats.active_count} / {stats.active_limit} active</strong>
        {' · '}{saved} / {stats.saved_limit} saved
      </p>
      <p className="text-muted mb-1">
        {stats.active_limit === 1
          ? 'Activating another entry automatically pauses the current one. Your saved settings stay available.'
          : `Pause an active entry to free a slot. You can keep up to ${stats.saved_limit} saved.`}
      </p>
      {stats.tier === 'free' && saved > stats.active_limit && (
        <p className="mb-0">
          <UpgradeRestoreLink guildId={guildId} />
          {' — '}Plus lets you activate all your saved {noun} together.
        </p>
      )}
    </div>
  );
}

export function SavedFeatureToggle({ name, active, busy, full, onChange }: {
  name: string; active: boolean; busy: boolean; full: boolean; onChange: () => void;
}) {
  return (
    <button type="button" className={`btn btn-sm ${active ? 'primary' : ''}`}
      aria-label={`${active ? 'Pause' : 'Activate'} ${name}`}
      aria-pressed={active} disabled={busy || (!active && full)}
      title={!active && full ? 'Pause an active entry to free a slot.' : undefined}
      onClick={onChange}>
      {active ? 'Active · Pause' : 'Paused · Activate'}
    </button>
  );
}
