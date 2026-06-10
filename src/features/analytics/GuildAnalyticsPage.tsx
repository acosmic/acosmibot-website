import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';
import type { TopReaction } from '@/api/profile';
import { LoadingSpinner } from '@/components/ui';

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

  if (commands.isLoading || reactions.isLoading) return <LoadingSpinner />;

  const topCommands = commands.data?.top_commands ?? [];
  const neverUsed = commands.data?.never_used ?? [];
  const topReactions = reactions.data?.top_reactions ?? [];

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ marginBottom: 4 }}>Server Analytics</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
        What your members actually use — popular commands, untapped features, and favorite reactions.
      </p>

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
    </div>
  );
};
