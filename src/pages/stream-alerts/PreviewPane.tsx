import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PreviewConfig } from '@/utils/streamAlertBox';
import type { PreviewHandle, PreviewResult } from './previewHandle';
import './StreamAlertsPanel.css';

/** What the overlay page exposes on its window (stream-overlays/acosmic-kit/obs/effects/effects.html). */
interface OverlayFX {
  fire: (name: string, options?: Record<string, unknown>) => boolean;
  /** Newer overlay copies only; an older preview copy may lack these. */
  skip?: () => boolean;
  stop?: () => void;
  clear?: () => number;
  stopEffects?: () => void;
  queue?: () => PreviewQueue;
  /** Phase 4 copies: custom designs only. */
  applyDesigns?: (designs: PreviewConfig['designs']) => unknown;
  /** Phase 5 copies: designs, alerts and general settings. Resolves once their media has loaded or failed. */
  applyConfig?: (config: PreviewConfig) => unknown;
}

interface PreviewQueue {
  waiting: number;
  playing: string | null;
  paused: boolean;
  safe_mode: boolean;
  flood: boolean;
  dropped: number;
  /** Phase 5 copies: alerts waiting for moderation. */
  held?: number;
}

const FLOOD_COUNT = 200;
const FLOOD_MS = 3_000;
const FLOOD_WORDS = ['Pixel', 'Nova', 'Echo', 'Lumen', 'Static', 'Comet', 'Byte', 'Orbit', 'Drift', 'Ember', 'Quartz', 'Vapor'];
const FLOOD_TAILS = ['Fox', 'Wave', 'Runner', 'Moth', 'Knight', 'Cat', 'Shade', 'Loop', 'Spark', 'Bloom'];

function floodName(index: number): string {
  const word = FLOOD_WORDS[index % FLOOD_WORDS.length];
  const tail = FLOOD_TAILS[Math.floor(index / FLOOD_WORDS.length) % FLOOD_TAILS.length];
  return `${word}${tail}${(index * 37) % 1000}`;
}

export const PREVIEW_BACKGROUNDS = ['#0d1622', '#00b140', '#ffffff', '#000000'];

/**
 * The preview of the stream: the hosted overlay in a frame, run offline (it connects to
 * nothing), over a background colour of the streamer's choice. The rest of the page plays
 * things in it through `handleRef`.
 */
export const PreviewPane: React.FC<{
  /** The saved settings the frame keeps between previews. */
  savedConfig: PreviewConfig | null;
  handleRef: React.MutableRefObject<PreviewHandle | null>;
  background: string;
  onBackground: (colour: string) => void;
  /** Buttons and notes under the preview. */
  children?: React.ReactNode;
  tools?: boolean;
}> = ({ savedConfig, handleRef, background, onBackground, children, tools = true }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const saved = useRef<PreviewConfig | null>(savedConfig);
  /** True after a preview put unsaved settings in the frame; the next plain preview puts the saved ones back. */
  const draftInFrame = useRef(false);
  const [queue, setQueue] = useState<PreviewQueue | null>(null);
  const [flooding, setFlooding] = useState(false);
  const floodTimer = useRef<number | null>(null);

  const overlayFX = useCallback(
    () => (frameRef.current?.contentWindow as (Window & { AcosmicFX?: OverlayFX }) | null | undefined)?.AcosmicFX,
    [],
  );

  /** Puts the saved settings into the preview frame, as much as its overlay copy can take. */
  const applySaved = useCallback(async () => {
    const fx = overlayFX();
    const config = saved.current;
    if (!fx || !config) return;
    try {
      if (typeof fx.applyConfig === 'function') await fx.applyConfig(config);
      else if (typeof fx.applyDesigns === 'function') await fx.applyDesigns(config.designs);
      draftInFrame.current = false;
    } catch {
      /* the preview falls back to the built-in cards */
    }
  }, [overlayFX]);

  useEffect(() => {
    saved.current = savedConfig;
    if (!draftInFrame.current) void applySaved();
  }, [savedConfig, applySaved]);

  // Light poll of the preview overlay's queue. Hidden when the preview copy has no queue().
  useEffect(() => {
    const timer = window.setInterval(() => {
      try {
        const fx = overlayFX();
        setQueue(typeof fx?.queue === 'function' ? fx.queue() : null);
      } catch {
        setQueue(null);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [overlayFX]);

  const stopFlood = () => {
    if (floodTimer.current !== null) {
      window.clearInterval(floodTimer.current);
      floodTimer.current = null;
      setFlooding(false);
    }
  };
  useEffect(() => () => { if (floodTimer.current !== null) window.clearInterval(floodTimer.current); }, []);

  /** Cut whatever the preview is showing or playing, so the next thing starts on an empty stage. */
  const stopPreview = useCallback(() => {
    stopFlood();
    try {
      overlayFX()?.stop?.();
    } catch {
      /* an older preview copy without stop(); the new preview waits its turn as before */
    }
  }, [overlayFX]);

  useEffect(() => {
    handleRef.current = {
      play: async (name, options): Promise<PreviewResult> => {
        const fx = overlayFX();
        if (!fx) return 'loading';
        // After a preview of unsaved settings, the alerts here show the saved ones again.
        if (draftInFrame.current) await applySaved();
        // A new preview replaces the last one instead of waiting behind it.
        stopPreview();
        try {
          fx.fire(name, options);
        } catch {
          return 'failed';
        }
        return 'played';
      },
      playDraft: async (config, kind, options): Promise<PreviewResult> => {
        const fx = overlayFX();
        if (!fx) return 'loading';
        if (typeof fx.applyConfig !== 'function') return 'unsupported';
        stopPreview();
        try {
          await fx.applyConfig(config);
          draftInFrame.current = true;
          fx.fire(kind, options);
        } catch {
          return 'failed';
        }
        return 'played';
      },
      stop: stopPreview,
      mirror: (action) => {
        // The preview mirrors skip, clear and stop effects only; it never pauses or hides alerts.
        try {
          const fx = overlayFX();
          if (action === 'skip') fx?.skip?.();
          if (action === 'clear') fx?.clear?.();
          if (action === 'stop_effects' && typeof fx?.stopEffects === 'function') fx.stopEffects();
        } catch {
          /* an older preview copy; the OBS part still runs */
        }
      },
    };
    return () => { handleRef.current = null; };
  }, [applySaved, handleRef, overlayFX, stopPreview]);

  const previewFollowFlood = () => {
    if (flooding || !overlayFX()) return;
    stopPreview();
    setFlooding(true);
    let sent = 0;
    floodTimer.current = window.setInterval(() => {
      const fx = overlayFX();
      // Send a few per tick so ~200 land in about three seconds.
      for (let i = 0; i < 4 && sent < FLOOD_COUNT; i += 1, sent += 1) {
        fx?.fire('follow', { user: floodName(sent), test: true });
      }
      if (sent >= FLOOD_COUNT) stopFlood();
    }, Math.round(FLOOD_MS / (FLOOD_COUNT / 4)));
  };

  return (
    <section className="stream-alerts stream-box__preview" aria-label="Overlay preview">
      <div className="stream-alerts__screen" style={{ '--preview-bg': background } as React.CSSProperties}>
        <span className="stream-alerts__scene-label">Preview of your stream (1920 × 1080)</span>
        <span className="stream-alerts__cam">Camera</span>
        <iframe
          ref={frameRef}
          title="Stream overlay preview"
          src="/stream-overlay/effects.html?offline=1"
          onLoad={() => { draftInFrame.current = false; void applySaved(); }}
        />
      </div>
      <div className="stream-box__bg" role="group" aria-label="Preview background colour">
        <span>Background</span>
        {PREVIEW_BACKGROUNDS.map((colour) => (
          <button
            key={colour}
            type="button"
            className="stream-box__swatch"
            style={{ background: colour }}
            aria-pressed={background === colour}
            aria-label={`Background ${colour}`}
            onClick={() => onBackground(colour)}
          />
        ))}
        <label className="stream-box__swatch-pick">
          <span className="visually-hidden">Pick any background colour</span>
          <input type="color" value={background} onChange={(event) => onBackground(event.target.value)} />
        </label>
      </div>
      {queue && (
        <p className="stream-alerts__queue" aria-live="off">
          Preview queue: {queue.waiting} waiting{typeof queue.held === 'number' && queue.held > 0 ? `, ${queue.held} held` : ''}{queue.flood ? ' · counting follows only' : ''}
        </p>
      )}
      {children}
      {tools && (
        <div className="stream-alerts__rewards">
          <span>More preview tools</span>
          <button type="button" disabled={flooding} onClick={previewFollowFlood}>
            {flooding ? 'Sending follows…' : 'Preview a follow flood'}
          </button>
          <button type="button" onClick={stopPreview}>Stop preview</button>
        </div>
      )}
      <p className="stream-alerts__hint">
        The preview ignores Safe Mode, pause, minimums and moderation, so it always shows the card.
      </p>
    </section>
  );
};
