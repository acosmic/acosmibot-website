import { api } from './client';

export interface DailyStatus {
  can_claim: boolean;
  streak: number;
  claimed_today: boolean;
  next_streak: number;
  next_reward: number;
  seconds_until_reset: number;
}

export interface DailyClaim {
  claimed: boolean;
  reward: number;
  streak: number;
  new_bank_balance: number;
  seconds_until_reset: number;
}

export const dailyApi = {
  getStatus: (): Promise<DailyStatus> => api.fetch<DailyStatus>('/api/daily'),
  claim: (): Promise<DailyClaim> => api.fetch<DailyClaim>('/api/daily/claim', { method: 'POST' }),
};
