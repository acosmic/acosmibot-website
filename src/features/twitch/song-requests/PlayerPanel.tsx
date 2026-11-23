/**
 * The song player (§12.7.3, §11.4). One open dashboard tab plays the queue with the YouTube IFrame
 * Player API and reports `started` / `ended` / `skipped` / `error` to the bot, which owns every queue
 * transition (a repeated or racing report cannot skip two songs). Browsers block autoplay, so playback
 * starts only after "Start player" is pressed in this tab.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { tk, twitchErrorMessage } from '../shared/ui';
import { songsApi } from './api';
import {
  PLAYER_STATE, START_TIMEOUT_MS, describePlayerError, formatSongDuration, planPlayer, requesterLabel,
  type QueueResponse,
} from './model';
import { createYouTubePlayer, loadSong, type YtPlayer } from './youtubePlayer';
import './song-requests.css';

interface Props {
  channelId: string;
  queue: QueueResponse | undefined;
  /** Saved default volume (settings `player_volume`). */
  volume: number;
  /** The fallback playlist is on in settings (the bot starts it when the queue is empty). */
  fallbackOn: boolean;
}

type Phase = 'off' | 'loading' | 'ready' | 'failed';

export const PlayerPanel: React.FC<Props> = ({ channelId, queue, volume, fallbackOn }) => {
  const queryClient = useQueryClient();
  const queueKey = tk(channelId, 'songs', 'queue');
  const current = queue?.current ?? null;
  const [armed, setArmed] = useState(false);
  const [phase, setPhase] = useState<Phase>('off');
  const [playerState, setPlayerState] = useState<number>(PLAYER_STATE.UNSTARTED);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localVolume, setLocalVolume] = useState(volume);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState({ time: 0, duration: 0 });
  const [tick, setTick] = useState(0);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const creatingRef = useRef(false);
  const loadedIdRef = useRef<number | null>(null);
  const reportedRef = useRef(new Set<string>());
  const lastIdleStartRef = useRef<number | null>(null);
  const startTimerRef = useRef<number | null>(null);
  const volumeRef = useRef(localVolume);
  const channelRef = useRef(channelId);
  channelRef.current = channelId;

  const clearStartTimer = () => {
    if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current);
    startTimerRef.current = null;
  };

  const report = useCallback((event: 'started' | 'ended' | 'skipped' | 'error', requestId: number | null) => {
    const key = `${event}:${requestId}`;
    if (requestId !== null) {
      if (reportedRef.current.has(key)) return;      // a song is reported once per kind, however often the player fires
      reportedRef.current.add(key);
    }
    songsApi.player(channelRef.current, event, requestId).then((result) => {
      queryClient.setQueryData<QueueResponse>(queueKey, (old) => (old ? { ...old, current: result.current } : old));
      void queryClient.invalidateQueries({ queryKey: queueKey });
    }).catch((error: unknown) => {
      reportedRef.current.delete(key);          // allow a retry on the next poll
      setNotice(`The bot could not be told (${twitchErrorMessage(error)}).`);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, channelId]);

  const armLoadWatch = () => {
    clearStartTimer();
    setBlocked(false);
    startTimerRef.current = window.setTimeout(() => setBlocked(true), START_TIMEOUT_MS);
  };

  const handleState = useCallback((state: number) => {
    setPlayerState(state);
    const id = loadedIdRef.current;
    if (state === PLAYER_STATE.PLAYING) {
      clearStartTimer();
      setBlocked(false);
      setNotice(null);
      if (id !== null) report('started', id);
    } else if (state === PLAYER_STATE.ENDED && id !== null) {
      report('ended', id);
    }
  }, [report]);

  const handleError = useCallback((code: number) => {
    const id = loadedIdRef.current;
    clearStartTimer();
    setNotice(describePlayerError(code).message);
    if (id !== null) report('error', id);
  }, [report]);

  // Decide what to do whenever the server state or the clock tick changes.
  useEffect(() => {
    const plan = planPlayer({
      armed: armed && phase !== 'failed', current, queueLength: queue?.length ?? 0, fallbackPossible: fallbackOn,
      loadedRequestId: loadedIdRef.current, now: Date.now(), lastIdleStartAt: lastIdleStartRef.current,
    });
    if (plan.kind === 'start') {
      lastIdleStartRef.current = Date.now();
      report('ended', null);
    } else if (plan.kind === 'skip_fallback') {
      report('skipped', plan.requestId);
    } else if (plan.kind === 'load') {
      loadedIdRef.current = plan.requestId;
      armLoadWatch();
      const existing = playerRef.current;
      if (existing) {
        loadSong(existing, plan.videoId);
      } else if (!creatingRef.current && hostRef.current) {
        creatingRef.current = true;
        setPhase('loading');
        createYouTubePlayer(hostRef.current, plan.videoId, {
          onReady: () => {
            const player = playerRef.current;
            if (!player) return;
            player.setVolume(volumeRef.current);
            player.playVideo();
            setPhase('ready');
          },
          onState: handleState,
          onError: handleError,
        }).then((player) => {
          playerRef.current = player;
          creatingRef.current = false;
        }).catch((error: unknown) => {
          creatingRef.current = false;
          loadedIdRef.current = null;
          clearStartTimer();
          setPhase('failed');
          setNotice(error instanceof Error ? error.message : 'The YouTube player could not be loaded.');
        });
      }
    }
  // The refs are read on purpose; the listed values are the triggers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, phase, current?.id, current?.video_id, current?.source, queue?.length, fallbackOn, tick]);

  // Re-plan every few seconds (idle start retries) and update the progress bar.
  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      const player = playerRef.current;
      if (player) {
        try { setProgress({ time: player.getCurrentTime() || 0, duration: player.getDuration() || 0 }); } catch { /* player not ready */ }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [armed]);

  useEffect(() => () => {
    clearStartTimer();
    try { playerRef.current?.destroy(); } catch { /* already gone */ }
    playerRef.current = null;
  }, []);

  const onVolume = (value: number) => {
    setLocalVolume(value);
    volumeRef.current = value;
    try { playerRef.current?.setVolume(value); } catch { /* not ready */ }
  };

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playerState === PLAYER_STATE.PLAYING) player.pauseVideo(); else player.playVideo();
    setBlocked(false);
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted()) { player.unMute(); setMuted(false); } else { player.mute(); setMuted(true); }
  };

  const skip = () => {
    if (current) report('skipped', current.id);
  };

  const playing = playerState === PLAYER_STATE.PLAYING;

  return (
    <section className="tw-sr-card" aria-labelledby="tw-sr-player-title">
      <h2 id="tw-sr-player-title" className="tw-st-card__title">Player</h2>
      {!armed ? (
        <div className="tw-sr-gate" role="status">
          <p className="tw-sr-gate__lead"><strong>The player is off.</strong> Your browser only allows sound after you press a button, so nothing plays until you start it here.</p>
          <p className="tw-muted">Start it in one tab only. If two tabs play, you hear the songs twice (the queue still advances once).</p>
          <button type="button" className="btn primary" onClick={() => setArmed(true)}>
            <Play size={16} aria-hidden="true" /> Start player
          </button>
        </div>
      ) : (
        <div className="tw-sr-player">
          <div className="tw-sr-frame" ref={hostRef} aria-hidden={!current} />
          <div className="tw-sr-now" aria-live="polite">
            {current ? (
              <>
                <p className="tw-sr-now__title">{current.title}</p>
                <p className="tw-muted">{current.channel_title} · requested by {requesterLabel(current)} · {formatSongDuration(current.duration_s)}</p>
              </>
            ) : (
              <p className="tw-muted">
                {phase === 'failed' ? 'The player could not start.' : 'Nothing is playing. Add a song or turn on the fallback playlist.'}
              </p>
            )}
          </div>
          {current && (
            <div className="tw-sr-progress" role="progressbar" aria-label="Song progress" aria-valuemin={0}
              aria-valuemax={Math.max(1, Math.round(progress.duration || current.duration_s))} aria-valuenow={Math.round(progress.time)}>
              <span style={{ width: `${progress.duration > 0 ? Math.min(100, (progress.time / progress.duration) * 100) : 0}%` }} />
            </div>
          )}
          {blocked && (
            <p className="tw-sr-warning" role="alert">
              Your browser is holding the song back. Press Play to let it start.
            </p>
          )}
          {notice && <p className="tw-sr-warning" role="status">{notice}</p>}
          {phase === 'failed' && (
            <button type="button" className="btn" onClick={() => { setNotice(null); setPhase('off'); }}>Try again</button>
          )}
          <div className="tw-sr-controls">
            <button type="button" className="btn primary" onClick={togglePlay} disabled={!current || phase !== 'ready'}>
              {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" className="btn" onClick={skip} disabled={!current}>
              <SkipForward size={16} aria-hidden="true" /> Skip
            </button>
            <button type="button" className="btn" onClick={toggleMute} disabled={phase !== 'ready'} aria-pressed={muted}>
              {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <label className="tw-sr-volume">
              <span>Volume {localVolume}</span>
              <input type="range" min={0} max={100} value={localVolume} onChange={(event) => onVolume(Number(event.target.value))} />
            </label>
          </div>
          <p className="tw-muted">The volume here is for this tab. The default is in Settings.</p>
        </div>
      )}
    </section>
  );
};
