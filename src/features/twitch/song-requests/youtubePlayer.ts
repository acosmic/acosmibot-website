/**
 * Thin wrapper over YouTube's IFrame Player API for the dashboard player (§12.7.3).
 *
 * Safety rules, enforced here and checked by `tests/twitch-song-requests.test.ts`:
 * - the API script is loaded only from `YOUTUBE_IFRAME_API_SRC` (https://www.youtube.com/iframe_api);
 * - the iframe is built from a validated 11 character video id on the fixed embed host
 *   (`youtubeEmbedSrc`); nothing a viewer typed is ever used as a URL;
 * - the iframe carries `referrerpolicy="strict-origin-when-cross-origin"`: the app sends
 *   `Referrer-Policy: no-referrer`, and YouTube's embedded player needs the page origin.
 */
import { PLAYER_STATE, YOUTUBE_IFRAME_API_SRC, isVideoId, youtubeEmbedSrc } from './model';

export interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(videoId: string): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YtEvent { data: number }
interface YtPlayerOptions {
  events: {
    onReady: () => void;
    onStateChange: (event: YtEvent) => void;
    onError: (event: YtEvent) => void;
  };
}
interface YtNamespace {
  Player: new (element: HTMLIFrameElement, options: YtPlayerOptions) => YtPlayer;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YtNamespace> | null = null;

/** Loads the IFrame API once; rejects after `timeoutMs` (blocked by an extension or offline). */
export function loadYouTubeApi(timeoutMs = 15_000): Promise<YtNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YtNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error('The YouTube player could not be loaded.'));
    }, timeoutMs);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer);
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else { apiPromise = null; reject(new Error('The YouTube player could not be loaded.')); }
    };
    const script = document.createElement('script');
    script.src = YOUTUBE_IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      apiPromise = null;
      script.remove();
      reject(new Error('The YouTube player could not be loaded.'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface PlayerHandlers {
  onReady: () => void;
  onState: (state: number) => void;
  onError: (code: number) => void;
}

/** Creates the iframe inside `host` for `videoId` and returns the player once the API is ready. */
export async function createYouTubePlayer(host: HTMLElement, videoId: string, handlers: PlayerHandlers): Promise<YtPlayer> {
  const src = youtubeEmbedSrc(videoId, window.location.origin);
  if (!src) throw new Error('That is not a YouTube video id.');
  const yt = await loadYouTubeApi();
  const iframe = document.createElement('iframe');
  iframe.title = 'YouTube song player';
  iframe.width = '100%';
  iframe.height = '100%';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute('frameborder', '0');
  iframe.src = src;
  host.replaceChildren(iframe);
  return new yt.Player(iframe, {
    events: {
      onReady: handlers.onReady,
      onStateChange: (event) => handlers.onState(event.data),
      onError: (event) => handlers.onError(event.data),
    },
  });
}

/** Loads the next song in an existing player. Ids are validated again here. */
export function loadSong(player: YtPlayer, videoId: string): boolean {
  if (!isVideoId(videoId)) return false;
  player.loadVideoById(videoId);
  return true;
}

export { PLAYER_STATE };
