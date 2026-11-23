/** The fallback playlist (§12.7): songs the player uses when the queue is empty. Editors only. */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import {
  EmptyState, Field, RecordTable, RoleGate, ReadOnlyNotice, isTwitchApiError, tk, twitchErrorMessage, twitchRetry,
  useChannelMutation, type Column,
} from '../shared/ui';
import type { Role } from '../types';
import { songsApi } from './api';
import { SONG_LIMITS, formatSongDuration, reorderIds, songInputProblem, type FallbackItem } from './model';
import './song-requests.css';

const Body: React.FC<{ channelId: string; fallbackOn: boolean }> = ({ channelId, fallbackOn }) => {
  const key = tk(channelId, 'songs', 'fallback');
  const list = useQuery({ queryKey: key, queryFn: () => songsApi.fallback(channelId), retry: twitchRetry });
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const add = useChannelMutation({
    mutationFn: (value: string) => songsApi.addFallback(channelId, value),
    invalidate: [key],
    successMessage: (data) => `Added "${data.item.title}"`,
    errorMessage: false,
    onSuccess: () => { setInput(''); setProblem(null); },
  });
  const order = useChannelMutation({
    mutationFn: (ids: number[]) => songsApi.orderFallback(channelId, ids),
    invalidate: [key],
    errorMessage: 'Could not change the order.',
  });
  const remove = useChannelMutation({
    mutationFn: (id: number) => songsApi.removeFallback(channelId, id),
    invalidate: [key],
    successMessage: 'Removed from the fallback playlist',
    errorMessage: 'Could not remove the song.',
  });

  if (list.isError) {
    return <LoadFailed title="The fallback playlist didn't load" message={twitchErrorMessage(list.error)} onRetry={() => list.refetch()} />;
  }
  if (list.isPending) return <LoadingSpinner />;

  const items = list.data.items;
  const ids = items.map((item) => item.id);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = songInputProblem(input);
    setProblem(found);
    if (!found) add.mutate(input.trim());
  };
  const serverError = add.error
    ? (isTwitchApiError(add.error, 'name_taken') ? 'That video is already in the fallback playlist.' : twitchErrorMessage(add.error))
    : null;

  const columns: Column<FallbackItem>[] = [
    { key: 'n', header: '#', width: '56px', render: (row) => ids.indexOf(row.id) + 1 },
    { key: 'title', header: 'Song', primary: true, render: (row) => <span className="tw-st-text" title={row.title}>{row.title}</span> },
    { key: 'channel', header: 'Channel', hideOnMobile: true, render: (row) => row.channel_title },
    { key: 'len', header: 'Length', width: '84px', align: 'end', render: (row) => formatSongDuration(row.duration_s) },
  ];

  return (
    <section className="tw-sr-card" aria-labelledby="tw-sr-fallback-title">
      <h2 id="tw-sr-fallback-title" className="tw-st-card__title">Fallback playlist</h2>
      <p className="tw-st-card__lead">
        Plays when the queue is empty, so the stream is never silent. {items.length} of {list.data.limit} songs.
        {!fallbackOn && ' The fallback playlist is turned off in Settings.'}
      </p>
      <form className="tw-st-inline" onSubmit={submit} noValidate>
        <Field label="Add a song" help="A YouTube link or an 11 character video id." error={problem ?? serverError ?? undefined}>
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={SONG_LIMITS.inputMax} value={input}
              autoComplete="off" onChange={(event) => setInput(event.target.value)} />
          )}
        </Field>
        <button type="submit" className="btn primary" disabled={add.isPending}><Plus size={16} aria-hidden="true" /> {add.isPending ? 'Adding…' : 'Add to playlist'}</button>
      </form>
      <RecordTable
        rows={items} columns={columns} rowKey={(row) => row.id} caption="Fallback playlist"
        rowActions={(row) => {
          const index = ids.indexOf(row.id);
          return (
            <span className="tw-st-row-actions">
              <button type="button" className="btn" aria-label={`Move ${row.title} up`} disabled={index <= 0 || order.isPending}
                onClick={() => order.mutate(reorderIds(ids, index, -1))}><ArrowUp size={16} aria-hidden="true" /></button>
              <button type="button" className="btn" aria-label={`Move ${row.title} down`} disabled={index >= ids.length - 1 || order.isPending}
                onClick={() => order.mutate(reorderIds(ids, index, 1))}><ArrowDown size={16} aria-hidden="true" /></button>
              <button type="button" className="btn" aria-label={`Remove ${row.title}`} disabled={remove.isPending}
                onClick={() => remove.mutate(row.id)}><Trash2 size={16} aria-hidden="true" /></button>
            </span>
          );
        }}
        empty={<EmptyState title="No fallback songs" description="Add a few songs so the player has something to play between requests." />}
      />
    </section>
  );
};

export const FallbackPanel: React.FC<{ channelId: string; role: Role; fallbackOn: boolean }> = ({ channelId, role, fallbackOn }) => (
  <RoleGate
    min="editor" role={role}
    fallback={<ReadOnlyNotice required="editor" role={role} what="the fallback playlist" />}
  >
    <Body channelId={channelId} fallbackOn={fallbackOn} />
  </RoleGate>
);
