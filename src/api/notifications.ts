import { api } from './client';

/** Reward payload carried by a claimable notification. */
export interface NotificationReward {
  credits?: number;
  cosmetic_id?: number | null;
  /** Name of the reward cosmetic, resolved at unlock time (for display). */
  cosmetic_name?: string | null;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  icon: string;
  reference_key: string | null;
  reward: NotificationReward;
  is_read: boolean;
  is_claimed: boolean;
  is_dismissed: boolean;
  is_claimable: boolean;
  created_at: string | null;
  read_at: string | null;
  claimed_at: string | null;
  dismissed_at: string | null;
}

export interface NotificationList {
  notifications: AppNotification[];
  unread_count: number;
}

export interface ClaimResult {
  success: boolean;
  reward: NotificationReward;
  new_bank_balance: number;
  cosmetic_id: number | null;
}

export const notificationsApi = {
  /** Newest-first list + the unread count for the bell badge. */
  list: (status: 'active' | 'dismissed' = 'active'): Promise<NotificationList> =>
    api.fetch<NotificationList>(`/api/notifications?status=${status}`),

  /** Just the unread count — cheap to poll. */
  unreadCount: (): Promise<{ unread_count: number }> =>
    api.fetch<{ unread_count: number }>('/api/notifications/unread-count'),

  markRead: (id: number): Promise<{ success: boolean; unread_count: number }> =>
    api.fetch<{ success: boolean; unread_count: number }>(`/api/notifications/${id}/read`, {
      method: 'POST',
    }),

  markAllRead: (): Promise<{ success: boolean; unread_count: number }> =>
    api.fetch<{ success: boolean; unread_count: number }>('/api/notifications/read-all', {
      method: 'POST',
    }),

  /** Move a notification to the past-notifications history. */
  dismiss: (id: number): Promise<{ success: boolean; unread_count: number }> =>
    api.fetch<{ success: boolean; unread_count: number }>(`/api/notifications/${id}/dismiss`, {
      method: 'POST',
    }),

  /** Claim a reward-bearing notification (grants Acosmicoins / cosmetic). */
  claim: (id: number): Promise<ClaimResult> =>
    api.fetch<ClaimResult>(`/api/notifications/${id}/claim`, { method: 'POST' }),
};
