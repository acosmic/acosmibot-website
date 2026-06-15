import React, { useState } from 'react';
import { Brain, Trash2, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { CollapsibleSection, LoadingSpinner, MemberSearchInput } from '@/components/ui';
import { MemberSearchResult } from '@/api/bannedUsers';
import { AiMemoryUser } from '@/api/aiMemories';
import { showToast } from '@/utils/toast';
import {
  useAiMemoryUsers,
  useAiMemoryFacts,
  useAiMemoryMutations,
} from './useAiMemories';

const FACT_MAX = 300;

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

const displayName = (u: { global_name: string | null; discord_username: string | null; user_id: string }) =>
  u.global_name || u.discord_username || u.user_id;

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
  const { data: facts, isLoading } = useAiMemoryFacts(guildId, open ? user.user_id : null);
  const { deleteFact, clearUser } = useAiMemoryMutations(guildId);

  const name = displayName(user);

  const handleDeleteFact = (memoryId: number) => {
    deleteFact.mutate(
      { userId: user.user_id, memoryId },
      {
        onSuccess: () => showToast('Memory deleted', 'success'),
        onError: (e) => showToast(errMsg(e, 'Failed to delete memory'), 'error'),
      },
    );
  };

  const handleClearUser = () => {
    if (!window.confirm(`Forget everything the AI remembers about ${name}?`)) return;
    clearUser.mutate(
      { userId: user.user_id },
      {
        onSuccess: () => showToast(`Cleared memories for ${name}`, 'success'),
        onError: (e) => showToast(errMsg(e, 'Failed to clear memories'), 'error'),
      },
    );
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border-light)' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px',
          cursor: 'pointer',
        }}
      >
        <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <Avatar url={user.avatar_url} name={name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fw-bold" style={{ color: 'var(--text-primary)' }}>{name}</div>
          {user.discord_username && user.global_name && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user.discord_username}</div>
          )}
        </div>
        <span
          className="small"
          style={{
            color: 'var(--text-muted)', background: 'var(--bg-overlay)',
            borderRadius: 12, padding: '2px 10px', whiteSpace: 'nowrap',
          }}
        >
          {user.fact_count} {user.fact_count === 1 ? 'memory' : 'memories'}
        </span>
        <button
          className="btn"
          type="button"
          onClick={(e) => { e.stopPropagation(); handleClearUser(); }}
          disabled={clearUser.isPending}
          title="Clear all memories for this member"
          style={{ padding: '4px 8px' }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {open && (
        <div style={{ padding: '0 8px 14px 44px' }}>
          {isLoading ? (
            <p className="text-muted small mb-0">Loading…</p>
          ) : facts && facts.length > 0 ? (
            facts.map(fact => (
              <div
                key={fact.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0',
                  borderTop: '1px solid var(--border-light)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>{fact.content}</span>
                  {fact.source === 'manual' && (
                    <span
                      className="small"
                      style={{
                        marginLeft: 8, color: 'var(--primary-color)',
                        border: '1px solid var(--border-cyan)', borderRadius: 8, padding: '0 6px',
                        fontSize: '0.68rem',
                      }}
                    >
                      manual
                    </span>
                  )}
                </div>
                <button
                  className="btn"
                  type="button"
                  onClick={() => handleDeleteFact(fact.id)}
                  disabled={deleteFact.isPending}
                  title="Delete this memory"
                  style={{ padding: '2px 6px' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-muted small mb-0">No memories stored.</p>
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
  const { addFact } = useAiMemoryMutations(guildId);
  const [target, setTarget] = useState<MemberSearchResult | null>(null);
  const [content, setContent] = useState('');

  const handleAdd = () => {
    if (!target) return;
    const trimmed = content.trim();
    if (trimmed.length < 3) {
      showToast('Memory must be at least 3 characters', 'error');
      return;
    }
    addFact.mutate(
      { userId: target.user_id, content: trimmed },
      {
        onSuccess: () => {
          showToast(`Added a memory for ${target.nickname || target.username}`, 'success');
          setContent('');
          setTarget(null);
        },
        onError: (e) => showToast(errMsg(e, 'Failed to add memory'), 'error'),
      },
    );
  };

  return (
    <CollapsibleSection title="Member Memories" defaultOpen={false}>
      <p className="text-muted small mb-4">
        Review what the AI has remembered about each member in this server, remove anything it
        shouldn't keep, or add a fact for it to remember.
        {!enabled && ' Memory is currently disabled — existing facts are kept but won\'t be used until you turn it back on.'}
      </p>

      {/* Add a memory */}
      <div
        className="mb-4"
        style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: 16 }}
      >
        <label className="form-label mb-2 d-block d-flex align-items-center gap-2">
          <Plus size={15} /> Add a memory
        </label>
        {target ? (
          <div className="d-flex align-items-center gap-2 mb-2">
            <Avatar url={target.avatar_url} name={target.nickname || target.username} />
            <span className="fw-bold" style={{ color: 'var(--text-primary)' }}>
              {target.nickname || target.username}
            </span>
            <button
              className="btn"
              type="button"
              onClick={() => setTarget(null)}
              style={{ padding: '2px 6px' }}
              title="Choose a different member"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="mb-2" style={{ maxWidth: 420 }}>
            <MemberSearchInput
              guildId={guildId}
              onSelect={(m) => setTarget(m)}
              placeholder="Search for a member…"
            />
          </div>
        )}

        {target && (
          <div className="d-flex gap-2 align-items-start flex-wrap">
            <div style={{ flex: '1 1 320px' }}>
              <input
                className="form-control"
                value={content}
                maxLength={FACT_MAX}
                placeholder="e.g. Plays Valorant, lives in GMT+1, loves dad jokes"
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              />
              <p className="text-muted small mt-1 mb-0">{content.length} / {FACT_MAX}</p>
            </div>
            <button
              className="btn primary"
              type="button"
              onClick={handleAdd}
              disabled={addFact.isPending || content.trim().length < 3}
            >
              {addFact.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}
      </div>

      {/* User list */}
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
