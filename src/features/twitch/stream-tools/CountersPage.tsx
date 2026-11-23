/**
 * Counters (§11.4, §12.8): named numbers such as a death count. Moderators change
 * them in chat with !counter; commands read them with $(getcount name) and change
 * them with $(counter name). Names are lowercase.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EditorDrawer,
  EmptyState,
  Field,
  RecordTable,
  SectionPage,
  formatNumber,
  formatRelative,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  type Column,
} from '../shared/ui';
import { countersApi } from './api';
import {
  COUNTER_LIMITS,
  counterNameProblem,
  counterValueProblem,
  normalizeCounterName,
  parseCounterValue,
  type Counter,
} from './model';
import './stream-tools.css';

type Editing = { kind: 'new' } | { kind: 'edit'; counter: Counter } | null;
interface Draft { name: string; value: string }

export const CountersPage: React.FC<SectionProps> = ({ channelId }) => {
  const list = useQuery({
    queryKey: tk(channelId, 'counters'),
    queryFn: () => countersApi.list(channelId),
    retry: twitchRetry,
  });
  const counters = list.data?.items ?? [];
  const limit = list.data?.limit ?? 100;

  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', value: '0' });
  const [base, setBase] = useState<Draft>({ name: '', value: '0' });
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Counter | null>(null);

  const open = (counter: Counter | null) => {
    const next = counter ? { name: counter.name, value: String(counter.value) } : { name: '', value: '0' };
    setDraft(next);
    setBase(next);
    setClientError(null);
    save.reset();
    setEditing(counter ? { kind: 'edit', counter } : { kind: 'new' });
  };

  const save = useChannelMutation({
    mutationFn: (value: Draft) => countersApi.put(channelId, normalizeCounterName(value.name), parseCounterValue(value.value) ?? 0),
    invalidate: [tk(channelId, 'counters')],
    successMessage: 'Counter saved',
    errorMessage: false,
    onSuccess: () => setEditing(null),
  });
  const remove = useChannelMutation({
    mutationFn: (counter: Counter) => countersApi.remove(channelId, counter.name),
    invalidate: [tk(channelId, 'counters')],
    successMessage: 'Counter deleted',
    errorMessage: 'Could not delete the counter.',
    onSuccess: () => { setConfirmDelete(null); setEditing(null); },
    onError: () => setConfirmDelete(null),
  });

  const submit = () => {
    const problem = (editing?.kind === 'new' ? counterNameProblem(draft.name) : null) ?? counterValueProblem(draft.value);
    setClientError(problem);
    if (!problem) save.mutate(draft);
  };
  const serverError = save.error
    ? (isTwitchApiError(save.error, 'limit_reached') ? `This channel already has ${limit} counters.` : twitchErrorMessage(save.error))
    : null;

  const columns: Column<Counter>[] = [
    { key: 'name', header: 'Name', primary: true, render: (counter) => counter.name },
    { key: 'value', header: 'Value', align: 'end', render: (counter) => <span className="tw-st-value">{formatNumber(counter.value)}</span> },
    { key: 'updated', header: 'Last changed', hideOnMobile: true, render: (counter) => (counter.updated_at ? formatRelative(counter.updated_at) : '') },
  ];

  return (
    <SectionPage
      title="Counters"
      description="Named numbers that chat commands can show and change, like a death count. Moderators use !counter name +1 in chat; a command response can use $(getcount name) or $(counter name)."
      query={list}
      actions={(
        <button type="button" className="btn primary" disabled={counters.length >= limit} onClick={() => open(null)}>
          <Plus size={16} aria-hidden="true" /> New counter
        </button>
      )}
    >
      <RecordTable
        rows={counters} columns={columns} rowKey={(counter) => counter.name} caption="Counters"
        onRowClick={open} rowLabel={(counter) => `Edit counter ${counter.name}`}
        activeKey={editing?.kind === 'edit' ? editing.counter.name : null}
        footer={<p className="tw-muted">{counters.length} of {limit} counters used.</p>}
        empty={(
          <EmptyState title="No counters yet"
            description="A counter is created the first time a moderator uses !counter with a new name, or you can add one here."
            action={<button type="button" className="btn primary" onClick={() => open(null)}>New counter</button>} />
        )}
      />

      <EditorDrawer
        open={editing !== null}
        title={editing?.kind === 'edit' ? `Edit ${editing.counter.name}` : 'New counter'}
        onClose={() => setEditing(null)}
        onSubmit={submit}
        submitting={save.isPending}
        error={clientError ?? serverError}
        dirty={draft.name !== base.name || draft.value !== base.value}
        submitLabel={editing?.kind === 'edit' ? 'Save counter' : 'Create counter'}
        secondaryAction={editing?.kind === 'edit' ? (
          <button type="button" className="btn" onClick={() => setConfirmDelete(editing.counter)}>Delete</button>
        ) : undefined}
      >
        <Field label="Name" help={`Letters, numbers, - and _, up to ${COUNTER_LIMITS.nameMax} characters. Saved in lowercase.`}>
          {(control) => (
            <input {...control} className="form-control" type="text" maxLength={COUNTER_LIMITS.nameMax} value={draft.name}
              readOnly={editing?.kind === 'edit'} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          )}
        </Field>
        <Field label="Value" help="A whole number. Chat commands can add to it or set it later.">
          {(control) => (
            <input {...control} className="form-control" type="text" inputMode="numeric" value={draft.value}
              onChange={(event) => setDraft({ ...draft, value: event.target.value })} />
          )}
        </Field>
      </EditorDrawer>

      {confirmDelete && (
        <ConfirmDialog
          kicker="Delete counter" title={`Delete ${confirmDelete.name}?`} confirmLabel="Delete counter"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(confirmDelete)} onClose={() => setConfirmDelete(null)}
        >
          <p>Commands that use this counter will start again from 0 if it is used again.</p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
