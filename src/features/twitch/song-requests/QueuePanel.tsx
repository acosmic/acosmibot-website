/** The song queue (§12.7): add by link or id, reorder, remove, clear. Titles are rendered as text only. */
import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUp, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import {
  EmptyState, Field, RecordTable, isTwitchApiError, tk, twitchErrorMessage, useChannelMutation, type Column,
} from '../shared/ui';
import { songsApi } from './api';
import {
  SONG_LIMITS, addFailureMessage, describeQueueLength, formatSongDuration, moveTarget, requesterLabel,
  songInputProblem, sourceLabel, type MoveDirection, type QueueResponse, type SongRequest,
} from './model';
import './song-requests.css';

interface Props {
  channelId: string;
  queue: QueueResponse;
  enabled: boolean;
}

export const QueuePanel: React.FC<Props> = ({ channelId, queue, enabled }) => {
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const queueKey = tk(channelId, 'songs', 'queue');
  const items = queue.items;

  const add = useChannelMutation({
    mutationFn: (value: string) => songsApi.add(channelId, value),
    invalidate: [queueKey],
    successMessage: (data) => `Added "${data.request.title}"`,
    errorMessage: false,
    onSuccess: () => { setInput(''); setProblem(null); },
  });
  const move = useChannelMutation({
    mutationFn: (vars: { id: number; before: number | null }) => songsApi.move(channelId, vars.id, vars.before),
    invalidate: [queueKey],
    errorMessage: 'Could not move the song.',
  });
  const remove = useChannelMutation({
    mutationFn: (id: number) => songsApi.remove(channelId, id),
    invalidate: [queueKey],
    successMessage: 'Song removed',
    errorMessage: 'Could not remove the song.',
  });
  const clear = useChannelMutation({
    mutationFn: () => songsApi.clear(channelId),
    invalidate: [queueKey],
    successMessage: (data) => `Removed ${data.removed} ${data.removed === 1 ? 'song' : 'songs'}`,
    errorMessage: 'Could not clear the queue.',
    onSuccess: () => setConfirmClear(false),
    onError: () => setConfirmClear(false),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = songInputProblem(input);
    setProblem(found);
    if (!found) add.mutate(input.trim());
  };

  const act = (id: number, direction: MoveDirection) => {
    const target = moveTarget(items, id, direction);
    if (target) move.mutate({ id, before: target.before_id });
  };

  const serverError = add.error
    ? addFailureMessage(isTwitchApiError(add.error) ? add.error.code : undefined, twitchErrorMessage(add.error))
    : null;
  const addError = problem ?? (serverError ? twitchErrorMessage(add.error) || serverError : null);

  const columns: Column<SongRequest>[] = [
    { key: 'n', header: '#', width: '56px', render: (row) => items.findIndex((item) => item.id === row.id) + 1 },
    { key: 'title', header: 'Song', primary: true, render: (row) => <span className="tw-st-text" title={row.title}>{row.title}</span> },
    { key: 'by', header: 'Requested by', hideOnMobile: true, render: (row) => requesterLabel(row) },
    { key: 'src', header: 'From', hideOnMobile: true, render: (row) => sourceLabel(row.source) },
    { key: 'len', header: 'Length', width: '84px', align: 'end', render: (row) => formatSongDuration(row.duration_s) },
  ];

  return (
    <section className="tw-sr-card" aria-labelledby="tw-sr-queue-title">
      <div className="tw-sr-card__head">
        <h2 id="tw-sr-queue-title" className="tw-st-card__title">
          Queue <span className="tw-muted">{items.length === 0 ? 'empty' : `${items.length} queued · ${describeQueueLength(items)}`}</span>
        </h2>
        <button type="button" className="btn" disabled={items.length === 0 || clear.isPending} onClick={() => setConfirmClear(true)}>
          <Trash2 size={16} aria-hidden="true" /> Clear queue
        </button>
      </div>
      {!enabled && (
        <p className="tw-sr-warning" role="status">Song requests are turned off in Settings. Viewers cannot request songs and the dashboard cannot add them.</p>
      )}
      <form className="tw-st-inline" onSubmit={submit} noValidate>
        <Field label="Add a song" help="A YouTube link or an 11 character video id." error={addError ?? undefined}>
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={SONG_LIMITS.inputMax} value={input}
              placeholder="https://www.youtube.com/watch?v=…" autoComplete="off" onChange={(event) => setInput(event.target.value)} />
          )}
        </Field>
        <button type="submit" className="btn primary" disabled={add.isPending || !enabled}>
          <Plus size={16} aria-hidden="true" /> {add.isPending ? 'Adding…' : 'Add song'}
        </button>
      </form>
      <RecordTable
        rows={items} columns={columns} rowKey={(row) => row.id} caption="Queued songs"
        rowActions={(row) => (
          <span className="tw-st-row-actions">
            <button type="button" className="btn" aria-label={`Play ${row.title} next`} title="Play next" onClick={() => act(row.id, 'top')}
              disabled={moveTarget(items, row.id, 'top') === undefined || move.isPending}><ChevronsUp size={16} aria-hidden="true" /></button>
            <button type="button" className="btn" aria-label={`Move ${row.title} up`} title="Move up" onClick={() => act(row.id, 'up')}
              disabled={moveTarget(items, row.id, 'up') === undefined || move.isPending}><ArrowUp size={16} aria-hidden="true" /></button>
            <button type="button" className="btn" aria-label={`Move ${row.title} down`} title="Move down" onClick={() => act(row.id, 'down')}
              disabled={moveTarget(items, row.id, 'down') === undefined || move.isPending}><ArrowDown size={16} aria-hidden="true" /></button>
            <button type="button" className="btn" aria-label={`Remove ${row.title}`} title="Remove" onClick={() => remove.mutate(row.id)}
              disabled={remove.isPending}><Trash2 size={16} aria-hidden="true" /></button>
          </span>
        )}
        empty={<EmptyState title="The queue is empty" description="Songs viewers request with !sr appear here. You can also add one above." />}
      />
      {confirmClear && (
        <ConfirmDialog
          kicker="Clear queue" title="Remove every queued song?" confirmLabel="Clear queue" pending={clear.isPending}
          onConfirm={() => clear.mutate()} onClose={() => setConfirmClear(false)}
        >
          <p>The song that is playing now keeps playing. Viewers are not refunded for removed requests.</p>
        </ConfirmDialog>
      )}
    </section>
  );
};
