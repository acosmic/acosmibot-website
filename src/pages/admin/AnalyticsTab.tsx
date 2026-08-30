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
const rankedList: React.CSSProperties = {
  height: 320, overflowY: 'auto', paddingRight: 6, scrollbarGutter: 'stable',
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
const metricGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
  margin: '18px -20px 20px', borderTop: '1px solid var(--border-light)',
  borderBottom: '1px solid var(--border-light)', background: 'var(--border-light)', gap: 1,
};
const metricCell: React.CSSProperties = {
  display: 'grid', gap: 4, padding: '14px 20px', background: 'var(--bg-card)',
};

const RANGE_OPTIONS: Array<{ label: string; days: number }> = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

const fmtCost = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const platformLabel = (platform: string) => (
  platform === 'twitter' ? 'X / Twitter' : titleCase(platform)
);

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
  const [embedsDays, setEmbedsDays] = useState(30); // Better Embeds range

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
  const aiCalls = useQuery({
    queryKey: ['global-analytics-ai-calls', aiDays],
    queryFn: () => analyticsApi.globalAiCalls(aiDays),
  });
  const messages = useQuery({
    queryKey: ['global-analytics-messages', msgDays],
    queryFn: () => analyticsApi.globalMessages(msgDays),
  });
  const betterEmbeds = useQuery({
    queryKey: ['global-analytics-better-embeds', embedsDays],
    queryFn: () => analyticsApi.globalBetterEmbeds(embedsDays),
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
  const embedTopPlatform = [...(betterEmbeds.data?.platforms ?? [])]
    .sort((a, b) => b.replaced - a.replaced)[0];
  const fallbackResolutions = (betterEmbeds.data?.providers ?? [])
    .filter((provider) => provider.status === 'fallback_validated')
    .reduce((sum, provider) => sum + provider.count, 0);
  const uncertainResolutions = (betterEmbeds.data?.providers ?? [])
    .filter((provider) => ['default_unverified', 'probe_error'].includes(provider.status))
    .reduce((sum, provider) => sum + provider.count, 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      <div style={panel}>
        <div style={heading}>Most-used commands (all servers)</div>
        <div style={rankedList}>
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
      </div>

      <div style={panel}>
        <div style={heading}>Most active servers (by commands)</div>
        <div style={rankedList}>
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
      </div>

      <div style={panel}>
        <div style={heading}>Top reactions (all servers)</div>
        <div style={rankedList}>
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

      {/* ---- Better Social Embeds ---- */}
      <div style={{ ...panel, gridColumn: '1 / -1' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ ...heading, marginBottom: 4 }}>Better Social Embeds</div>
            <p style={{ ...meta, margin: 0 }}>
              Content-free replacement outcomes across all servers. Posted means the bot transaction completed.
            </p>
          </div>
          <RangeSelect value={embedsDays} onChange={setEmbedsDays} />
        </div>

        {betterEmbeds.isLoading && (
          <p className="text-muted" style={{ margin: '18px 0 0' }}>Loading…</p>
        )}
        {betterEmbeds.isError && (
          <p style={{ color: 'var(--error-color)', margin: '18px 0 0' }}>
            Better Embeds activity is unavailable.
          </p>
        )}
        {betterEmbeds.data && betterEmbeds.data.totals.eligible_messages === 0 && (
          <p className="text-muted" style={{ margin: '18px 0 0' }}>
            No supported links have been recorded in this range.
          </p>
        )}
        {betterEmbeds.data && betterEmbeds.data.totals.eligible_messages > 0 && (
          <>
            <div style={metricGrid}>
              <div style={metricCell}>
                <span style={meta}>Replacements posted</span>
                <strong>{betterEmbeds.data.totals.replacements_posted.toLocaleString()}</strong>
              </div>
              <div style={metricCell}>
                <span style={meta}>Completion</span>
                <strong>{Math.round(betterEmbeds.data.totals.completion_rate * 100)}%</strong>
              </div>
              <div style={metricCell}>
                <span style={meta}>Active servers</span>
                <strong>{betterEmbeds.data.active_guilds.toLocaleString()}</strong>
              </div>
              <div style={metricCell}>
                <span style={meta}>Top platform</span>
                <strong>{embedTopPlatform ? platformLabel(embedTopPlatform.platform) : '—'}</strong>
              </div>
              <div style={metricCell}>
                <span style={meta}>Fallback resolutions</span>
                <strong>{fallbackResolutions.toLocaleString()}</strong>
              </div>
              <div style={metricCell}>
                <span style={meta}>Unverified / probe errors</span>
                <strong>{uncertainResolutions.toLocaleString()}</strong>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
              gap: 24,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={heading}>Daily replacements (UTC)</div>
                <VolumeChart
                  unit="replacement"
                  data={{
                    granularity: 'day',
                    days: embedsDays,
                    buckets: betterEmbeds.data.daily.map((day) => ({
                      bucket: day.date,
                      count: day.replacements_posted,
                    })),
                  }}
                />
              </div>
              <div>
                <div style={heading}>Platform mix</div>
                {betterEmbeds.data.platforms.map((platform) => (
                  <div key={platform.platform} style={compactRow}>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {platformLabel(platform.platform)}
                    </span>
                    <span style={meta}>
                      {platform.replaced.toLocaleString()} / {platform.detected.toLocaleString()}
                    </span>
                  </div>
                ))}
                <p style={{ ...meta, margin: '10px 0 0' }}>Posted / detected links</p>
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24, marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border-light)',
            }}>
              <div>
                <div style={heading}>Top servers by replacements</div>
                {betterEmbeds.data.top_guilds.map((guild, index) => (
                  <div key={guild.guild_id} style={compactRow}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={num}>{index + 1}</span>
                      <span style={{
                        color: 'var(--text-primary)', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {guild.name}
                      </span>
                    </span>
                    <span style={meta}>{guild.replacements_posted.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={heading}>Provider resolution</div>
                {betterEmbeds.data.providers.slice(0, 10).map((provider) => (
                  <div
                    key={`${provider.platform}:${provider.provider}:${provider.status}`}
                    style={compactRow}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>
                      {platformLabel(provider.platform)} · {provider.provider}
                    </span>
                    <span style={meta}>
                      {titleCase(provider.status)} · {provider.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {betterEmbeds.data.tracking_started_at && (
              <p style={{ ...meta, margin: '18px 0 0' }}>
                Forward-only history starts {betterEmbeds.data.tracking_started_at}; aggregates retain up to 400 days.
              </p>
            )}
          </>
        )}
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
        <div style={heading}>AI provider call health</div>
        {aiCalls.isLoading || !aiCalls.data ? <p className="text-muted" style={{ margin: 0 }}>Loading…</p> : (
          <>
            <div style={row}><span style={{ color: 'var(--text-primary)' }}>Calls</span><span style={meta}>{aiCalls.data.call_count.toLocaleString()} · {aiCalls.data.success_count.toLocaleString()} succeeded</span></div>
            <div style={row}><span style={{ color: 'var(--text-primary)' }}>Spend</span><span style={meta}>{fmtCost(Number(aiCalls.data.cost_usd))}</span></div>
            <div style={row}><span style={{ color: 'var(--text-primary)' }}>Latency</span><span style={meta}>p50 {aiCalls.data.latency_ms.p50 ?? '—'} ms · p95 {aiCalls.data.latency_ms.p95 ?? '—'} ms</span></div>
            <div style={row}><span style={{ color: 'var(--text-primary)' }}>Cost quality</span><span style={meta}>{aiCalls.data.unknown_cost_count} unknown · {aiCalls.data.fallback_cost_count} fallback</span></div>
            <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>Daily spend</div>
            {aiCalls.data.spend_by_day.slice(0, 5).map((day) => (
              <div key={day.date} style={compactRow}><span style={{ color: 'var(--text-primary)' }}>{day.date}</span><span style={meta}>{fmtCost(Number(day.cost_usd))} · {day.call_count.toLocaleString()} calls</span></div>
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
