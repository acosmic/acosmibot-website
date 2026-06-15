import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';
import type { TopReaction } from '@/api/profile';
import { LoadingSpinner, FeatureToggle, ChannelSelect, SaveBar } from '@/components/ui';
import { useDirtyState } from '@/hooks/useDirtyState';
import { useRecapConfig, RecapConfig } from './useRecapConfig';
import { Sparkline } from './charts';

const fmtCost = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Custom Discord emoji from the CDN, or the unicode char directly. */
export const EmojiBadge: React.FC<{ reaction: TopReaction; size?: number }> = ({ reaction, size = 20 }) => {
  if (reaction.emoji_id) {
    const ext = reaction.animated ? 'gif' : 'png';
    return (
      <img
        src={`https://cdn.discordapp.com/emojis/${reaction.emoji_id}.${ext}?size=32`}
        alt={reaction.emoji_display}
        title={`:${reaction.emoji_display}:`}
        style={{ width: size, height: size, verticalAlign: 'middle' }}
      />
    );
  }
  return <span style={{ fontSize: `${size - 2}px` }}>{reaction.emoji_display}</span>;
};

const panel: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
  borderRadius: '14px', padding: '20px', marginBottom: '16px',
};
const heading: React.CSSProperties = {
  fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '14px', fontWeight: 600,
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0',
};
const num: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '13px', width: 22 };
const meta: React.CSSProperties = {
  color: 'var(--text-muted)', fontSize: '13px', fontVariantNumeric: 'tabular-nums',
};

export const GuildAnalyticsPage: React.FC = () => {
  const { guildId } = useParams<{ guildId: string }>();

  const commands = useQuery({
    queryKey: ['guild-analytics-commands', guildId],
    queryFn: () => analyticsApi.guildCommands(guildId!),
    enabled: !!guildId,
  });
  const reactions = useQuery({
    queryKey: ['guild-analytics-reactions', guildId],
    queryFn: () => analyticsApi.guildReactions(guildId!),
    enabled: !!guildId,
  });
  const [days] = useState(30);
  const aiUsage = useQuery({
    queryKey: ['guild-analytics-ai', guildId, days],
    queryFn: () => analyticsApi.guildAiUsage(guildId!, days),
    enabled: !!guildId,
  });
  const channels = useQuery({
    queryKey: ['guild-analytics-channels', guildId, days],
    queryFn: () => analyticsApi.guildChannels(guildId!, days),
    enabled: !!guildId,
  });

  const { recap, save: saveRecap, isSaving, saveError } = useRecapConfig(guildId!);
  const { form: recapForm, setForm: setRecapForm, isDirty: recapDirty, resetForm: resetRecapForm } =
    useDirtyState<RecapConfig>(recap);

  if (commands.isLoading || reactions.isLoading) return <LoadingSpinner />;

  const topCommands = commands.data?.top_commands ?? [];
  const neverUsed = commands.data?.never_used ?? [];
  const topReactions = reactions.data?.top_reactions ?? [];
  const aiByType = Object.entries(aiUsage.data?.stats_by_type ?? {});
  const aiTopUsers = aiUsage.data?.top_users ?? [];
  const aiTotalCost = aiByType.reduce((sum, [, s]) => sum + s.total_cost, 0);
  const channelList = channels.data?.channels ?? [];

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ marginBottom: 4 }}>Server Analytics</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
        What your members actually use — popular commands, untapped features, and favorite reactions.
      </p>

      {recapForm && (
        <div style={{ marginBottom: 16 }}>
          <FeatureToggle
            enabled={recapForm.enabled}
            onChange={(v) => setRecapForm({ enabled: v })}
            label="Weekly Recap"
            description="Post a summary of the week's top commands and reactions every Monday."
          />
          {recapForm.enabled && (
            <div style={panel}>
              <ChannelSelect
                guildId={guildId!}
                value={recapForm.channel_id}
                onChange={(v) => setRecapForm({ channel_id: v })}
                label="Recap Channel"
                placeholder="Select a channel…"
              />
              {!recapForm.channel_id && (
                <p style={{ color: 'var(--warning-color, #e0a800)', fontSize: 13, margin: 0 }}>
                  Pick a channel — recaps won't post until one is selected.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={panel}>
        <div style={heading}>Most-used commands</div>
        {topCommands.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No command usage recorded yet.</div>
        ) : topCommands.map((c, i) => (
          <div key={c.name} style={row}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={num}>{i + 1}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>/{c.name}</span>
            </span>
            <span style={meta}>
              {c.count.toLocaleString()} uses{c.users ? ` · ${c.users.toLocaleString()} members` : ''}
            </span>
          </div>
        ))}
      </div>

      {neverUsed.length > 0 && (
        <div style={panel}>
          <div style={heading}>Never used here ({neverUsed.length})</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -6, marginBottom: 12 }}>
            Commands your members haven't tried — candidates to promote or surface.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {neverUsed.map((name) => (
              <span key={name} style={{
                background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
                border: '1px solid var(--border-light)', borderRadius: 8,
                padding: '4px 10px', fontSize: 13, color: 'var(--text-secondary, var(--text-muted))',
              }}>/{name}</span>
            ))}
          </div>
        </div>
      )}

      <div style={panel}>
        <div style={heading}>Top reactions</div>
        {topReactions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No reactions recorded yet.</div>
        ) : topReactions.map((r, i) => (
          <div key={r.emoji_key} style={row}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={num}>{i + 1}</span>
              <EmojiBadge reaction={r} />
            </span>
            <span style={meta}>{r.count.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div style={panel}>
        <div style={heading}>Most active channels (last {days} days)</div>
        {channels.isLoading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : channelList.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No channel activity recorded yet.</div>
        ) : channelList.slice(0, 15).map((c, i) => (
          <div key={c.channel_id} style={row}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={num}>{i + 1}</span>
              <span style={{
                color: 'var(--text-primary)', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>#{c.name}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Sparkline data={c.series.map((s) => s.count)} />
              <span style={{ ...meta, minWidth: 56, textAlign: 'right' }}>
                {c.count.toLocaleString()}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div style={panel}>
        <div style={heading}>AI usage (last {days} days)</div>
        {aiUsage.isLoading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : aiByType.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No AI usage recorded yet.</div>
        ) : (
          <>
            <div style={{ ...row, fontWeight: 700 }}>
              <span style={{ color: 'var(--text-primary)' }}>Total cost</span>
              <span style={meta}>{fmtCost(aiTotalCost)}</span>
            </div>
            {aiByType.sort((a, b) => b[1].count - a[1].count).map(([type, s]) => (
              <div key={type} style={row}>
                <span style={{ color: 'var(--text-primary)' }}>{titleCase(type)}</span>
                <span style={meta}>
                  {s.count.toLocaleString()} · {s.total_tokens.toLocaleString()} tok · {fmtCost(s.total_cost)}
                </span>
              </div>
            ))}
            {aiTopUsers.length > 0 && (
              <>
                <div style={{ ...heading, marginTop: 16 }}>Top AI users</div>
                {aiTopUsers.map((u, i) => (
                  <div key={u.user_id} style={row}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={num}>{i + 1}</span>
                      <span style={{
                        color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{u.username}</span>
                    </span>
                    <span style={meta}>{u.total_usage.toLocaleString()} uses</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      <SaveBar
        isDirty={recapDirty}
        onSave={() => saveRecap(recapForm!)}
        onDiscard={resetRecapForm}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
};
