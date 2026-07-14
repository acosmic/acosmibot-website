import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Gift, History, Trophy, X } from 'lucide-react';
import { InlineIcon } from '@/components/ui/InlineIcon';
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
    queryKey: ['notifications', 'active'],
    queryFn: () => notificationsApi.list(),
  });

  const [justClaimed, setJustClaimed] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const historyQuery = useQuery({
    queryKey: ['notifications', 'dismissed'],
    queryFn: () => notificationsApi.list('dismissed'),
    enabled: showHistory,
  });

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

  const dismissMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.dismiss(id),
    onSuccess: () => invalidate(),
  });

  const items = query.data?.notifications ?? [];
  const historyItems = historyQuery.data?.notifications ?? [];
  const hasClaimable = useMemo(() => items.some((n) => n.is_claimable), [items]);

  if (query.isLoading) return null;

  return (
    <section id="notifications" style={{ marginBottom: 28, scrollMarginTop: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: 18, margin: 0 }}>Notifications</h3>
        <button
          type="button"
          className="btn btn-sm"
          aria-expanded={showHistory}
          aria-controls="past-notifications"
          onClick={() => setShowHistory((shown) => !shown)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <History size={14} /> Past notifications
          <ChevronDown
            size={14}
            style={{ transform: showHistory ? 'rotate(180deg)' : undefined, transition: 'transform 150ms ease' }}
          />
        </button>
      </div>
      {hasClaimable && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          You have rewards to claim <InlineIcon icon={Gift} color="#ffd700" />
        </p>
      )}
      {items.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              claimed={justClaimed === n.id}
              claiming={claimMutation.isPending && claimMutation.variables === n.id}
              dismissing={dismissMutation.isPending && dismissMutation.variables === n.id}
              onClaim={() => claimMutation.mutate(n.id)}
              onDismiss={() => dismissMutation.mutate(n.id)}
            />
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '10px 0 0' }}>
          You’re all caught up.
        </p>
      )}

      {showHistory && (
        <div id="past-notifications" style={{ borderTop: '1px solid var(--border-light)', marginTop: 16, paddingTop: 14 }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 10px' }}>Past notifications</h4>
          {historyQuery.isLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Loading…</p>
          ) : historyItems.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {historyItems.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  claimed={justClaimed === n.id}
                  claiming={claimMutation.isPending && claimMutation.variables === n.id}
                  dismissing={false}
                  onClaim={() => claimMutation.mutate(n.id)}
                />
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No past notifications yet.</p>
          )}
        </div>
      )}

      {(claimMutation.error || dismissMutation.error) && (
        <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
          Error: {String(claimMutation.error || dismissMutation.error)}
        </p>
      )}
    </section>
  );
};

const CONFETTI = ['#00d9ff', '#ffd700', '#ff5277', '#a3ff3c', '#a855f7'];

const NotificationRow: React.FC<{
  n: AppNotification;
  claimed: boolean;
  claiming: boolean;
  dismissing: boolean;
  onClaim: () => void;
  onDismiss?: () => void;
}> = ({ n, claimed, claiming, dismissing, onClaim, onDismiss }) => {
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
      {n.icon
        ? <span style={{ fontSize: 26, lineHeight: 1 }}>{n.icon}</span>
        : <Trophy size={26} color="#ffd700" />}
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
        {n.is_dismissed && n.created_at && (
          <time dateTime={n.created_at} style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
            {formatNotificationDate(n.created_at)}
          </time>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {canClaim ? (
          <button type="button" className="btn btn-sm primary" disabled={claiming} onClick={onClaim}>
            {claiming ? 'Claiming…' : 'Claim'}
          </button>
        ) : n.is_claimed ? (
          <span className={claimed ? 'dr-reward-pop' : undefined} style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>
            <InlineIcon icon={Check} /> Claimed
          </span>
        ) : null}
        {onDismiss && (
          <button
            type="button"
            className="btn btn-sm"
            aria-label={`Dismiss ${n.title}`}
            title="Move to past notifications"
            disabled={dismissing}
            onClick={onDismiss}
            style={{ width: 30, height: 30, padding: 0, display: 'inline-grid', placeItems: 'center' }}
          >
            <X size={16} />
          </button>
        )}
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

const formatNotificationDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export default NotificationList;
