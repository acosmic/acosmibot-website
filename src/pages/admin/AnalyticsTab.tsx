import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';
import type { VolumeGranularity } from '@/api/analytics';
import { EmojiBadge } from '@/features/analytics/GuildAnalyticsPage';
import { VolumeChart } from '@/features/analytics/charts';

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

const fmtCost = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const RangeSelect: React.FC<{ value: number; onChange: (d: number) => void }> = ({ value, onChange }) => (
  <select style={select} value={value} onChange={(e) => onChange(Number(e.target.value))}>
    {RANGE_OPTIONS.filter((o) => o.days >= 7).map((o) => (
      <option key={o.days} value={o.days}>{o.label}</option>
    ))}
  </select>
);

export const AnalyticsTab: React.FC = () => {
  const [granularity, setGranularity] = useState<VolumeGranularity>('hour');
  const [days, setDays] = useState(30);     // command-volume chart range
  const [aiDays, setAiDays] = useState(30);  // AI usage range
  const [msgDays, setMsgDays] = useState(30); // messages range

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
  const ai = useQuery({
    queryKey: ['global-analytics-ai', aiDays],
    queryFn: () => analyticsApi.globalAiUsage(aiDays),
  });
  const messages = useQuery({
    queryKey: ['global-analytics-messages', msgDays],
    queryFn: () => analyticsApi.globalMessages(msgDays),
  });

  if (commands.isLoading || reactions.isLoading) {
    return <p className="text-muted">Loading…</p>;
  }

  const topCommands = commands.data?.top_commands ?? [];
  const topGuilds = commands.data?.top_guilds ?? [];
  const topReactions = reactions.data?.top_reactions ?? [];
  const aiByType = Object.entries(ai.data?.stats_by_type ?? {});
  const aiByModel = ai.data?.by_model ?? [];
  const aiTopGuilds = ai.data?.top_guilds ?? [];
  const aiTotalCost = aiByType.reduce((sum, [, s]) => sum + s.total_cost, 0);
  const msgTopGuilds = messages.data?.top_guilds ?? [];

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

      {/* ---- AI usage ---- */}
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={heading}>AI usage by type</div>
          <RangeSelect value={aiDays} onChange={setAiDays} />
        </div>
        {ai.isLoading ? <p className="text-muted" style={{ margin: 0 }}>Loading…</p> : (
          <>
            <div style={{ ...row, fontWeight: 700 }}>
              <span style={{ color: 'var(--text-primary)' }}>Total cost</span>
              <span style={meta}>{fmtCost(aiTotalCost)}</span>
            </div>
            {aiByType.length === 0 && <p className="text-muted" style={{ margin: 0 }}>No AI usage yet.</p>}
            {aiByType.sort((a, b) => b[1].count - a[1].count).map(([type, s]) => (
              <div key={type} style={row}>
                <span style={{ color: 'var(--text-primary)' }}>{titleCase(type)}</span>
                <span style={meta}>
                  {s.count.toLocaleString()} · {s.total_tokens.toLocaleString()} tok · {fmtCost(s.total_cost)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={panel}>
        <div style={heading}>AI usage by model</div>
        {(aiByModel.length === 0)
          ? <p className="text-muted" style={{ margin: 0 }}>No AI usage yet.</p>
          : aiByModel.map((m) => (
            <div key={m.model} style={row}>
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.model}</span>
              <span style={meta}>{m.usage_count.toLocaleString()} · {fmtCost(m.total_cost)}</span>
            </div>
          ))}
      </div>

      <div style={panel}>
        <div style={heading}>Top servers by AI cost</div>
        {(aiTopGuilds.length === 0)
          ? <p className="text-muted" style={{ margin: 0 }}>No AI usage yet.</p>
          : aiTopGuilds.map((g, i) => (
            <div key={g.guild_id} style={row}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={num}>{i + 1}</span>
                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
              </span>
              <span style={meta}>{fmtCost(g.total_cost)} · {g.usage_count.toLocaleString()}</span>
            </div>
          ))}
      </div>

      {/* ---- Messages ---- */}
      <div style={panel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={heading}>Most active servers (by messages)</div>
          <RangeSelect value={msgDays} onChange={setMsgDays} />
        </div>
        {messages.isLoading ? <p className="text-muted" style={{ margin: 0 }}>Loading…</p> : (
          msgTopGuilds.length === 0
            ? <p className="text-muted" style={{ margin: 0 }}>No message data yet.</p>
            : msgTopGuilds.map((g, i) => (
              <div key={g.guild_id} style={row}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={num}>{i + 1}</span>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                </span>
                <span style={meta}>
                  {g.count.toLocaleString()}
                  {g.channels ? ` · ${g.channels.toLocaleString()} channels` : ''}
                </span>
              </div>
            ))
        )}
      </div>

      <div style={{ ...panel, gridColumn: '1 / -1' }}>
        <div style={{ ...heading }}>Message volume (UTC, daily)</div>
        {messages.isLoading || !messages.data
          ? <p className="text-muted" style={{ margin: 0 }}>Loading…</p>
          : (
            <VolumeChart
              unit="message"
              data={{ granularity: 'day', days: msgDays, buckets: messages.data.volume }}
            />
          )}
      </div>
    </div>
  );
};
