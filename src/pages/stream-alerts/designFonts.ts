import { useEffect, useState } from 'react';
import type { StreamAlertAsset } from '@/api/streamAlerts';
import { googleFontsHref, uploadedFontFamily } from '@/utils/streamAlertDesigns';

const STYLESHEET_ID = 'stream-alert-design-fonts';
const uploaded = new Map<string, Promise<void>>();

/** Adds the one Google Fonts stylesheet for the design fonts to the page, once. */
function loadListedFonts(fonts: readonly string[]) {
  if (typeof document === 'undefined' || document.getElementById(STYLESHEET_ID)) return;
  const href = googleFontsHref(fonts);
  if (!href) return;
  const link = document.createElement('link');
  link.id = STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** Loads an uploaded font under the family the resolved design gives it, once per page. */
function loadUploadedFont(asset: Pick<StreamAlertAsset, 'id' | 'url'>): Promise<void> {
  const family = uploadedFontFamily(asset.id);
  const known = uploaded.get(family);
  if (known) return known;
  const loading = (async () => {
    if (!asset.url || typeof FontFace === 'undefined') return;
    const face = new FontFace(family, `url(${JSON.stringify(asset.url)})`);
    document.fonts.add(await face.load());
  })().catch(() => {
    /* a font that will not load falls back to the next family */
  });
  uploaded.set(family, loading);
  return loading;
}

/**
 * Loads the listed Google fonts and the library's uploaded fonts for the designer, and returns a
 * number that changes whenever a font finishes loading, so text fitted to its box can be measured again.
 */
export function useDesignFonts(fonts: readonly string[], assets: readonly StreamAlertAsset[]): number {
  const [version, setVersion] = useState(0);
  const fontKey = fonts.join('|');
  const assetKey = assets.filter((asset) => asset.kind === 'font' && asset.status === 'ready').map((asset) => `${asset.id}:${asset.url}`).join('|');

  useEffect(() => {
    loadListedFonts(fonts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  useEffect(() => {
    let live = true;
    const ready = assets.filter((asset) => asset.kind === 'font' && asset.status === 'ready' && asset.url);
    Promise.all(ready.map(loadUploadedFont)).then(() => { if (live) setVersion((value) => value + 1); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey]);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return undefined;
    const bump = () => setVersion((value) => value + 1);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);

  return version;
}
