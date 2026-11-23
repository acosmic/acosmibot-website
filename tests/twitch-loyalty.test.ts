import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  EMPTY_ITEM_DRAFT,
  LOYALTY_LIMITS,
  balancePatch,
  describeStock,
  draftFromItem,
  formatWatchMinutes,
  isSoundUrl,
  itemInputFromDraft,
  itemProblem,
  leaderboardQuery,
  loyaltySettingsProblem,
  normalizeViewerSearch,
  previewBalance,
  reasonLabel,
  redeemCommand,
  redemptionActions,
  redemptionQuery,
  sameItemDraft,
  viewerQuery,
  type LoyaltySettings,
  type StoreItem,
} from '../src/features/twitch/loyalty/model.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const SETTINGS: LoyaltySettings = {
  enabled: true, currency_name: 'points', interval_minutes: 5, points_per_interval: 5, active_bonus: 5,
  active_window_minutes: 15, subscriber_multiplier: 2, vip_multiplier: 1.5, include_lurkers: true, offline_accrual: false,
  offline_points_per_interval: 0, starting_points: 0, bonus_follow: 50, bonus_sub: 500, bonus_gift_per_sub: 250,
  bonus_cheer_per_100_bits: 100, bonus_raid_per_viewer: 1, exclude_broadcaster: true, exclude_known_bots: true,
  give_enabled: true, give_min: 1, give_tax_percent: 0, auto_regular_watch_minutes: 0, leaderboard_public: true,
};

test('viewer search normalises to a login prefix and rejects text that cannot match', () => {
  assert.equal(normalizeViewerSearch('  @Some_User '), 'some_user');
  assert.equal(normalizeViewerSearch(''), '');
  assert.equal(normalizeViewerSearch("x'; DROP"), null);
  assert.equal(normalizeViewerSearch('a'.repeat(26)), null);
  assert.equal(viewerQuery('@Bob', 'watch_minutes', 2), '?q=bob&sort=watch_minutes&offset=100&limit=50');
  assert.equal(viewerQuery('bad name!', 'points', 0), '?sort=points&offset=0&limit=50');
});

test('balance edits send a target or a signed change, never a computed balance', () => {
  assert.deepEqual(balancePatch('set', '1,500'), { points: 1500 });
  assert.deepEqual(balancePatch('add', '-200'), { points_delta: -200 });
  assert.deepEqual(balancePatch('add', '+50'), { points_delta: 50 });
  assert.ok('problem' in balancePatch('set', '-1'));
  assert.ok('problem' in balancePatch('add', '0'));
  assert.ok('problem' in balancePatch('add', '1.5'));
  assert.ok('problem' in balancePatch('add', String(LOYALTY_LIMITS.maxDelta + 1)));
  assert.ok('problem' in balancePatch('set', 'abc'));
  assert.equal(previewBalance(100, { points_delta: -500 }), 0);
  assert.equal(previewBalance(100, { points: 40 }), 40);
});

test('loyalty settings validation mirrors the pydantic bounds', () => {
  assert.equal(loyaltySettingsProblem(SETTINGS), null);
  assert.match(loyaltySettingsProblem({ ...SETTINGS, currency_name: 'gold-coins' }) ?? '', /currency name/);
  assert.match(loyaltySettingsProblem({ ...SETTINGS, interval_minutes: 0 }) ?? '', /Award interval/);
  assert.match(loyaltySettingsProblem({ ...SETTINGS, give_tax_percent: 60 }) ?? '', /Gift tax/);
  assert.match(loyaltySettingsProblem({ ...SETTINGS, points_per_interval: 2.5 }) ?? '', /whole number/);
  assert.equal(loyaltySettingsProblem({ ...SETTINGS, vip_multiplier: 1.25 }), null);
});

test('formatting helpers', () => {
  assert.equal(formatWatchMinutes(0), '0m');
  assert.equal(formatWatchMinutes(125), '2h 5m');
  assert.equal(formatWatchMinutes(1500), '1d 1h');
  assert.equal(reasonLabel('store_refund'), 'Store refund');
  assert.equal(reasonLabel('game_slots'), 'Game: slots');
  assert.equal(reasonLabel('unknown_reason'), 'unknown_reason');
  assert.equal(describeStock(null), 'Unlimited');
  assert.equal(describeStock(0), 'Sold out');
  assert.equal(describeStock(1200), '1,200 left');
});

test('store item drafts validate like the API and only send fields that apply to the kind', () => {
  assert.equal(itemProblem({ ...EMPTY_ITEM_DRAFT, name: 'Hydrate' }), null);
  assert.match(itemProblem({ ...EMPTY_ITEM_DRAFT, name: '   ' }) ?? '', /name/);
  assert.match(itemProblem({ ...EMPTY_ITEM_DRAFT, name: 'x'.repeat(61) }) ?? '', /60/);
  assert.match(itemProblem({ ...EMPTY_ITEM_DRAFT, name: 'A', cost: 0 }) ?? '', /cost/);
  assert.match(itemProblem({ ...EMPTY_ITEM_DRAFT, name: 'A', stock: '-1' }) ?? '', /Stock/);
  assert.match(itemProblem({ ...EMPTY_ITEM_DRAFT, name: 'A', per_user_limit: '0' }) ?? '', /per-viewer/);
  assert.match(itemProblem({ ...EMPTY_ITEM_DRAFT, name: 'A', kind: 'sound', sound_url: 'http://x.test/a.mp3' }) ?? '', /https/);
  assert.match(itemProblem({ ...EMPTY_ITEM_DRAFT, name: 'A', kind: 'message' }) ?? '', /message/);
  assert.equal(isSoundUrl('https://cdn.example/s/horn.MP3?v=2'), true);
  assert.equal(isSoundUrl('https://user:pw@cdn.example/a.mp3'), false);
  assert.equal(isSoundUrl('https://cdn.example/a.exe'), false);
  assert.equal(isSoundUrl('javascript:alert(1)//.mp3'), false);

  const input = itemInputFromDraft({
    ...EMPTY_ITEM_DRAFT, name: '  Air \u0007 horn ', kind: 'sound', sound_url: ' https://cdn.example/h.ogg ',
    message_template: 'leftover', stock: ' 5 ', per_user_limit: '',
  });
  assert.equal(input.name, 'Air horn');
  assert.equal(input.sound_url, 'https://cdn.example/h.ogg');
  assert.equal(input.message_template, null);
  assert.equal(input.stock, 5);
  assert.equal(input.per_user_limit, null);
  assert.equal(itemInputFromDraft({ ...EMPTY_ITEM_DRAFT, name: 'Song', kind: 'song' }).requires_input, true);
});

test('drafts round-trip from items and detect changes', () => {
  const item: StoreItem = {
    id: 3, broadcaster_id: '1000', name: 'Hydrate', description: null, kind: 'generic', cost: 250, level: 300, stock: null,
    per_user_limit: 2, user_cooldown_s: 60, global_cooldown_s: 0, requires_input: false, sound_url: null,
    message_template: null, enabled: true, sort_order: 1, created_at: null, updated_at: null,
  };
  const draft = draftFromItem(item);
  assert.equal(draft.stock, '');
  assert.equal(draft.per_user_limit, '2');
  assert.equal(sameItemDraft(draft, draftFromItem(item)), true);
  assert.equal(sameItemDraft(draft, { ...draft, cost: 251 }), false);
  const input = itemInputFromDraft(draft);
  assert.deepEqual({ cost: input.cost, level: input.level, stock: input.stock, per_user_limit: input.per_user_limit },
    { cost: 250, level: 300, stock: null, per_user_limit: 2 });
});

test('redemption actions follow the one-shot state machine', () => {
  assert.deepEqual(redemptionActions('pending'), ['fulfilled', 'refunded', 'rejected']);
  assert.deepEqual(redemptionActions('fulfilled'), ['refunded']);
  assert.deepEqual(redemptionActions('refunded'), []);
  assert.deepEqual(redemptionActions('rejected'), []);
  assert.equal(redemptionQuery('pending', null), '?status=pending&limit=50');
  assert.equal(redemptionQuery('all', 42), '?before_id=42&limit=50');
});

test('public helpers', () => {
  assert.equal(leaderboardQuery('watch_minutes'), '?by=watch_minutes&limit=100');
  assert.equal(leaderboardQuery('points', 500), '?by=points&limit=100');
  assert.equal(redeemCommand({ name: 'Hydrate', kind: 'generic' }), '!redeem Hydrate');
  assert.equal(redeemCommand({ name: 'Song', kind: 'song' }), '!redeem Song <song link or search>');
});

test('registry entries are metadata only with lazy pages and the spec ids', () => {
  const section = read('src/features/twitch/loyalty/section.tsx');
  assert.match(section, /id: 'loyalty'[\s\S]*group: 'community'[\s\S]*order: 10/);
  assert.match(section, /id: 'store'[\s\S]*group: 'community'[\s\S]*order: 20/);
  assert.doesNotMatch(section, /from '\.\/(LoyaltyPage|StorePage)'/);
  const publicPages = read('src/features/twitch/loyalty/public.tsx');
  assert.match(publicPages, /id: 'leaderboard'/);
  assert.match(publicPages, /id: 'store'/);
  for (const file of ['LoyaltyPage.tsx', 'StorePage.tsx', 'PublicLeaderboardPage.tsx', 'PublicStorePage.tsx']) {
    assert.doesNotMatch(read(`src/features/twitch/loyalty/${file}`), /dangerouslySetInnerHTML/);
  }
});
