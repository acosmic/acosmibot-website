/**
 * OG-card ornamentation — drawn only when the equipped background cosmetic is
 * the achievement-granted OG card (loadout.backgroundKey === 'og_member').
 *
 * Two pieces, each chosen for how it renders through Satori:
 *  - Gold filigree FRAME: an <img> with an inline SVG data URI. Because it's an
 *    image, the full SVG (gradients, <use>, scrollwork paths) is rasterized by
 *    the browser in the live preview and by resvg-wasm in the render function —
 *    not by Satori's limited inline-SVG support — so it looks identical in both.
 *  - Embossed "OG" monogram: stacked JSX text copies (highlight + shadow + face)
 *    so Satori lays it out with the embedded Urbanist font. Giant, tilted, and
 *    bleeding off the bottom-right corner so it reads as a zoomed-in relief
 *    pressed into the gold.
 */

const FRAME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="250" viewBox="0 0 800 250">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff4c2"/>
      <stop offset="0.42" stop-color="#ead06a"/>
      <stop offset="0.58" stop-color="#c9a12f"/>
      <stop offset="1" stop-color="#7d5e12"/>
    </linearGradient>
    <g id="flourish" fill="none" stroke="url(#gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 12 82 C 12 42 42 12 82 12"/>
      <path d="M 24 82 C 24 52 52 24 82 24" opacity="0.7"/>
      <path d="M 12 82 C 34 82 46 72 46 55 C 46 44 37 39 31 45 C 26 50 31 58 38 55"/>
      <path d="M 82 12 C 82 34 72 46 55 46 C 44 46 39 37 45 31 C 50 26 58 31 55 38"/>
      <path d="M 66 66 C 80 60 96 64 108 54" opacity="0.85"/>
      <path d="M 66 66 C 60 80 64 96 54 108" opacity="0.85"/>
      <path d="M 108 54 C 116 50 120 42 118 34" opacity="0.7"/>
      <path d="M 54 108 C 50 116 42 120 34 118" opacity="0.7"/>
      <circle cx="82" cy="82" r="3" fill="url(#gold)" stroke="none"/>
      <circle cx="118" cy="34" r="2" fill="url(#gold)" stroke="none"/>
      <circle cx="34" cy="118" r="2" fill="url(#gold)" stroke="none"/>
    </g>
  </defs>
  <rect x="9" y="9" width="782" height="232" rx="8" fill="none" stroke="url(#gold)" stroke-width="2.5"/>
  <rect x="15" y="15" width="770" height="220" rx="6" fill="none" stroke="url(#gold)" stroke-width="1" opacity="0.7"/>
  <use href="#flourish"/>
  <use href="#flourish" transform="translate(800,0) scale(-1,1)"/>
  <use href="#flourish" transform="translate(0,250) scale(1,-1)"/>
  <use href="#flourish" transform="translate(800,250) scale(-1,-1)"/>
</svg>`;

function b64(s: string): string {
  // btoa exists in the browser and in the Node 18 render function; the Buffer
  // fallback (reached only off-browser) is accessed via globalThis so this file
  // needs no Node types for the website's tsc build.
  if (typeof btoa !== 'undefined') return btoa(s);
  const B = (globalThis as { Buffer?: { from(d: string, e: string): { toString(enc: string): string } } }).Buffer;
  return B ? B.from(s, 'utf8').toString('base64') : s;
}

const FRAME_DATA_URI = `data:image/svg+xml;base64,${b64(FRAME_SVG)}`;

/**
 * Giant tilted "OG" pressed into the gold (highlight + shadow + face stack).
 * Rendered BEHIND the card content (low z) so the username/stats stay legible.
 */
export function OgMonogram() {
  const SIZE = 340;
  const layer: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    fontFamily: 'Urbanist, sans-serif',
    fontWeight: 700,
    fontSize: SIZE,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };
  return (
    <div
      style={{
        position: 'absolute',
        left: 505,
        top: 18,
        display: 'flex',
        transform: 'rotate(-13deg)',
        opacity: 0.46,
      }}
    >
      <div style={{ position: 'relative', display: 'flex', width: SIZE * 1.35, height: SIZE }}>
        {/* deep shadow (bottom-right) — recessed rim under a top-left light */}
        <div style={{ ...layer, color: '#140e00', transform: 'translate(8px, 9px)' }}>OG</div>
        {/* mid shadow softens the step */}
        <div style={{ ...layer, color: '#5a4406', transform: 'translate(4px, 5px)' }}>OG</div>
        {/* bright highlight (top-left) */}
        <div style={{ ...layer, color: '#fff0b0', transform: 'translate(-5px, -5px)' }}>OG</div>
        {/* face — the lit gold surface */}
        <div style={{ ...layer, color: '#caa033' }}>OG</div>
      </div>
    </div>
  );
}

/** Gold filigree frame, drawn ON TOP of the card content (high z). */
export function OgFrame() {
  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      src={FRAME_DATA_URI}
      width={800}
      height={250}
      style={{ position: 'absolute', left: 0, top: 0, width: 800, height: 250 }}
    />
  );
}
