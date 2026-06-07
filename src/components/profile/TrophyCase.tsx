import React from 'react';
import type { UnlockedAchievement } from '@/api/achievements';

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  legendary: '#a855f7',
};

/**
 * The profile trophy case — a grid of unlocked achievement badges. Public
 * (gated server-side by the show_achievements privacy flag). Returns null when
 * there's nothing earned or the section is hidden.
 */
export const TrophyCase: React.FC<{ achievements?: UnlockedAchievement[] | null; isOwner?: boolean }> = ({
  achievements,
  isOwner,
}) => {
  if (!achievements || achievements.length === 0) {
    if (!isOwner) return null;
    return (
      <section style={{ marginBottom: 28 }}>
        <SectionHeader />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          No achievements yet — keep chatting, leveling and claiming your daily reward.{' '}
          <a href="/achievements" style={{ color: 'var(--primary-color)' }}>See what you can earn →</a>
        </p>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHeader count={achievements.length} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {achievements.map((a) => (
          <div
            key={a.key}
            title={a.description}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-secondary)',
              border: `1px solid ${TIER_COLORS[a.tier] ?? 'var(--border-light)'}55`,
              borderRadius: 10, padding: '10px 12px',
            }}
          >
            <span style={{ fontSize: 26, lineHeight: 1 }}>{a.icon || '🏆'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.name}
              </div>
              <div style={{ color: TIER_COLORS[a.tier], fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>
                {a.tier}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const SectionHeader: React.FC<{ count?: number }> = ({ count }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
    <h3 style={{ color: 'var(--text-primary)', fontSize: 18, margin: 0 }}>
      Achievements{count ? ` (${count})` : ''}
    </h3>
    <a href="/achievements" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
      View all →
    </a>
  </div>
);

export default TrophyCase;
