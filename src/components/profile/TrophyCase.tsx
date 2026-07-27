import React from 'react';
import { Trophy } from 'lucide-react';
import type { UnlockedAchievement } from '@/api/achievements';

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#b7c5cf',
  gold: '#ffd166',
  legendary: '#9f8bff',
};

export const TrophyCase: React.FC<{
  achievements?: UnlockedAchievement[] | null;
  isOwner?: boolean;
}> = ({ achievements, isOwner }) => {
  if (!achievements || achievements.length === 0) {
    if (!isOwner) return null;
    return (
      <section className="profile-trophies is-empty">
        <TrophyHeader />
        <p>
          No achievements yet—keep chatting, leveling, and claiming your daily reward.
          <a href="/achievements">See what you can earn</a>
        </p>
      </section>
    );
  }

  return (
    <section className="profile-trophies">
      <TrophyHeader count={achievements.length} />
      <div className="profile-trophies__grid">
        {achievements.map((achievement) => (
          <article
            key={achievement.key}
            title={achievement.description}
            style={{ '--trophy-color': TIER_COLORS[achievement.tier] } as React.CSSProperties}
          >
            <span>{achievement.icon || <Trophy aria-hidden="true" />}</span>
            <div><strong>{achievement.name}</strong><small>{achievement.tier}</small></div>
          </article>
        ))}
      </div>
    </section>
  );
};

const TrophyHeader: React.FC<{ count?: number }> = ({ count }) => (
  <header>
    <div><p>Collected milestones</p><h2>Achievements{count ? ` · ${count}` : ''}</h2></div>
    <a href="/achievements">View atlas</a>
  </header>
);

export default TrophyCase;
