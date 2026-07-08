import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CollapsibleSection, LoadingSpinner } from '@/components/ui';
import { showToast } from '@/utils/toast';
import { useAiMemoryMutations, useAiServerMemory } from './useAiMemories';

const SERVER_DOC_MAX = 4000;

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

export const AiServerMemorySection: React.FC<{ guildId: string; enabled: boolean }> = ({
  guildId,
  enabled,
}) => {
  const { data: doc, isLoading, refetch } = useAiServerMemory(guildId);
  const { saveServerDoc, clearServerDoc } = useAiMemoryMutations(guildId);
  const [draft, setDraft] = useState('');
  const dirty = draft !== (doc?.content ?? '');

  useEffect(() => {
    if (doc) setDraft(doc.content);
  }, [doc]);

  const handleSave = () => {
    saveServerDoc.mutate(
      { content: draft, expectedVersion: doc?.version ?? 0 },
      {
        onSuccess: () => showToast('Saved server memories', 'success'),
        onError: (e) => {
          showToast(errMsg(e, 'Failed to save server memories'), 'error');
          refetch();
        },
      },
    );
  };

  const handleClear = () => {
    if (!window.confirm('Clear the server-wide AI memory log?')) return;
    clearServerDoc.mutate(undefined, {
      onSuccess: () => {
        setDraft('');
        showToast('Cleared server memories', 'success');
      },
      onError: (e) => showToast(errMsg(e, 'Failed to clear server memories'), 'error'),
    });
  };

  return (
    <CollapsibleSection title="Server Memories" defaultOpen={false}>
      <p className="text-muted small mb-4">
        A shared markdown log of memorable moments the AI records from conversations it's part of.
        {!enabled && ' Memory is currently disabled — this log is kept but not injected into replies.'}
      </p>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <textarea
            className="form-control"
            value={draft}
            maxLength={SERVER_DOC_MAX}
            rows={12}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          />
          <div className="d-flex align-items-center justify-content-between mt-2 gap-2 flex-wrap">
            <span className="text-muted small">{draft.length} / {SERVER_DOC_MAX}</span>
            <div className="d-flex gap-2">
              <button
                className="btn"
                type="button"
                onClick={handleClear}
                disabled={clearServerDoc.isPending}
                title="Clear server memories"
              >
                <Trash2 size={15} />
              </button>
              <button
                className="btn"
                type="button"
                disabled={!dirty || saveServerDoc.isPending}
                onClick={() => setDraft(doc?.content ?? '')}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!dirty || saveServerDoc.isPending}
                onClick={handleSave}
              >
                {saveServerDoc.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
};
