/**
 * Public viewer queue page, `/t/:login/queue` (§11.1, §12.6). Reads `GET /public/:login/queue` (no session).
 * Names and notes are viewer-written text and are rendered as plain text only.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { publicKey } from '../shared/queryKeys';
import { twitchRetry } from '../shared/api';
import { EmptyState, StatusChip } from '../shared/ui';
import { publicQueueApi } from './api';
import './engagement.css';

export const PublicQueuePage: React.FC<{ login: string }> = ({ login }) => {
  const query = useQuery({
    queryKey: publicKey(login, 'queue'),
    queryFn: () => publicQueueApi.get(login),
    retry: twitchRetry,
    refetchInterval: 15_000,
  });

  if (query.isError) {
    return (
      <LoadFailed
        title="The queue didn't load"
        message={`${query.error instanceof Error ? query.error.message : 'Something went wrong.'} Try again in a moment.`}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingSpinner />;

  const { open, items } = query.data;
  return (
    <section aria-labelledby="tw-public-queue-title" className="tw-en-stack">
      <h2 id="tw-public-queue-title" className="tw-section-title">
        Viewer queue <StatusChip tone={open ? 'active' : 'neutral'}>{open ? 'Open' : 'Closed'}</StatusChip>
      </h2>
      {items.length === 0 ? (
        <EmptyState
          title="Nobody is waiting"
          description={open ? 'Type !queue join in chat to get in line.' : 'The queue is closed right now.'}
        />
      ) : (
        <ol className="tw-en-public-list" aria-live="polite">
          {items.map((item) => (
            <li key={item.position}>
              <span className="tw-en-public-list__place">{item.position}</span>
              <span>
                <span className="tw-en-name">{item.display_name}</span>
                {item.note && <span className="tw-en-note">{item.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
