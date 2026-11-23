/**
 * Managers (§11.4, §12.10): people the broadcaster gives dashboard access by
 * hand (editor or moderator), next to the editors and moderators synced from
 * Twitch. Broadcaster only; the API checks the role on every request, so a
 * removed manager loses access on their next request.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, UserPlus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EmptyState,
  Field,
  RecordTable,
  SectionPage,
  StatusChip,
  UserLookupInput,
  formatRelative,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
  type Column,
} from '../shared/ui';
import { managersApi } from './api';
import {
  MANAGER_ROLE_HELP,
  SYNCED_SOURCE_LABELS,
  groupSynced,
  managerLoginProblem,
  normalizeLogin,
  type ManagerRole,
  type ManualManager,
} from './model';
import './admin.css';

type SyncedRow = ReturnType<typeof groupSynced>[number];

export const ManagersPage: React.FC<SectionProps> = ({ channelId, channel }) => {
  const key = tk(channelId, 'managers');
  const list = useQuery({ queryKey: key, queryFn: () => managersApi.list(channelId), retry: twitchRetry });
  const manual = list.data?.manual ?? [];
  const synced = groupSynced(list.data?.synced ?? []);
  const limit = list.data?.limit ?? 50;

  const [login, setLogin] = useState('');
  const [role, setRole] = useState<ManagerRole>('moderator');
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ManualManager | null>(null);

  const add = useChannelMutation({
    mutationFn: (input: { login: string; role: ManagerRole }) => managersApi.add(channelId, input.login, input.role),
    invalidate: [key],
    successMessage: (result) => (result.updated
      ? `${result.manager.login} is now ${result.manager.role === 'editor' ? 'an editor' : 'a moderator'}.`
      : `${result.manager.login} was added.`),
    errorMessage: false,
    onSuccess: () => { setLogin(''); setProblem(null); },
    onError: (error) => {
      setProblem(isTwitchApiError(error, 'not_found')
        ? 'No Twitch account has that username.'
        : isTwitchApiError(error, 'limit_reached')
          ? `A channel can have at most ${limit} managers.`
          : twitchErrorMessage(error));
    },
  });
  const remove = useChannelMutation({
    mutationFn: (manager: ManualManager) => managersApi.remove(channelId, manager.user_id),
    invalidate: [key],
    successMessage: 'Access removed.',
    errorMessage: 'Could not remove the manager.',
    onSuccess: () => setRemoving(null),
    onError: () => setRemoving(null),
  });
  const sync = useChannelMutation({
    mutationFn: () => managersApi.sync(channelId),
    invalidate: [key],
    successMessage: (result) => `Synced ${result.editors} editor${result.editors === 1 ? '' : 's'} and ${result.moderators} moderator${result.moderators === 1 ? '' : 's'} from Twitch.`,
    errorMessage: 'Could not sync from Twitch.',
  });

  const submit = () => {
    const found = managerLoginProblem(login, channel.login);
    setProblem(found);
    if (!found) add.mutate({ login: normalizeLogin(login), role });
  };

  const manualColumns: Column<ManualManager>[] = [
    { key: 'login', header: 'Username', primary: true, render: (row) => row.login },
    {
      key: 'role', header: 'Access',
      render: (row) => <StatusChip tone="neutral">{row.role === 'editor' ? 'Editor' : 'Moderator'}</StatusChip>,
    },
    { key: 'added', header: 'Added', hideOnMobile: true, render: (row) => (row.created_at ? formatRelative(row.created_at) : '') },
  ];
  const syncedColumns: Column<SyncedRow>[] = [
    { key: 'login', header: 'Username', primary: true, render: (row) => row.login },
    {
      key: 'role', header: 'Access',
      render: (row) => <StatusChip tone="neutral">{row.role === 'editor' ? 'Editor' : 'Moderator'}</StatusChip>,
    },
    { key: 'source', header: 'From Twitch', render: (row) => row.sources.map((source) => SYNCED_SOURCE_LABELS[source]).join(', ') },
  ];

  return (
    <SectionPage
      title="Managers"
      description="Choose who can use this dashboard. Your Twitch editors and moderators get access automatically; add anyone else here."
      query={list}
    >
      <section className="tw-admin-card" aria-labelledby="tw-managers-add">
        <h2 id="tw-managers-add" className="tw-admin-card__title">Add a manager</h2>
        <p className="tw-admin-card__lead">They sign in with their own Twitch account and see this channel in their dashboard.</p>
        <form className="tw-admin-inline" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
          <UserLookupInput value={login} onChange={(value) => { setLogin(value); setProblem(null); }} label="Twitch username"
            disabled={add.isPending} required />
          <Field label="Access" help={MANAGER_ROLE_HELP[role]}>
            {(control) => (
              <select {...control} className="form-select" value={role} disabled={add.isPending}
                onChange={(event) => setRole(event.target.value === 'editor' ? 'editor' : 'moderator')}>
                <option value="moderator">Moderator</option>
                <option value="editor">Editor</option>
              </select>
            )}
          </Field>
          <button type="submit" className="btn primary tw-admin-inline__action" disabled={add.isPending || manual.length >= limit}
            aria-busy={add.isPending}>
            <UserPlus size={16} aria-hidden="true" /> {add.isPending ? 'Adding…' : 'Add manager'}
          </button>
        </form>
        {problem && <p className="tw-field__error" role="alert">{problem}</p>}
      </section>

      <section className="tw-admin-section" aria-labelledby="tw-managers-manual">
        <h2 id="tw-managers-manual" className="tw-section-title">Added here</h2>
        <RecordTable
          rows={manual} columns={manualColumns} rowKey={(row) => row.user_id} caption="Managers added here"
          rowActions={(row) => (
            <button type="button" className="btn" onClick={() => setRemoving(row)}>Remove</button>
          )}
          footer={manual.length ? <p className="tw-muted">{manual.length} of {limit} managers.</p> : undefined}
          empty={<EmptyState title="No managers added yet" description="People you add here can open this channel’s dashboard with the access you choose." />}
        />
      </section>

      <section className="tw-admin-section" aria-labelledby="tw-managers-synced">
        <div className="tw-admin-section__header">
          <h2 id="tw-managers-synced" className="tw-section-title">From Twitch</h2>
          <button type="button" className="btn" onClick={() => sync.mutate()} disabled={sync.isPending} aria-busy={sync.isPending}>
            <RefreshCw size={16} aria-hidden="true" /> {sync.isPending ? 'Syncing…' : 'Sync from Twitch'}
          </button>
        </div>
        <p className="tw-muted tw-admin-section__lead">
          Your Twitch editors become editors here and your Twitch moderators become moderators. Change them on Twitch; Acosmibot refreshes this list every few hours.
        </p>
        <RecordTable
          rows={synced} columns={syncedColumns} rowKey={(row) => row.user_id} caption="Editors and moderators from Twitch"
          empty={<EmptyState title="No editors or moderators synced" description="Editors and moderators you add on Twitch appear here after the next sync." />}
        />
      </section>

      {removing && (
        <ConfirmDialog
          kicker="Remove manager" title={`Remove ${removing.login}?`} confirmLabel="Remove access"
          pending={remove.isPending} onConfirm={() => remove.mutate(removing)} onClose={() => setRemoving(null)}
        >
          <p>
            {removing.login} loses the access you gave them here on their next page load. If they are also an editor or
            moderator on Twitch, that access stays until you change it on Twitch.
          </p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
