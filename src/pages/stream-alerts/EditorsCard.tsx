import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { streamAlertsApi, StreamAlertAccount, StreamAlertEditor } from '@/api/streamAlerts';
import { plainError } from '@/utils/streamAlertAccounts';

type Notice = { tone: 'ok' | 'error'; text: string };

/** Owner only: who else may control this account's alerts. */
export const EditorsCard: React.FC<{ account: StreamAlertAccount }> = ({ account }) => {
  const queryClient = useQueryClient();
  const accountId = account.id;
  const editorsKey = ['stream-alerts', accountId, 'editors'];
  const [choice, setChoice] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const list = useQuery({
    queryKey: editorsKey,
    queryFn: () => streamAlertsApi.getEditors(accountId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: editorsKey });

  const add = useMutation({
    mutationFn: (discordId: string) => streamAlertsApi.addEditor(accountId, discordId),
    onSuccess: (result) => {
      setChoice('');
      setNotice({ tone: 'ok', text: `Added ${result.editor.username}. They can now control your alerts from this page.` });
    },
    onError: (error) => setNotice({ tone: 'error', text: `Could not add that person: ${plainError(error)}` }),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (editor: StreamAlertEditor) => streamAlertsApi.removeEditor(accountId, editor.discord_id),
    onSuccess: (_result, editor) => setNotice({ tone: 'ok', text: `Removed ${editor.username}. They can no longer control your alerts.` }),
    onError: (error, editor) => setNotice({
      tone: 'error',
      // The API answers "Not found" both when the person is no longer an editor and when the account is gone.
      text: error instanceof Error && error.message === 'Not found'
        ? `Could not remove ${editor.username}. They may already have been removed, so the list was refreshed.`
        : `Could not remove ${editor.username}: ${plainError(error)}`,
    }),
    onSettled: refresh,
  });

  const editors = list.data?.editors ?? [];
  const candidates = list.data?.candidates ?? [];
  // A person who was just added, or is no longer eligible, drops out of the list after a refresh.
  const chosen = candidates.some((person) => person.discord_id === choice) ? choice : '';
  const working = add.isPending || remove.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!chosen || working) return;
    setNotice(null);
    add.mutate(chosen);
  };

  return (
    <section className="stream-accounts__card" aria-labelledby="stream-editors-title">
      <div className="stream-accounts__card-head">
        <h3 id="stream-editors-title">Editors</h3>
        <p>Editors can use everything on this page for your alerts. They cannot see your OBS link or change who the editors are.</p>
      </div>

      {list.isLoading && <p className="stream-accounts__empty" role="status">Loading your editors…</p>}
      {list.error && !list.data && (
        <div className="stream-accounts__load-error" role="alert">
          <p className="stream-accounts__notice is-error">Could not load your editors: {plainError(list.error)}</p>
          <button type="button" disabled={list.isFetching} onClick={() => list.refetch()}>Try again</button>
        </div>
      )}

      {list.data && (
        <>
          {editors.length === 0 ? (
            <p className="stream-accounts__empty">No editors yet. Only you can control your alerts.</p>
          ) : (
            <ul className="stream-accounts__editors">
              {editors.map((editor) => (
                <li key={editor.discord_id}>
                  <span>{editor.username}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${editor.username}`}
                    disabled={working}
                    onClick={() => { setNotice(null); remove.mutate(editor); }}
                  >
                    {remove.isPending && remove.variables?.discord_id === editor.discord_id ? 'Removing…' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {candidates.length === 0 ? (
            <p className="stream-accounts__empty">
              {editors.length === 0
                ? 'There is nobody you can add right now.'
                : 'There is nobody else you can add right now.'}
            </p>
          ) : (
            <form className="stream-accounts__add" onSubmit={submit}>
              <label>
                <span>Add an editor</span>
                <select className="form-control" value={chosen} onChange={(event) => setChoice(event.target.value)}>
                  <option value="">Choose a person</option>
                  {candidates.map((person) => (
                    <option key={person.discord_id} value={person.discord_id}>{person.username}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="is-primary" disabled={!chosen || working}>
                {add.isPending ? 'Adding…' : 'Add editor'}
              </button>
            </form>
          )}
        </>
      )}

      {notice && (
        <p className={`stream-accounts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </p>
      )}
    </section>
  );
};
