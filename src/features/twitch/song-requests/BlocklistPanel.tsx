/** Blocked videos, YouTube channels and title words (§12.7). Moderators can edit; the bot applies changes at once. */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { LoadFailed, LoadingSpinner } from '@/components/ui';
import {
  EmptyState, Field, RecordTable, formatDateTime, isTwitchApiError, tk, twitchErrorMessage, twitchRetry,
  useChannelMutation, type Column,
} from '../shared/ui';
import { songsApi } from './api';
import { SONG_LIMITS, blockKindLabel, blockProblem, type BlockKind, type SongBlock } from './model';
import './song-requests.css';

export const BlocklistPanel: React.FC<{ channelId: string }> = ({ channelId }) => {
  const key = tk(channelId, 'songs', 'blocklist');
  const list = useQuery({ queryKey: key, queryFn: () => songsApi.blocklist(channelId), retry: twitchRetry });
  const [kind, setKind] = useState<BlockKind>('term');
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const add = useChannelMutation({
    mutationFn: (vars: { kind: BlockKind; value: string }) => songsApi.addBlock(channelId, vars.kind, vars.value),
    invalidate: [key],
    successMessage: 'Added to the blocklist',
    errorMessage: false,
    onSuccess: () => { setValue(''); setProblem(null); },
  });
  const remove = useChannelMutation({
    mutationFn: (id: number) => songsApi.removeBlock(channelId, id),
    invalidate: [key],
    successMessage: 'Removed from the blocklist',
    errorMessage: 'Could not remove the entry.',
  });

  if (list.isError) {
    return <LoadFailed title="The blocklist didn't load" message={twitchErrorMessage(list.error)} onRetry={() => list.refetch()} />;
  }
  if (list.isPending) return <LoadingSpinner />;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = blockProblem(kind, value);
    setProblem(found);
    if (!found) add.mutate({ kind, value: value.trim() });
  };
  const serverError = add.error
    ? (isTwitchApiError(add.error, 'limit_reached') ? 'The blocklist is full.' : twitchErrorMessage(add.error))
    : null;

  const columns: Column<SongBlock>[] = [
    { key: 'kind', header: 'Type', width: '120px', render: (row) => blockKindLabel(row.kind) },
    { key: 'value', header: 'Blocked', primary: true, render: (row) => <span className="tw-st-text" title={row.value}>{row.value}</span> },
    { key: 'when', header: 'Added', hideOnMobile: true, render: (row) => (row.created_at ? formatDateTime(row.created_at) : '') },
  ];
  const help = kind === 'term'
    ? 'Any song whose title contains this word or phrase is refused (case does not matter).'
    : kind === 'channel'
      ? 'A YouTube channel id, 24 characters starting with UC.'
      : 'A YouTube link or an 11 character video id.';

  return (
    <section className="tw-sr-card" aria-labelledby="tw-sr-block-title">
      <h2 id="tw-sr-block-title" className="tw-st-card__title">Blocklist</h2>
      <p className="tw-st-card__lead">Songs that match are refused when a viewer requests them. {list.data.items.length} of {list.data.limit} entries used.</p>
      <form className="tw-st-inline" onSubmit={submit} noValidate>
        <Field label="Type">
          {(control) => (
            <select {...control} className="form-control" value={kind} onChange={(event) => { setKind(event.target.value as BlockKind); setProblem(null); }}>
              <option value="term">Title word</option>
              <option value="video">Video</option>
              <option value="channel">YouTube channel</option>
            </select>
          )}
        </Field>
        <Field label="Value" help={help} error={problem ?? serverError ?? undefined}>
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={kind === 'term' ? SONG_LIMITS.termMax : SONG_LIMITS.inputMax}
              value={value} autoComplete="off" onChange={(event) => setValue(event.target.value)} />
          )}
        </Field>
        <button type="submit" className="btn primary" disabled={add.isPending}><Plus size={16} aria-hidden="true" /> Add to blocklist</button>
      </form>
      <RecordTable
        rows={list.data.items} columns={columns} rowKey={(row) => row.id} caption="Blocklist"
        rowActions={(row) => (
          <button type="button" className="btn" aria-label={`Remove ${row.value} from the blocklist`} onClick={() => remove.mutate(row.id)}
            disabled={remove.isPending}><Trash2 size={16} aria-hidden="true" /> Remove</button>
        )}
        empty={<EmptyState title="Nothing is blocked" description="Add a video, a YouTube channel or a title word to refuse matching songs." />}
      />
    </section>
  );
};
