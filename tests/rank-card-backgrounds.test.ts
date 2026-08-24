import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('artwork cards fit the overlay around framed title art', () => {
  const rankCard = source('src/cards/RankCard.tsx');

  assert.match(rankCard, /const isArtworkCard = loadout\?\.layoutPreset === 'artwork'/);
  assert.match(rankCard, /const xpBarWidth = isArtworkCard \? 265 : 530/);
  assert.match(rankCard, /const avatarSize = isArtworkCard \? 120 : 140/);
  assert.match(rankCard, /const avatarLeft = isArtworkCard \? 35 : 25/);
  assert.match(rankCard, /const avatarTop = isArtworkCard \? 65 : 55/);
  assert.match(rankCard, /const avatarShadow = isArtworkCard \? 6 : 12/);
  assert.match(rankCard, /left: 180,[\s\S]*top: 180,[\s\S]*width: xpBarWidth/);
  assert.match(rankCard, /isArtworkCard && !hideGlobalLevel/);
  assert.match(rankCard, /`· Global Lvl \$\{globalLevel\}`/);
  assert.match(rankCard, /!hideGlobalLevel && !isArtworkCard/);
  assert.match(rankCard, /right: 84,[\s\S]*top: 156/);
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
  assert.match(cosmeticsTab, /Message to recipient/);
  assert.match(cosmeticsTab, /maxLength=\{500\}/);
  assert.match(cosmeticsTab, /full artwork and a button to open Card Studio/);
  assert.match(adminApi, /message,/);
});

test('a successful first upload populates the cache before selecting its preview', () => {
  const cosmeticsTab = source('src/pages/admin/CosmeticsTab.tsx');

  assert.match(cosmeticsTab, /setQueryData<AdminCosmeticsResponse>/);
  assert.match(cosmeticsTab, /item\.id !== response\.cosmetic\.id/);
  assert.match(cosmeticsTab, /setGrantCosmeticId\(response\.cosmetic\.id\)/);
  assert.match(cosmeticsTab, /\{selectedGrantArtwork && \(/);
  assert.doesNotMatch(cosmeticsTab, /\?\? artworkBackgrounds\[0\]/);
});

test('Card Studio shows the uploaded artwork in both its card and material swatch', () => {
  const studio = source('src/pages/CardStudioPage.tsx');

  assert.match(studio, /backgroundImageUrl: selected\.background\?\.asset_url/);
  assert.match(studio, /backgroundImage: `url\("\$\{cosmetic\.asset_url\}"\)`/);
});

test('Card Studio uses focused, literal previews for each cosmetic slot', () => {
  const studio = source('src/pages/CardStudioPage.tsx');
  const styles = source('src/styles/member.css');

  assert.match(studio, /const \[activeType, setActiveType\]/);
  assert.match(studio, /role="tablist"/);
  assert.match(studio, /Changes both the LVL number and XP bar fill/);
  assert.match(studio, /studio-accent-demo__track/);
  assert.match(studio, /LVL&nbsp; 34/);
  assert.match(studio, /boxShadow: `0 0 10px \$\{cosmetic\.value\}`/);
  assert.match(studio, /avatarUrl=\{preview\.avatarUrl\}/);
  assert.match(styles, /\.studio-swatch__material--ring > img/);
  assert.match(styles, /\.studio-slot-tabs/);
  assert.doesNotMatch(studio, /\{SLOT_ORDER\.map\(\(type\) => \(\s*<SlotTray/);
});
