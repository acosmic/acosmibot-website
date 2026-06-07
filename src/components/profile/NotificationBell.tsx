import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications';
import { useAuthStore } from '@/store/auth';

/**
 * Bell shown near the avatar in the top nav. Polls the unread count and shows a
 * badge; clicking navigates to the user's profile notifications section where
 * rewards are claimed. Shared by ProfileNav and the dashboard TopBar.
 */
export const NotificationBell: React.FC<{ username: string | null; size?: number }> = ({ username, size = 20 }) => {
  const token = useAuthStore((s) => s.token);

  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: !!token,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const count = data?.unread_count ?? 0;
  const href = username ? `/u/${username}#notifications` : '/me';

  return (
    <a
      href={href}
      aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)' }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span
          style={{
            position: 'absolute', top: -6, right: -7, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </a>
  );
};

export default NotificationBell;
