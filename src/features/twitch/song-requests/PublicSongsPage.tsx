/**
 * Public song queue, `/t/:login/songs` (§11.1, §12.7). Reads `GET /public/:login/songs` (no session).
 * Only titles and requester names are shown, as plain text.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { publicKey } from '../shared/queryKeys';
import { twitchRetry } from '../shared/api';
import { EmptyState } from '../shared/ui';
import { publicSongsApi } from './api';
import { formatSongDuration } from './model';
import './song-requests.css';

const REFRESH_MS = 15_000;

export const PublicSongsPage: React.FC<{ login: string }> = ({ login }) => {
  const query = useQuery({
    queryKey: publicKey(login, 'songs'),
    queryFn: () => publicSongsApi.queue(login),
    retry: twitchRetry,
    refetchInterval: REFRESH_MS,
    placeholderData: (previous) => previous,
  });

  if (query.isError && !query.data) {
    return (
      <LoadFailed
        title="The song queue didn't load"
        message={`${query.error instanceof Error ? query.error.message : 'Something went wrong.'} Try again in a moment.`}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.isPending) return <LoadingSpinner />;

  const { current, items } = query.data;
  return (
    <section aria-labelledby="tw-public-songs-title" className="tw-st-stack">
      <h2 id="tw-public-songs-title" className="tw-section-title">Song requests</h2>
      <div className="tw-sr-card" aria-live="polite">
        <h3 className="tw-st-card__title">Now playing</h3>
        {current ? (
          <>
            <p className="tw-sr-now__title">{current.title}</p>
            <p className="tw-muted">{current.channel_title} · requested by {current.requested_by_display_name}</p>
          </>
        ) : (
          <p className="tw-muted">Nothing is playing right now.</p>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState title="The queue is empty" description="Songs that viewers request in chat show up here." />
      ) : (
        <div className="tw-sr-card">
          <h3 className="tw-st-card__title">Up next</h3>
          <ol className="tw-sr-public-list">
            {items.map((song) => (
              <li key={song.position}>
                <span className="tw-sr-public-list__n">{song.position}</span>
                <span className="tw-sr-public-list__body">
                  <strong>{song.title}</strong>
                  <small>requested by {song.requested_by_display_name} · {formatSongDuration(song.duration_s)}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="tw-muted">The list refreshes by itself every few seconds.</p>
    </section>
  );
};
