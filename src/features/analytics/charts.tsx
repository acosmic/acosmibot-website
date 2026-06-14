import React, { useState } from 'react';
import type { CommandVolume } from '@/api/analytics';

const PLOT_H = 170;        // px height of the bar plotting area
const Y_AXIS_W = 36;       // px reserved for y-axis tick labels

/** Round a max value up to a "nice" axis ceiling (1,2,5 × 10ⁿ) so the y-axis
 *  stays readable whether the peak is 3 or 30,000. */
export const niceCeil = (v: number): number => {
  if (v <= 1) return 1;
  if (v <= 5) return v;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
};

/** Bar chart for command/message volume — hour-of-day histogram or daily timeline. */
export const VolumeChart: React.FC<{ data: CommandVolume; unit?: string }> = ({
  data, unit = 'command',
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const isHour = data.granularity === 'hour';

  // Build an ordered, gap-filled bucket list so empty hours/days still show.
  let buckets: Array<{ key: string; label: string; count: number; showLabel: boolean }>;
  if (isHour) {
    const byHour = new Array(24).fill(0);
    data.buckets.forEach((b) => { byHour[Number(b.bucket)] = b.count; });
    buckets = byHour.map((count, h) => ({
      key: String(h), label: `${h}:00`, count, showLabel: h % 6 === 0,
    }));
  } else {
    const n = data.buckets.length;
    const step = Math.max(1, Math.ceil(n / 8));
    buckets = data.buckets.map((b, i) => {
      const d = new Date(b.bucket + 'T00:00:00');
      return {
        key: b.bucket,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: b.count,
        showLabel: i % step === 0,
      };
    });
  }

  if (buckets.length === 0) {
    return <p className="text-muted" style={{ margin: 0 }}>No activity in this range.</p>;
  }

  const rawMax = Math.max(...buckets.map((b) => b.count));
  const axisMax = niceCeil(rawMax);
  const ticks = [axisMax, axisMax / 2, 0];
  const active = hover != null ? buckets[hover] : null;

  return (
    <div>
      {/* Hover readout — keeps a fixed slot so the chart doesn't jump. */}
      <div style={{ height: 22, marginBottom: 6, fontSize: 13, color: 'var(--text-secondary, var(--text-muted))' }}>
        {active && (
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>
              {isHour ? `${active.key}:00–${active.key}:59 UTC` : active.label}
            </strong>
            {' · '}{active.count.toLocaleString()} {unit}{active.count === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {/* Y-axis tick labels */}
        <div style={{
          width: Y_AXIS_W, height: PLOT_H, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', alignItems: 'flex-end',
          fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
        }}>
          {ticks.map((t) => <span key={t}>{t.toLocaleString()}</span>)}
        </div>

        {/* Plot area with horizontal gridlines behind the bars */}
        <div style={{ flex: 1, position: 'relative', height: PLOT_H }}>
          {ticks.map((t) => (
            <div key={t} style={{
              position: 'absolute', left: 0, right: 0, top: `${(1 - t / axisMax) * 100}%`,
              borderTop: '1px dashed var(--border-light)', opacity: 0.5,
            }} />
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%', position: 'relative' }}>
            {buckets.map((b, i) => (
              <div
                key={b.key}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                title={`${isHour ? `${b.key}:00` : b.label} — ${b.count.toLocaleString()} ${unit}s`}
                style={{
                  flex: 1, height: '100%', minWidth: 0,
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
                  cursor: 'default',
                }}
              >
                <div style={{
                  width: '100%',
                  height: Math.max(b.count > 0 ? 2 : 0, (b.count / axisMax) * PLOT_H),
                  background: hover === i ? '#8b95ff' : '#5865F2',
                  borderRadius: '3px 3px 0 0', transition: 'background 0.1s',
                }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* X-axis labels, aligned under the bars (offset past the y-axis) */}
      <div style={{ display: 'flex', gap: 3, marginTop: 6, paddingLeft: Y_AXIS_W + 8 }}>
        {buckets.map((b) => (
          <div key={b.key} style={{
            flex: 1, minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap',
            fontSize: 10, color: 'var(--text-muted)',
          }}>
            {b.showLabel ? b.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Tiny inline trend line for a series of daily counts. */
export const Sparkline: React.FC<{
  data: number[]; width?: number; height?: number; color?: string;
}> = ({ data, width = 80, height = 22, color = '#5865F2' }) => {
  if (data.length === 0) return <svg width={width} height={height} />;
  const max = Math.max(1, ...data);
  const n = data.length;
  const pts = data.map((v, i) => {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
    const y = height - (v / max) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export interface MemberFlowDay {
  date: string;
  joins: number;
  leaves: number;
  kicks: number;
  bans: number;
  departures: number;
  net: number;
}

const FLOW_COLORS = {
  join: '#3ba55d',
  leave: '#ed4245',
  kick: '#faa61a',
  ban: '#992d22',
};

/**
 * Diverging bar chart: joins above the baseline (green), departures below —
 * stacked as leaves (red), kicks (amber), and bans (dark red).
 */
export const MemberFlowChart: React.FC<{ data: MemberFlowDay[] }> = ({ data }) => {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-muted" style={{ margin: 0 }}>No joins or departures in this range yet.</p>;
  }

  const maxJoin = Math.max(1, ...data.map((d) => d.joins));
  const maxDepart = Math.max(1, ...data.map((d) => d.departures));
  const half = 80;            // px above / below the baseline
  const step = Math.max(1, Math.ceil(data.length / 8));
  const active = hover != null ? data[hover] : null;

  const fmtDate = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const segHeight = (value: number) => (value / maxDepart) * (half - 2);

  return (
    <div>
      <div style={{ height: 22, marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>
        {active && (
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>{fmtDate(active.date)}</strong>
            {' · '}
            <span style={{ color: FLOW_COLORS.join }}>+{active.joins}</span>{' '}
            <span style={{ color: FLOW_COLORS.leave }}>−{active.leaves} left</span>{' '}
            <span style={{ color: FLOW_COLORS.kick }}>−{active.kicks} kicked</span>{' '}
            <span style={{ color: FLOW_COLORS.ban }}>−{active.bans} banned</span>{' '}
            <span style={{ color: active.net >= 0 ? FLOW_COLORS.join : FLOW_COLORS.leave }}>
              (net {active.net >= 0 ? '+' : ''}{active.net})
            </span>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 3, position: 'relative' }}>
        {/* center baseline */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: half,
          borderTop: '1px solid var(--border-light)',
        }} />
        {data.map((d, i) => {
          const dim = hover != null && hover !== i;
          return (
            <div
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              title={`${fmtDate(d.date)} · +${d.joins} / −${d.departures}`}
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', cursor: 'default' }}
            >
              {/* joins (up) */}
              <div style={{ height: half, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%', height: (d.joins / maxJoin) * (half - 2),
                  background: FLOW_COLORS.join, opacity: dim ? 0.45 : 1, borderRadius: '2px 2px 0 0',
                }} />
              </div>
              {/* departures (down), stacked leaves → kicks → bans */}
              <div style={{ height: half, display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%', height: segHeight(d.leaves), background: FLOW_COLORS.leave, opacity: dim ? 0.45 : 1 }} />
                <div style={{ width: '100%', height: segHeight(d.kicks), background: FLOW_COLORS.kick, opacity: dim ? 0.45 : 1 }} />
                <div style={{ width: '100%', height: segHeight(d.bans), background: FLOW_COLORS.ban, opacity: dim ? 0.45 : 1 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {data.map((d, i) => (
          <div key={d.date} style={{
            flex: 1, minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap',
            fontSize: 10, color: 'var(--text-muted)',
          }}>
            {i % step === 0 ? fmtDate(d.date) : ''}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
        <span><span style={{ color: FLOW_COLORS.join }}>■</span> Joins</span>
        <span><span style={{ color: FLOW_COLORS.leave }}>■</span> Leaves</span>
        <span><span style={{ color: FLOW_COLORS.kick }}>■</span> Kicks</span>
        <span><span style={{ color: FLOW_COLORS.ban }}>■</span> Bans</span>
      </div>
    </div>
  );
};
