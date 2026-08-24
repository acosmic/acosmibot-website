import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('artwork cards keep the shared overlay and halve only the XP track', () => {
  const rankCard = source('src/cards/RankCard.tsx');

  assert.match(rankCard, /layoutPreset === 'artwork' \? 265 : 530/);
  assert.match(rankCard, /left: 180,[\s\S]*top: 180,[\s\S]*width: xpBarWidth/);
  assert.match(rankCard, /src=\{backgroundImageUrl\}/);
  assert.match(rankCard, /width=\{CARD_WIDTH\}/);
  assert.match(rankCard, /height=\{CARD_HEIGHT\}/);
});

test('Satori accepts only the dedicated immutable CDN path and inlines it', () => {
  const renderer = source('api/render-card/index.tsx');

  assert.match(renderer, /RANK_BACKGROUND_HOST = 'cdn\.acosmibot\.com'/);
  assert.match(renderer, /RANK_BACKGROUND_PATH_PREFIX = '\/embed-images\/rank-card-backgrounds\/'/);
  assert.match(renderer, /isAllowedRankBackgroundUrl\(data\.loadout\.backgroundImageUrl\)/);
  assert.match(renderer, /imageToDataUri\(backgroundSource, 'image\/png'\)/);
  assert.match(renderer, /redirect: 'error'/);
});

test('owner console exposes validated upload and Discord-ID assignment', () => {
  const adminApi = source('src/api/admin.ts');
  const cosmeticsTab = source('src/pages/admin/CosmeticsTab.tsx');

  assert.match(adminApi, /uploadRankCardBackground/);
  assert.match(adminApi, /grantRankCardBackground/);
  assert.match(cosmeticsTab, /exactly 800×250/);
  assert.match(cosmeticsTab, /Discord user ID/);
  assert.match(cosmeticsTab, /does not force-equip it/);
});

test('Card Studio shows the uploaded artwork in both its card and material swatch', () => {
  const studio = source('src/pages/CardStudioPage.tsx');

  assert.match(studio, /backgroundImageUrl: selected\.background\?\.asset_url/);
  assert.match(studio, /backgroundImage: `url\("\$\{cosmetic\.asset_url\}"\)`/);
});
