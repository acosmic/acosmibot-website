import React from 'react';
import type { PremiumTier } from '@/api/subscriptions';
import { PREMIUM_TIER_ILLUSTRATION_SRC, normalizePremiumTier } from './PremiumTierIcon';

/*
 * Animated plan aura around the tier mascot. Every paid tier shares one shell
 * size; higher tiers add speed, streaks, orbits, circuit traces and lightning.
 * Render <TierAuraDefs /> once per page before any <TierAura />.
 */

const ID = 'tier-aura';
const SHELL =
  'M170 92C250 110 290 200 285 280C280 340 230 372 170 372C110 372 60 340 55 280C50 200 90 110 170 92Z';
const STREAK = 'M-2.2 0L0-52L2.2 0Z';
const SPARK_STAR = 'M0-6L1.2-1.2 6 0 1.2 1.2 0 6-1.2 1.2-6 0-1.2-1.2Z';

const TIER_RANK: Record<PremiumTier, number> = { free: 0, plus: 1, pro: 2, max: 3 };

const COLORS: Record<Exclude<PremiumTier, 'free'>, [string, string, string]> = {
  plus: ['#4fe3a1', '#c9ffe4', '#1fae7c'],
  pro: ['#61daf1', '#e0fbff', '#9f8bff'],
  max: ['#ff8f72', '#ffd58a', '#9f8bff'],
};

// [x, y, duration s, delay s, minimum tier rank]
const STREAKS: Array<[number, number, number, number, number]> = [
  [78, 300, 0.95, -0.1, 1],
  [262, 300, 1.05, -0.6, 1],
  [100, 226, 0.9, -0.35, 1],
  [240, 226, 1, -0.8, 1],
  [132, 168, 1.1, -0.5, 1],
  [208, 168, 0.85, -0.15, 1],
  [64, 252, 1, -0.45, 2],
  [276, 252, 0.9, -0.7, 2],
  [152, 128, 1, -0.25, 2],
  [188, 128, 1.1, -0.9, 2],
  [90, 342, 0.8, -0.3, 3],
  [250, 342, 0.85, -0.55, 3],
  [116, 196, 0.9, -0.05, 3],
  [224, 196, 0.95, -0.4, 3],
];

// [x, y, duration s, delay s, drift px, star?, minimum tier rank]
const SPARKS: Array<[number, number, number, number, number, boolean, number]> = [
  [118, 330, 2.4, -0.3, -14, true, 1],
  [226, 336, 2, -1.2, 12, false, 1],
  [150, 344, 2.7, -2, -6, true, 1],
  [196, 340, 1.8, -0.8, 8, false, 2],
  [96, 320, 2.2, -1.6, -10, true, 2],
  [246, 318, 1.9, -0.4, 14, true, 3],
  [170, 350, 1.6, -1, 2, false, 3],
  [134, 326, 2.1, -1.9, -4, false, 3],
];

// [path, delay class suffix, end x, end y, minimum tier rank]
const TRACES: Array<[string, string, number, number, number]> = [
  ['M122 372V334H106V284H94V232', '', 94, 232, 2],
  ['M218 372V326H236V274H248V218', ' is-d2', 248, 218, 2],
  ['M150 372V344H134V302H124V186', ' is-d1', 124, 186, 3],
  ['M192 372V348H208V298H216V170', ' is-d3', 216, 170, 3],
];

const BOLTS = [
  'M70 120L84 150 76 156 96 190 89 194 104 224M84 150L64 170',
  'M282 146L266 176 274 180 254 210 262 214 248 242M266 176L286 194',
];

type AuraStyle = React.CSSProperties & Record<`--${string}`, string>;

const url = (name: string) => `url(#${ID}-${name})`;

const verticalStops = (stops: Array<[number, string, number?]>) =>
  stops.map(([offset, color, opacity = 1]) => (
    <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
  ));

export const TierAuraDefs: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
    <defs>
      <filter id={`${ID}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${ID}-bloom`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
      <filter id={`${ID}-bloom-sm`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <radialGradient id={`${ID}-halo-free`}>
        <stop offset="0" stopColor="#61daf1" stopOpacity=".35" />
        <stop offset="1" stopColor="#61daf1" stopOpacity="0" />
      </radialGradient>
      {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map((tier) => {
        const [c1, c2, c3] = COLORS[tier];
        return (
          <React.Fragment key={tier}>
            <linearGradient id={`${ID}-shell-${tier}`} x1="0" y1="1" x2="0" y2="0">
              {verticalStops([[0, c1, 0.95], [0.45, c1, 0.55], [0.8, c3, 0.3], [1, c3, 0]])}
            </linearGradient>
            <linearGradient id={`${ID}-streak-${tier}`} x1="0" y1="1" x2="0" y2="0">
              {verticalStops([[0, c2], [0.4, c1, 0.85], [1, c1, 0]])}
            </linearGradient>
            <linearGradient id={`${ID}-hot-${tier}`} x1="0" y1="1" x2="0" y2="0">
              {verticalStops([[0, '#ffffff'], [0.45, c2, 0.95], [1, c2, 0]])}
            </linearGradient>
            <radialGradient id={`${ID}-halo-${tier}`}>
              {verticalStops([[0, tier === 'max' ? c2 : c1, 0.5], [0.6, c1, 0.2], [1, c3, 0]])}
            </radialGradient>
          </React.Fragment>
        );
      })}
    </defs>
  </svg>
);

const Planet: React.FC<{ path: string; dur: string; front: boolean; r: number }> = ({ path, dur, front, r }) => (
  <g opacity={front ? 1 : 0}>
    <animateMotion dur={dur} repeatCount="indefinite" path={path} />
    <animate
      attributeName="opacity"
      dur={dur}
      repeatCount="indefinite"
      values={front ? '1;1;0;0;1' : '0;0;1;1;0'}
      keyTimes="0;.48;.52;.96;1"
    />
    <circle className="tier-aura__planet-halo" r={r} />
    <circle r={r * 0.38} fill="#ffffff" />
  </g>
);

const ORBIT_A = 'M20 270A150 34 0 0 0 320 270A150 34 0 0 0 20 270';
const ORBIT_B = 'M5 250A165 26 0 0 1 335 250A165 26 0 0 1 5 250';

const Orbits: React.FC<{ rank: number; front: boolean }> = ({ rank, front }) => (
  <>
    {rank >= 2 && (
      <g transform="rotate(-12 170 270)">
        <path
          className={front ? 'tier-aura__orbit-front' : 'tier-aura__orbit-back'}
          d={front ? 'M20 270A150 34 0 0 0 320 270' : 'M20 270A150 34 0 0 1 320 270'}
        />
        <Planet path={ORBIT_A} dur="3.4s" front={front} r={8} />
      </g>
    )}
    {rank >= 3 && (
      <g className="tier-aura__orbit-b" transform="rotate(16 170 250)">
        <path
          className={front ? 'tier-aura__orbit-front' : 'tier-aura__orbit-back'}
          d={front ? 'M5 250A165 26 0 0 1 335 250' : 'M5 250A165 26 0 0 0 335 250'}
        />
        <Planet path={ORBIT_B} dur="2.3s" front={front} r={7} />
      </g>
    )}
  </>
);

export const TierAura: React.FC<{ tier: unknown; className?: string }> = ({ tier, className }) => {
  const normalized = normalizePremiumTier(tier);
  const rank = TIER_RANK[normalized];

  return (
    <span
      className={['tier-aura', `tier-aura--${normalized}`, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <svg className="tier-aura__fx tier-aura__fx--back" viewBox="0 0 340 380">
        <circle className="tier-aura__halo" cx="170" cy="262" r="118" fill={url(`halo-${normalized}`)} />
        {rank === 0 && (
          <>
            <circle className="tier-aura__scan tier-aura__scan--dots" cx="170" cy="262" r="88" />
            <circle className="tier-aura__scan tier-aura__scan--sweep" cx="170" cy="262" r="94" />
          </>
        )}
        {rank >= 2 && (
          <ellipse className="tier-aura__ground" cx="170" cy="366" rx="128" ry="16" fill={url(`halo-${normalized}`)} />
        )}
        {rank >= 3 && <ellipse className="tier-aura__shock" cx="170" cy="366" rx="52" ry="8" />}
        {TRACES.filter(([, , , , min]) => rank >= min).map(([d, delay, x, y]) => (
          <React.Fragment key={d}>
            <path className="tier-aura__trace" d={d} />
            <path className={`tier-aura__pulse${delay}`} d={d} />
            <circle className={`tier-aura__node${delay}`} cx={x} cy={y} r="2.6" />
          </React.Fragment>
        ))}
        {rank >= 1 && (
          <g className="tier-aura__hover">
            <g className="tier-aura__shell">
              <path className="tier-aura__shell-fill" d={SHELL} fill={url(`shell-${normalized}`)} />
              <path className="tier-aura__shell-rim" d={SHELL} />
              <path className="tier-aura__shell-run" pathLength={400} d={SHELL} />
              <path className="tier-aura__shell-run is-secondary" pathLength={400} d={SHELL} />
              {STREAKS.filter(([, , , , min]) => rank >= min).map(([x, y, duration, delay, min]) => (
                <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                  <path
                    className="tier-aura__streak"
                    style={{ '--d': `${duration}s`, '--dl': `${delay}s` } as AuraStyle}
                    d={STREAK}
                    fill={url(`${min === 3 ? 'hot' : 'streak'}-${normalized}`)}
                  />
                </g>
              ))}
            </g>
          </g>
        )}
        <Orbits rank={rank} front={false} />
      </svg>

      <img className="tier-aura__mascot" src={PREMIUM_TIER_ILLUSTRATION_SRC[normalized]} alt="" decoding="async" />

      <svg className="tier-aura__fx tier-aura__fx--front" viewBox="0 0 340 380">
        <Orbits rank={rank} front />
        {SPARKS.filter(([, , , , , , min]) => rank >= min).map(([x, y, duration, delay, drift, star]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <g
              className="tier-aura__spark"
              style={{ '--d': `${duration}s`, '--dl': `${delay}s`, '--dx': `${drift}px` } as AuraStyle}
            >
              <circle className="tier-aura__spark-glow" r="6" />
              {star ? <path className="tier-aura__spark-core" d={SPARK_STAR} /> : <circle className="tier-aura__spark-core" r="1.6" />}
            </g>
          </g>
        ))}
        {rank >= 3 &&
          BOLTS.map((d, index) => (
            <g key={d} className={`tier-aura__bolt${index ? ' is-late' : ''}`}>
              <path className="tier-aura__bolt-glow" d={d} />
              <path className="tier-aura__bolt-core" d={d} />
            </g>
          ))}
      </svg>
    </span>
  );
};
