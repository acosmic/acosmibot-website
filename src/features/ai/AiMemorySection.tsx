import React, { useState } from 'react';
import { Brain, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { CollapsibleSection, LoadingSpinner } from '@/components/ui';
import { AiMemoryUser } from '@/api/aiMemories';
import { showToast } from '@/utils/toast';
import {
  useAiMemoryUsers,
  useAiMemoryDoc,
  useAiMemoryMutations,
} from './useAiMemories';

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

const displayName = (u: { global_name: string | null; discord_username: string | null; user_id: string }) =>
  u.global_name || u.discord_username || u.user_id;

const formatUpdated = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : 'not saved';

const Avatar: React.FC<{ url: string | null; name: string }> = ({ url, name }) =>
  url ? (
    <img src={url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
  ) : (
    <div
      style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 13, fontWeight: 'bold',
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );

interface UserRowProps {
  guildId: string;
  user: AiMemoryUser;
}

const UserRow: React.FC<UserRowProps> = ({ guildId, user }) => {
  const [open, setOpen] = useState(false);
  const { data: doc, isLoading } = useAiMemoryDoc(guildId, open ? user.user_id : null);
  const { clearUser } = useAiMemoryMutations(guildId);

  const name = displayName(user);
  const panelId = `ai-memory-${user.user_id}`;

  const handleClearUser = () => {
    if (!window.confirm(`Forget everything the AI remembers about ${name}?`)) return;
    clearUser.mutate(
      { userId: user.user_id },
      {
        onSuccess: () => {
          showToast(`Cleared memories for ${name}`, 'success');
        },
        onError: (e) => showToast(errMsg(e, 'Failed to clear memories'), 'error'),
      },
    );
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border-light)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px',
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(o => !o)}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <Avatar url={user.avatar_url} name={name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fw-bold" style={{ color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {user.discord_username && user.global_name ? `${user.discord_username} · ` : ''}
              Updated {formatUpdated(user.updated_at)}
            </div>
          </div>
          <span
            className="small"
            style={{
              color: 'var(--text-muted)', background: 'var(--bg-overlay)',
              borderRadius: 12, padding: '2px 10px', whiteSpace: 'nowrap',
            }}
          >
            {user.doc_length} chars
          </span>
        </button>
        <button
          className="btn"
          type="button"
          onClick={handleClearUser}
          disabled={clearUser.isPending}
          aria-label={`Clear all memories for ${name}`}
          title="Clear all memories for this member"
          style={{ padding: '4px 8px' }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {open && (
        <div id={panelId} style={{ padding: '0 8px 14px 44px' }}>
          {isLoading ? (
            <p className="text-muted small mb-0">Loading...</p>
          ) : (
            <pre
              style={{
                margin: 0,
                padding: 14,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                lineHeight: 1.6,
              }}
            >
              {doc?.content || 'No stored memories.'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

interface AiMemorySectionProps {
  guildId: string;
  enabled: boolean;
}

export const AiMemorySection: React.FC<AiMemorySectionProps> = ({ guildId, enabled }) => {
  const { data: users, isLoading } = useAiMemoryUsers(guildId);

  return (
    <CollapsibleSection title="Member Memories" defaultOpen={false}>
      <p className="text-muted small mb-4">
        Review memories the AI learned from conversation, or clear them. Memories cannot be added or edited manually.
        {!enabled && ' Memory is currently disabled — existing docs are kept but won\'t be used until you turn it back on.'}
      </p>

      {isLoading ? (
        <LoadingSpinner />
      ) : users && users.length > 0 ? (
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden' }}>
          {users.map(u => (
            <UserRow key={u.user_id} guildId={guildId} user={u} />
          ))}
        </div>
      ) : (
        <div className="text-center text-muted py-4">
          <Brain size={32} style={{ opacity: 0.5 }} />
          <p className="small mt-2 mb-0">No members have any stored memories yet.</p>
        </div>
      )}
    </CollapsibleSection>
  );
};
