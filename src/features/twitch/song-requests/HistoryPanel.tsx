/** Recently finished songs (§12.7): played, skipped and removed requests, newest first. */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import { EmptyState, RecordTable, formatDateTime, tk, twitchErrorMessage, twitchRetry, type Column } from '../shared/ui';
import { songsApi } from './api';
import { describeStatus, formatSongDuration, requesterLabel, type SongRequest } from './model';
import './song-requests.css';

export const HistoryPanel: React.FC<{ channelId: string }> = ({ channelId }) => {
  const [cursors, setCursors] = useState<Array<number | null>>([null]);
  const before = cursors[cursors.length - 1];
  const history = useQuery({
    queryKey: tk(channelId, 'songs', 'history', before),
    queryFn: () => songsApi.history(channelId, before),
    retry: twitchRetry,
    placeholderData: (previous) => previous,
  });

  if (history.isError) {
    return <LoadFailed title="History didn't load" message={twitchErrorMessage(history.error)} onRetry={() => history.refetch()} />;
  }
  if (history.isPending) return <LoadingSpinner />;

  const columns: Column<SongRequest>[] = [
    { key: 'title', header: 'Song', primary: true, render: (row) => <span className="tw-st-text" title={row.title}>{row.title}</span> },
    { key: 'by', header: 'Requested by', hideOnMobile: true, render: (row) => requesterLabel(row) },
    { key: 'status', header: 'Result', render: (row) => describeStatus(row.status) },
    { key: 'len', header: 'Length', hideOnMobile: true, align: 'end', render: (row) => formatSongDuration(row.duration_s) },
    { key: 'when', header: 'Requested', hideOnMobile: true, render: (row) => (row.created_at ? formatDateTime(row.created_at) : '') },
  ];

  return (
    <section className="tw-sr-card" aria-labelledby="tw-sr-history-title">
      <h2 id="tw-sr-history-title" className="tw-st-card__title">History</h2>
      <p className="tw-st-card__lead">Finished requests are kept for 30 days.</p>
      <RecordTable
        rows={history.data.items} columns={columns} rowKey={(row) => row.id} caption="Song history"
        empty={<EmptyState title="No finished songs yet" description="Songs appear here after they have played, been skipped or been removed." />}
        footer={(cursors.length > 1 || history.data.next_before_id) ? (
          <div className="tw-st-pager">
            <button type="button" className="btn" disabled={cursors.length <= 1} onClick={() => setCursors(cursors.slice(0, -1))}>Newer</button>
            <button type="button" className="btn" disabled={!history.data.next_before_id}
              onClick={() => history.data.next_before_id && setCursors([...cursors, history.data.next_before_id])}>Older</button>
          </div>
        ) : undefined}
      />
    </section>
  );
};
