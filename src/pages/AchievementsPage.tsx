import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { achievementsApi, type AchievementCatalogEntry } from '@/api/achievements';
import { ProfileNav } from '@/components/profile/ProfileNav';
import { startLogin, useHydrateAuthUser } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  legendary: '#a855f7',
};

const CATEGORY_LABELS: Record<string, string> = {
  leveling: 'Leveling',
  social: 'Social',
  economy: 'Economy',
  games: 'Games',
  special: 'Special',
};

/** Browse the full achievements catalog with your unlock state + progress. */
export const AchievementsPage: React.FC = () => {
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  useHydrateAuthUser();

  const { data, isLoading } = useQuery({
    queryKey: ['achievements', 'catalog'],
    queryFn: () => achievementsApi.getCatalog(),
    enabled: !!token,
  });

  const grouped = useMemo(() => {
    const map: Record<string, AchievementCatalogEntry[]> = {};
    for (const a of data?.achievements ?? []) (map[a.category] ??= []).push(a);
    return map;
  }, [data]);

  const unlocked = data?.unlocked_count ?? 0;
  const total = data?.achievements.length ?? 0;

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ProfileNav user={authUser} />

      <div style={{ flex: 1, padding: '40px 24px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <nav style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '14px' }}>
          {authUser?.username && (
            <Link to={`/u/${authUser.username}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
              ← Back to profile
            </Link>
          )}
          <Link to="/settings" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Settings
          </Link>
        </nav>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ color: 'var(--text-primary)', margin: 0 }}>🏆 Achievements</h1>
          {token && <span style={{ color: 'var(--text-muted)' }}>{unlocked} / {total} unlocked</span>}
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 28 }}>
          Earn badges by leveling up, chatting, and staying active. Rewards are claimed from your profile notifications.
        </p>

        {!token ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Sign in to track your achievement progress.</p>
            <button className="btn primary" onClick={startLogin}>Sign in with Discord</button>
          </div>
        ) : isLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          Object.keys(grouped).map((category) => (
            <section key={category} style={{ marginBottom: 32 }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 18, marginBottom: 14 }}>
                {CATEGORY_LABELS[category] ?? category}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {grouped[category].map((a) => <AchievementCard key={a.key} a={a} />)}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

const AchievementCard: React.FC<{ a: AchievementCatalogEntry }> = ({ a }) => {
  const tierColor = TIER_COLORS[a.tier] ?? 'var(--border-light)';
  const pct = a.progress && a.progress.threshold > 0
    ? Math.min(100, Math.round((a.progress.current / a.progress.threshold) * 100))
    : 0;

  return (
    <div
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        background: 'var(--bg-secondary)',
        border: `1px solid ${a.unlocked ? `${tierColor}88` : 'var(--border-light)'}`,
        borderRadius: 12, padding: 14,
        opacity: a.unlocked ? 1 : 0.92,
      }}
    >
      <span style={{ fontSize: 30, lineHeight: 1, filter: a.unlocked ? 'none' : 'grayscale(0.7)' }}>
        {a.icon || '🏆'}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{a.name}</strong>
          {a.unlocked && <span style={{ color: '#4ade80', fontSize: 12 }}>✓</span>}
          {a.available_until && !a.unlocked && (
            <span style={{
              color: '#f59e0b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              border: '1px solid #f59e0b66', borderRadius: 6, padding: '1px 6px',
            }}>
              Limited — ends {new Date(a.available_until).toLocaleDateString()}
            </span>
          )}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{a.description}</div>

        {!a.unlocked && a.progress && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: tierColor }} />
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
              {a.progress.current.toLocaleString()} / {a.progress.threshold.toLocaleString()}
            </div>
          </div>
        )}

        {(a.reward_credits ? a.reward_credits > 0 : false) || a.reward_cosmetic_id ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 8 }}>
            Reward:{' '}
            {a.reward_credits ? <span style={{ color: '#ffd700' }}>{a.reward_credits.toLocaleString()} credits</span> : ''}
            {a.reward_credits && a.reward_cosmetic_id ? ' + ' : ''}
            {a.reward_cosmetic_id ? <span style={{ color: '#a855f7' }}>cosmetic</span> : ''}
          </div>
        ) : null}
      </div>
      <span style={{ color: tierColor, fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
        {a.tier}
      </span>
    </div>
  );
};

export default AchievementsPage;
