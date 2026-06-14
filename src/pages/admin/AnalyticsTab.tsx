import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';
import type { CommandVolume, VolumeGranularity } from '@/api/analytics';
import { EmojiBadge } from '@/features/analytics/GuildAnalyticsPage';

const panel: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
  borderRadius: '14px', padding: '20px',
};
const heading: React.CSSProperties = {
  fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '14px', fontWeight: 600,
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0',
};
const compactRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0',
};
const num: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 13, width: 26 };
const meta: React.CSSProperties = {
  color: 'var(--text-muted)', fontSize: 13, fontVariantNumeric: 'tabular-nums',
};
const select: React.CSSProperties = {
  background: 'var(--bg-input, var(--bg-card))', color: 'var(--text-primary)',
  border: '1px solid var(--border-light)', borderRadius: 8,
  padding: '4px 8px', fontSize: 13,
};

const RANGE_OPTIONS: Array<{ label: string; days: number }> = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

const PLOT_H = 170;        // px height of the bar plotting area
const Y_AXIS_W = 36;       // px reserved for y-axis tick labels

/** Round a max value up to a "nice" axis ceiling (1,2,5 × 10ⁿ) so the y-axis
 *  stays readable whether the peak is 3 or 30,000. */
const niceCeil = (v: number): number => {
  if (v <= 1) return 1;
  if (v <= 5) return v;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
};

/** Bar chart for command volume — hour-of-day histogram or daily timeline. */
const VolumeChart: React.FC<{ data: CommandVolume }> = ({ data }) => {
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
            {' · '}{active.count.toLocaleString()} command{active.count === 1 ? '' : 's'}
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
                title={`${isHour ? `${b.key}:00` : b.label} — ${b.count.toLocaleString()} commands`}
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

export const AnalyticsTab: React.FC = () => {
  const [granularity, setGranularity] = useState<VolumeGranularity>('hour');
  const [days, setDays] = useState(30);

  const commands = useQuery({
    queryKey: ['global-analytics-commands'],
    queryFn: () => analyticsApi.globalCommands(),
  });
  const reactions = useQuery({
    queryKey: ['global-analytics-reactions'],
    queryFn: () => analyticsApi.globalReactions(),
  });
  const volume = useQuery({
    queryKey: ['global-analytics-volume', granularity, days],
    queryFn: () => analyticsApi.globalVolume(granularity, days),
  });

  if (commands.isLoading || reactions.isLoading) {
    return <p className="text-muted">Loading…</p>;
  }

  const topCommands = commands.data?.top_commands ?? [];
  const topGuilds = commands.data?.top_guilds ?? [];
  const topReactions = reactions.data?.top_reactions ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      <div style={panel}>
        <div style={heading}>Most-used commands (all servers)</div>
        {topCommands.map((c, i) => (
          <div key={c.name} style={row}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={num}>{i + 1}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>/{c.name}</span>
            </span>
            <span style={meta}>
              {c.count.toLocaleString()}
              {c.guilds ? ` · ${c.guilds.toLocaleString()} servers` : ''}
            </span>
          </div>
        ))}
      </div>

      <div style={panel}>
        <div style={heading}>Most active servers (by commands)</div>
        {topGuilds.length === 0 && (
          <p className="text-muted" style={{ margin: 0 }}>No data yet.</p>
        )}
        {topGuilds.map((g, i) => (
          <div key={g.guild_id} style={row}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={num}>{i + 1}</span>
              <span style={{
                color: 'var(--text-primary)', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {g.name}
              </span>
            </span>
            <span style={meta}>
              {g.count.toLocaleString()}
              {g.users ? ` · ${g.users.toLocaleString()} users` : ''}
            </span>
          </div>
        ))}
      </div>

      <div style={panel}>
        <div style={heading}>Top reactions (all servers)</div>
        <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 6 }}>
          {topReactions.map((r, i) => (
            <div key={r.emoji_key} style={compactRow}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={num}>{i + 1}</span>
                <EmojiBadge reaction={r} size={18} />
              </span>
              <span style={meta}>{r.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...panel, gridColumn: '1 / -1' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 14,
        }}>
          <div style={{ ...heading, marginBottom: 0 }}>Command volume (UTC)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              style={select}
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as VolumeGranularity)}
            >
              <option value="hour">By hour of day</option>
              <option value="day">By day</option>
            </select>
            <select
              style={select}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        {volume.isLoading || !volume.data
          ? <p className="text-muted" style={{ margin: 0 }}>Loading…</p>
          : <VolumeChart data={volume.data} />}
      </div>
    </div>
  );
};
