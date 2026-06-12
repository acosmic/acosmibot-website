import { api } from './client';

export interface ActivityRule {
  id: string;
  name: string;
  enabled: boolean;
  activity_type: string;
  trigger_role_id: string;
  assigned_role_id: string;
}

export interface ActivityMonitorConfig {
  enabled: boolean;
  check_interval: number;
  rules: ActivityRule[];
}

interface SaveResponse {
  success: boolean;
  data: ActivityMonitorConfig;
  errors?: Array<string | { message: string }>;
  message?: string;
}

export const activityMonitorApi = {
  getConfig: (guildId: string) =>
    api.fetch<{ data: ActivityMonitorConfig }>(`/api/guilds/${guildId}/activity-monitor/config`)
      .then((r) => r.data),

  saveConfig: async (guildId: string, config: ActivityMonitorConfig) => {
    const result = await api.fetch<SaveResponse>(
      `/api/guilds/${guildId}/activity-monitor/config`,
      { method: 'POST', body: JSON.stringify(config) },
    );
    if (!result.success) {
      const msg = result.errors
        ? result.errors.map((e) => (typeof e === 'string' ? e : e.message)).join(', ')
        : result.message || 'Failed to save configuration';
      throw new Error(msg);
    }
    return result.data;
  },
};
