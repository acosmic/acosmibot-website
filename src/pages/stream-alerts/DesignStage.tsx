import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StreamAlertAsset, StreamAlertDesign, StreamAlertDesignText } from '@/api/streamAlerts';
import {
  arrowStep,
  boxVisibleAt,
  fillTemplate,
  fontCss,
  formatLength,
  mediaRect,
  moveBox,
  moveMedia,
  resizeBox,
  screenToBoxFraction,
  screenToStage,
  shrinkToFit,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  stageScaleFor,
  timelinePercent,
} from '@/utils/streamAlertDesigns';

/** One colour per text box, used on the stage outline and its timeline markers. */
export const BOX_COLOURS = ['#22d3ee', '#f472b6', '#fbbf24', '#4ade80'];

type Zoom = 'fit' | 0.5 | 1;
const ZOOMS: { value: Zoom; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: 0.5, label: '50%' },
  { value: 1, label: '100%' },
];

type Drag = { what: 'media' | 'move' | 'resize'; index: number; pointerId: number; startX: number; startY: number; start: StreamAlertDesign };

/** The text of one box, in the box's font, made smaller until it fits when the box says so. */
const BoxText: React.FC<{ text: StreamAlertDesignText; content: string; scale: number; fontsVersion: number }> = ({ text, content, scale, fontsVersion }) => {
  const ref = useRef<HTMLDivElement>(null);
  const base = text.size * scale;
  useLayoutEffect(() => {
    const element = ref.current;
    const box = element?.parentElement;
    if (!element || !box) return;
    if (text.fit !== 'shrink') {
      element.style.fontSize = `${base}px`;
      return;
    }
    const fits = (size: number) => {
      element.style.fontSize = `${size}px`;
      return element.scrollWidth <= element.clientWidth + 1 && element.offsetHeight <= box.clientHeight + 1;
    };
    element.style.fontSize = `${shrinkToFit(base, fits, 4)}px`;
  }, [base, content, text.fit, text.font, text.weight, text.italic, text.w, text.h, fontsVersion]);

  return (
    <div
      ref={ref}
      className="stream-stage__text"
      style={{
        fontFamily: fontCss(text.font),
        fontWeight: text.weight,
        fontStyle: text.italic ? 'italic' : 'normal',
        color: text.color,
        textAlign: text.align,
        textShadow: text.shadow ? `0 ${2 * scale}px ${8 * scale}px rgba(0, 0, 0, 0.75)` : 'none',
      }}
    >
      {content}
    </div>
  );
};

/**
 * The 1920x1080 screen scaled to fit, with the alert's media placed on it and its text boxes
 * drawn over the media, plus the timeline under it. Everything here is in stage pixels; the
 * whole screen is drawn at full size and scaled down, so text wraps as it will in OBS.
 */
export const DesignStage: React.FC<{
  design: StreamAlertDesign;
  /** The video or picture the design uses, when it is ready. */
  media: StreamAlertAsset | null;
  /** How long the alert lasts, in ms. */
  length: number;
  time: number;
  onTime: (ms: number) => void;
  /** Sample text for each variable. */
  values: Record<string, string>;
  selected: number | null;
  onSelect: (index: number | null) => void;
  onChange: (next: StreamAlertDesign) => void;
  fontsVersion: number;
}> = ({ design, media, length, time, onTime, values, selected, onSelect, onChange, fontsVersion }) => {
  const outer = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const drag = useRef<Drag | null>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [playing, setPlaying] = useState(false);
  const clock = useRef<{ frame: number | null; startedAt: number; from: number }>({ frame: null, startedAt: 0, from: 0 });

  useLayoutEffect(() => {
    const element = outer.current;
    if (!element) return undefined;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = zoom === 'fit' ? stageScaleFor(width) : zoom;
  const rect = mediaRect(design, media);
  const isVideo = media?.kind === 'video';

  // Zoomed in, the stage box shows the alert rather than the top left corner of the screen.
  useLayoutEffect(() => {
    const element = outer.current;
    if (!element || zoom === 'fit') return;
    element.scrollLeft = Math.max(0, (rect.left + rect.width / 2) * scale - element.clientWidth / 2);
    element.scrollTop = Math.max(0, (rect.top + rect.height / 2) * scale - element.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // The stage shows the real video frame at the scrubber's time.
  useEffect(() => {
    const element = video.current;
    if (!element || playing) return;
    const target = time / 1000;
    if (Math.abs(element.currentTime - target) > 0.02) {
      try { element.currentTime = target; } catch { /* not seekable yet */ }
    }
  }, [time, playing, media?.url]);

  const stopClock = useCallback(() => {
    if (clock.current.frame !== null) cancelAnimationFrame(clock.current.frame);
    clock.current.frame = null;
  }, []);
  useEffect(() => () => stopClock(), [stopClock]);
  useEffect(() => { stopClock(); setPlaying(false); video.current?.pause(); }, [media?.url, stopClock]);

  const play = () => {
    const from = time >= length ? 0 : time;
    clock.current = { frame: null, startedAt: performance.now(), from };
    setPlaying(true);
    if (isVideo && video.current) {
      const element = video.current;
      element.currentTime = from / 1000;
      element.play().catch(() => setPlaying(false));
      const tick = () => {
        onTime(Math.min(length, Math.round(element.currentTime * 1000)));
        if (element.ended || element.paused) { setPlaying(false); clock.current.frame = null; return; }
        clock.current.frame = requestAnimationFrame(tick);
      };
      clock.current.frame = requestAnimationFrame(tick);
      return;
    }
    const tick = () => {
      const now = Math.min(length, clock.current.from + (performance.now() - clock.current.startedAt));
      onTime(Math.round(now));
      if (now >= length) { setPlaying(false); clock.current.frame = null; return; }
      clock.current.frame = requestAnimationFrame(tick);
    };
    clock.current.frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    stopClock();
    video.current?.pause();
    setPlaying(false);
  };

  const startDrag = (event: React.PointerEvent, what: Drag['what'], index = -1) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    if (what !== 'media') onSelect(index);
    drag.current = { what, index, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, start: design };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (current.what === 'media') {
      const next = moveMedia(current.start, screenToStage(dx, scale), screenToStage(dy, scale));
      onChange({ ...current.start, ...next });
      return;
    }
    const startBox = current.start.texts[current.index];
    if (!startBox) return;
    const fraction = screenToBoxFraction(dx, dy, scale, mediaRect(current.start, media));
    const box = current.what === 'move' ? moveBox(startBox, fraction.dx, fraction.dy) : resizeBox(startBox, fraction.dx, fraction.dy);
    onChange({ ...current.start, texts: current.start.texts.map((item, index) => (index === current.index ? box : item)) });
  };
  const endDrag = (event: React.PointerEvent) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  const keyMedia = (event: React.KeyboardEvent) => {
    const step = arrowStep(event.key, event.shiftKey, event.altKey);
    if (!step) return;
    event.preventDefault();
    onChange({ ...design, ...moveMedia(design, step.dx, step.dy) });
  };
  const keyBox = (event: React.KeyboardEvent, index: number, what: 'move' | 'resize') => {
    if (event.key === 'Escape') { onSelect(null); return; }
    const step = arrowStep(event.key, event.shiftKey, false);
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    // 10 px steps become 1% of the media; Shift makes them 5%.
    const dx = step.dx / 1000;
    const dy = step.dy / 1000;
    const box = design.texts[index];
    const next = what === 'move' ? moveBox(box, dx, dy) : resizeBox(box, dx, dy);
    onChange({ ...design, texts: design.texts.map((item, i) => (i === index ? next : item)) });
  };

  const markers = design.texts.flatMap((text, index) => [
    { key: `a${index}`, index, ms: text.appear_ms, kind: 'appear' as const },
    ...(text.disappear_ms === null ? [] : [{ key: `d${index}`, index, ms: text.disappear_ms, kind: 'disappear' as const }]),
  ]);

  return (
    <div className="stream-stage">
      <div className="stream-stage__tools">
        <span id="stream-stage-zoom-label">Zoom</span>
        <div className="stream-stage__zoom" role="group" aria-labelledby="stream-stage-zoom-label">
          {ZOOMS.map((item) => (
            <button key={String(item.value)} type="button" aria-pressed={zoom === item.value} className={zoom === item.value ? 'is-current' : ''} onClick={() => setZoom(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="stream-stage__outer" ref={outer}>
        <div className="stream-stage__sizer" style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}>
          <div
            className="stream-stage__world"
            style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})`, '--stage-scale': scale || 1 } as React.CSSProperties}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerDown={(event) => { if (event.target === event.currentTarget) onSelect(null); }}
          >
            <span className="stream-stage__label">Your stream (1920 × 1080)</span>
            {media?.url ? (
              <div
                className="stream-stage__media"
                style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                tabIndex={0}
                role="group"
                aria-label={`The alert, centred at ${design.x}, ${design.y}. Drag it, or use the arrow keys to move it. Shift moves further, Alt moves 1 pixel.`}
                onPointerDown={(event) => startDrag(event, 'media')}
                onKeyDown={keyMedia}
              >
                {isVideo ? (
                  <video ref={video} src={media.url} muted playsInline preload="auto" aria-hidden="true" onEnded={() => setPlaying(false)} />
                ) : (
                  <img src={media.url} alt="" draggable={false} />
                )}
                {design.texts.map((text, index) => {
                  const visible = boxVisibleAt(text, time);
                  const isSelected = selected === index;
                  if (!visible && !isSelected) return null;
                  return (
                    <div
                      key={index}
                      className={`stream-stage__box${isSelected ? ' is-selected' : ''}${visible ? '' : ' is-hidden'}`}
                      style={{ left: `${text.x * 100}%`, top: `${text.y * 100}%`, width: `${text.w * 100}%`, height: `${text.h * 100}%`, '--box-colour': BOX_COLOURS[index] } as React.CSSProperties}
                      tabIndex={0}
                      role="group"
                      aria-label={`Text ${index + 1}${visible ? '' : ', not shown at this time'}. Drag it, or use the arrow keys to move it.`}
                      onPointerDown={(event) => startDrag(event, 'move', index)}
                      onKeyDown={(event) => keyBox(event, index, 'move')}
                      onFocus={() => onSelect(index)}
                    >
                      {visible
                        ? <BoxText text={text} content={fillTemplate(text.template, values)} scale={design.scale} fontsVersion={fontsVersion} />
                        : <span className="stream-stage__hidden-note">Not shown at this time</span>}
                      <span className="stream-stage__tag" aria-hidden="true">{index + 1}</span>
                      {isSelected && (
                        <span
                          className="stream-stage__handle"
                          tabIndex={0}
                          role="button"
                          aria-label={`Resize text ${index + 1}. Use the arrow keys to make it wider, narrower, taller or shorter.`}
                          onPointerDown={(event) => startDrag(event, 'resize', index)}
                          onKeyDown={(event) => keyBox(event, index, 'resize')}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="stream-stage__empty">The file for this alert is not ready, so it cannot be shown here.</p>
            )}
          </div>
        </div>
      </div>

      <div className="stream-timeline">
        <button type="button" onClick={playing ? pause : play} disabled={!media?.url || length <= 0}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <div className="stream-timeline__track">
          <input
            type="range"
            min={0}
            max={Math.max(1, length)}
            step={10}
            value={Math.min(time, length)}
            aria-label="Time in the alert"
            aria-valuetext={`${formatLength(time)} of ${formatLength(length)}`}
            onChange={(event) => { if (playing) pause(); onTime(Number(event.target.value)); }}
          />
          <div className="stream-timeline__markers" aria-hidden="true">
            {markers.map((marker) => (
              <span
                key={marker.key}
                className={`stream-timeline__marker is-${marker.kind}${selected === marker.index ? ' is-selected' : ''}`}
                style={{ left: `${timelinePercent(marker.ms, length)}%`, '--box-colour': BOX_COLOURS[marker.index] } as React.CSSProperties}
                title={`Text ${marker.index + 1} ${marker.kind === 'appear' ? 'appears' : 'disappears'} at ${formatLength(marker.ms)}`}
              >
                {marker.index + 1}
              </span>
            ))}
          </div>
        </div>
        <span className="stream-timeline__time">{formatLength(time)} / {formatLength(length)}</span>
      </div>
      <p className="stream-stage__hint">
        The stage plays without sound. Markers under the timeline show when each text appears (solid) and disappears (outlined).
      </p>
    </div>
  );
};
