import type { StreamAlertResolvedDesign, StreamAlertType } from '@/api/streamAlerts';

export type PreviewDesigns = Partial<Record<StreamAlertType, StreamAlertResolvedDesign>>;

/** How a design preview went. `unsupported`: the preview's overlay copy is older and has no `applyDesigns`. */
export type DesignPreviewResult = 'played' | 'loading' | 'unsupported' | 'failed';

/**
 * What the stream alerts panel lets the designer do with its preview frame. The panel owns the
 * frame; the designer only gets these two calls.
 */
export interface PreviewHandle {
  /** The saved designs, so the panel's own previews look like OBS. Applied now and whenever the frame loads again. */
  setSavedDesigns: (designs: PreviewDesigns) => void;
  /**
   * Gives the preview overlay these designs, then plays one alert of `kind` with `options`
   * (the overlay's `fire` options), and brings the preview into view.
   */
  playDesign: (
    designs: PreviewDesigns,
    kind: StreamAlertType,
    options: Record<string, unknown>,
    from: { label: string; onBack: () => void },
  ) => Promise<DesignPreviewResult>;
}
