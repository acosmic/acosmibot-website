import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGiveawayConfig } from './useGiveawayConfig';
import { useQuery } from '@tanstack/react-query';
import { ChannelSelect, RoleMultiSelect, FeatureToggle, SaveBar, LoadingSpinner, CollapsibleSection } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { giveawayApi } from '@/api/giveaway';
import { useGuildRoles } from '@/hooks/useGuildRoles';

export const GiveawayPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving } = useGiveawayConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState(data);
  const { data: availableRoles } = useGuildRoles(guildId!);

  // Role multiplier add state
  const [roleMulRoleId, setRoleMulRoleId] = useState('');
  const [roleMulValue, setRoleMulValue] = useState(2);

  // Banned user input state
  const [bannedUserInput, setBannedUserInput] = useState('');

  // Live giveaways
  const { data: activeGiveaways, refetch: refetchActive } = useQuery({
    queryKey: ['giveaways', guildId, 'active'],
    queryFn: () => giveawayApi.getActiveGiveaways(guildId!),
    enabled: !!guildId,
  });
  const { data: recentGiveaways } = useQuery({
    queryKey: ['giveaways', guildId, 'recent'],
    queryFn: () => giveawayApi.getRecentGiveaways(guildId!),
    enabled: !!guildId,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  const addRoleMultiplier = () => {
    if (!roleMulRoleId) return;
    if (roleMulValue < 2 || roleMulValue > 10) return;
    setForm({ roleMultipliers: { ...form.roleMultipliers, [roleMulRoleId]: roleMulValue } });
    setRoleMulRoleId('');
    setRoleMulValue(2);
  };

  const removeRoleMultiplier = (roleId: string) => {
    const next = { ...form.roleMultipliers };
    delete next[roleId];
    setForm({ roleMultipliers: next });
  };

  const addBannedUser = () => {
    const id = bannedUserInput.trim();
    if (!/^\d{17,20}$/.test(id)) return;
    if (form.bannedUserIds.includes(id)) return;
    setForm({ bannedUserIds: [...form.bannedUserIds, id] });
    setBannedUserInput('');
  };

  const cancelGiveaway = async (giveawayId: number) => {
    if (!confirm('Cancel this giveaway? This cannot be undone.')) return;
    await giveawayApi.cancelGiveaway(guildId!, giveawayId);
    refetchActive();
  };

  const formatTimeLeft = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const roleColor = (id: string) => {
    const role = availableRoles?.find(r => r.id === id);
    return role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5';
  };

  const roleName = (id: string) => availableRoles?.find(r => r.id === id)?.name ?? `Role ${id}`;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Giveaway Settings</h1>
        <p>Configure how giveaways work in your server.</p>
      </div>

      <FeatureToggle
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="Enable or disable the giveaway system."
      />

      {/* General */}
      <div className="card p-4 mb-4">
        <h3 className="mb-4">General Configuration</h3>

        <ChannelSelect
          guildId={guildId!}
          value={form.winnerLogChannelId}
          onChange={(v) => setForm({ winnerLogChannelId: v })}
          label="Winner Log Channel"
          placeholder="No log channel selected"
        />

        <div className="row">
          <div className="col-md-4 mb-3">
            <label className="form-label mb-2 d-block">Default Emoji</label>
            <input
              type="text"
              className="form-control"
              value={form.defaultEmoji}
              onChange={(e) => setForm({ defaultEmoji: e.target.value || '🎉' })}
              maxLength={8}
            />
          </div>
          <div className="col-md-4 mb-3">
            <label className="form-label mb-2 d-block">Recent Winner Lockout</label>
            <input
              type="number"
              className="form-control"
              value={form.recentWinnerLockoutCount}
              min={0}
              onChange={(e) => setForm({ recentWinnerLockoutCount: parseInt(e.target.value) || 0 })}
            />
            <div className="small text-muted mt-1">How many past giveaways to lock out winners from</div>
          </div>
          <div className="col-md-4 mb-3 d-flex align-items-end pb-3">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="dmWinner"
                checked={form.dmWinner}
                onChange={(e) => setForm({ dmWinner: e.target.checked })}
                style={{ width: '3em', height: '1.5em' }}
              />
              <label className="form-check-label ms-2" htmlFor="dmWinner">DM Winners</label>
            </div>
          </div>
        </div>
      </div>

      {/* Entry Requirements */}
      <CollapsibleSection title="Entry Requirements" defaultOpen={true}>
        <div className="row mb-4">
          <div className="col-md-6 mb-3">
            <label className="form-label mb-2 d-block">Min Account Age (days)</label>
            <input
              type="number"
              className="form-control"
              value={form.minAccountAgeDays}
              min={0}
              onChange={(e) => setForm({ minAccountAgeDays: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label mb-2 d-block">Min Server Join Age (days)</label>
            <input
              type="number"
              className="form-control"
              value={form.minServerJoinDays}
              min={0}
              onChange={(e) => setForm({ minServerJoinDays: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label mb-2 d-block">Required Roles</label>
          <div className="small text-muted mb-2">Members must have at least one of these roles to enter.</div>
          <RoleMultiSelect
            guildId={guildId!}
            value={form.requiredRoleIds}
            onChange={(v) => setForm({ requiredRoleIds: v })}
            placeholder="No required roles — all members can enter"
          />
        </div>

        <div className="mb-3">
          <label className="form-label mb-2 d-block">Excluded Roles</label>
          <div className="small text-muted mb-2">Members with these roles cannot enter.</div>
          <RoleMultiSelect
            guildId={guildId!}
            value={form.excludedRoleIds}
            onChange={(v) => setForm({ excludedRoleIds: v })}
            placeholder="No excluded roles"
          />
        </div>
      </CollapsibleSection>

      {/* Booster Multiplier */}
      <CollapsibleSection title="Booster Multiplier">
        <div className="d-flex align-items-center gap-3 mb-3">
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id="boosterEnabled"
              checked={form.boosterMultiplierEnabled}
              onChange={(e) => setForm({ boosterMultiplierEnabled: e.target.checked })}
              style={{ width: '3em', height: '1.5em' }}
            />
            <label className="form-check-label ms-2" htmlFor="boosterEnabled">Enable server booster bonus</label>
          </div>
        </div>
        {form.boosterMultiplierEnabled && (
          <div className="col-md-4">
            <label className="form-label mb-2 d-block">Booster Multiplier (2–10)</label>
            <input
              type="number"
              className="form-control"
              value={form.boosterMultiplier}
              min={2}
              max={10}
              onChange={(e) => setForm({ boosterMultiplier: parseInt(e.target.value) || 2 })}
            />
            <div className="small text-muted mt-1">Server boosters get this many entries.</div>
          </div>
        )}
      </CollapsibleSection>

      {/* Role Multipliers */}
      <CollapsibleSection title="Role Multipliers">
        <div className="small text-muted mb-3">Give specific roles extra entries per giveaway.</div>

        {/* Existing multipliers */}
        {Object.keys(form.roleMultipliers).length === 0 ? (
          <p className="text-muted small mb-3">No role multipliers configured.</p>
        ) : (
          <div className="mb-3">
            {Object.entries(form.roleMultipliers).map(([id, mult]) => (
              <div key={id} className="d-flex align-items-center gap-3 mb-2 p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: roleColor(id), flexShrink: 0 }} />
                <span className="flex-grow-1">{roleName(id)}</span>
                <span className="text-primary fw-bold">{mult}× entries</span>
                <button
                  className="btn btn-sm p-1"
                  onClick={() => removeRoleMultiplier(id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--error-color)' }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add new multiplier */}
        <div className="row align-items-end g-2">
          <div className="col-md-6">
            <label className="form-label mb-1 d-block small">Role</label>
            <select
              className="form-control"
              value={roleMulRoleId}
              onChange={(e) => setRoleMulRoleId(e.target.value)}
            >
              <option value="">Select a role...</option>
              {availableRoles?.filter(r => !r.managed && r.name !== '@everyone').map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label mb-1 d-block small">Multiplier</label>
            <input
              type="number"
              className="form-control"
              value={roleMulValue}
              min={2}
              max={10}
              onChange={(e) => setRoleMulValue(parseInt(e.target.value) || 2)}
            />
          </div>
          <div className="col-md-3">
            <button
              className="btn primary w-100"
              onClick={addRoleMultiplier}
              disabled={!roleMulRoleId}
            >
              Add
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Banned Users */}
      <CollapsibleSection title="Banned Users">
        <div className="small text-muted mb-3">These users can never enter giveaways in this server.</div>

        {form.bannedUserIds.length === 0 ? (
          <p className="text-muted small mb-3">No banned users.</p>
        ) : (
          <div className="mb-3">
            {form.bannedUserIds.map(id => (
              <div key={id} className="d-flex align-items-center justify-content-between p-2 rounded mb-2" style={{ background: 'var(--bg-tertiary)' }}>
                <div>
                  <div className="fw-bold small">User {id}</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>{id}</div>
                </div>
                <button
                  className="btn btn-sm p-1"
                  onClick={() => setForm({ bannedUserIds: form.bannedUserIds.filter(u => u !== id) })}
                  style={{ background: 'transparent', border: 'none', color: 'var(--error-color)' }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control"
            placeholder="Discord User ID (17–20 digits)"
            value={bannedUserInput}
            onChange={(e) => setBannedUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBannedUser()}
          />
          <button className="btn primary px-4" onClick={addBannedUser}>Ban</button>
        </div>
      </CollapsibleSection>

      {/* Active / Recent Giveaways */}
      <CollapsibleSection title="Active Giveaways" defaultOpen={true}>
        {!activeGiveaways?.length ? (
          <p className="text-muted small">No active giveaways.</p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {activeGiveaways.map((g: any) => {
              const end = new Date(g.end_time);
              const diff = end.getTime() - Date.now();
              return (
                <div key={g.id} className="card p-3" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="fw-bold">{g.prize}</span>
                    <span className="badge bg-success">Active</span>
                  </div>
                  {g.description && <p className="small text-muted mb-2">{g.description}</p>}
                  <div className="d-flex gap-3 small text-muted mb-3">
                    <span>🎟️ {(g.entry_count || 0).toLocaleString()} entries</span>
                    <span>⏰ {diff > 0 ? formatTimeLeft(diff) : 'Ending soon'}</span>
                    <span>📅 {end.toLocaleString()}</span>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ color: 'var(--error-color)', border: '1px solid var(--error-color)', background: 'transparent' }}
                    onClick={() => cancelGiveaway(g.id)}
                  >
                    Cancel Giveaway
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Recent Giveaways">
        {!recentGiveaways?.length ? (
          <p className="text-muted small">No recent giveaways.</p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {recentGiveaways.map((g: any) => (
              <div key={g.id} className="card p-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="fw-bold">{g.prize}</span>
                  <span className="badge bg-secondary">Ended</span>
                </div>
                {g.description && <p className="small text-muted mb-2">{g.description}</p>}
                <div className="d-flex gap-3 small text-muted">
                  <span>🎟️ {(g.entry_count || 0).toLocaleString()} entries</span>
                  {g.winner_id && g.winner_id !== 0
                    ? <span>🏆 Winner: {g.winner_id}</span>
                    : <span>No winner</span>
                  }
                  <span>📅 {new Date(g.end_time).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <SaveBar
        isDirty={isDirty}
        onSave={() => save(form)}
        onDiscard={resetForm}
        isSaving={isSaving}
      />
    </div>
  );
};
