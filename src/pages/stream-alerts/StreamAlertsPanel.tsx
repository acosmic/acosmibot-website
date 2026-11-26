import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  streamAlertsApi,
  StreamAlert,
  StreamAlertAccount,
  StreamAlertClearScope,
  StreamAlertControlAction,
  StreamAlertModerationDecision,
  StreamAlertSettings,
  StreamAlertStatus,
  StreamAlertType,
  StreamEffectInput,
  StreamEffectName,
} from '@/api/streamAlerts';
import { ownerPossessive, plainError } from '@/utils/streamAlertAccounts';
import { previewProblem, type PreviewHandle } from './previewHandle';
import './StreamAlertsPanel.css';

/*
 * The pieces of the stream alerts control panel that the alert box page places: the overlay
 * light and live controls in the top bar, the channel point effects under Channel points, and
 * the recent alerts (with moderation) under Activity. Each takes the account, and the page
 * mounts them under `key={account.id}`, so nothing typed or shown for one account carries over.
 */

const DEFAULT_SETTINGS: StreamAlertSettings = { paused: false, safe_mode: false, min_raid_viewers: 1, min_cheer_bits: 1 };

/** Plain-words results for each live control. */
const CONTROL_TEXT: Record<StreamAlertControlAction, { done: string; verb: string }> = {
  skip: { done: 'Skipped the alert in OBS.', verb: 'skip the alert' },
  clear: { done: 'Cleared the waiting alerts in OBS.', verb: 'clear the waiting alerts' },
  pause: { done: 'Paused alerts in OBS. New alerts will wait until you resume.', verb: 'pause alerts' },
  resume: { done: 'Resumed alerts in OBS.', verb: 'resume alerts' },
  safe_mode_on: { done: 'Safe Mode is on. Follow and raid alerts are hidden.', verb: 'turn on Safe Mode' },
  safe_mode_off: { done: 'Safe Mode is off. Follow and raid alerts show again.', verb: 'turn off Safe Mode' },
  stop_effects: { done: 'Stopped the effects in OBS.', verb: 'stop the effects' },
};

interface AlertKind {
  type: StreamAlertType;
  label: string;
  source: string;
  accent: string;
}

/** Every alert the overlay draws, in the order the page lists them. */
export const ALERT_KINDS: AlertKind[] = [
  { type: 'donation', label: 'Donation', source: 'Stripe', accent: '#22d3ee' },
  { type: 'follow', label: 'Follow', source: 'Twitch', accent: '#22d3ee' },
  { type: 'sub', label: 'New sub', source: 'Twitch', accent: '#a78bfa' },
  { type: 'resub', label: 'Resub', source: 'Twitch', accent: '#a78bfa' },
  { type: 'gift', label: 'Gift subs', source: 'Twitch', accent: '#f472b6' },
  { type: 'cheer', label: 'Cheer', source: 'Twitch', accent: '#fbbf24' },
  { type: 'raid', label: 'Raid', source: 'Twitch', accent: '#fb7185' },
  { type: 'hypetrain', label: 'Hype train', source: 'Twitch', accent: '#4ade80' },
];

interface RewardEffect {
  name: StreamEffectName;
  label: string;
  /** What it does on stream, from the overlay's FX table. */
  does: string;
  accent: string;
  usesMessage?: boolean;
}

/** Channel point effects on the overlay. Each can be previewed here or sent to OBS. */
const REWARD_EFFECTS: RewardEffect[] = [
  { name: 'boop', label: 'Boop', accent: '#22d3ee', does: 'Ripples across the screen and a camera bump. Repeats count up, and five in a row make a boop storm.' },
  { name: 'meteor', label: 'Meteor Shower', accent: '#61daf1', does: 'About 30 meteors streak down. A few hit the camera and knock it.' },
  { name: 'news', label: 'Breaking News', accent: '#fbbf24', usesMessage: true, does: 'A news ticker along the bottom for about 14 seconds. Shows the name and the Message.' },
  { name: 'flood', label: 'Flood', accent: '#1570e0', does: 'Water rises over the screen for about 13 seconds and the camera floats on it.' },
  { name: 'rewind', label: 'Instant Replay tag', accent: '#fb7185', does: 'A REW tag in the corner for about 4 seconds, with a rewind sound.' },
];

const effectLabel = (effect: StreamEffectName) => REWARD_EFFECTS.find((item) => item.name === effect)?.label ?? effect;

const KIND_BY_TYPE = new Map(ALERT_KINDS.map((kind) => [kind.type, kind]));
export const kindLabel = (type: StreamAlertType) => KIND_BY_TYPE.get(type)?.label ?? type;
const OVERLAY_CONNECTED_WINDOW_SECONDS = 45;

function describe(alert: StreamAlert): string {
  switch (alert.type) {
    case 'donation': return alert.amount_display ?? '';
    case 'resub': return `${alert.value ?? 1} months`;
    case 'gift': return `${alert.value ?? 1} gifted`;
    case 'cheer': return `${alert.value ?? 0} bits`;
    case 'raid': return `${alert.value ?? 0} raiders`;
    case 'hypetrain': return `level ${alert.value ?? 1}`;
    default: return '';
  }
}

function overlayOptions(alert: Pick<StreamAlert, 'name' | 'message' | 'value' | 'tier' | 'amount_display'>, test: boolean) {
  return { user: alert.name, text: alert.message, value: alert.value, tier: alert.tier, amount: alert.amount_display, test };
}

export const statusQueryKey = (accountId: number) => ['stream-alerts', accountId, 'status'];
export const recentQueryKey = (accountId: number) => ['stream-alerts', accountId, 'recent'];

/** The account's status (overlay, Twitch, live settings), read every 10 seconds. One read for every piece that shows it. */
export function useStreamStatus(accountId: number) {
  return useQuery({
    queryKey: statusQueryKey(accountId),
    queryFn: () => streamAlertsApi.getStatus(accountId),
    refetchInterval: 10_000,
  });
}

function useNow(ms = 5_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

/** The overlay connection light, with the reason in its title and a sentence for screen readers. */
export const OverlayLight: React.FC<{ account: StreamAlertAccount }> = ({ account }) => {
  const status = useStreamStatus(account.id);
  const now = useNow();
  const lastSeen = status.data?.overlay_last_seen ?? null;
  const secondsSinceSeen = lastSeen === null ? null : Math.max(0, Math.round(now / 1000 - lastSeen));
  const overlayConnected = secondsSinceSeen !== null && secondsSinceSeen <= OVERLAY_CONNECTED_WINDOW_SECONDS;
  // The account that drives the overlay already installed in OBS keeps its source name; everyone else pasted a link.
  const reconnectHint = account.legacy_overlay
    ? 'Open OBS, or refresh the "Acosmic Effects" source.'
    : `Open OBS, or refresh the browser source that uses ${account.role === 'owner' ? 'your' : ownerPossessive(account.owner_username)} link.`;
  let detail = '';
  if (status.isLoading) detail = 'Checking the overlay…';
  else if (status.error) detail = `Could not read the status: ${String(status.error)}`;
  else if (status.data && !status.data.configured) detail = 'The API has no overlay key set, so alerts cannot reach OBS.';
  else if (status.data?.configured && overlayConnected) detail = 'The overlay in OBS is listening. "Send to OBS" will play on stream.';
  else if (status.data?.configured) detail = `Nothing has asked for alerts in the last minute. ${reconnectHint}`;
  return (
    <div className="stream-alerts__status stream-box__light" aria-live="polite" title={detail}>
      <span className={`stream-alerts__light ${overlayConnected ? 'is-on' : ''}`} aria-hidden="true" />
      <div>
        <strong>{overlayConnected ? 'OBS connected' : 'OBS not connected'}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
};

/** Skip, stop effects, pause, clear waiting and Safe Mode, acting on the overlay in OBS right now. */
export const LiveControls: React.FC<{ account: StreamAlertAccount; preview: React.MutableRefObject<PreviewHandle | null> }> = ({ account, preview }) => {
  const queryClient = useQueryClient();
  const accountId = account.id;
  const status = useStreamStatus(accountId);
  const [liveNotice, setLiveNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const settings = status.data?.settings ?? DEFAULT_SETTINGS;

  const applySettings = (next: StreamAlertSettings) => {
    queryClient.setQueryData<StreamAlertStatus>(statusQueryKey(accountId), (old) => (old ? { ...old, settings: next } : old));
    queryClient.invalidateQueries({ queryKey: statusQueryKey(accountId) });
  };

  const control = useMutation({
    mutationFn: (action: StreamAlertControlAction) => streamAlertsApi.sendControl(accountId, action),
    onSuccess: (result, action) => {
      if (result.settings) applySettings(result.settings);
      setLiveNotice({ tone: 'ok', text: CONTROL_TEXT[action].done });
    },
    onError: (error, action) => setLiveNotice({ tone: 'error', text: `Could not ${CONTROL_TEXT[action].verb}: ${String(error)}` }),
  });

  const runControl = (action: StreamAlertControlAction) => {
    if (control.isPending) return;
    if (action === 'skip' || action === 'clear' || action === 'stop_effects') preview.current?.mirror(action);
    control.mutate(action);
  };

  const obsReady = Boolean(status.data?.configured && status.data?.available);
  const liveDisabled = control.isPending || !obsReady;

  return (
    <section className="stream-alerts stream-alerts__live stream-box__live" aria-label="Live controls">
      <div className="stream-alerts__live-buttons">
        <button type="button" className="stream-alerts__skip" disabled={liveDisabled} title="Ends the alert card on screen." onClick={() => runControl('skip')}>
          Skip alert
        </button>
        <button
          type="button"
          className={settings.paused ? 'is-on' : ''}
          aria-pressed={settings.paused}
          disabled={liveDisabled}
          onClick={() => runControl(settings.paused ? 'resume' : 'pause')}
        >
          {settings.paused ? 'Resume alerts' : 'Pause alerts'}
        </button>
        <button
          type="button"
          className={settings.safe_mode ? 'is-on' : ''}
          aria-pressed={settings.safe_mode}
          title="Hides follow and raid alerts while it is on."
          disabled={liveDisabled}
          onClick={() => runControl(settings.safe_mode ? 'safe_mode_off' : 'safe_mode_on')}
        >
          {settings.safe_mode ? 'Safe Mode: on' : 'Safe Mode: off'}
        </button>
        <button type="button" disabled={liveDisabled} onClick={() => runControl('clear')}>
          Clear waiting
        </button>
        <button
          type="button"
          title="Ends a running channel point effect, such as Flood. Alert cards stay."
          disabled={liveDisabled}
          onClick={() => runControl('stop_effects')}
        >
          Stop effects
        </button>
      </div>
      {(settings.paused || settings.safe_mode) && (
        <div className="stream-alerts__banners" aria-live="polite">
          {settings.paused && (
            <p className="stream-alerts__banner is-paused">
              <strong>Alerts are paused.</strong> New alerts are waiting and will play when you press Resume alerts.
            </p>
          )}
          {settings.safe_mode && (
            <p className="stream-alerts__banner is-safe">
              <strong>Safe Mode is on.</strong> Follow and raid alerts are hidden until you turn it off.
            </p>
          )}
        </div>
      )}
      {!obsReady && status.data && (
        <p className="stream-alerts__hint stream-alerts__live-hint">The live controls are off because alerts cannot reach OBS at the moment.</p>
      )}
      {liveNotice && (
        <p className={`stream-alerts__notice is-${liveNotice.tone}`} role="status">{liveNotice.text}</p>
      )}
    </section>
  );
};

/** The channel point effects, each with Preview (here) and Send to OBS. */
export const ChannelEffects: React.FC<{
  account: StreamAlertAccount;
  preview: React.MutableRefObject<PreviewHandle | null>;
  name: string;
  message: string;
}> = ({ account, preview, name, message }) => {
  const accountId = account.id;
  const status = useStreamStatus(accountId);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const fireEffect = useMutation({
    mutationFn: (input: StreamEffectInput) => streamAlertsApi.fireEffect(accountId, input),
    onSuccess: (_result, input) => setNotice({ tone: 'ok', text: `Sent ${effectLabel(input.effect)} to OBS.` }),
    onError: (error, input) => setNotice({ tone: 'error', text: `Could not send ${effectLabel(input.effect)}: ${String(error)}` }),
  });
  const sendEffect = (effect: RewardEffect) => {
    if (fireEffect.isPending) return;
    fireEffect.mutate({ effect: effect.name, name: name.trim() || undefined, message: message.trim() || undefined });
  };
  const previewEffect = async (effect: RewardEffect) => {
    const result = await preview.current?.play(effect.name, { user: name.trim() || 'Test Viewer', text: message.trim() }) ?? 'loading';
    setNotice(result === 'played' ? null : { tone: 'error', text: previewProblem(result) ?? '' });
  };

  return (
    <section className="stream-alerts stream-alerts__list" aria-labelledby="stream-effects-title">
      <h3 className="stream-alerts__list-head" id="stream-effects-title">Channel point effects</h3>
      <ul className="stream-alerts__kinds is-effects">
        {REWARD_EFFECTS.map((effect) => (
          <li key={effect.name} style={{ '--alert-accent': effect.accent } as React.CSSProperties}>
            <div className="stream-alerts__kind-name">
              <strong>{effect.label}</strong>
              <span>{effect.does}{effect.usesMessage ? '' : ' Ignores the message.'}</span>
            </div>
            <div className="stream-alerts__actions">
              <button type="button" onClick={() => previewEffect(effect)}>Preview</button>
              <button
                type="button"
                className="is-primary"
                disabled={fireEffect.isPending || !status.data?.configured}
                onClick={() => sendEffect(effect)}
              >
                Send to OBS
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="stream-alerts__hint">Channel point effects sent to OBS play right away, with no TEST tag.</p>
      {notice && (
        <p className={`stream-alerts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>
      )}
    </section>
  );
};

const MODERATION_TEXT: Record<string, string> = {
  pending: 'Held',
  approved: 'Approved',
  blocked: 'Blocked',
  released: 'Shown',
};

/** Recent alerts, newest first: replay in OBS, preview here, Approve or Block while held, and tidy the list. */
export const ActivityList: React.FC<{ account: StreamAlertAccount; preview: React.MutableRefObject<PreviewHandle | null> }> = ({ account, preview }) => {
  const queryClient = useQueryClient();
  const accountId = account.id;
  const recentKey = recentQueryKey(accountId);
  const status = useStreamStatus(accountId);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const anyPending = (alerts: StreamAlert[] | undefined) => Boolean(alerts?.some((alert) => alert.moderation === 'pending'));
  const recent = useQuery({
    queryKey: recentKey,
    queryFn: () => streamAlertsApi.getRecent(accountId, 30),
    // Held alerts wait on a person, so read more often while there are any.
    refetchInterval: (query) => (anyPending(query.state.data?.alerts) ? 3_000 : 15_000),
  });
  const refreshRecent = () => queryClient.invalidateQueries({ queryKey: recentKey });

  const replay = useMutation({
    mutationFn: (id: string) => streamAlertsApi.replayAlert(accountId, id),
    onSuccess: () => {
      setNotice({ tone: 'ok', text: 'Replayed on the overlay.' });
      refreshRecent();
    },
    onError: (error) => setNotice({ tone: 'error', text: `Could not replay: ${String(error)}` }),
  });
  const moderate = useMutation({
    mutationFn: (input: { id: string; decision: StreamAlertModerationDecision }) => streamAlertsApi.moderate(accountId, input.id, input.decision),
    onSuccess: (_result, input) => {
      queryClient.setQueryData<{ success: boolean; alerts: StreamAlert[] }>(recentKey, (old) => (old ? {
        ...old,
        alerts: old.alerts.map((alert) => (alert.id === input.id ? { ...alert, moderation: input.decision === 'approve' ? 'approved' : 'blocked' } : alert)),
      } : old));
      setNotice({ tone: 'ok', text: input.decision === 'approve' ? 'Approved. The alert shows in OBS now.' : 'Blocked. The alert will not show.' });
      refreshRecent();
    },
    onError: (error, input) => setNotice({ tone: 'error', text: `Could not ${input.decision} the alert: ${plainError(error)}` }),
  });
  /** Results of clearing the recent list, shown beside the list. */
  const [recentNotice, setRecentNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const clearRecent = useMutation({
    mutationFn: (scope: StreamAlertClearScope) => streamAlertsApi.clearRecent(accountId, scope),
    onSuccess: (result, scope) => {
      const removed = Number(result.removed) || 0;
      const what = scope === 'tests' ? 'test alert' : 'recent alert';
      setRecentNotice({
        tone: 'ok',
        text: removed === 0 ? 'Nothing to clear.' : `Cleared ${removed} ${what}${removed === 1 ? '' : 's'}.`,
      });
    },
    onError: (error, scope) => setRecentNotice({
      tone: 'error',
      text: `Could not clear the ${scope === 'tests' ? 'test alerts' : 'recent alerts'}: ${String(error)}`,
    }),
    onSettled: () => {
      setConfirmClearAll(false);
      refreshRecent();
    },
  });
  const runClear = (scope: StreamAlertClearScope) => {
    if (clearRecent.isPending) return;
    clearRecent.mutate(scope);
  };
  const previewAlert = async (alert: StreamAlert) => {
    const result = await preview.current?.play(alert.type, overlayOptions(alert, alert.test)) ?? 'loading';
    setNotice(result === 'played' ? null : { tone: 'error', text: previewProblem(result) ?? '' });
  };

  const alerts = recent.data?.alerts ?? [];
  const hasTestAlerts = alerts.some((alert) => alert.test || alert.sandbox);
  const twitchConnected = status.data?.twitch?.status === 'connected';
  const held = alerts.filter((alert) => alert.moderation === 'pending').length;

  return (
    <section className="stream-alerts stream-alerts__recent" aria-labelledby="stream-recent-title">
      <h3 id="stream-recent-title">Recent alerts</h3>
      <p className="text-muted">
        {account.legacy_overlay && (twitchConnected
          ? 'Donations, real Twitch alerts and test alerts, newest first. Channel point effects are not listed.'
          : 'Donations and test alerts that went through the API, newest first. Channel point effects are not listed. Follows, subs, bits and raids go from Twitch straight to the overlay, so they are not listed here until Twitch is connected under Connections.')}
        {!account.legacy_overlay && (twitchConnected
          ? 'Real Twitch alerts and test alerts sent from this page, newest first. Channel point effects are not listed. Real donations are not connected to a hosted link yet.'
          : 'Test alerts sent from this page, newest first. Real Twitch alerts appear here too once Twitch is connected. Channel point effects are not listed. Real donations are not connected to a hosted link yet.')}
      </p>
      {held > 0 && (
        <p className="stream-alerts__banner is-paused" role="status">
          <strong>{held === 1 ? '1 alert is' : `${held} alerts are`} waiting for you.</strong> Approve shows it in OBS now; Block drops it.
        </p>
      )}
      <div className="stream-alerts__recent-tools">
        <div className="stream-alerts__recent-buttons">
          <button type="button" disabled={clearRecent.isPending || !hasTestAlerts} onClick={() => runClear('tests')}>
            Clear test alerts
          </button>
          {confirmClearAll ? (
            <span className="stream-alerts__confirm" role="group" aria-label="Confirm clearing all recent alerts">
              <strong>Clear all recent alerts?</strong>
              <button type="button" className="is-on" disabled={clearRecent.isPending} onClick={() => runClear('all')}>
                {clearRecent.isPending ? 'Clearing…' : 'Yes, clear'}
              </button>
              <button type="button" disabled={clearRecent.isPending} onClick={() => setConfirmClearAll(false)}>Cancel</button>
            </span>
          ) : (
            <button
              type="button"
              disabled={clearRecent.isPending || alerts.length === 0}
              onClick={() => { setRecentNotice(null); setConfirmClearAll(true); }}
            >
              Clear recent alerts
            </button>
          )}
        </div>
        <p className="stream-alerts__hint">
          This only tidies this list. It does not change anything in OBS or Stripe. Cleared donations can no longer be replayed.
        </p>
        {recentNotice && (
          <p className={`stream-alerts__notice is-${recentNotice.tone}`} role={recentNotice.tone === 'error' ? 'alert' : 'status'}>
            {recentNotice.text}
          </p>
        )}
      </div>
      {notice && (
        <p className={`stream-alerts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>
      )}
      {recent.isLoading && <p className="text-muted">Loading…</p>}
      {recent.error && <p role="alert" className="stream-alerts__notice is-error">Could not load recent alerts: {String(recent.error)}</p>}
      {!recent.isLoading && !recent.error && alerts.length === 0 && <p className="text-muted">No alerts yet. Send one from the Test menu.</p>}
      {alerts.length > 0 && (
        <div className="stream-alerts__table">
          <table>
            <thead>
              <tr><th>When</th><th>Alert</th><th>Name</th><th>Detail</th><th>Message</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.cursor ?? alert.id} className={alert.moderation === 'pending' ? 'is-held' : ''}>
                  <td>{new Date(alert.created * 1000).toLocaleString()}</td>
                  <td>
                    {kindLabel(alert.type)}
                    {alert.test && <em>test</em>}
                    {alert.sandbox && <em>sandbox</em>}
                    {alert.replay_of && <em>replay</em>}
                    {alert.moderation && <em className={`is-${alert.moderation}`}>{MODERATION_TEXT[alert.moderation] ?? alert.moderation}</em>}
                  </td>
                  <td>{alert.name}</td>
                  <td>{describe(alert)}</td>
                  <td className="stream-alerts__message">{alert.message}</td>
                  <td className="stream-alerts__actions">
                    {alert.moderation === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="is-primary"
                          disabled={moderate.isPending}
                          aria-label={`Approve the ${kindLabel(alert.type).toLowerCase()} from ${alert.name}`}
                          onClick={() => moderate.mutate({ id: alert.id, decision: 'approve' })}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="is-on"
                          disabled={moderate.isPending}
                          aria-label={`Block the ${kindLabel(alert.type).toLowerCase()} from ${alert.name}`}
                          onClick={() => moderate.mutate({ id: alert.id, decision: 'block' })}
                        >
                          Block
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => previewAlert(alert)}>Preview</button>
                    <button type="button" disabled={replay.isPending} onClick={() => replay.mutate(alert.id)}>Replay in OBS</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
