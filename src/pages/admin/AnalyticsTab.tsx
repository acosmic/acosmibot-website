import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';
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
const num: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 13, width: 26 };
const meta: React.CSSProperties = {
  color: 'var(--text-muted)', fontSize: 13, fontVariantNumeric: 'tabular-nums',
};

/** Simple 24-bar hour-of-day histogram. */
const HourlyChart: React.FC<{ data: Array<{ hour: number; count: number }> }> = ({ data }) => {
  const byHour = new Array(24).fill(0);
  data.forEach((d) => { byHour[d.hour] = d.count; });
  const max = Math.max(1, ...byHour);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
      {byHour.map((c, h) => (
        <div key={h} title={`${h}:00 — ${c.toLocaleString()} commands`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%', height: `${(c / max) * 100}%`, minHeight: c > 0 ? 2 : 0,
            background: '#5865F2', borderRadius: '3px 3px 0 0',
          }} />
          {h % 6 === 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{h}</span>}
        </div>
      ))}
    </div>
  );
};

export const AnalyticsTab: React.FC = () => {
  const commands = useQuery({
    queryKey: ['global-analytics-commands'],
    queryFn: () => analyticsApi.globalCommands(),
  });
  const reactions = useQuery({
    queryKey: ['global-analytics-reactions'],
    queryFn: () => analyticsApi.globalReactions(),
  });

  if (commands.isLoading || reactions.isLoading) {
    return <p className="text-muted">Loading…</p>;
  }

  const topCommands = commands.data?.top_commands ?? [];
  const hourly = commands.data?.hourly_distribution ?? [];
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
        <div style={heading}>Top reactions (all servers)</div>
        {topReactions.map((r, i) => (
          <div key={r.emoji_key} style={row}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={num}>{i + 1}</span>
              <EmojiBadge reaction={r} />
            </span>
            <span style={meta}>{r.count.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div style={{ ...panel, gridColumn: '1 / -1' }}>
        <div style={heading}>Command volume by hour (UTC, last 30 days)</div>
        <HourlyChart data={hourly} />
      </div>
    </div>
  );
};
