/**
 * Condition artwork + sky palettes for <WeatherCard>.
 *
 * Icons are inline SVG data URIs rather than emoji on purpose: the `render-card`
 * Azure function loads only Urbanist 400/700, so an emoji glyph would rasterize
 * as tofu. Satori renders `<img>` sources, so each icon is a self-contained SVG
 * encoded with encodeURIComponent (isomorphic — no btoa/Buffer split between the
 * browser preview and Node).
 *
 * Keyed by the OpenWeatherMap icon id ("01d".."50n"); the numeric prefix picks
 * the artwork and the trailing d/n picks day or night.
 */

const svg = (body: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${body}</svg>`,
  )}`;

// ---- shared pieces ---------------------------------------------------------

const SUN = `
  <circle cx="32" cy="32" r="13" fill="#FFC93C"/>
  <g stroke="#FFC93C" stroke-width="4" stroke-linecap="round">
    <line x1="32" y1="6" x2="32" y2="13"/>
    <line x1="32" y1="51" x2="32" y2="58"/>
    <line x1="6" y1="32" x2="13" y2="32"/>
    <line x1="51" y1="32" x2="58" y2="32"/>
    <line x1="13.6" y1="13.6" x2="18.5" y2="18.5"/>
    <line x1="45.5" y1="45.5" x2="50.4" y2="50.4"/>
    <line x1="13.6" y1="50.4" x2="18.5" y2="45.5"/>
    <line x1="45.5" y1="18.5" x2="50.4" y2="13.6"/>
  </g>`;

const MOON = `
  <path d="M42 8a24 24 0 1 0 14 34A20 20 0 0 1 42 8z" fill="#E4ECF9"/>`;

const SMALL_SUN = `<circle cx="24" cy="22" r="11" fill="#FFC93C"/>`;
const SMALL_MOON = `<path d="M30 10a15 15 0 1 0 9 21A12.5 12.5 0 0 1 30 10z" fill="#E4ECF9"/>`;

/** Front cloud, sitting low so a sun/moon peeks out behind its top-left. */
const cloud = (fill: string, dy = 0): string => `
  <g transform="translate(0 ${dy})">
    <path d="M20 46h24a10 10 0 0 0 0.6-20A14 14 0 0 0 18 28.5 9.8 9.8 0 0 0 20 46z" fill="${fill}"/>
  </g>`;

const RAIN = `
  <g stroke="#5FA8F5" stroke-width="4" stroke-linecap="round">
    <line x1="24" y1="49" x2="21" y2="58"/>
    <line x1="34" y1="49" x2="31" y2="58"/>
    <line x1="44" y1="49" x2="41" y2="58"/>
  </g>`;

// Deeper than the cloud fill so the flakes still read against a pale daytime
// sky as well as against the dark forecast strip.
const SNOW = `
  <g fill="#9EC2E8">
    <circle cx="23" cy="53" r="3.4"/>
    <circle cx="34" cy="56" r="3.4"/>
    <circle cx="45" cy="53" r="3.4"/>
  </g>`;

// Sits below the cloud, not behind it — a bolt drawn through the cloud body is
// almost entirely hidden.
const BOLT = `<path d="M35 39 L23 54 L30 54 L27 62 L41 45 L33 45 Z" fill="#FFCE45"/>`;

const MIST = `
  <g stroke="#C3CDDB" stroke-width="4.5" stroke-linecap="round">
    <line x1="12" y1="24" x2="50" y2="24"/>
    <line x1="16" y1="34" x2="54" y2="34"/>
    <line x1="10" y1="44" x2="44" y2="44"/>
  </g>`;

const CLOUD_LIGHT = '#F1F5FB';
const CLOUD_GREY = '#C6D0DE';

// ---- icon table ------------------------------------------------------------

const ICONS: Record<string, string> = {
  '01d': svg(SUN),
  '01n': svg(MOON),
  '02d': svg(SMALL_SUN + cloud(CLOUD_LIGHT, 4)),
  '02n': svg(SMALL_MOON + cloud(CLOUD_LIGHT, 4)),
  '03d': svg(cloud(CLOUD_LIGHT, -2)),
  '03n': svg(cloud(CLOUD_LIGHT, -2)),
  '04d': svg(cloud(CLOUD_GREY, -10) + cloud(CLOUD_LIGHT, 4)),
  '04n': svg(cloud(CLOUD_GREY, -10) + cloud(CLOUD_LIGHT, 4)),
  '09d': svg(cloud(CLOUD_GREY, -6) + RAIN),
  '09n': svg(cloud(CLOUD_GREY, -6) + RAIN),
  '10d': svg(SMALL_SUN + cloud(CLOUD_LIGHT, -2) + RAIN),
  '10n': svg(SMALL_MOON + cloud(CLOUD_LIGHT, -2) + RAIN),
  '11d': svg(cloud(CLOUD_GREY, -8) + BOLT),
  '11n': svg(cloud(CLOUD_GREY, -8) + BOLT),
  '13d': svg(cloud(CLOUD_LIGHT, -6) + SNOW),
  '13n': svg(cloud(CLOUD_LIGHT, -6) + SNOW),
  '50d': svg(MIST),
  '50n': svg(MIST),
};

const FALLBACK_ICON = ICONS['03d'];

export function weatherIcon(iconCode: string): string {
  return ICONS[iconCode] || ICONS[`${(iconCode || '').slice(0, 2)}d`] || FALLBACK_ICON;
}

// ---- sky palettes ----------------------------------------------------------

export interface SkyPalette {
  /** CSS gradient for the hero panel. */
  gradient: string;
  /** Primary text color on that gradient. */
  text: string;
  /** Secondary/subdued text color. */
  muted: string;
}

const DAY_SKIES: Record<string, SkyPalette> = {
  clear: {
    gradient: 'linear-gradient(160deg, #3E9BE9 0%, #7FC4F2 55%, #BFE3FA 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.82)',
  },
  cloudy: {
    gradient: 'linear-gradient(160deg, #416F97 0%, #7BA3C6 55%, #AFC9DF 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.80)',
  },
  rain: {
    gradient: 'linear-gradient(160deg, #3C5670 0%, #55738F 55%, #7E9AB3 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.78)',
  },
  storm: {
    gradient: 'linear-gradient(160deg, #2B3448 0%, #414D66 55%, #5E6A85 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.78)',
  },
  snow: {
    gradient: 'linear-gradient(160deg, #4E657F 0%, #7C93AC 55%, #ADC2D6 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.85)',
  },
  mist: {
    gradient: 'linear-gradient(160deg, #5D6A7A 0%, #86939F 55%, #B4BEC9 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.80)',
  },
};

const NIGHT_SKIES: Record<string, SkyPalette> = {
  clear: {
    gradient: 'linear-gradient(160deg, #101A38 0%, #1E2F5C 55%, #35508A 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.74)',
  },
  cloudy: {
    gradient: 'linear-gradient(160deg, #161D2F 0%, #263149 55%, #3B4A69 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.74)',
  },
  rain: {
    gradient: 'linear-gradient(160deg, #10182A 0%, #1D2A42 55%, #31435F 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.72)',
  },
  storm: {
    gradient: 'linear-gradient(160deg, #0C1120 0%, #1A2033 55%, #2C3450 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.72)',
  },
  snow: {
    gradient: 'linear-gradient(160deg, #1A2438 0%, #2E3E58 55%, #52678A 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.78)',
  },
  mist: {
    gradient: 'linear-gradient(160deg, #191F29 0%, #2B333F 55%, #47515F 100%)',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.74)',
  },
};

const GROUP_BY_PREFIX: Record<string, keyof typeof DAY_SKIES> = {
  '01': 'clear',
  '02': 'clear',
  '03': 'cloudy',
  '04': 'cloudy',
  '09': 'rain',
  '10': 'rain',
  '11': 'storm',
  '13': 'snow',
  '50': 'mist',
};

export function skyPalette(iconCode: string): SkyPalette {
  const group = GROUP_BY_PREFIX[(iconCode || '').slice(0, 2)] || 'cloudy';
  const isNight = (iconCode || '').endsWith('n');
  return (isNight ? NIGHT_SKIES : DAY_SKIES)[group];
}
