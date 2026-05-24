import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { leaderboardsApi, GlobalLeaderboardEntry } from '@/api/leaderboards';
import { LoadingSpinner } from '@/components/ui';

const LIMIT = 25;

const displayName = (e: GlobalLeaderboardEntry): string =>
  e.global_name || e.discord_username || 'Unknown User';

export const GlobalLeaderboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', 'global-xp', LIMIT],
    queryFn: () => leaderboardsApi.getGlobalXp(LIMIT, 0),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div>Failed to load leaderboard: {(error as Error).message}</div>;

  const entries = data?.entries ?? [];

  return (
    <div className="feature-page">
      <div className="page-header text-start mt-0 mb-4">
        <h1>Global Leaderboard</h1>
        <p>Top members by global XP, earned across every server. Ranking uses fixed,
          server-independent rates so it stays fair no matter how each server tunes its leveling.</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-muted">No ranked members yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th style={{ width: '64px' }}>#</th>
                <th>Member</th>
                <th style={{ width: '100px' }}>Level</th>
                <th style={{ width: '140px' }}>XP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.user_id}>
                  <td>{e.rank}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundImage: e.avatar_url ? `url(${e.avatar_url})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          background: e.avatar_url ? undefined : 'var(--bg-tertiary, #444)',
                          color: 'white',
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        {!e.avatar_url && displayName(e).charAt(0).toUpperCase()}
                      </div>
                      <span>{displayName(e)}</span>
                    </div>
                  </td>
                  <td>{e.global_level}</td>
                  <td>{e.global_exp.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
