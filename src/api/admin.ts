import { api } from './client';

export interface AdminAiSettings {
  enabled: boolean;
  model: string;
  daily_limit: number;
  monthly_limit: number;
  available_models: string[];
}

export interface AdminAiSettingsResponse {
  success: boolean;
  data: AdminAiSettings;
}

export const adminApi = {
  getAiSettings: () =>
    api.fetch<AdminAiSettingsResponse>('/api/admin/ai-settings'),

  updateAiSettings: (payload: Partial<Omit<AdminAiSettings, 'available_models'>>) =>
    api.fetch<{ success: boolean; updated_count: number }>(
      '/api/admin/ai-settings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
};
