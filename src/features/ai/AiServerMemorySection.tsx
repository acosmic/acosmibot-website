import React from 'react';
import { Trash2 } from 'lucide-react';
import { CollapsibleSection, LoadingSpinner } from '@/components/ui';
import { showToast } from '@/utils/toast';
import { useAiMemoryMutations, useAiServerMemory } from './useAiMemories';

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

export const AiServerMemorySection: React.FC<{ guildId: string; enabled: boolean }> = ({
  guildId,
  enabled,
}) => {
  const { data: doc, isLoading } = useAiServerMemory(guildId);
  const { clearServerDoc } = useAiMemoryMutations(guildId);

  const handleClear = () => {
    if (!window.confirm('Clear the server-wide AI memory log?')) return;
    clearServerDoc.mutate(undefined, {
      onSuccess: () => {
        showToast('Cleared server memories', 'success');
      },
      onError: (e) => showToast(errMsg(e, 'Failed to clear server memories'), 'error'),
    });
  };

  return (
    <CollapsibleSection title="Server Memories" defaultOpen={false}>
      <p className="text-muted small mb-4">
        Review the shared log the AI learned from conversations, or clear it. Server memories cannot be added or edited manually.
        {!enabled && ' Memory is currently disabled — this log is kept but not injected into replies.'}
      </p>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div>
          <pre
            style={{
              margin: 0,
              minHeight: 120,
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
            {doc?.content || 'No stored server memories.'}
          </pre>
          <div className="d-flex justify-content-end mt-2">
            <button
              className="btn"
              type="button"
              onClick={handleClear}
              disabled={clearServerDoc.isPending || !doc?.content}
              title="Clear server memories"
            >
              <Trash2 size={15} />
              {clearServerDoc.isPending ? 'Clearing...' : 'Clear server memories'}
            </button>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
};
