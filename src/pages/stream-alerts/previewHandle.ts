import type { StreamAlertType } from '@/api/streamAlerts';
import type { PreviewConfig } from '@/utils/streamAlertBox';

/** How a preview went. `unsupported`: the preview's overlay copy is older and has no `applyConfig`. */
export type PreviewResult = 'played' | 'loading' | 'unsupported' | 'failed';

/** A live control the preview mirrors, so it matches what OBS does. */
export type PreviewMirror = 'skip' | 'clear' | 'stop_effects';

/**
 * What the preview pane lets the rest of the page do with its frame. The pane owns the frame,
 * keeps the saved settings in it, and puts them back after a preview of unsaved changes.
 */
export interface PreviewHandle {
  /** Plays an alert or effect with the saved settings. `options` are the overlay's `fire` options. */
  play: (name: string, options: Record<string, unknown>) => Promise<PreviewResult>;
  /** Gives the preview overlay this config (with an unsaved draft in it) through `applyConfig`, then plays one alert of `kind`. */
  playDraft: (config: PreviewConfig, kind: StreamAlertType, options: Record<string, unknown>) => Promise<PreviewResult>;
  /** Cuts whatever the preview is showing. */
  stop: () => void;
  mirror: (action: PreviewMirror) => void;
}

/** What the page says for a preview that did not play. */
export function previewProblem(result: PreviewResult): string | null {
  if (result === 'loading') return 'The preview is still loading. Try again in a moment.';
  if (result === 'unsupported') {
    return 'The preview on this page is an older copy of the overlay that cannot show unsaved settings yet. Save, then use Send to OBS to see them on the OBS link.';
  }
  if (result === 'failed') return 'The preview could not load these settings. Try again, or check that their files still play.';
  return null;
}
