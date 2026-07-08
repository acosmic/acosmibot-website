import React, { useEffect, useState } from 'react';
import { Brain, Trash2, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { CollapsibleSection, LoadingSpinner, MemberSearchInput } from '@/components/ui';
import { MemberSearchResult } from '@/api/bannedUsers';
import { AiMemoryUser } from '@/api/aiMemories';
import { showToast } from '@/utils/toast';
import {
  useAiMemoryUsers,
  useAiMemoryDoc,
  useAiMemoryMutations,
} from './useAiMemories';

const FACT_MAX = 300;
const USER_DOC_MAX = 2000;

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
  const { data: doc, isLoading, refetch } = useAiMemoryDoc(guildId, open ? user.user_id : null);
  const { saveDoc, clearUser } = useAiMemoryMutations(guildId);
  const [draft, setDraft] = useState('');

  const name = displayName(user);
  const dirty = draft !== (doc?.content ?? '');

  useEffect(() => {
    if (doc) setDraft(doc.content);
  }, [doc]);

  const handleSave = () => {
    saveDoc.mutate(
      { userId: user.user_id, content: draft, expectedVersion: doc?.version ?? 0 },
      {
        onSuccess: () => showToast(`Saved memories for ${name}`, 'success'),
        onError: (e) => {
          showToast(errMsg(e, 'Failed to save memories'), 'error');
          refetch();
        },
      },
    );
  };

  const handleClearUser = () => {
    if (!window.confirm(`Forget everything the AI remembers about ${name}?`)) return;
    clearUser.mutate(
      { userId: user.user_id },
      {
        onSuccess: () => {
          setDraft('');
          showToast(`Cleared memories for ${name}`, 'success');
        },
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
            <p className="text-muted small mb-0">Loading...</p>
          ) : (
            <>
              <textarea
                className="form-control"
                value={draft}
                maxLength={USER_DOC_MAX}
                rows={10}
                onChange={(e) => setDraft(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                }}
              />
              <div className="d-flex align-items-center justify-content-between mt-2 gap-2 flex-wrap">
                <span className="text-muted small">{draft.length} / {USER_DOC_MAX}</span>
                <div className="d-flex gap-2">
                  <button
                    className="btn"
                    type="button"
                    disabled={!dirty || saveDoc.isPending}
                    onClick={() => setDraft(doc?.content ?? '')}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={!dirty || saveDoc.isPending}
                    onClick={handleSave}
                  >
                    {saveDoc.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </>
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
  const { appendFact } = useAiMemoryMutations(guildId);
  const [target, setTarget] = useState<MemberSearchResult | null>(null);
  const [content, setContent] = useState('');

  const handleAdd = () => {
    if (!target) return;
    const trimmed = content.trim();
    if (trimmed.length < 3) {
      showToast('Memory must be at least 3 characters', 'error');
      return;
    }
    appendFact.mutate(
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
        Review and edit the markdown memory document for each member in this server.
        {!enabled && ' Memory is currently disabled — existing docs are kept but won\'t be used until you turn it back on.'}
      </p>

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
              placeholder="Search for a member..."
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
              disabled={appendFact.isPending || content.trim().length < 3}
            >
              {appendFact.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
        )}
      </div>

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
