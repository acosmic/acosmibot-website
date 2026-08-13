import { lazy, type ComponentType } from 'react';

/** Version-skew recovery for route chunks.
 *
 * Every deploy rebuilds the hashed route chunks and Azure SWA drops the old
 * ones. A tab left open across a deploy still runs the previous entry module,
 * so the next route navigation requests a chunk that 404s, the lazy import
 * rejects, and the page sits blank until the user refreshes by hand. Reload
 * once for that tab instead — the fresh index.html points at chunks that
 * exist, and the reload lands on the route the user was already navigating to.
 *
 * The reload is guarded: a chunk that is missing from the *current* build
 * would otherwise reload forever, so a second failure inside the window falls
 * through to the caller (RouteErrorBoundary) as a real error.
 */

const RELOAD_KEY = 'acosmibot_chunk_reload';
const RELOAD_WINDOW_MS = 20_000;

/** Backstop for browsers where sessionStorage throws (private mode, blocked
 * cookies): at least never reload twice within one page load. */
let reloadedThisPageLoad = false;

/** Vite/browser wording differs per engine; match all the known phrasings. */
export const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|expected a javascript(?:-or-wasm)? module script|is not a valid javascript mime type/i
    .test(message);
};

/** Reloads the page unless one was already attempted recently. Returns whether
 * a reload is now in flight, so callers can surface the error when it is not. */
export const reloadForNewDeploy = (): boolean => {
  if (reloadedThisPageLoad) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* storage unavailable — the per-page-load guard still applies */ }
  reloadedThisPageLoad = true;
  window.location.reload();
  return true;
};

/** Wraps a chunk import so a stale-deploy failure reloads the page. Anything
 * else — and any failure the reload guard declines — rejects as usual and
 * surfaces through RouteErrorBoundary. */
export const recoverChunk = <T>(factory: () => Promise<T>) => () => factory().catch((error: unknown) => {
  if (isChunkLoadError(error) && reloadForNewDeploy()) {
    // Hold the Suspense fallback until the reload swaps the document out;
    // resolving or rejecting here would flash UI that is about to vanish.
    return new Promise<T>(() => {});
  }
  throw error;
});

/** React.lazy for route chunks: a stale-deploy failure reloads instead of
 * leaving a blank screen. */
export const lazyRoute = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) => lazy(recoverChunk(factory));

/** Vite fires this when a chunk's preloaded dependency 404s, ahead of the
 * import rejection. Handling it here reloads a beat sooner; leaving the event
 * un-prevented when the guard declines lets the error reach lazyRoute. */
export const installPreloadErrorHandler = () => {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewDeploy()) event.preventDefault();
  });
};
