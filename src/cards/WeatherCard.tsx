import type { WeatherCardData } from './types';
import { skyPalette, weatherIcon } from './weatherIcons';

/**
 * Canonical weather-card layout — a pure, stateless component.
 *
 * Rendered through Satori in the `render-card` Azure function (selected by
 * `card: 'weather'` on the payload) to produce the PNG the bot attaches to
 * `/weather` and to weather answers from AI chat.
 *
 * Same Satori constraints as <RankCard>: flexbox, absolute positioning,
 * borderRadius, border and gradients only — no `filter: blur()` — and any
 * element with more than one child must be `display: flex`. Interpolated text is
 * collapsed into a single template-string child for the same reason.
 *
 * The component does no unit conversion: every temperature arrives pre-formatted
 * so the °C/°F toggle re-renders from the same code path the first render used.
 */

export const CARD_WIDTH = 900;
export const CARD_HEIGHT = 520;

const HERO_HEIGHT = 330;
const FONT_STACK = 'Urbanist, sans-serif';

const STRIP = {
  background: '#111318',
  divider: 'rgba(255,255,255,0.10)',
  label: 'rgba(255,255,255,0.62)',
  high: '#ffffff',
  low: 'rgba(255,255,255,0.55)',
} as const;

export function WeatherCard({ data }: { data: WeatherCardData }) {
  const { location, temperature, condition, detail, iconCode, days } = data;
  const sky = skyPalette(iconCode);
  const columns = (days || []).slice(0, 5);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: STRIP.background,
        fontFamily: FONT_STACK,
        overflow: 'hidden',
      }}
    >
      {/* Hero — sky gradient, place, big temperature, condition glyph. */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: CARD_WIDTH,
          height: HERO_HEIGHT,
          background: sky.gradient,
        }}
      >
        {/* Place label. */}
        <div
          style={{
            position: 'absolute',
            left: 48,
            top: 40,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
            color: sky.muted,
          }}
        >
          {location.toUpperCase()}
        </div>

        {/* Temperature. */}
        <div
          style={{
            position: 'absolute',
            left: 44,
            top: 96,
            fontSize: 132,
            fontWeight: 700,
            color: sky.text,
          }}
        >
          {temperature}
        </div>

        {/* Condition + detail, right of the temperature's baseline. */}
        <div
          style={{
            position: 'absolute',
            left: 48,
            top: 234,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 38, fontWeight: 700, color: sky.text }}>{condition}</div>
          <div style={{ fontSize: 24, fontWeight: 400, color: sky.muted, marginTop: 4 }}>
            {detail}
          </div>
        </div>

        {/* Condition glyph. */}
        <img
          src={weatherIcon(iconCode)}
          width={200}
          height={200}
          style={{ position: 'absolute', right: 56, top: 58, width: 200, height: 200 }}
        />
      </div>

      {/* Forecast strip — one column per day. */}
      <div
        style={{
          display: 'flex',
          width: CARD_WIDTH,
          height: CARD_HEIGHT - HERO_HEIGHT,
          backgroundColor: STRIP.background,
        }}
      >
        {columns.map((day, index) => (
          <div
            key={`${day.label}-${index}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: CARD_WIDTH / (columns.length || 1),
              height: '100%',
              // Divider between columns only — a trailing border would sit on
              // the card edge.
              borderLeft: index === 0 ? '0px solid transparent' : `1px solid ${STRIP.divider}`,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1,
                color: index === 0 ? '#8FD0FF' : STRIP.label,
              }}
            >
              {day.label.toUpperCase()}
            </div>
            <img
              src={weatherIcon(day.iconCode)}
              width={62}
              height={62}
              style={{ width: 62, height: 62, marginTop: 10, marginBottom: 8 }}
            />
            <div style={{ fontSize: 30, fontWeight: 700, color: STRIP.high }}>{day.high}</div>
            <div style={{ fontSize: 20, fontWeight: 400, color: STRIP.low, marginTop: 2 }}>
              {day.low}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WeatherCard;
