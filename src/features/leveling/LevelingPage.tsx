import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLevelingConfig, LevelingConfig, RolesConfig } from './useLevelingConfig';
import { ChannelSelect, FeatureToggle, SaveBar, CollapsibleSection, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useGuildChannels } from '@/hooks/useGuildChannels';
import { useGuildRoles } from '@/hooks/useGuildRoles';

export const LevelingPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { leveling, roles, isLoading, save, isSaving, saveError } = useLevelingConfig(guildId!);
  const { form: levelForm, setForm: setLevelForm, isDirty: levelDirty, resetForm: resetLevelForm } = useDirtyState<LevelingConfig>(leveling);
  const { form: roleForm, setForm: setRoleForm, isDirty: roleDirty, resetForm: resetRoleForm } = useDirtyState<RolesConfig>(roles);
  const { data: availableRoles } = useGuildRoles(guildId!);

  const isDirty = levelDirty || roleDirty;

  const filteredRoles = useMemo(
    () => (availableRoles ?? []).filter(r => r.name !== '@everyone' && !r.managed),
    [availableRoles],
  );

  if (isLoading) return <LoadingSpinner />;
  if (!levelForm || !roleForm) return <div>No data found.</div>;

  const handleSave = () => {
    save({ leveling: levelForm, roles: roleForm });
  };

  const handleDiscard = () => {
    resetLevelForm();
    resetRoleForm();
  };

  const addMapping = () => {
    const mappings = { ...roleForm.role_mappings };
    let level = 0;
    while (mappings[String(level)]) level += 5;
    mappings[String(level)] = { role_ids: [] };
    setRoleForm({ role_mappings: mappings });
  };

  const removeMapping = (level: string) => {
    const mappings = { ...roleForm.role_mappings };
    delete mappings[level];
    setRoleForm({ role_mappings: mappings });
  };

  const updateMappingLevel = (oldLevel: string, newLevel: string) => {
    if (oldLevel === newLevel) return;
    const mappings = { ...roleForm.role_mappings };
    mappings[newLevel] = mappings[oldLevel];
    delete mappings[oldLevel];
    setRoleForm({ role_mappings: mappings });
  };

  const updateMappingRole = (level: string, roleId: string) => {
    const mappings = { ...roleForm.role_mappings };
    mappings[level] = { ...mappings[level], role_ids: roleId ? [roleId] : [] };
    setRoleForm({ role_mappings: mappings });
  };

  const sortedLevels = Object.keys(roleForm.role_mappings).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Leveling System</h1>
        <p>Reward your community for participation.</p>
      </div>

      <FeatureToggle
        enabled={levelForm.enabled}
        onChange={(v) => setLevelForm({ enabled: v })}
        description="Enable XP, levels, and role rewards."
      />

      {/* Level-Up Announcements */}
      <CollapsibleSection title="Level-Up Announcements" defaultOpen={true}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Enable Level-Up Announcements</label>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={levelForm.level_up_announcements}
              onChange={(e) => setLevelForm({ level_up_announcements: e.target.checked })}
              style={{ width: '3em', height: '1.5em', cursor: 'pointer' }}
            />
          </div>
        </div>

        <ChannelSelect
          guildId={guildId!}
          value={levelForm.announcement_channel_id}
          onChange={(v) => setLevelForm({ announcement_channel_id: v })}
          label="Announcement Channel"
          placeholder="Send to current channel if none selected"
        />

        <div className="mb-3">
          <label className="form-label mb-2 d-block">Level-Up Message</label>
          <textarea
            className="form-control"
            rows={3}
            value={levelForm.level_up_message}
            onChange={(e) => setLevelForm({ level_up_message: e.target.value })}
            placeholder="{username}, you have reached level {level}!"
          />
          <p className="text-muted small mt-1">Variables: {'{username}'}, {'{mention}'}, {'{level}'}, {'{credits}'}</p>
        </div>

        <div className="mb-3">
          <label className="form-label mb-2 d-block">Level-Up Message (With Streak)</label>
          <textarea
            className="form-control"
            rows={3}
            value={levelForm.level_up_message_with_streak}
            onChange={(e) => setLevelForm({ level_up_message_with_streak: e.target.value })}
            placeholder="{mention} reached level {level}! +{credits} Credits!"
          />
          <p className="text-muted small mt-1">Variables: {'{username}'}, {'{mention}'}, {'{level}'}, {'{credits}'}, {'{base_credits}'}, {'{streak_bonus}'}, {'{streak}'}</p>
        </div>
      </CollapsibleSection>

      {/* Daily Rewards */}
      <CollapsibleSection title="Daily Rewards" defaultOpen={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Enable Daily Reward Announcements</label>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={levelForm.daily_announcements_enabled}
              onChange={(e) => setLevelForm({ daily_announcements_enabled: e.target.checked })}
              style={{ width: '3em', height: '1.5em', cursor: 'pointer' }}
            />
          </div>
        </div>

        <ChannelSelect
          guildId={guildId!}
          value={levelForm.daily_announcement_channel_id}
          onChange={(v) => setLevelForm({ daily_announcement_channel_id: v })}
          label="Daily Rewards Channel"
          placeholder="Select a channel..."
        />

        <div className="mb-3">
          <label className="form-label mb-2 d-block">Daily Reward Message</label>
          <textarea
            className="form-control"
            rows={3}
            value={levelForm.daily_announcement_message}
            onChange={(e) => setLevelForm({ daily_announcement_message: e.target.value })}
            placeholder="{username} claimed their daily reward!"
          />
        </div>

        <div className="mb-3">
          <label className="form-label mb-2 d-block">Daily Reward Message (With Streak)</label>
          <textarea
            className="form-control"
            rows={3}
            value={levelForm.daily_announcement_message_with_streak}
            onChange={(e) => setLevelForm({ daily_announcement_message_with_streak: e.target.value })}
            placeholder="{mention} claimed their daily reward! +{credits} Credits!"
          />
          <p className="text-muted small mt-1">Variables: {'{username}'}, {'{mention}'}, {'{credits}'}, {'{base_credits}'}, {'{streak_bonus}'}, {'{streak}'}</p>
        </div>
      </CollapsibleSection>

      {/* Role Assignments */}
      <CollapsibleSection title="Role Assignments" defaultOpen={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Enable Role Rewards</label>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={roleForm.enabled}
              onChange={(e) => setRoleForm({ enabled: e.target.checked })}
              style={{ width: '3em', height: '1.5em', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label mb-2 d-block">Assignment Mode</label>
          <select
            className="form-control"
            value={roleForm.mode}
            onChange={(e) => setRoleForm({ mode: e.target.value })}
          >
            <option value="additive">Additive (keep all earned roles)</option>
            <option value="replace">Replace (only latest role)</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label mb-3 d-block">Level → Role Mappings</label>
          {sortedLevels.length === 0 && (
            <p className="text-muted small">No role mappings configured. Add one below.</p>
          )}
          {sortedLevels.map(level => {
            const mapping = roleForm.role_mappings[level];
            return (
              <div key={level} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '100px', flexShrink: 0 }}
                  value={level}
                  min={0}
                  onChange={(e) => updateMappingLevel(level, e.target.value)}
                  placeholder="Level"
                />
                <select
                  className="form-control"
                  value={mapping.role_ids?.[0] || ''}
                  onChange={(e) => updateMappingRole(level, e.target.value)}
                >
                  <option value="">Select Role...</option>
                  {filteredRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <button
                  className="btn"
                  style={{ flexShrink: 0, padding: '8px 14px', color: 'var(--error-color)', borderColor: 'var(--error-color)' }}
                  onClick={() => removeMapping(level)}
                >
                  ×
                </button>
              </div>
            );
          })}
          <button className="btn primary mt-2" onClick={addMapping}>
            + Add Level Mapping
          </button>
        </div>
      </CollapsibleSection>

      {/* Role Announcements */}
      <CollapsibleSection title="Role Announcements" defaultOpen={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Enable Role Announcements</label>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={roleForm.role_announcement}
              onChange={(e) => setRoleForm({ role_announcement: e.target.checked })}
              style={{ width: '3em', height: '1.5em', cursor: 'pointer' }}
            />
          </div>
        </div>

        <ChannelSelect
          guildId={guildId!}
          value={roleForm.announcement_channel_id}
          onChange={(v) => setRoleForm({ announcement_channel_id: v })}
          label="Role Announcement Channel"
          placeholder="Select a channel..."
        />
      </CollapsibleSection>

      <SaveBar
        isDirty={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};
