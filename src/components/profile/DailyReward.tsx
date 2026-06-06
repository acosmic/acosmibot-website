import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyApi } from '@/api/daily';
import './DailyReward.css';

const CONFETTI_COLORS = ['#00d9ff', '#ffd700', '#ff6b6b', '#7CFC00', '#ff9ff3', '#feca57'];

/**
 * Daily login reward — the repeat-visit hook. Owner-only; claim once per UTC day
 * to grow a streak (bigger reward). Celebrates the claim with a little burst.
 */
export const DailyReward: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['daily'],
    queryFn: () => dailyApi.getStatus(),
  });

  const claim = useMutation({
    mutationFn: () => dailyApi.claim(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] }); // currency changed
    },
  });

  if (isLoading || isError || !data) return null;

  const justClaimed = claim.isSuccess;
  const canClaim = data.can_claim && !claim.isPending && !justClaimed;
  const streakShown = claim.data?.streak ?? data.streak;
  const resetIn = formatReset(claim.data?.seconds_until_reset ?? data.seconds_until_reset);
  const showCelebration = data.can_claim || justClaimed; // gift state, not the "already claimed" state

  return (
    <div
      className={justClaimed ? 'dr-card--claimed' : undefined}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
        background: 'var(--bg-card)',
        border: `1px solid ${showCelebration ? 'var(--border-cyan)' : 'var(--border-light)'}`,
        borderRadius: '16px', padding: '18px 20px', marginBottom: '20px',
      }}
    >
      {justClaimed && <Confetti />}

      <div
        key={justClaimed ? 'claimed' : 'idle'}
        className={justClaimed ? 'dr-emoji--pop' : (canClaim ? 'dr-gift--idle' : undefined)}
        style={{ fontSize: '2rem', lineHeight: 1 }}
      >
        {justClaimed ? '🎉' : data.can_claim ? '🎁' : '✅'}
      </div>

      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Daily reward
          {streakShown > 0 && (
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}> · 🔥 {streakShown.toLocaleString()} day streak</span>
          )}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {justClaimed ? (
            <span className="dr-reward-pop" style={{ color: 'var(--primary-color)', fontWeight: 700 }}>
              +{claim.data!.reward.toLocaleString()} credits added to your bank — withdraw in any server!
            </span>
          ) : data.can_claim
            ? `Claim +${data.next_reward.toLocaleString()} credits to your bank (day ${data.next_streak.toLocaleString()}). Resets in ${resetIn}.`
            : `Claimed today. Next reward in ${resetIn}.`}
        </div>
      </div>

      <button
        onClick={() => claim.mutate()}
        disabled={!canClaim}
        style={{
          flexShrink: 0,
          background: canClaim ? 'var(--primary-color)' : 'var(--bg-tertiary)',
          color: canClaim ? '#000' : 'var(--text-muted)',
          border: 'none', borderRadius: '10px', padding: '10px 22px',
          fontSize: '14px', fontWeight: 700, cursor: canClaim ? 'pointer' : 'default',
          transition: 'transform 0.1s ease',
        }}
      >
        {claim.isPending ? 'Claiming…' : justClaimed ? 'Claimed 🎉' : data.can_claim ? `Claim +${data.next_reward.toLocaleString()}` : 'Claimed'}
      </button>
    </div>
  );
};

/** A short burst of confetti pieces flying out from the gift icon. */
const Confetti: React.FC = () => {
  const pieces = React.useMemo(
    () => Array.from({ length: 16 }, (_, i) => {
      const angle = (Math.PI * (0.15 + Math.random() * 0.7)); // upward-ish fan
      const dist = 60 + Math.random() * 70;
      return {
        id: i,
        dx: `${Math.cos(angle) * dist * (Math.random() < 0.5 ? -1 : 1)}px`,
        dy: `${-Math.sin(angle) * dist + 40}px`,
        rot: `${360 + Math.random() * 360}deg`,
        delay: `${Math.random() * 0.12}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      };
    }),
    [],
  );
  return (
    <div className="dr-confetti-layer" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="dr-confetti-piece"
          style={{
            background: p.color,
            animationDelay: p.delay,
            // CSS custom props consumed by the keyframes
            ['--dr-dx' as any]: p.dx,
            ['--dr-dy' as any]: p.dy,
            ['--dr-rot' as any]: p.rot,
          }}
        />
      ))}
    </div>
  );
};

function formatReset(seconds: number): string {
  if (seconds <= 0) return 'soon';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
