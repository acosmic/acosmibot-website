import { api } from './client';
import type { LevelingConfig, UpdateLevelingConfigRequest } from '@/types/features';

export const levelingApi = {
  getConfig: (guildId: string) =>
    api.fetch<LevelingConfig>(`/api/leveling/${guildId}`),

  updateConfig: (guildId: string, data: UpdateLevelingConfigRequest) =>
    api.fetch<LevelingConfig>(`/api/leveling/${guildId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
