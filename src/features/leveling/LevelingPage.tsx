import React from 'react';
import { useParams } from 'react-router-dom';
import { useLevelingConfig } from './useLevelingConfig';
import { ChannelSelect, RoleMultiSelect, FeatureToggle, SaveBar, CollapsibleSection, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';

export const LevelingPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving } = useLevelingConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState(data);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Leveling System</h1>
        <p>Reward your community for participation.</p>
      </div>

      <FeatureToggle 
        enabled={form.enabled} 
        onChange={(v) => setForm({ enabled: v })} 
        description="Enable XP, levels, and role rewards."
      />

      <div className="card p-4 mb-4">
        <h3 className="mb-4">Global XP Configuration</h3>
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label mb-2 d-block">XP Rate (Base)</label>
            <input 
              type="number" 
              className="form-control" 
              value={form.xpRate} 
              onChange={(e) => setForm({ xpRate: parseFloat(e.target.value) || 1.0 })}
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label mb-2 d-block">Cooldown (Seconds)</label>
            <input 
              type="number" 
              className="form-control" 
              value={form.cooldownSeconds} 
              onChange={(e) => setForm({ cooldownSeconds: parseInt(e.target.value) || 60 })}
            />
          </div>
        </div>
      </div>

      <CollapsibleSection title="Announcements" defaultOpen={true}>
        <ChannelSelect
          guildId={guildId!}
          value={form.announcementChannelId}
          onChange={(v) => setForm({ announcementChannelId: v })}
          label="Announcement Channel"
          placeholder="Send to current channel if none selected"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Exclusions">
        <RoleMultiSelect
          guildId={guildId!}
          value={form.ignoredRoleIds}
          onChange={(v) => setForm({ ignoredRoleIds: v })}
          label="Ignored Roles"
          placeholder="These roles won't earn XP"
        />
        <div className="mt-4">
          <p className="text-muted small">Members in these roles or chatting in ignored channels will not receive experience points.</p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Rewards (Rank Roles)">
        <div className="text-center p-4">
          <p className="mb-0">Rewards table migration in progress...</p>
        </div>
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
