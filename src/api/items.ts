import { api } from './client';

/** One effect spec carried by an owned item. */
export interface ItemEffect {
  type: string;
  scope: 'global' | 'guild';
  magnitude: number;
  duration_seconds: number | null;
}

/** An owned inventory item (catalog details + quantity). */
export interface InventoryItem {
  item_id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  item_type: string;
  effects: ItemEffect[];
  is_consumable: boolean;
  is_giftable: boolean;
  is_tradeable: boolean;
  quantity: number;
  acquired_at: string | null;
  source: string;
}

export interface InventoryResponse {
  items: InventoryItem[];
  count: number;
}

/** A live boost currently in force for the user. */
export interface ActiveEffect {
  id: number;
  scope: 'global' | 'guild';
  guild_id: number | null;
  effect_type: string;
  magnitude: number;
  expires_at: string | null;
}

export interface ActiveEffectsResponse {
  effects: ActiveEffect[];
}

export interface ShopResponse {
  items: Array<{
    id: number;
    slug: string;
    name: string;
    description: string;
    icon: string;
    rarity: string;
    item_type: string;
    effects: ItemEffect[];
    price_credits: number | null;
  }>;
  count: number;
}

export const itemsApi = {
  getInventory: () => api.fetch<InventoryResponse>('/api/items/inventory'),
  getActiveEffects: () => api.fetch<ActiveEffectsResponse>('/api/items/active-effects'),
  getShop: () => api.fetch<ShopResponse>('/api/items/shop'),
};
