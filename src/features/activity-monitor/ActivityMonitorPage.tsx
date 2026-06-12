import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowRight, ClipboardList, Eye, Gamepad2, MessageCircle, Music,
  Pencil, Plus, Trash2, TriangleAlert, Trophy, TvMinimalPlay,
  type LucideIcon,
} from 'lucide-react';
import { FeatureToggle, LoadingSpinner } from '@/components/ui';
import { useGuildRoles } from '@/hooks/useGuildRoles';
import { showToast } from '@/utils/toast';
import type { ActivityRule } from '@/api/activityMonitor';
import { useActivityMonitorConfig } from './useActivityMonitorConfig';

const ACTIVITY_TYPES: Array<{ value: string; label: string; icon: LucideIcon; description: string }> = [
  { value: 'playing',   label: 'Playing (Game)',    icon: Gamepad2,      description: 'Assign role when playing a game' },
  { value: 'streaming', label: 'Streaming',         icon: TvMinimalPlay, description: 'Assign role when streaming on Twitch/YouTube' },
  { value: 'listening', label: 'Listening (Music)', icon: Music,         description: 'Assign role when listening to music' },
  { value: 'watching',  label: 'Watching (Video)',  icon: Eye,           description: 'Assign role when watching something' },
  { value: 'competing', label: 'Competing',         icon: Trophy,        description: 'Assign role when competing' },
  { value: 'custom',    label: 'Custom Status',     icon: MessageCircle, description: 'Assign role with custom status' },
];

const roleColor = (color?: number): string =>
  color ? `#${color.toString(16).padStart(6, '0')}` : '#99AAB5';

export const ActivityMonitorPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { config, isLoading, save, isSaving } = useActivityMonitorConfig(guildId!);
  const { data: roles = [] } = useGuildRoles(guildId!);
  const [editing, setEditing] = useState<ActivityRule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ActivityRule | null>(null);

  if (isLoading) return <LoadingSpinner />;
  if (!config) return <div>No data found.</div>;

  const persist = async (next: typeof config) => {
    try {
      await save(next);
      showToast('Configuration saved successfully!', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save configuration', 'error');
    }
  };

  const saveRule = (rule: ActivityRule) => {
    const exists = config.rules.some((r) => r.id === rule.id);
    const rules = exists
      ? config.rules.map((r) => (r.id === rule.id ? rule : r))
      : [...config.rules, rule];
    setEditing(null);
    void persist({ ...config, rules });
  };

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Activity Monitor</h1>
        <p>Automatically assign roles based on member activities (playing, streaming, listening…).</p>
      </div>

      <FeatureToggle
        enabled={config.enabled}
        onChange={(v) => void persist({ ...config, enabled: v })}
        label="Activity Monitor"
        description="Enable automatic role assignment based on user activities."
      />

      {!config.enabled ? (
        <div className="card p-5 text-center">
          <div style={{ color: 'var(--warning-color, #FFB800)', marginBottom: 12 }}>
            <TriangleAlert size={40} />
          </div>
          <h3 style={{ color: 'var(--text-primary)', fontSize: 18 }}>Activity Monitor is Disabled</h3>
          <p className="text-muted mb-0">Enable the activity monitor above to start creating rules.</p>
        </div>
      ) : (
        <div className="card p-4 mb-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Activity Rules</h3>
            <button className="btn primary" disabled={isSaving} onClick={() => setEditing('new')}>
              <Plus size={16} style={{ verticalAlign: '-0.15em' }} /> Add Rule
            </button>
          </div>

          {config.rules.length === 0 ? (
            <div className="text-center p-4">
              <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}><ClipboardList size={40} /></div>
              <h4 style={{ color: 'var(--text-primary)', fontSize: 16 }}>No Rules Configured</h4>
              <p className="text-muted">Create your first activity monitoring rule to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {config.rules.map((rule) => {
                const type = ACTIVITY_TYPES.find((t) => t.value === rule.activity_type);
                const TypeIcon = type?.icon ?? MessageCircle;
                const trigger = roles.find((r) => r.id === rule.trigger_role_id);
                const assigned = roles.find((r) => r.id === rule.assigned_role_id);
                return (
                  <div key={rule.id} style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 12, padding: 16,
                    opacity: rule.enabled ? 1 : 0.6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ color: 'var(--primary-color)', display: 'flex' }}><TypeIcon size={22} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rule.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {type?.label ?? rule.activity_type}
                          </div>
                        </div>
                      </div>
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={rule.enabled}
                          disabled={isSaving}
                          onChange={() => void persist({
                            ...config,
                            rules: config.rules.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r),
                          })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
                      <RoleBox label="Monitor" name={trigger?.name} color={roleColor(trigger?.color)} />
                      <ArrowRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <RoleBox label="Assign" name={assigned?.name} color={roleColor(assigned?.color)} />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm" disabled={isSaving} onClick={() => setEditing(rule)}
                        style={{ border: '1px solid var(--border-light)', color: 'var(--text-primary)', background: 'transparent' }}>
                        <Pencil size={13} style={{ verticalAlign: '-0.125em' }} /> Edit
                      </button>
                      <button className="btn btn-sm" disabled={isSaving} onClick={() => setDeleting(rule)}
                        style={{ border: '1px solid var(--error-color, #FF4444)', color: 'var(--error-color, #FF4444)', background: 'transparent' }}>
                        <Trash2 size={13} style={{ verticalAlign: '-0.125em' }} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {editing && (
        <RuleEditorModal
          rule={editing === 'new' ? null : editing}
          roles={roles}
          busy={isSaving}
          onCancel={() => setEditing(null)}
          onSave={saveRule}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete rule"
          message={`Are you sure you want to delete "${deleting.name}"?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const rule = deleting;
            setDeleting(null);
            void persist({ ...config, rules: config.rules.filter((r) => r.id !== rule.id) });
          }}
        />
      )}
    </div>
  );
};

const RoleBox: React.FC<{ label: string; name?: string; color: string }> = ({ label, name, color }) => (
  <div style={{
    flex: 1, minWidth: 0, background: 'var(--bg-tertiary)', borderRadius: 8, padding: '8px 10px',
  }}>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {name ?? 'Unknown Role'}
    </div>
  </div>
);

const RuleEditorModal: React.FC<{
  rule: ActivityRule | null;
  roles: Array<{ id: string; name: string; color: number }>;
  busy: boolean;
  onCancel: () => void;
  onSave: (rule: ActivityRule) => void;
}> = ({ rule, roles, busy, onCancel, onSave }) => {
  const [name, setName] = useState(rule?.name ?? '');
  const [activityType, setActivityType] = useState(rule?.activity_type ?? '');
  const [triggerRoleId, setTriggerRoleId] = useState(rule?.trigger_role_id ?? '');
  const [assignedRoleId, setAssignedRoleId] = useState(rule?.assigned_role_id ?? '');

  const typeDef = ACTIVITY_TYPES.find((t) => t.value === activityType);

  const submit = () => {
    if (!name.trim() || !activityType || !triggerRoleId || !assignedRoleId) {
      showToast('All fields are required', 'error');
      return;
    }
    if (triggerRoleId === assignedRoleId) {
      showToast('Trigger and assigned roles cannot be the same', 'error');
      return;
    }
    onSave({
      id: rule?.id ?? crypto.randomUUID(),
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      activity_type: activityType,
      trigger_role_id: triggerRoleId,
      assigned_role_id: assignedRoleId,
    });
  };

  return (
    <ModalShell onClose={onCancel}>
      <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
        {rule ? 'Edit Activity Rule' : 'Add Activity Rule'}
      </h3>

      <div className="mb-3">
        <label className="form-label mb-2 d-block">Rule Name *</label>
        <input
          className="form-control" type="text" maxLength={100}
          placeholder="e.g., Streamers Live"
          value={name} onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label className="form-label mb-2 d-block">Activity Type *</label>
        <select className="form-control" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
          <option value="">Select activity type...</option>
          {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {typeDef && <p className="text-muted small mt-2 mb-0">{typeDef.description}</p>}
      </div>

      <div className="mb-3">
        <label className="form-label mb-2 d-block">Trigger Role *</label>
        <select className="form-control" value={triggerRoleId} onChange={(e) => setTriggerRoleId(e.target.value)}>
          <option value="">Select role to monitor...</option>
          {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
        </select>
        <p className="text-muted small mt-2 mb-0">Monitor members with this role for the selected activity</p>
      </div>

      <div className="mb-3">
        <label className="form-label mb-2 d-block">Assigned Role *</label>
        <select className="form-control" value={assignedRoleId} onChange={(e) => setAssignedRoleId(e.target.value)}>
          <option value="">Select role to assign...</option>
          {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
        </select>
        <p className="text-muted small mt-2 mb-0">Automatically assign this role when the activity is detected</p>
      </div>

      <div style={{
        background: 'rgba(0,217,255,0.06)', border: '1px solid var(--border-cyan)',
        borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16,
      }}>
        <strong>Pro Tip:</strong> To show active users above others in the member list, enable
        "Display role members separately from online members" in Discord's role settings for the assigned role.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn primary" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Save Rule'}
        </button>
      </div>
    </ModalShell>
  );
};

const ConfirmModal: React.FC<{
  title: string; message: string; onCancel: () => void; onConfirm: () => void;
}> = ({ title, message, onCancel, onConfirm }) => (
  <ModalShell onClose={onCancel}>
    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
    <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14 }}>{message}</p>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
      <button className="btn" onClick={onCancel}>Cancel</button>
      <button className="btn" onClick={onConfirm}
        style={{ border: '1px solid var(--error-color, #FF4444)', color: 'var(--error-color, #FF4444)', background: 'transparent' }}>
        Delete
      </button>
    </div>
  </ModalShell>
);

const ModalShell: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', borderRadius: 16,
        padding: 24, maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      {children}
    </div>
  </div>
);
