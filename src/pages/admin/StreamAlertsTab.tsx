import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, StreamAlert, StreamAlertTestInput, StreamAlertTier, StreamAlertType } from '@/api/admin';
import './StreamAlertsTab.css';

/** What the overlay page exposes on its window (stream-overlays/acosmic-kit/obs/effects/effects.html). */
interface OverlayWindow extends Window {
  AcosmicFX?: { fire: (name: string, options?: Record<string, unknown>) => boolean };
}

interface AlertKind {
  type: StreamAlertType;
  label: string;
  source: string;
  accent: string;
  /** Label and default for the kind's number; donations use dollars instead. */
  number?: { label: string; initial: number };
  hasTier?: boolean;
  hasMessage?: boolean;
}

const ALERT_KINDS: AlertKind[] = [
  { type: 'donation', label: 'Donation', source: 'Stripe', accent: '#22d3ee', number: { label: 'Dollars', initial: 5 }, hasMessage: true },
  { type: 'follow', label: 'Follow', source: 'Twitch', accent: '#22d3ee' },
  { type: 'sub', label: 'New sub', source: 'Twitch', accent: '#a78bfa', hasTier: true },
  { type: 'resub', label: 'Resub', source: 'Twitch', accent: '#a78bfa', number: { label: 'Months', initial: 14 }, hasTier: true, hasMessage: true },
  { type: 'gift', label: 'Gift subs', source: 'Twitch', accent: '#f472b6', number: { label: 'Subs', initial: 5 }, hasTier: true },
  { type: 'cheer', label: 'Cheer', source: 'Twitch', accent: '#fbbf24', number: { label: 'Bits', initial: 500 }, hasMessage: true },
  { type: 'raid', label: 'Raid', source: 'Twitch', accent: '#fb7185', number: { label: 'Raiders', initial: 42 } },
  { type: 'hypetrain', label: 'Hype train', source: 'Twitch', accent: '#4ade80', number: { label: 'Level', initial: 2 } },
];

/** Channel point effects already on the overlay. They only run in the preview from here. */
const REWARD_EFFECTS = [
  { name: 'boop', label: 'Boop' },
  { name: 'meteor', label: 'Meteor Shower' },
  { name: 'news', label: 'Breaking News' },
  { name: 'blackout', label: 'Blackout' },
  { name: 'flood', label: 'Flood' },
  { name: 'rewind', label: 'Instant Replay tag' },
];

const TIERS: { value: StreamAlertTier; label: string }[] = [
  { value: '1000', label: 'Tier 1' },
  { value: '2000', label: 'Tier 2' },
  { value: '3000', label: 'Tier 3' },
  { value: 'prime', label: 'Prime' },
];

const KIND_BY_TYPE = new Map(ALERT_KINDS.map((kind) => [kind.type, kind]));
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

export const StreamAlertsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [name, setName] = useState('Nova');
  const [message, setMessage] = useState('Love the stream, keep building.');
  const [numbers, setNumbers] = useState<Record<string, number>>(
    () => Object.fromEntries(ALERT_KINDS.filter((kind) => kind.number).map((kind) => [kind.type, kind.number!.initial])),
  );
  const [tier, setTier] = useState<StreamAlertTier>('1000');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const status = useQuery({
    queryKey: ['admin', 'stream-alerts', 'status'],
    queryFn: () => adminApi.getStreamAlertStatus(),
    refetchInterval: 10_000,
  });
  const recent = useQuery({
    queryKey: ['admin', 'stream-alerts', 'recent'],
    queryFn: () => adminApi.getRecentStreamAlerts(30),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const buildInput = useCallback((kind: AlertKind): StreamAlertTestInput => {
    const input: StreamAlertTestInput = { type: kind.type, name: name.trim() || undefined };
    if (kind.hasMessage && message.trim()) input.message = message.trim();
    if (kind.hasTier) input.tier = tier;
    const number = numbers[kind.type];
    if (kind.type === 'donation') input.amount_minor = Math.round((number || 0) * 100);
    else if (kind.number) input.value = Math.max(1, Math.round(number || 1));
    return input;
  }, [message, name, numbers, tier]);

  const playInPreview = useCallback((effect: string, options: Record<string, unknown>) => {
    const overlay = frameRef.current?.contentWindow as OverlayWindow | null | undefined;
    if (!overlay?.AcosmicFX) {
      setNotice({ tone: 'error', text: 'The preview is still loading. Try again in a moment.' });
      return;
    }
    overlay.AcosmicFX.fire(effect, options);
  }, []);

  const previewKind = (kind: AlertKind) => {
    const input = buildInput(kind);
    playInPreview(kind.type, overlayOptions({
      name: input.name ?? 'Test Viewer',
      message: input.message ?? '',
      value: input.value,
      tier: input.tier,
      amount_display: input.amount_minor === undefined ? undefined : `$${(input.amount_minor / 100).toFixed(2)}`,
    }, true));
  };

  const refreshRecent = () => queryClient.invalidateQueries({ queryKey: ['admin', 'stream-alerts', 'recent'] });

  const fire = useMutation({
    mutationFn: (input: StreamAlertTestInput) => adminApi.fireStreamAlert(input),
    onSuccess: (result) => {
      setNotice({ tone: 'ok', text: `Sent a test ${KIND_BY_TYPE.get(result.alert.type)?.label.toLowerCase() ?? 'alert'} to the overlay.` });
      refreshRecent();
    },
    onError: (error) => setNotice({ tone: 'error', text: `Could not send: ${String(error)}` }),
  });
  const replay = useMutation({
    mutationFn: (id: string) => adminApi.replayStreamAlert(id),
    onSuccess: () => {
      setNotice({ tone: 'ok', text: 'Replayed on the overlay.' });
      refreshRecent();
    },
    onError: (error) => setNotice({ tone: 'error', text: `Could not replay: ${String(error)}` }),
  });

  const lastSeen = status.data?.overlay_last_seen ?? null;
  const secondsSinceSeen = lastSeen === null ? null : Math.max(0, Math.round(now / 1000 - lastSeen));
  const overlayConnected = secondsSinceSeen !== null && secondsSinceSeen <= OVERLAY_CONNECTED_WINDOW_SECONDS;
  const alerts = recent.data?.alerts ?? [];

  return (
    <div className="stream-alerts">
      <header className="stream-alerts__status" aria-live="polite">
        <span className={`stream-alerts__light ${overlayConnected ? 'is-on' : ''}`} aria-hidden="true" />
        <div>
          <strong>{overlayConnected ? 'OBS overlay connected' : 'OBS overlay not connected'}</strong>
          <p>
            {status.isLoading && 'Checking the overlay…'}
            {status.error && `Could not read the status: ${String(status.error)}`}
            {status.data && !status.data.configured && 'The API has no overlay key set, so alerts cannot reach OBS.'}
            {status.data?.configured && overlayConnected && 'The overlay in OBS is listening. "Send to OBS" will play on stream.'}
            {status.data?.configured && !overlayConnected && 'Nothing has asked for alerts in the last minute. Open OBS, or refresh the "Acosmic Effects" source.'}
          </p>
        </div>
      </header>

      <div className="stream-alerts__layout">
        <section className="stream-alerts__stage" aria-label="Overlay preview">
          <div className="stream-alerts__screen">
            <span className="stream-alerts__scene-label">Preview of your stream (1920 × 1080)</span>
            <span className="stream-alerts__cam">Camera</span>
            <iframe
              ref={frameRef}
              title="Stream overlay preview"
              src="/stream-overlay/effects.html?offline=1"
            />
          </div>
          <p className="stream-alerts__hint">
            "Preview" plays here only, with sound. "Send to OBS" goes through the same path a real donation takes and shows a TEST tag on stream.
          </p>
          <div className="stream-alerts__rewards">
            <span>Channel point effects (preview only)</span>
            {REWARD_EFFECTS.map((effect) => (
              <button
                key={effect.name}
                type="button"
                onClick={() => playInPreview(effect.name, { user: name.trim() || 'Test Viewer', text: message.trim() })}
              >
                {effect.label}
              </button>
            ))}
          </div>
        </section>

        <section className="stream-alerts__controls" aria-label="Test alerts">
          <div className="stream-alerts__shared">
            <label>
              <span>Name</span>
              <input className="form-control" value={name} maxLength={32} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>Sub tier</span>
              <select className="form-control" value={tier} onChange={(event) => setTier(event.target.value as StreamAlertTier)}>
                {TIERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="is-wide">
              <span>Message</span>
              <input className="form-control" value={message} maxLength={200} onChange={(event) => setMessage(event.target.value)} />
            </label>
          </div>

          <ul className="stream-alerts__kinds">
            {ALERT_KINDS.map((kind) => (
              <li key={kind.type} style={{ '--alert-accent': kind.accent } as React.CSSProperties}>
                <div className="stream-alerts__kind-name">
                  <strong>{kind.label}</strong>
                  <span>{kind.source}{kind.hasMessage ? ' · message' : ''}{kind.hasTier ? ' · tier' : ''}</span>
                </div>
                {kind.number ? (
                  <label className="stream-alerts__number">
                    <span>{kind.number.label}</span>
                    <input
                      className="form-control"
                      type="number"
                      min={kind.type === 'donation' ? 0 : 1}
                      step={kind.type === 'donation' ? 0.01 : 1}
                      value={numbers[kind.type] ?? kind.number.initial}
                      onChange={(event) => setNumbers({ ...numbers, [kind.type]: Number(event.target.value) })}
                    />
                  </label>
                ) : <span className="stream-alerts__number" />}
                <div className="stream-alerts__actions">
                  <button type="button" onClick={() => previewKind(kind)}>Preview</button>
                  <button
                    type="button"
                    className="is-primary"
                    disabled={fire.isPending || !status.data?.configured}
                    onClick={() => fire.mutate(buildInput(kind))}
                  >
                    Send to OBS
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {notice && (
            <p className={`stream-alerts__notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
              {notice.text}
            </p>
          )}
        </section>
      </div>

      <section className="stream-alerts__recent" aria-label="Recent alerts">
        <h3>Recent alerts</h3>
        <p className="text-muted">
          Donations and tests that went through the API, newest first. Follows, subs, bits and raids go from Twitch straight to the overlay, so they are not listed here yet.
        </p>
        {recent.isLoading && <p className="text-muted">Loading…</p>}
        {recent.error && <p role="alert" className="stream-alerts__notice is-error">Could not load recent alerts: {String(recent.error)}</p>}
        {!recent.isLoading && !recent.error && alerts.length === 0 && <p className="text-muted">No alerts yet. Send a test above.</p>}
        {alerts.length > 0 && (
          <div className="stream-alerts__table">
            <table>
              <thead>
                <tr><th>When</th><th>Alert</th><th>Name</th><th>Detail</th><th>Message</th><th><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.cursor ?? alert.id}>
                    <td>{new Date(alert.created * 1000).toLocaleString()}</td>
                    <td>
                      {KIND_BY_TYPE.get(alert.type)?.label ?? alert.type}
                      {alert.test && <em>test</em>}
                      {alert.sandbox && <em>sandbox</em>}
                      {alert.replay_of && <em>replay</em>}
                    </td>
                    <td>{alert.name}</td>
                    <td>{describe(alert)}</td>
                    <td className="stream-alerts__message">{alert.message}</td>
                    <td className="stream-alerts__actions">
                      <button type="button" onClick={() => playInPreview(alert.type, overlayOptions(alert, alert.test))}>Preview</button>
                      <button type="button" disabled={replay.isPending} onClick={() => replay.mutate(alert.id)}>Replay in OBS</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
