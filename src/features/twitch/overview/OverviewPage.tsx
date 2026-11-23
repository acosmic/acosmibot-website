/**
 * Channel overview (§11.4): live state, bot health with the actions that fix
 * it, and recent activity when the activity log is available.
 *
 * It is also the reference composition for slice pages:
 *  - the page frame is `SectionPage` (header + loading / failed / content);
 *  - data comes from `useQuery` with `tk(channelId, …)` keys and `twitchRetry`;
 *  - every write is a `useChannelMutation` (error toast, refetch on success);
 *  - role checks are presentation only (`hasRole`, `RoleGate`);
 *  - live updates arrive through `useFeedEvents`, never a second poller.
 * See `shared/ui/index.ts` for the list-page and settings-page examples.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Pause, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import { showToast } from '@/utils/toast';
import type { ChannelRuntimeStatus, CursorPage, SectionProps } from '../types';
import { TwitchApiError, channelPath, twitchApi, twitchErrorMessage, twitchRetry } from '../shared/api';
import { startAddChannel } from '../shared/auth';
import { summaryKey, tk } from '../shared/queryKeys';
import { hasRole } from '../shared/roles';
import { useChannel } from '../shared/useChannel';
import { useFeedEvents } from '../shared/useChannelFeed';
import {
  ChannelAvatar,
  EmptyState,
  RoleGate,
  SectionPage,
  StatusChip,
  channelStatusView,
  describeActivityEvent,
  describeActivityRow,
  formatNumber,
  formatRelative,
  liveView,
  reauthDetail,
  useChannelMutation,
  type ActivityLine,
  type ActivityRow,
  type StatusView,
} from '../shared/ui';

interface StatusResponse {
  success: true;
  bot_online: boolean;
  /** null when the chat service is offline (W1(c) note). */
  status?: ChannelRuntimeStatus | null;
}

const HealthRow: React.FC<{ label: string; view: StatusView | null; detail: React.ReactNode; action?: React.ReactNode }> = ({ label, view, detail, action }) => (
  <div className="dashboard-record-row tw-health-row">
    <div className="tw-health-row__label">
      <h3>{label}</h3>
      {view && <StatusChip tone={view.tone}>{view.label}</StatusChip>}
    </div>
    <p className="tw-health-row__detail">{detail}</p>
    {action && <div className="tw-health-row__action">{action}</div>}
  </div>
);

export const OverviewPage: React.FC<SectionProps> = ({ channelId, channel, role }) => {
  const { refetch: refetchChannel } = useChannel();
  const [params, setParams] = useSearchParams();
  const [confirmPause, setConfirmPause] = useState(false);
  const [liveLines, setLiveLines] = useState<ActivityLine[]>([]);
  const isBroadcaster = hasRole(role, 'broadcaster');
  const isEditor = hasRole(role, 'editor');

  // Landing here from "Add Acosmibot to my channel" (§5.1.3 redirect).
  useEffect(() => {
    if (params.get('connected') !== '1') return;
    showToast('Acosmibot is now connected to your channel.', 'success');
    const next = new URLSearchParams(params);
    next.delete('connected');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const status = useQuery({
    queryKey: tk(channelId, 'overview', 'status'),
    queryFn: () => twitchApi.get<StatusResponse>(channelPath(channelId, '/status')),
    retry: twitchRetry,
    refetchInterval: 60_000,
  });

  const activity = useQuery({
    queryKey: tk(channelId, 'activity', 'recent'),
    queryFn: () => twitchApi.get<CursorPage<ActivityRow>>(channelPath(channelId, '/activity?limit=10')),
    retry: twitchRetry,
  });
  // The activity log is provided by the overlays slice; until it exists the panel stays hidden.
  const activityMissing = activity.error instanceof TwitchApiError && activity.error.status === 404;

  useFeedEvents(['activity.'], (event) => {
    setLiveLines((lines) => [describeActivityEvent(event), ...lines].slice(0, 10));
    if (activity.isSuccess) void activity.refetch();
  });

  // Channel actions answer 409 `invalid_state` when the channel changed elsewhere (e.g. already
  // paused) and 503 `bot_offline` / `redis_unavailable` when the chat service is down. The toast
  // shows the API's sentence; on any failure the summary is refetched so the buttons match reality.
  const actionError = (error: unknown) => {
    if (error instanceof TwitchApiError && error.status === 503 && (error.code === 'bot_offline' || error.code === 'redis_unavailable')) {
      showToast('The Acosmibot chat service is offline right now. Try again once it is back.', 'error');
    } else {
      showToast(twitchErrorMessage(error, 'That did not work. Try again.'), 'error');
    }
    void refetchChannel();
    void status.refetch();
  };
  const afterChannelChange = {
    invalidate: [summaryKey(channelId), tk(channelId, 'overview', 'status')],
    onSuccess: () => { void refetchChannel(); },
    errorMessage: false as const,
    onError: actionError,
  };

  const pause = useChannelMutation({
    mutationFn: () => twitchApi.post<{ success: true; status: string }>(channelPath(channelId, '/pause')),
    successMessage: 'Acosmibot is paused in this channel.',
    ...afterChannelChange,
    onSuccess: () => { setConfirmPause(false); void refetchChannel(); },
    onError: (error) => { setConfirmPause(false); actionError(error); },
  });
  const resume = useChannelMutation({
    mutationFn: () => twitchApi.post<{ success: true; status: string }>(channelPath(channelId, '/resume')),
    successMessage: 'Acosmibot is running in this channel again.',
    ...afterChannelChange,
  });
  const makeModerator = useChannelMutation({
    mutationFn: () => twitchApi.post<{ success: true; bot_is_moderator: boolean }>(channelPath(channelId, '/bot/mod')),
    successMessage: (result) => (result.bot_is_moderator ? 'Acosmibot is now a moderator.' : 'Twitch did not make Acosmibot a moderator.'),
    ...afterChannelChange,
  });
  const rejoin = useChannelMutation({
    mutationFn: () => twitchApi.post<{ success: true }>(channelPath(channelId, '/rejoin')),
    successMessage: 'Acosmibot is rejoining the chat.',
    ...afterChannelChange,
  });

  const live = liveView(channel);
  const channelState = channelStatusView(channel.status);
  const bot = channel.bot;
  const runtime = status.data?.status ?? null;
  // The bot's `runtime.channel_status` may omit `subscriptions` (W1(b2) note); treat that as unknown.
  const subscriptions = runtime && typeof runtime.subscriptions?.expected === 'number' && typeof runtime.subscriptions?.enabled === 'number'
    ? runtime.subscriptions
    : null;
  const subscriptionsComplete = subscriptions ? subscriptions.enabled >= subscriptions.expected : true;

  const statusAction = channel.status === 'active' ? (
    <RoleGate min="broadcaster" role={role}>
      <button type="button" className="btn" onClick={() => setConfirmPause(true)} disabled={pause.isPending}>
        <Pause aria-hidden="true" size={16} /> Pause Acosmibot
      </button>
    </RoleGate>
  ) : channel.status === 'paused' ? (
    <RoleGate min="broadcaster" role={role}>
      <button type="button" className="btn primary" onClick={() => resume.mutate()} disabled={resume.isPending} aria-busy={resume.isPending}>
        <Play aria-hidden="true" size={16} /> {resume.isPending ? 'Resuming…' : 'Resume Acosmibot'}
      </button>
    </RoleGate>
  ) : channel.status === 'reauth_required' ? (
    <RoleGate min="broadcaster" role={role} fallback={<span className="tw-muted">Only the broadcaster can reconnect Acosmibot.</span>}>
      <button type="button" className="btn primary" onClick={() => startAddChannel(true)}>
        <RefreshCw aria-hidden="true" size={16} /> Reconnect Acosmibot
      </button>
    </RoleGate>
  ) : channel.status === 'bot_banned' ? (
    <RoleGate min="editor" role={role}>
      <button type="button" className="btn" onClick={() => rejoin.mutate()} disabled={rejoin.isPending} aria-busy={rejoin.isPending}>
        <RefreshCw aria-hidden="true" size={16} /> {rejoin.isPending ? 'Rejoining…' : 'Rejoin chat'}
      </button>
    </RoleGate>
  ) : null;

  const lines: ActivityLine[] = activity.isSuccess ? (activity.data.items ?? []).map(describeActivityRow) : liveLines;
  const showActivity = activity.isSuccess || (activityMissing && liveLines.length > 0) || (activity.isError && !activityMissing);

  const needsReauth = channel.status === 'reauth_required';
  const channelDetail = needsReauth
    ? reauthDetail(channel)
    : channel.status_reason ? `${channelState.detail} ${channel.status_reason}` : channelState.detail;

  return (
    <SectionPage title="Overview" description={`Live state and bot health for ${channel.display_name}.`}>
      {needsReauth && (
        <div className="tw-banner tw-banner--error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <p>{reauthDetail(channel)}</p>
          {statusAction}
        </div>
      )}
      <section className="overview-server-summary tw-overview-summary" aria-label="Channel">
        <div className="overview-server-summary__identity">
          <ChannelAvatar src={channel.profile_image_url} name={channel.display_name} size={56} className="overview-server-summary__avatar" />
          <div className="overview-server-summary__copy">
            <h2>{channel.display_name}</h2>
            <p>twitch.tv/{channel.login}{channel.broadcaster_type ? ` · ${channel.broadcaster_type}` : ''}</p>
          </div>
        </div>
        <div className="tw-overview-live">
          <StatusChip tone={live.tone}>{live.label}</StatusChip>
          {channel.live?.live ? (
            <dl className="tw-overview-live__facts">
              {channel.live.title && <div><dt>Title</dt><dd>{channel.live.title}</dd></div>}
              {channel.live.category_name && <div><dt>Category</dt><dd>{channel.live.category_name}</dd></div>}
              {typeof channel.live.viewer_count === 'number' && <div><dt>Viewers</dt><dd>{formatNumber(channel.live.viewer_count)}</dd></div>}
              {channel.live.started_at && <div><dt>Started</dt><dd>{formatRelative(channel.live.started_at)}</dd></div>}
            </dl>
          ) : (
            <p className="tw-muted">Not streaming right now.</p>
          )}
        </div>
      </section>

      <section className="overview-section" aria-labelledby="tw-health-title">
        <div className="overview-section__header">
          <h2 id="tw-health-title">Bot health</h2>
        </div>
        <div className="dashboard-record-ledger tw-health">
          <HealthRow
            label="Channel"
            view={channelState}
            detail={channelDetail}
            action={needsReauth ? undefined : statusAction}
          />
          <HealthRow
            label="Chat service"
            view={channel.bot_online ? { tone: 'active', label: 'Online', detail: '' } : { tone: 'warning', label: 'Offline', detail: '' }}
            detail={channel.bot_online
              ? 'The Acosmibot chat service is running.'
              : 'The chat service is not responding. Settings still save and apply when it is back.'}
          />
          <HealthRow
            label="Bot account"
            view={!bot?.user_id
              ? { tone: 'warning', label: 'Not connected', detail: '' }
              : bot.is_moderator
                ? { tone: 'active', label: 'Moderator', detail: '' }
                : { tone: 'warning', label: 'Not a moderator', detail: '' }}
            detail={!bot?.user_id
              ? 'No bot account is connected yet, so Acosmibot cannot chat here.'
              : `${bot.is_custom ? 'Custom bot' : 'Chatting as'} ${bot.login ?? 'the Acosmibot account'}. ${bot.is_moderator
                ? 'It is a moderator, so it acts on chat itself.'
                : 'It is not a moderator, so it shares a lower message limit and moderates through the broadcaster’s permission.'}`}
            action={bot?.user_id && !bot.is_moderator && !bot.is_custom ? (
              <RoleGate min="broadcaster" role={role} fallback={<span className="tw-muted">The broadcaster can make it a moderator.</span>}>
                <button type="button" className="btn primary" onClick={() => makeModerator.mutate()} disabled={makeModerator.isPending} aria-busy={makeModerator.isPending}>
                  <ShieldCheck aria-hidden="true" size={16} /> {makeModerator.isPending ? 'Working…' : 'Make Acosmibot a moderator'}
                </button>
              </RoleGate>
            ) : undefined}
          />
          <HealthRow
            label="Permissions"
            view={channel.missing_scopes.length
              ? { tone: 'warning', label: `${channel.missing_scopes.length} missing`, detail: '' }
              : { tone: 'active', label: 'All granted', detail: '' }}
            detail={channel.missing_scopes.length
              ? <>Some features need permissions this channel has not granted: <span className="tw-code-list">{channel.missing_scopes.join(', ')}</span>.</>
              : 'This channel has granted every permission Acosmibot asks for.'}
            action={channel.missing_scopes.length ? (
              <RoleGate min="broadcaster" role={role} fallback={<span className="tw-muted">Only the broadcaster can reconnect.</span>}>
                <button type="button" className="btn" onClick={() => startAddChannel(true)}>
                  <RefreshCw aria-hidden="true" size={16} /> Reconnect
                </button>
              </RoleGate>
            ) : undefined}
          />
          <HealthRow
            label="Twitch events"
            view={status.isPending
              ? null
              : status.isError || !status.data?.bot_online || !subscriptions
                ? { tone: 'neutral', label: 'Unknown', detail: '' }
                : subscriptionsComplete
                  ? { tone: 'active', label: 'Receiving', detail: '' }
                  : { tone: 'warning', label: 'Incomplete', detail: '' }}
            detail={status.isPending
              ? 'Checking…'
              : status.isError
                ? 'The event status could not be checked.'
                : !status.data?.bot_online || !runtime
                  ? 'Event status is available while the chat service is online.'
                  : !subscriptions
                    ? 'The chat service did not report its Twitch event subscriptions.'
                    : `${subscriptions.enabled} of ${subscriptions.expected} Twitch event subscriptions are active.`}
            action={status.isError ? (
              <button type="button" className="btn" onClick={() => void status.refetch()}>
                <RefreshCw aria-hidden="true" size={16} /> Check again
              </button>
            ) : subscriptions && !subscriptionsComplete && isEditor ? (
              <button type="button" className="btn" onClick={() => rejoin.mutate()} disabled={rejoin.isPending} aria-busy={rejoin.isPending}>
                <RefreshCw aria-hidden="true" size={16} /> {rejoin.isPending ? 'Rejoining…' : 'Rejoin chat'}
              </button>
            ) : undefined}
          />
        </div>
      </section>

      {showActivity && (
        <section className="overview-section" aria-labelledby="tw-activity-title">
          <div className="overview-section__header">
            <h2 id="tw-activity-title">Recent activity</h2>
          </div>
          {activity.isError && !activityMissing ? (
            <div className="tw-inline-failed" role="alert">
              <span>Recent activity didn't load.</span>
              <button type="button" className="btn" onClick={() => void activity.refetch()}>
                <RefreshCw aria-hidden="true" size={16} /> Retry
              </button>
            </div>
          ) : lines.length === 0 ? (
            <EmptyState title="No activity yet" description="Follows, subscriptions, cheers, raids and redemptions appear here as they happen." />
          ) : (
            <ol className="tw-activity-list">
              {lines.map((line) => (
                <li key={line.key}>
                  <span className="tw-activity-list__text">
                    {line.actor && <strong>{line.actor} </strong>}
                    {line.actor ? line.text : line.text.charAt(0).toUpperCase() + line.text.slice(1)}
                    {line.message && <span className="tw-activity-list__message">“{line.message}”</span>}
                  </span>
                  <time dateTime={line.at}>{formatRelative(line.at)}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {confirmPause && isBroadcaster && (
        <ConfirmDialog
          kicker="Pause Acosmibot"
          title={`Pause Acosmibot in ${channel.display_name}?`}
          confirmLabel="Pause"
          tone="primary"
          pending={pause.isPending}
          onConfirm={() => pause.mutate()}
          onClose={() => setConfirmPause(false)}
        >
          <p>While paused, Acosmibot stops responding and acting in your chat. Your settings stay saved, and you can resume at any time.</p>
        </ConfirmDialog>
      )}
    </SectionPage>
  );
};
