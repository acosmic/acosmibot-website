import { api } from './client';
import type { GiveawayConfig, UpdateGiveawayConfigRequest } from '@/types/features';

export const giveawayApi = {
  getConfig: (guildId: string) =>
    api.fetch<GiveawayConfig>(`/api/giveaway/${guildId}`),

  updateConfig: (guildId: string, data: UpdateGiveawayConfigRequest) =>
    api.fetch<GiveawayConfig>(`/api/giveaway/${guildId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
