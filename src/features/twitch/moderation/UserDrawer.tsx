/**
 * User drawer (§11.4): one viewer's points, watch time, follow date, recent
 * messages and moderation history in this channel, plus timeout / ban / unban /
 * Twitch warning. Opened from the moderation log and the chat log. Messages are
 * rendered as text, never as markup.
 */
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DurationInput,
  EditorDrawer,
  Field,
  StatusChip,
  formatDateTime,
  formatNumber,
  formatDuration,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
} from '../shared/ui';
import { showToast } from '@/utils/toast';
import { moderationApi } from './api';
import {
  LIMITS,
  describeActionError,
  describeLogAction,
  ruleLabel,
  type ManualAction,
  type ManualActionInput,
} from './model';

const ACTIONS: { value: Exclude<ManualAction, 'delete'>; label: string; done: string }[] = [
  { value: 'timeout', label: 'Timeout', done: 'Timed out' },
  { value: 'warn', label: 'Send a Twitch warning', done: 'Warning sent' },
  { value: 'ban', label: 'Ban', done: 'Banned' },
  { value: 'unban', label: 'Unban or end the timeout', done: 'Unbanned' },
];

export const UserDrawer: React.FC<{ channelId: string; userId: string | null; onClose: () => void }> = ({ channelId, userId, onClose }) => {
  const [action, setAction] = useState<Exclude<ManualAction, 'delete'>>('timeout');
  const [duration, setDuration] = useState(600);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAction('timeout');
    setDuration(600);
    setReason('');
    setError(null);
  }, [userId]);

  const lookup = useQuery({
    queryKey: tk(channelId, 'moderation', 'user', userId ?? ''),
    queryFn: () => moderationApi.user(channelId, userId as string),
    enabled: Boolean(userId),
    retry: twitchRetry,
  });

  const act = useChannelMutation({
    mutationFn: (input: ManualActionInput) => moderationApi.act(channelId, input),
    invalidate: [tk(channelId, 'moderation')],
    errorMessage: false,
    onSuccess: (result) => {
      if (result.ok) {
        showToast(ACTIONS.find((item) => item.value === action)?.done ?? 'Done', 'success');
        setReason('');
        setError(null);
      } else {
        setError(describeActionError(result.error));
      }
    },
    onError: (failure) => setError(twitchErrorMessage(failure)),
  });

  const data = lookup.data;
  const name = data?.user.display_name || data?.user.login || userId || '';
  const submit = () => {
    if (!userId) return;
    if (action === 'timeout' && (duration < 1 || duration > LIMITS.maxTimeoutS)) {
      setError('Timeouts must last between 1 second and 14 days.');
      return;
    }
    const input: ManualActionInput = { action, user_id: userId };
    if (action === 'timeout') input.duration_s = duration;
    if (reason.trim() && action !== 'unban') input.reason = reason.trim();
    act.mutate(input);
  };

  return (
    <EditorDrawer
      open={userId !== null}
      title={name ? `User: ${name}` : 'User'}
      description="This channel only. Messages appear while the chat log is on and for as long as it keeps them."
      onClose={onClose}
      onSubmit={submit}
      submitting={act.isPending}
      error={error}
      dirty={reason.trim().length > 0}
      submitLabel={ACTIONS.find((item) => item.value === action)?.label ?? 'Apply'}
      submitDisabled={!data}
    >
      {lookup.isPending && <p className="tw-muted">Loading…</p>}
      {lookup.isError && (
        <div className="tw-inline-failed">
          <span>This user didn't load. {twitchErrorMessage(lookup.error)}</span>
          <button type="button" className="btn" onClick={() => lookup.refetch()}>Retry</button>
        </div>
      )}
      {data && (
        <>
          <dl className="tw-mod-facts">
            <div><dt>Login</dt><dd>{data.user.login ?? '—'}</dd></div>
            <div><dt>Points</dt><dd>{data.viewer ? formatNumber(data.viewer.points) : '—'}</dd></div>
            <div><dt>Watch time</dt><dd>{data.viewer ? formatDuration(data.viewer.watch_minutes * 60) : '—'}</dd></div>
            <div><dt>Following since</dt><dd>{data.follow ? formatDateTime(data.follow.followed_at) : 'Not following or unknown'}</dd></div>
            <div><dt>Regular</dt><dd>{data.is_regular ? 'Yes' : 'No'}</dd></div>
          </dl>

          <h3 className="tw-mod-subtitle">Recent messages</h3>
          {data.recent_messages.length ? (
            <ul className="tw-mod-history">
              {data.recent_messages.map((message) => (
                <li key={message.id}>
                  <time dateTime={message.created_at ?? undefined}>{formatDateTime(message.created_at)}</time>
                  <span className={`tw-mod-message${message.is_deleted ? ' is-deleted' : ''}`}>{message.text}</span>
                  {message.is_deleted && <StatusChip tone="neutral">Deleted</StatusChip>}
                </li>
              ))}
            </ul>
          ) : <p className="tw-muted">No logged messages.</p>}

          <h3 className="tw-mod-subtitle">Moderation history</h3>
          {data.moderation.length ? (
            <ul className="tw-mod-history">
              {data.moderation.map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.created_at ?? undefined}>{formatDateTime(entry.created_at)}</time>
                  {describeLogAction(entry)} · {ruleLabel(entry.rule)}
                </li>
              ))}
            </ul>
          ) : <p className="tw-muted">No moderation actions.</p>}

          <h3 className="tw-mod-subtitle">Take action</h3>
          <Field label="Action">
            {(control) => (
              <select {...control} className="form-select" value={action}
                onChange={(event) => { setAction(event.target.value as Exclude<ManualAction, 'delete'>); setError(null); }}>
                {ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            )}
          </Field>
          {action === 'timeout' && (
            <DurationInput label="Timeout length" seconds={duration} min={1} max={LIMITS.maxTimeoutS} onChange={setDuration} />
          )}
          {action !== 'unban' && (
            <Field label="Reason" optional help="Shown to the user by Twitch.">
              {(control) => (
                <input {...control} className="form-control" maxLength={500} value={reason}
                  onChange={(event) => setReason(event.target.value)} />
              )}
            </Field>
          )}
        </>
      )}
    </EditorDrawer>
  );
};
