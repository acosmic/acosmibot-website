/**
 * THESIS: Achievement progress is a navigable atlas, not a wall of interchangeable badge cards.
 * OWN-WORLD: Observatory field, tier signals, category sectors, compact progress tracks, and literal reward labels.
 * STORY: See total completion, enter a category, understand what is unlocked, and identify the next attainable badge.
 * FIRST VIEWPORT: A completion orbit anchors the right side while the catalog thesis and category index lead on the left.
 * FORM: Fifth-ranked achievement-atlas structure; established world; seed 61a84eab.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, LockKeyhole, Sparkles, Trophy } from 'lucide-react';
import { achievementsApi, type AchievementCatalogEntry } from '@/api/achievements';
import { MemberNav } from '@/components/profile/MemberNav';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { startLogin } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import '@/styles/member.css';

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#b7c5cf',
  gold: '#ffd166',
  legendary: '#9f8bff',
};

const CATEGORY_LABELS: Record<string, string> = {
  leveling: 'Leveling',
  social: 'Social',
  economy: 'Economy',
  games: 'Games',
  special: 'Special',
};

const CATEGORY_NOTES: Record<string, string> = {
  leveling: 'XP, levels, and long-term progression.',
  social: 'Conversation, reactions, and community participation.',
  economy: 'Acosmicoins, banking, collecting, and trade.',
  games: 'Play, wins, streaks, and risk.',
  special: 'Events, milestones, and rare moments.',
};

export const AchievementsPage: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['achievements', 'catalog'],
    queryFn: () => achievementsApi.getCatalog(),
    enabled: isAuthenticated,
  });

  const grouped = useMemo(() => {
    const map: Record<string, AchievementCatalogEntry[]> = {};
    for (const achievement of data?.achievements ?? []) {
      (map[achievement.category] ??= []).push(achievement);
    }
    return map;
  }, [data]);

  const unlocked = data?.unlocked_count ?? 0;
  const total = data?.achievements.length ?? 0;
  const completion = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <div className="member-page achievements-page">
      <PublicNav variant="observatory" />
      <MemberNav />

      <main className="member-main achievements-main">
        <header className="achievements-hero">
          <div className="achievements-hero__copy">
            <p className="member-kicker">Progression atlas</p>
            <h1>Every signal you’ve earned—and what comes next.</h1>
            <p>
              Explore badges across leveling, community, economy, games, and special events.
              Rewards are claimed from your profile notifications.
            </p>
            {isAuthenticated && Object.keys(grouped).length > 0 && (
              <nav className="achievement-category-index" aria-label="Achievement categories">
                {Object.entries(grouped).map(([category, entries]) => (
                  <a key={category} href={`#achievement-${category}`}>
                    <span>{CATEGORY_LABELS[category] ?? category}</span>
                    <small>{entries.filter((entry) => entry.unlocked).length}/{entries.length}</small>
                  </a>
                ))}
              </nav>
            )}
          </div>

          <div className="achievement-orbit" aria-label={`${unlocked} of ${total} achievements unlocked`}>
            <div className="achievement-orbit__ring" style={{ '--completion': `${completion * 3.6}deg` } as React.CSSProperties}>
              <div className="achievement-orbit__core">
                <Trophy aria-hidden="true" />
                <strong>{isAuthenticated ? `${completion}%` : '—'}</strong>
                <span>{isAuthenticated ? `${unlocked} / ${total} unlocked` : 'Sign in to sync'}</span>
              </div>
            </div>
            <span className="achievement-orbit__node is-bronze" />
            <span className="achievement-orbit__node is-silver" />
            <span className="achievement-orbit__node is-gold" />
            <span className="achievement-orbit__node is-legendary" />
          </div>
        </header>

        {!isAuthenticated ? (
          <section className="member-gate">
            <span><LockKeyhole aria-hidden="true" /></span>
            <div>
              <p className="member-kicker">Personal progress</p>
              <h2>Connect your Discord signal.</h2>
              <p>Sign in to see unlocked badges, live metric progress, limited-time availability, and rewards.</p>
            </div>
            <button type="button" onClick={startLogin}>Sign in with Discord</button>
          </section>
        ) : isLoading ? (
          <AchievementSkeleton />
        ) : isError ? (
          <section className="member-error">
            <Sparkles aria-hidden="true" />
            <h2>Achievement signals are unavailable.</h2>
            <p>The catalog could not be loaded. Try the request again.</p>
            <button type="button" onClick={() => refetch()}>Retry catalog</button>
          </section>
        ) : total === 0 ? (
          <section className="member-empty">
            <Trophy aria-hidden="true" />
            <h2>The atlas is quiet.</h2>
            <p>No achievements are currently available.</p>
          </section>
        ) : (
          <div className="achievement-atlas">
            {Object.entries(grouped).map(([category, entries]) => (
              <section className="achievement-sector" id={`achievement-${category}`} key={category}>
                <header>
                  <div>
                    <p>{CATEGORY_NOTES[category] ?? 'Community milestones and rewards.'}</p>
                    <h2>{CATEGORY_LABELS[category] ?? category}</h2>
                  </div>
                  <span>{entries.filter((entry) => entry.unlocked).length} of {entries.length} complete</span>
                </header>
                <div className="achievement-sector__track">
                  {entries.map((achievement) => (
                    <AchievementNode key={achievement.key} achievement={achievement} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

const AchievementNode: React.FC<{ achievement: AchievementCatalogEntry }> = ({ achievement }) => {
  const tierColor = TIER_COLORS[achievement.tier] ?? 'var(--member-border)';
  const progress = achievement.progress;
  const percent = progress && progress.threshold > 0
    ? Math.min(100, Math.round((progress.current / progress.threshold) * 100))
    : 0;

  return (
    <article
      className={`achievement-node${achievement.unlocked ? ' is-unlocked' : ''}`}
      style={{ '--tier-color': tierColor } as React.CSSProperties}
    >
      <span className="achievement-node__connector" aria-hidden="true" />
      <div className="achievement-node__mark" aria-hidden="true">
        <span>{achievement.icon || <Trophy />}</span>
        {achievement.unlocked && <i><Check /></i>}
      </div>
      <div className="achievement-node__body">
        <div className="achievement-node__title">
          <div>
            <span>{achievement.tier}</span>
            <h3>{achievement.name}</h3>
          </div>
          <ChevronRight aria-hidden="true" />
        </div>
        <p>{achievement.description}</p>
        {achievement.available_until && !achievement.unlocked && (
          <strong className="achievement-node__limited">
            Limited · ends {new Date(achievement.available_until).toLocaleDateString()}
          </strong>
        )}
        {!achievement.unlocked && progress && (
          <div className="achievement-node__progress">
            <div><span style={{ width: `${percent}%` }} /></div>
            <small>{progress.current.toLocaleString()} / {progress.threshold.toLocaleString()}</small>
          </div>
        )}
        {(achievement.reward_credits || achievement.reward_cosmetic_id) && (
          <div className="achievement-node__reward">
            Reward · {achievement.reward_credits ? `${achievement.reward_credits.toLocaleString()} Acosmicoins` : ''}
            {achievement.reward_credits && achievement.reward_cosmetic_id ? ' + ' : ''}
            {achievement.reward_cosmetic_id ? 'cosmetic' : ''}
          </div>
        )}
      </div>
    </article>
  );
};

const AchievementSkeleton: React.FC = () => (
  <div className="achievement-skeleton" aria-label="Loading achievement catalog">
    {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
  </div>
);

export default AchievementsPage;
