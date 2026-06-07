import type { RankCardData } from './types';
import { OgMonogram, OgFrame } from './ogOrnament';

/**
 * Canonical rank-card layout — a pure, stateless component.
 *
 * Rendered live in the browser for the Card Studio preview AND run through
 * Satori in the `render-card` Azure function to produce the PNG the bot shows.
 * Because both paths use THIS component, the Discord card and the website
 * preview cannot drift.
 *
 * This reproduces the legacy PIL design in `acosmibot/Cogs/Rank.py`
 * (`create_rank_card`). Only CSS that Satori supports is used: flexbox,
 * absolute positioning, borderRadius, border, gradients — no `filter: blur()`.
 *
 * Coordinates/colors mirror the PIL implementation 1:1 so the two can be
 * compared side-by-side and tuned to parity.
 */

export const CARD_WIDTH = 800;
export const CARD_HEIGHT = 250;

const COLORS = {
  background: '#18191c', //  (24, 25, 28)
  username: '#ffffff',
  guild: '#969696', //      (150, 150, 150)
  global: 'rgba(255, 165, 0, 0.7)', // subtle orange
  rank: '#ffffff',
  accent: '#00ffff', //     cyan — level text + XP bar fill
  xpText: '#c8c8c8', //     (200, 200, 200)
  xpTrack: '#323232', //    (50, 50, 50)
  outline: '#000000',
} as const;

const FONT_STACK = 'Urbanist, sans-serif';

/** Deterministic thousands separators (avoid Node/browser locale drift). */
const fmt = (n: number): string => n.toLocaleString('en-US');

export function RankCard({ data }: { data: RankCardData }) {
  const {
    displayName,
    avatarUrl,
    guildName,
    rank,
    level,
    globalLevel,
    currentExp,
    expProgress,
    expNeeded,
    loadout,
    topLeftLabel,
    hideGlobalLevel,
  } = data;

  // Resolve the cosmetic loadout, falling back to the legacy hardcoded defaults
  // so the card looks identical when no loadout is equipped.
  const accent = loadout?.accentColor || COLORS.accent;
  const background = loadout?.background || COLORS.background;
  const ringColor = loadout?.ringColor || COLORS.outline;
  // A `background` value may be either a solid color or a CSS gradient string;
  // the shorthand `background` property accepts both.
  const isGradient = /gradient/i.test(background);
  // The achievement-granted OG card carries extra ornamentation.
  const isOgCard = loadout?.backgroundKey === 'og_member';

  // XP bar fill: clamp 0..1, enforce an 8% minimum sliver (matches PIL).
  const ratio = expNeeded > 0 ? expProgress / expNeeded : 1;
  const clamped = Math.max(0, Math.min(1, ratio));
  const fillPct = Math.max(0.08, clamped) * 100;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        // `background` shorthand carries either a solid color or a gradient;
        // fall back to backgroundColor for the solid case to stay explicit.
        ...(isGradient ? { background } : { backgroundColor: background }),
        fontFamily: FONT_STACK,
        overflow: 'hidden',
      }}
    >
      {/* OG embossed monogram — behind all content so text stays legible. */}
      {isOgCard && <OgMonogram />}

      {/* Avatar — 140px circle with a thin black ring, vertically centered.
          Falls back to a plain gray circle when no avatar is available
          (mirrors the PIL path, which simply omits a missing avatar). */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          width={140}
          height={140}
          style={{
            position: 'absolute',
            left: 25,
            top: 55,
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: `2px solid ${ringColor}`,
            boxShadow: `0 0 12px ${ringColor}`,
            boxSizing: 'border-box',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 25,
            top: 55,
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: `2px solid ${ringColor}`,
            boxShadow: `0 0 12px ${ringColor}`,
            boxSizing: 'border-box',
            backgroundColor: '#2b2d31',
          }}
        />
      )}

      {/* Guild label (top-left). */}
      <div
        style={{
          position: 'absolute',
          left: 180,
          top: 20,
          fontSize: 18,
          fontWeight: 400,
          color: COLORS.guild,
        }}
      >
        {topLeftLabel ?? `in ${guildName}`}
      </div>

      {/* Global level — sits just above the far-right end of the XP bar (the
          bar spans left:180 + width:530 + 3px border = right edge x716, so a
          right offset of 84 aligns the label's right edge to it). Hidden on the
          global card variant, where the main LVL already shows the global level. */}
      {!hideGlobalLevel && (
        <div
          style={{
            position: 'absolute',
            right: 84,
            top: 156,
            fontSize: 16,
            fontWeight: 400,
            color: COLORS.global,
          }}
        >
          {`Global Lvl ${globalLevel}`}
        </div>
      )}

      {/* Username (large). */}
      <div
        style={{
          position: 'absolute',
          left: 180,
          top: 50,
          fontSize: 48,
          fontWeight: 700,
          color: COLORS.username,
        }}
      >
        {displayName}
      </div>

      {/* Rank + Level on one row (dynamic spacing via flex gap). */}
      <div
        style={{
          position: 'absolute',
          left: 180,
          top: 110,
          display: 'flex',
          alignItems: 'baseline',
          gap: 25,
          fontSize: 32,
          fontWeight: 700,
        }}
      >
        <span style={{ color: COLORS.rank }}>{rank > 0 ? `RANK  #${rank}` : 'RANK —'}</span>
        <span style={{ color: accent }}>{`LVL  ${level}`}</span>
      </div>

      {/* XP label. */}
      <div
        style={{
          position: 'absolute',
          left: 180,
          top: 150,
          fontSize: 24,
          fontWeight: 400,
          color: COLORS.xpText,
        }}
      >
        {`${fmt(currentExp)} XP (${fmt(expProgress)} / ${fmt(expNeeded)})`}
      </div>

      {/* XP bar — 530x30 track, 3px outline, cyan fill. */}
      <div
        style={{
          position: 'absolute',
          left: 180,
          top: 180,
          display: 'flex',
          width: 530,
          height: 30,
          boxSizing: 'content-box',
          border: `3px solid ${COLORS.outline}`,
          borderRadius: 18,
          backgroundColor: COLORS.xpTrack,
        }}
      >
        <div
          style={{
            width: `${fillPct}%`,
            height: '100%',
            backgroundColor: accent,
            borderRadius: 15,
          }}
        />
      </div>

      {/* OG gold filigree frame — on top of everything. */}
      {isOgCard && <OgFrame />}
    </div>
  );
}

export default RankCard;
