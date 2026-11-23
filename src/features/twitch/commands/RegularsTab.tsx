/** Regulars tab: viewers who count as "regular" for command levels (§6.6). Moderators add and remove them. */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { ConfirmDialog, LoadFailed, LoadingSpinner } from '@/components/ui';
import type { SectionProps } from '../types';
import {
  EmptyState, RecordTable, StatusChip, UserLookupInput, formatDateTime, isValidLogin, normalizeLogin, twitchRetry,
  useChannelMutation,
} from '../shared/ui';
import { regularsApi } from './api';
import { regularsKey } from './hooks';
import { COMMAND_LIMITS, type Regular } from './model';

export const RegularsTab: React.FC<SectionProps> = ({ channelId }) => {
  const [login, setLogin] = useState('');
  const [removing, setRemoving] = useState<Regular | null>(null);
  const list = useQuery({ queryKey: regularsKey(channelId), queryFn: () => regularsApi.list(channelId), retry: twitchRetry });
  const add = useChannelMutation({
    mutationFn: (name: string) => regularsApi.add(channelId, name),
    invalidate: [regularsKey(channelId)],
    successMessage: (result) => (result.already ? `${result.regular.login} is already a regular.` : `${result.regular.login} is now a regular.`),
    onSuccess: () => setLogin(''),
  });
  const remove = useChannelMutation({
    mutationFn: (regular: Regular) => regularsApi.remove(channelId, regular.user_id),
    invalidate: [regularsKey(channelId)],
    successMessage: (_result, regular) => `${regular.login} is no longer a regular.`,
    onSuccess: () => setRemoving(null),
    onError: () => setRemoving(null),
  });

  if (list.isError) {
    return (
      <LoadFailed
        title="Regulars didn't load"
        message={`${list.error instanceof Error ? list.error.message : 'Something went wrong.'} Nothing was changed.`}
        onRetry={() => list.refetch()}
      />
    );
  }
  if (list.isPending) return <LoadingSpinner />;

  const { items, count, limit } = list.data;
  const full = count >= (limit || COMMAND_LIMITS.regularsMax);
  const submit = (value: string) => {
    const name = normalizeLogin(value);
    if (isValidLogin(name) && !full && !add.isPending) add.mutate(name);
  };

  return (
    <div className="tw-cmd-stack">
      <p className="tw-muted">
        Regulars can use commands set to “Regulars” even when they are not subscribers. Moderators can also type
        {' '}<code className="tw-code-list">!regulars add name</code> in chat.
      </p>
      <form className="tw-cmd-toolbar" onSubmit={(event) => { event.preventDefault(); submit(login); }}>
        <UserLookupInput value={login} onChange={setLogin} label="Add a regular" placeholder="twitch_username"
          disabled={full || add.isPending} />
        <button type="submit" className="btn primary" disabled={full || add.isPending || !isValidLogin(login)}>
          <UserPlus size={16} aria-hidden="true" /> Add regular
        </button>
        <span className="tw-muted" aria-live="polite">{count.toLocaleString()} of {limit.toLocaleString()}</span>
      </form>
      <RecordTable<Regular>
        caption="Regulars"
        rows={items}
        rowKey={(regular) => regular.user_id}
        columns={[
          { key: 'login', header: 'Viewer', primary: true, render: (regular) => regular.login },
          {
            key: 'source', header: 'Added by', width: '160px',
            render: (regular) => (
              <StatusChip tone="neutral">{regular.source === 'auto' ? 'Watch time' : 'A moderator'}</StatusChip>
            ),
          },
          { key: 'created', header: 'Since', width: '200px', hideOnMobile: true, render: (regular) => formatDateTime(regular.created_at) },
        ]}
        rowActions={(regular) => (
          <button type="button" className="btn" onClick={() => setRemoving(regular)} aria-label={`Remove ${regular.login}`}>
            Remove
          </button>
        )}
        empty={<EmptyState title="No regulars yet" description="Add viewers here or with !regulars add in chat." />}
      />
      {removing && (
        <ConfirmDialog
          kicker="Remove regular"
          title={`Remove ${removing.login}?`}
          confirmLabel="Remove"
          tone="danger"
          pending={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => setRemoving(null)}
        >
          <p>They keep any other level they have, such as subscriber or VIP.</p>
        </ConfirmDialog>
      )}
    </div>
  );
};
