import React from 'react';
import { useParams } from 'react-router-dom';
import { useGiveawayConfig } from './useGiveawayConfig';
import { ChannelSelect, RoleSelect, FeatureToggle, SaveBar, LoadingSpinner } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';

export const GiveawayPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving } = useGiveawayConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState(data);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

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

      <div className="card p-4 mb-4">
        <h3 className="mb-4">General Configuration</h3>
        
        <ChannelSelect
          guildId={guildId!}
          value={form.announcementChannelId}
          onChange={(v) => setForm({ announcementChannelId: v })}
          label="Announcement Channel"
        />

        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label mb-2 d-block">Max Winners</label>
            <input 
              type="number" 
              className="form-control" 
              value={form.maxWinners} 
              onChange={(e) => setForm({ maxWinners: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label mb-2 d-block">Duration (Minutes)</label>
            <input 
              type="number" 
              className="form-control" 
              value={form.durationMinutes} 
              onChange={(e) => setForm({ durationMinutes: parseInt(e.target.value) || 60 })}
            />
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="mb-4">Permissions</h3>
        
        <RoleSelect
          guildId={guildId!}
          value={form.requiredRoleId}
          onChange={(v) => setForm({ requiredRoleId: v })}
          label="Required Role"
          placeholder="Anyone can join if none selected"
        />

        <RoleSelect
          guildId={guildId!}
          value={form.bypassRoleId}
          onChange={(v) => setForm({ bypassRoleId: v })}
          label="Bypass Role"
          placeholder="No bypass role selected"
        />
      </div>

      <SaveBar 
        isDirty={isDirty} 
        onSave={() => save(form)} 
        onDiscard={resetForm} 
        isSaving={isSaving} 
      />
    </div>
  );
};
