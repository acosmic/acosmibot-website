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
  is_equippable: boolean;
  equip_slot: string | null;
  quantity: number;
  acquired_at: string | null;
  source: string;
}

export interface InventoryResponse {
  items: InventoryItem[];
  count: number;
}

/** An item the user currently has equipped, by slot. */
export interface EquippedItem {
  slot: string;
  item_id: number;
  slug: string;
  name: string;
  icon: string;
  rarity: string;
  item_type: string;
  effects: ItemEffect[];
  equipped_at: string | null;
}

export interface EquippedResponse {
  equipped: EquippedItem[];
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
  getEquipped: () => api.fetch<EquippedResponse>('/api/items/equipped'),
  equip: (slug: string) =>
    api.fetch<{ success: boolean; message: string }>('/api/items/equip', {
      method: 'POST',
      body: JSON.stringify({ slug }),
    }),
  unequip: (slug: string) =>
    api.fetch<{ success: boolean; message: string }>('/api/items/unequip', {
      method: 'POST',
      body: JSON.stringify({ slug }),
    }),
};
