import React from 'react';
import { useParams } from 'react-router-dom';
import { useModerationConfig } from './useModerationConfig';
import { ChannelSelect, FeatureToggle, SaveBar, LoadingSpinner, CollapsibleSection } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { ModerationConfig } from '@/types/features';

export const ModerationPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving } = useModerationConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<ModerationConfig>(data);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  const updateEvent = (category: string, eventName: string | null, updates: { enabled?: boolean; channel_id?: string | null }) => {
    const newEvents = { ...form.events };
    
    if (category === 'on_audit_log_entry') {
      if (!newEvents.on_audit_log_entry) newEvents.on_audit_log_entry = {};
      newEvents.on_audit_log_entry[eventName!] = { 
        ...newEvents.on_audit_log_entry[eventName!], 
        ...updates 
      };
    } else if (category === 'on_member_update') {
      if (!newEvents.on_member_update) newEvents.on_member_update = {};
      newEvents.on_member_update[eventName!] = { 
        ...newEvents.on_member_update[eventName!], 
        ...updates 
      };
    } else {
      const cat = category as keyof typeof form.events;
      if (!(newEvents as any)[cat]) (newEvents as any)[cat] = { enabled: false, channel_id: null };
      (newEvents as any)[cat] = { ...(newEvents as any)[cat], ...updates };
    }

    setForm({ events: newEvents });
  };

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Moderation Tools</h1>
        <p>Monitor and manage your community effectively.</p>
      </div>

      <FeatureToggle 
        enabled={form.enabled} 
        onChange={(v) => setForm({ enabled: v })} 
        description="Enable moderation logging and automated monitoring."
      />

      <div className="card p-4 mb-4">
        <h3 className="mb-4">Global Logging</h3>
        <ChannelSelect
          guildId={guildId!}
          value={form.mod_log_channel_id}
          onChange={(v) => setForm({ mod_log_channel_id: v })}
          label="Master Moderation Log"
          placeholder="Select a channel for all mod logs..."
        />
        <ChannelSelect
          guildId={guildId!}
          value={form.member_activity_channel_id}
          onChange={(v) => setForm({ member_activity_channel_id: v })}
          label="Member Activity Log"
          placeholder="Select a channel for join/leave/activity..."
        />
      </div>

      <CollapsibleSection title="Audit Log Events" defaultOpen={true}>
        <div className="row">
          {['ban', 'unban', 'kick', 'mute'].map(event => (
            <div key={event} className="col-md-6 mb-4">
              <div className="card bg-tertiary p-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold text-capitalize">{event} Logs</span>
                  <div className="form-check form-switch">
                    <input 
                      type="checkbox" 
                      className="form-check-input"
                      checked={form.events.on_audit_log_entry?.[event]?.enabled || false}
                      onChange={(e) => updateEvent('on_audit_log_entry', event, { enabled: e.target.checked })}
                    />
                  </div>
                </div>
                <ChannelSelect
                  guildId={guildId!}
                  value={form.events.on_audit_log_entry?.[event]?.channel_id || null}
                  onChange={(v) => updateEvent('on_audit_log_entry', event, { channel_id: v })}
                  placeholder="Use master log channel"
                />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Message Monitoring">
        <div className="row">
          {['on_message_edit', 'on_message_delete'].map(event => (
            <div key={event} className="col-md-6 mb-4">
              <div className="card bg-tertiary p-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold">{event.replace(/_/g, ' ').replace('on ', '').toUpperCase()}</span>
                  <div className="form-check form-switch">
                    <input 
                      type="checkbox" 
                      className="form-check-input"
                      checked={(form.events as any)[event]?.enabled || false}
                      onChange={(e) => updateEvent(event, null, { enabled: e.target.checked })}
                    />
                  </div>
                </div>
                <ChannelSelect
                  guildId={guildId!}
                  value={(form.events as any)[event]?.channel_id || null}
                  onChange={(v) => updateEvent(event, null, { channel_id: v })}
                  placeholder="Use master log channel"
                />
              </div>
            </div>
          ))}
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
