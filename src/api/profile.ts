import { api } from './client';

export interface PrivacySettings {
  profile_public: boolean;
  show_economy: boolean;
  show_guilds: boolean;
}

export interface ProfileGuild {
  guild_id: string;
  guild_name: string | null;
  level: number;
  exp: number;
  rank: number | null;
  streak: number;
}

export interface ProfileGlobal {
  level: number;
  exp: number;
  exp_rank: number | null;
  total_messages: number;
  total_reactions: number;
  total_commands: number;
  // Present only when the economy section is visible.
  currency?: number;
  bank_balance?: number;
  currency_rank?: number | null;
}

export interface PublicProfile {
  id: string;
  username: string;
  global_name: string | null;
  avatar_url: string;
  member_since: string | null;
  account_created: string | null;
  global: ProfileGlobal;
  guilds: ProfileGuild[] | null;
  privacy: PrivacySettings;
  is_owner?: boolean;
}

export const profileApi = {
  /** Public profile for /u/<username>. Works logged-out. */
  getPublicProfile: (identifier: string): Promise<PublicProfile> =>
    api.fetch<PublicProfile>(`/api/profile/${encodeURIComponent(identifier)}`),

  /** The authenticated user's own profile, including hidden sections. */
  getMyProfile: (): Promise<PublicProfile> =>
    api.fetch<PublicProfile>('/api/profile/me'),

  /** Update the authenticated user's privacy (opt-out) toggles. */
  updateMyPrivacy: (updates: Partial<PrivacySettings>): Promise<{ privacy: PrivacySettings }> =>
    api.fetch<{ privacy: PrivacySettings }>('/api/profile/me', {
      method: 'PATCH',
      body: JSON.stringify({ privacy: updates }),
    }),
};
