import { api } from './client';

/** A cosmetic slot type. Mirrors the backend ENUM. */
export type CosmeticType = 'background' | 'ring' | 'accent';

export interface Cosmetic {
  id: number;
  name: string;
  description: string;
  type: CosmeticType;
  rarity: string;
  price: number;
  /** Raw CSS value: a hex color or a gradient string. */
  value: string;
  /** Achievement key when granted by one (e.g. 'og_member'); else null. */
  achievement_key?: string | null;
  /** Immutable CDN image for an owner-uploaded 800×250 background. */
  asset_url?: string | null;
  /** Uploaded artwork keeps the overlay but uses the half-width XP bar. */
  layout_preset?: 'standard' | 'artwork';
  owned: boolean;
  equipped: boolean;
}

export interface CosmeticCatalog {
  cosmetics: Cosmetic[];
  bank_balance: number;
  /** Active shop-discount fraction (e.g. 0.2 from an equipped Merchant's Amulet). */
  shop_discount: number;
}

/** Equipped cosmetic id per slot (null = card default). */
export interface LoadoutSlots {
  background: number | null;
  ring: number | null;
  accent: number | null;
}

export const cosmeticsApi = {
  /** Available cosmetics annotated with owned/equipped, plus the user's balance. */
  getCatalog: (): Promise<CosmeticCatalog> =>
    api.fetch<CosmeticCatalog>('/api/cosmetics/catalog'),

  /** The user's current equipped slot ids. */
  getLoadout: (): Promise<{ loadout: LoadoutSlots }> =>
    api.fetch<{ loadout: LoadoutSlots }>('/api/cosmetics/loadout'),

  /** Buy a cosmetic with bank Acosmicoins. Returns the new balance on success. */
  purchase: (cosmeticId: number): Promise<{ success: boolean; bank_balance: number }> =>
    api.fetch<{ success: boolean; bank_balance: number }>('/api/cosmetics/purchase', {
      method: 'POST',
      body: JSON.stringify({ cosmetic_id: cosmeticId }),
    }),

  /** Equip a cosmetic in its slot, or pass null to clear the slot. */
  equip: (type: CosmeticType, cosmeticId: number | null): Promise<{ success: boolean }> =>
    api.fetch<{ success: boolean }>('/api/cosmetics/equip', {
      method: 'POST',
      body: JSON.stringify({ type, cosmetic_id: cosmeticId }),
    }),
};
