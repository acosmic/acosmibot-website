export interface User {
  id: string;
  username: string;
  avatar: string | null;
  global_name: string | null;
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string[];
  member_count?: number;
  premium_tier?: string;
  premium_entitlement?: {
    tier: string;
    source: 'free' | 'stripe' | 'complimentary';
    complimentary: boolean;
    grant_source: string | null;
    starts_at: string | null;
    expires_at: string | null;
    permanent: boolean;
  };
}

export interface Channel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
}

export interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}
