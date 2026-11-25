import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  StreamAlert,
  StreamAlertClearScope,
  StreamAlertControlAction,
  StreamAlertSettings,
  StreamAlertStatus,
  StreamAlertTestInput,
  StreamAlertTier,
  StreamAlertType,
  StreamEffectInput,
  StreamEffectName,
} from '@/api/admin';
import './StreamAlertsPanel.css';

/** What the overlay page exposes on its window (stream-overlays/acosmic-kit/obs/effects/effects.html). */
interface OverlayWindow extends Window {
  AcosmicFX?: {
    fire: (name: string, options?: Record<string, unknown>) => boolean;
    /** Newer overlay copies only; an older preview copy may lack these. */
    skip?: () => boolean;
    stop?: () => void;
    clear?: () => number;
    stopEffects?: () => void;
    queue?: () => PreviewQueue;
  };
}

interface PreviewQueue {
  waiting: number;
  playing: string | null;
  paused: boolean;
  safe_mode: boolean;
  flood: boolean;
  dropped: number;
}

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

const FLOOD_COUNT = 200;
const FLOOD_MS = 3_000;
const FLOOD_WORDS = ['Pixel', 'Nova', 'Echo', 'Lumen', 'Static', 'Comet', 'Byte', 'Orbit', 'Drift', 'Ember', 'Quartz', 'Vapor'];
const FLOOD_TAILS = ['Fox', 'Wave', 'Runner', 'Moth', 'Knight', 'Cat', 'Shade', 'Loop', 'Spark', 'Bloom'];

function floodName(index: number): string {
  const word = FLOOD_WORDS[index % FLOOD_WORDS.length];
  const tail = FLOOD_TAILS[Math.floor(index / FLOOD_WORDS.length) % FLOOD_TAILS.length];
  return `${word}${tail}${(index * 37) % 1000}`;
}

function wholeNumber(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return number >= min && number <= max ? number : null;
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

const TIERS: { value: StreamAlertTier; label: string }[] = [
  { value: '1000', label: 'Tier 1' },
  { value: '2000', label: 'Tier 2' },
  { value: '3000', label: 'Tier 3' },
  { value: 'prime', label: 'Prime' },
];

const effectLabel = (effect: StreamEffectName) => REWARD_EFFECTS.find((item) => item.name === effect)?.label ?? effect;

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

export const StreamAlertsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [name, setName] = useState('Nova');
  const [message, setMessage] = useState('Love the stream, keep building.');
  const [numbers, setNumbers] = useState<Record<string, number>>(
    () => Object.fromEntries(ALERT_KINDS.filter((kind) => kind.number).map((kind) => [kind.type, kind.number!.initial])),
  );
  const [tier, setTier] = useState<StreamAlertTier>('1000');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  /** Results of the live controls, shown beside them rather than under the test list further down. */
  const [liveNotice, setLiveNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [minRaid, setMinRaid] = useState('');
  const [minCheer, setMinCheer] = useState('');
  const [thresholdsDirty, setThresholdsDirty] = useState(false);
  const [previewQueue, setPreviewQueue] = useState<PreviewQueue | null>(null);
  const [flooding, setFlooding] = useState(false);
  const floodTimer = useRef<number | null>(null);

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

  const overlayFX = useCallback(
    () => (frameRef.current?.contentWindow as OverlayWindow | null | undefined)?.AcosmicFX,
    [],
  );

  // Light poll of the preview overlay's queue. Hidden when the preview copy has no queue().
  useEffect(() => {
    const timer = window.setInterval(() => {
      try {
        const fx = overlayFX();
        setPreviewQueue(typeof fx?.queue === 'function' ? fx.queue() : null);
      } catch {
        setPreviewQueue(null);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [overlayFX]);

  useEffect(() => () => {
    if (floodTimer.current !== null) window.clearInterval(floodTimer.current);
  }, []);

  const settings = status.data?.settings ?? DEFAULT_SETTINGS;

  // Fill the threshold inputs from the saved settings until the owner starts editing them.
  useEffect(() => {
    if (thresholdsDirty) return;
    setMinRaid(String(settings.min_raid_viewers));
    setMinCheer(String(settings.min_cheer_bits));
  }, [settings.min_raid_viewers, settings.min_cheer_bits, thresholdsDirty]);

  const buildInput = useCallback((kind: AlertKind): StreamAlertTestInput => {
    const input: StreamAlertTestInput = { type: kind.type, name: name.trim() || undefined };
    if (kind.hasMessage && message.trim()) input.message = message.trim();
    if (kind.hasTier) input.tier = tier;
    const number = numbers[kind.type];
    if (kind.type === 'donation') input.amount_minor = Math.round((number || 0) * 100);
    else if (kind.number) input.value = Math.max(1, Math.round(number || 1));
    return input;
  }, [message, name, numbers, tier]);

  /** Cut whatever the preview is showing or playing, so the next thing starts on an empty stage. */
  const stopPreview = useCallback(() => {
    if (floodTimer.current !== null) {
      window.clearInterval(floodTimer.current);
      floodTimer.current = null;
      setFlooding(false);
    }
    try {
      const overlay = frameRef.current?.contentWindow as OverlayWindow | null | undefined;
      overlay?.AcosmicFX?.stop?.();
    } catch {
      /* an older preview copy without stop(); the new preview waits its turn as before */
    }
  }, []);

  const playInPreview = useCallback((effect: string, options: Record<string, unknown>) => {
    const overlay = frameRef.current?.contentWindow as OverlayWindow | null | undefined;
    if (!overlay?.AcosmicFX) {
      setNotice({ tone: 'error', text: 'The preview is still loading. Try again in a moment.' });
      return;
    }
    // A new preview replaces the last one instead of waiting behind it.
    stopPreview();
    overlay.AcosmicFX.fire(effect, options);
  }, [stopPreview]);

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

  const applySettings = (next: StreamAlertSettings) => {
    queryClient.setQueryData<StreamAlertStatus>(['admin', 'stream-alerts', 'status'], (old) => (old ? { ...old, settings: next } : old));
    queryClient.invalidateQueries({ queryKey: ['admin', 'stream-alerts', 'status'] });
  };

  const control = useMutation({
    mutationFn: (action: StreamAlertControlAction) => adminApi.sendStreamAlertControl(action),
    onSuccess: (result, action) => {
      if (result.settings) applySettings(result.settings);
      setLiveNotice({ tone: 'ok', text: CONTROL_TEXT[action].done });
    },
    onError: (error, action) => setLiveNotice({ tone: 'error', text: `Could not ${CONTROL_TEXT[action].verb}: ${String(error)}` }),
  });

  const runControl = (action: StreamAlertControlAction) => {
    if (control.isPending) return;
    // The preview mirrors skip, clear and stop effects only; it never pauses or hides alerts.
    try {
      const fx = overlayFX();
      if (action === 'skip') fx?.skip?.();
      if (action === 'clear') fx?.clear?.();
      if (action === 'stop_effects' && typeof fx?.stopEffects === 'function') fx.stopEffects();
    } catch {
      /* an older preview copy; the OBS part still runs */
    }
    control.mutate(action);
  };

  const saveThresholds = useMutation({
    mutationFn: (partial: { min_raid_viewers: number; min_cheer_bits: number }) => adminApi.updateStreamAlertSettings(partial),
    onSuccess: (result) => {
      setThresholdsDirty(false);
      if (result.settings) applySettings(result.settings);
      setLiveNotice({ tone: 'ok', text: 'Saved. OBS now uses the new smallest raid and cheer.' });
    },
    onError: (error) => setLiveNotice({ tone: 'error', text: `Could not save the limits: ${String(error)}` }),
  });

  const submitThresholds = (event: React.FormEvent) => {
    event.preventDefault();
    if (saveThresholds.isPending) return;
    const raid = wholeNumber(minRaid, 1, 100_000);
    const cheer = wholeNumber(minCheer, 1, 1_000_000);
    if (raid === null) return setLiveNotice({ tone: 'error', text: 'Smallest raid must be a whole number from 1 to 100000.' });
    if (cheer === null) return setLiveNotice({ tone: 'error', text: 'Smallest cheer must be a whole number from 1 to 1000000.' });
    saveThresholds.mutate({ min_raid_viewers: raid, min_cheer_bits: cheer });
  };

  const previewFollowFlood = () => {
    if (flooding) return;
    if (!overlayFX()) {
      setNotice({ tone: 'error', text: 'The preview is still loading. Try again in a moment.' });
      return;
    }
    stopPreview();
    setFlooding(true);
    let sent = 0;
    floodTimer.current = window.setInterval(() => {
      const fx = overlayFX();
      // Send a few per tick so ~200 land in about three seconds.
      for (let i = 0; i < 4 && sent < FLOOD_COUNT; i += 1, sent += 1) {
        fx?.fire('follow', { user: floodName(sent), test: true });
      }
      if (sent >= FLOOD_COUNT && floodTimer.current !== null) {
        window.clearInterval(floodTimer.current);
        floodTimer.current = null;
        setFlooding(false);
      }
    }, Math.round(FLOOD_MS / (FLOOD_COUNT / 4)));
  };

  const refreshRecent = () => queryClient.invalidateQueries({ queryKey: ['admin', 'stream-alerts', 'recent'] });

  const fireEffect = useMutation({
    mutationFn: (input: StreamEffectInput) => adminApi.fireStreamEffect(input),
    onSuccess: (_result, input) => setNotice({ tone: 'ok', text: `Sent ${effectLabel(input.effect)} to OBS.` }),
    onError: (error, input) => setNotice({ tone: 'error', text: `Could not send ${effectLabel(input.effect)}: ${String(error)}` }),
  });
  const sendEffect = (effect: RewardEffect) => {
    if (fireEffect.isPending) return;
    fireEffect.mutate({ effect: effect.name, name: name.trim() || undefined, message: message.trim() || undefined });
  };
  const previewEffect = (effect: RewardEffect) => playInPreview(effect.name, { user: name.trim() || 'Test Viewer', text: message.trim() });

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
  /** Results of clearing the recent list, shown beside the list. */
  const [recentNotice, setRecentNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const clearRecent = useMutation({
    mutationFn: (scope: StreamAlertClearScope) => adminApi.clearRecentStreamAlerts(scope),
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

  const lastSeen = status.data?.overlay_last_seen ?? null;
  const secondsSinceSeen = lastSeen === null ? null : Math.max(0, Math.round(now / 1000 - lastSeen));
  const overlayConnected = secondsSinceSeen !== null && secondsSinceSeen <= OVERLAY_CONNECTED_WINDOW_SECONDS;
  const alerts = recent.data?.alerts ?? [];
  const obsReady = Boolean(status.data?.configured && status.data?.available);
  const liveDisabled = control.isPending || !obsReady;
  const hasTestAlerts = alerts.some((alert) => alert.test || alert.sandbox);

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

      <section className="stream-alerts__live" aria-label="Live controls">
        <div className="stream-alerts__live-head">
          <h3>Live controls</h3>
          <p>These act on the overlay in OBS right now.{!obsReady && status.data && ' They are off because alerts cannot reach OBS at the moment.'}</p>
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
        <div className="stream-alerts__live-buttons">
          <button type="button" className="stream-alerts__skip" disabled={liveDisabled} onClick={() => runControl('skip')}>
            Skip current alert
          </button>
          <button
            type="button"
            title="Ends a running channel point effect, such as Flood. Alert cards stay."
            disabled={liveDisabled}
            onClick={() => runControl('stop_effects')}
          >
            Stop effects
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
          <button type="button" disabled={liveDisabled} onClick={() => runControl('clear')}>
            Clear waiting alerts
          </button>
          <button
            type="button"
            className={settings.safe_mode ? 'is-on' : ''}
            aria-pressed={settings.safe_mode}
            disabled={liveDisabled}
            onClick={() => runControl(settings.safe_mode ? 'safe_mode_off' : 'safe_mode_on')}
          >
            {settings.safe_mode ? 'Safe Mode: on (turn off)' : 'Safe Mode: off (turn on)'}
          </button>
        </div>
        <p className="stream-alerts__hint stream-alerts__live-hint">
          Skip ends the alert card on screen. Stop effects ends a channel point effect, such as Flood, and leaves alert cards alone.
        </p>
        <form className="stream-alerts__thresholds" onSubmit={submitThresholds}>
          <label>
            <span>Smallest raid to show (viewers)</span>
            <input
              className="form-control"
              type="number"
              inputMode="numeric"
              min={1}
              max={100000}
              step={1}
              value={minRaid}
              onChange={(event) => { setThresholdsDirty(true); setMinRaid(event.target.value); }}
            />
          </label>
          <label>
            <span>Smallest cheer to show (bits)</span>
            <input
              className="form-control"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000000}
              step={1}
              value={minCheer}
              onChange={(event) => { setThresholdsDirty(true); setMinCheer(event.target.value); }}
            />
          </label>
          <button type="submit" disabled={saveThresholds.isPending || !obsReady}>Save limits</button>
        </form>
        {liveNotice && (
          <p className={`stream-alerts__notice is-${liveNotice.tone}`} role="status">{liveNotice.text}</p>
        )}
      </section>

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
          {previewQueue && (
            <p className="stream-alerts__queue" aria-live="off">
              Preview queue: {previewQueue.waiting} waiting{previewQueue.flood ? ' · counting follows only' : ''}
              {previewQueue.flood && previewQueue.waiting > 0 && !previewQueue.playing
                ? '. During a flood, follow cards stay ten seconds apart, so the next one shows shortly.'
                : ''}
            </p>
          )}
          <p className="stream-alerts__hint">
            The preview ignores Safe Mode, pause and the smallest raid and cheer, so it always shows the card.
          </p>
          <p className="stream-alerts__hint">
            "Preview" plays here only, with sound, and cuts off the preview before it. For alerts, "Send to OBS" goes through the same path a real donation takes and shows a TEST tag on stream. Channel point effects sent to OBS play right away, with no TEST tag.
          </p>
          <div className="stream-alerts__rewards">
            <span>More preview tools</span>
            <button type="button" disabled={flooding} onClick={previewFollowFlood}>
              {flooding ? 'Sending follows…' : 'Preview a follow flood'}
            </button>
            <button type="button" onClick={stopPreview}>Stop preview</button>
          </div>
        </section>

        <section className="stream-alerts__controls" aria-label="Test alerts and effects">
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

          <div className="stream-alerts__lists">
          <div className="stream-alerts__list">
          <h3 className="stream-alerts__list-head">Alerts</h3>
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
          </div>

          <div className="stream-alerts__list">
          <h3 className="stream-alerts__list-head">Channel point effects</h3>
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
          </div>
          </div>
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
          Donations and test alerts that went through the API, newest first. Channel point effects are not listed. Follows, subs, bits and raids go from Twitch straight to the overlay, so they are not listed here yet.
        </p>
        <div className="stream-alerts__recent-tools">
          <div className="stream-alerts__recent-buttons">
            <button
              type="button"
              disabled={clearRecent.isPending || !hasTestAlerts}
              onClick={() => runClear('tests')}
            >
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
