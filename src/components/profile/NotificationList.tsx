import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type AppNotification } from '@/api/notifications';
import './DailyReward.css';

/**
 * Owner-only notifications feed shown on the profile (the bell links here via
 * the #notifications anchor). Each reward-bearing notification has a Claim
 * button that grants credits / a cosmetic and plays a small celebration.
 */
export const NotificationList: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });

  const [justClaimed, setJustClaimed] = useState<number | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  // Mark everything read once the panel is viewed (clears the bell badge).
  const seenRef = React.useRef(false);
  useEffect(() => {
    if (seenRef.current) return;
    if (query.data && query.data.unread_count > 0) {
      seenRef.current = true;
      notificationsApi.markAllRead().then(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
      }).catch(() => {});
    }
  }, [query.data, queryClient]);

  const claimMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.claim(id),
    onSuccess: (_res, id) => { setJustClaimed(id); invalidate(); },
  });

  const items = query.data?.notifications ?? [];
  const hasClaimable = useMemo(() => items.some((n) => n.is_claimable), [items]);

  if (query.isLoading) return null;
  if (!items.length) return null;

  return (
    <section id="notifications" style={{ marginBottom: 28, scrollMarginTop: 72 }}>
      <h3 style={{ color: 'var(--text-primary)', fontSize: 18, marginBottom: 4 }}>Notifications</h3>
      {hasClaimable && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          You have rewards to claim 🎁
        </p>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((n) => (
          <NotificationRow
            key={n.id}
            n={n}
            claimed={justClaimed === n.id}
            claiming={claimMutation.isPending && claimMutation.variables === n.id}
            onClaim={() => claimMutation.mutate(n.id)}
          />
        ))}
      </div>
      {claimMutation.error && (
        <p style={{ color: '#f87171', fontSize: 13 }}>Error: {String(claimMutation.error)}</p>
      )}
    </section>
  );
};

const CONFETTI = ['#00d9ff', '#ffd700', '#ff5277', '#a3ff3c', '#a855f7'];

const NotificationRow: React.FC<{
  n: AppNotification;
  claimed: boolean;
  claiming: boolean;
  onClaim: () => void;
}> = ({ n, claimed, claiming, onClaim }) => {
  const credits = n.reward?.credits ?? 0;
  const canClaim = n.is_claimable;

  return (
    <div
      className={claimed ? 'dr-card--claimed' : undefined}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'var(--bg-secondary)',
        border: `1px solid ${canClaim ? 'rgba(255,215,0,0.4)' : 'var(--border-light)'}`,
        borderRadius: 10, padding: '12px 16px',
        opacity: n.is_claimed && !claimed ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>{n.icon || '🏆'}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
        {n.body && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{n.body}</div>}
        {(credits > 0 || n.reward?.cosmetic_id) && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
            Reward:{' '}
            {credits > 0 && <strong style={{ color: '#ffd700' }}>{credits.toLocaleString()} credits</strong>}
            {credits > 0 && n.reward?.cosmetic_id ? ' + ' : ''}
            {n.reward?.cosmetic_id ? <strong style={{ color: '#a855f7' }}>{n.reward?.cosmetic_name || 'a cosmetic'}</strong> : ''}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto' }}>
        {canClaim ? (
          <button type="button" className="btn btn-sm primary" disabled={claiming} onClick={onClaim}>
            {claiming ? 'Claiming…' : 'Claim'}
          </button>
        ) : n.is_claimed ? (
          <span className={claimed ? 'dr-reward-pop' : undefined} style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>
            ✓ Claimed
          </span>
        ) : null}
      </div>

      {claimed && (
        <div className="dr-confetti-layer" style={{ left: 'auto', right: 40 }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const dist = 40 + (i % 3) * 14;
            return (
              <span
                key={i}
                className="dr-confetti-piece"
                style={{
                  background: CONFETTI[i % CONFETTI.length],
                  ['--dr-dx' as any]: `${Math.cos(angle) * dist}px`,
                  ['--dr-dy' as any]: `${Math.sin(angle) * dist}px`,
                  ['--dr-rot' as any]: `${180 + i * 30}deg`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationList;
