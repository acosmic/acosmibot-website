import { api } from './client';

export type XAlertsTier = 'free' | 'plus' | 'pro' | 'max';

export interface XAlertAccount {
  user_id: string;
  username: string;
  display_name: string;
  profile_image_url: string | null;
  enabled: boolean;
  priority: number;
}

export interface XAlertSettings {
  enabled: boolean;
  channel_id: string | null;
  mention_role_id: string | null;
  accounts: XAlertAccount[];
}

export interface XAlertsData {
  settings: XAlertSettings;
  tier: XAlertsTier;
  limit: number;
  active_account_ids: string[];
  suspended_account_ids: string[];
}

interface XAlertsResponse {
  success: boolean;
  data: XAlertsData;
  message?: string;
}

export interface XUserValidationResult {
  success: boolean;
  valid: boolean;
  message?: string;
  user?: {
    user_id: string;
    username: string;
    display_name: string;
    profile_image_url: string | null;
    verified: boolean;
  };
}

const EMPTY_SETTINGS: XAlertSettings = {
  enabled: false,
  channel_id: null,
  mention_role_id: null,
  accounts: [],
};

const normalizeData = (data: XAlertsData): XAlertsData => ({
  ...data,
  tier: data.tier ?? 'free',
  limit: Number.isFinite(data.limit) ? Math.max(0, data.limit) : 0,
  active_account_ids: data.active_account_ids ?? [],
  suspended_account_ids: data.suspended_account_ids ?? [],
  settings: {
    ...EMPTY_SETTINGS,
    ...(data.settings ?? {}),
    accounts: [...(data.settings?.accounts ?? [])]
      .map((account, index) => ({
        ...account,
        profile_image_url: account.profile_image_url ?? null,
        enabled: account.enabled !== false,
        priority: Number.isFinite(account.priority) ? account.priority : index,
      }))
      .sort((left, right) => left.priority - right.priority),
  },
});

export const xAlertsApi = {
  getConfig: async (guildId: string): Promise<XAlertsData> => {
    const response = await api.fetch<XAlertsResponse>(`/api/guilds/${guildId}/x-alerts`);
    return normalizeData(response.data);
  },

  updateConfig: async (guildId: string, settings: XAlertSettings): Promise<XAlertsData> => {
    const response = await api.fetch<XAlertsResponse>(`/api/guilds/${guildId}/x-alerts`, {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
    return normalizeData(response.data);
  },

  validateUsername: (guildId: string, username: string) =>
    api.fetch<XUserValidationResult>('/api/x/validate-username', {
      method: 'POST',
      body: JSON.stringify({
        guild_id: guildId,
        username: username.trim().replace(/^@/, ''),
      }),
    }),
};
