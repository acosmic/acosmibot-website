import React from 'react';
import { useParams } from 'react-router-dom';
import { useBannedUsersConfig } from './useBannedUsersConfig';
import { MemberSearchInput } from '@/components/ui/MemberSearchInput';
import { FeatureToggle, SaveBar, LoadingSpinner, CollapsibleSection } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { BannedUsersConfig, BannedUserEntry, MemberSearchResult } from '@/api/bannedUsers';

export const BannedUsersPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();
  const { data, isLoading, save, isSaving, saveError } = useBannedUsersConfig(guildId!);
  const { form, setForm, isDirty, resetForm } = useDirtyState<BannedUsersConfig>(data);

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <div>No data found.</div>;

  const handleSelectMember = (member: MemberSearchResult) => {
    if (form.users.some((u) => u.user_id === member.user_id)) return;
    const entry: BannedUserEntry = {
      user_id: member.user_id,
      username: member.nickname || member.username,
      avatar_url: member.avatar_url,
      banned_at: '',
      banned_by: '',
    };
    setForm({ users: [...form.users, entry] });
  };

  const handleUnban = (userId: string) => {
    setForm({ users: form.users.filter((u) => u.user_id !== userId) });
  };

  const displayName = (entry: BannedUserEntry) => entry.username || entry.user_id;

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Banned Users</h1>
        <p>Prevent specific members from using any acosmibot feature in this server.</p>
      </div>

      <FeatureToggle
        enabled={form.enabled}
        onChange={(v) => setForm({ enabled: v })}
        description="When disabled, the ban list is preserved but not enforced."
      />

      <CollapsibleSection title="Response Mode" defaultOpen={true}>
        <div className="mb-3">
          <label className="form-label mb-2 d-block">What should the bot do when a banned user tries something?</label>
          <select
            className="form-control"
            value={form.response_mode}
            onChange={(e) => setForm({ response_mode: e.target.value as BannedUsersConfig['response_mode'] })}
          >
            <option value="ignore">Silently Ignore — do nothing, post nothing</option>
            <option value="dm">Send DM — privately message the user</option>
            <option value="channel">Respond in Channel — post a message where they triggered the bot</option>
          </select>
        </div>

        {form.response_mode === 'dm' && (
          <div className="mb-3">
            <label className="form-label mb-2 d-block">DM Message</label>
            <div className="small text-muted mb-2">
              Available placeholders: <code>{'{guild_name}'}</code>
            </div>
            <textarea
              className="form-control"
              rows={3}
              maxLength={1000}
              value={form.dm_message}
              onChange={(e) => setForm({ dm_message: e.target.value })}
            />
            <div className="small text-muted mt-1">{form.dm_message.length} / 1000</div>
          </div>
        )}

        {form.response_mode === 'channel' && (
          <div className="mb-3">
            <label className="form-label mb-2 d-block">Channel Message</label>
            <div className="small text-muted mb-2">
              Available placeholders: <code>{'{user_mention}'}</code>
            </div>
            <textarea
              className="form-control"
              rows={3}
              maxLength={1000}
              value={form.channel_message}
              onChange={(e) => setForm({ channel_message: e.target.value })}
            />
            <div className="small text-muted mt-1">{form.channel_message.length} / 1000</div>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Add User" defaultOpen={true}>
        <div className="small text-muted mb-3">
          Search for a server member by username or nickname.
          Server admins cannot be banned.
        </div>
        <MemberSearchInput
          guildId={guildId!}
          onSelect={handleSelectMember}
          excludeUserIds={form.users.map((u) => u.user_id)}
          placeholder="Search by username…"
        />
      </CollapsibleSection>

      <CollapsibleSection title="Banned Users" defaultOpen={true}>
        {form.users.length === 0 ? (
          <p className="text-muted small">No users are currently banned.</p>
        ) : (
          <div>
            {form.users.map((entry) => (
              <div
                key={entry.user_id}
                className="d-flex align-items-center gap-3 p-2 rounded mb-2"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}
                  >
                    {displayName(entry).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-grow-1">
                  <div className="fw-bold small">{displayName(entry)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{entry.user_id}</div>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={() => handleUnban(entry.user_id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--error-color)',
                    color: 'var(--error-color)',
                    padding: '2px 10px',
                  }}
                >
                  Unban
                </button>
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
        saveError={saveError}
      />
    </div>
  );
};
