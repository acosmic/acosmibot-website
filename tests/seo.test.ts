import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildStructuredData,
  DOC_ROUTES,
  FEATURE_LANDINGS,
  getSeoMeta,
  INDEXABLE_PUBLIC_PATHS,
  SITE_ORIGIN,
  HOME_TAGLINE,
} from '../src/seo/publicRoutes.ts';

test('every public route has unique indexable metadata and a canonical URL', () => {
  const metadata = INDEXABLE_PUBLIC_PATHS.map(pathname => getSeoMeta(pathname));

  assert.equal(new Set(metadata.map(meta => meta.title)).size, metadata.length);
  assert.equal(new Set(metadata.map(meta => meta.canonicalPath)).size, metadata.length);
  for (const meta of metadata) {
    assert.equal(meta.indexable, true);
    assert.ok(meta.title.includes('Acosmibot'));
    assert.ok(meta.description.length >= 90);
    assert.ok(`${SITE_ORIGIN}${meta.canonicalPath}`.startsWith('https://acosmibot.com/'));
  }
});

test('homepage keeps its search title while using the cosmic social tagline', () => {
  const homepage = getSeoMeta('/');
  assert.match(homepage.title, /AI.*Discord/i);
  assert.equal(homepage.socialTitle, HOME_TAGLINE);
});

test('documentation manifest and source views stay in sync', () => {
  const testDir = fileURLToPath(new URL('.', import.meta.url));
  for (const [slug] of DOC_ROUTES) {
    const viewPath = `${testDir}../public/docs/views/${slug}-view.html`;
    assert.ok(
      existsSync(viewPath),
      `missing documentation view for ${slug}`,
    );
    const html = readFileSync(viewPath, 'utf8');
    assert.doesNotMatch(html, /href="\/(?:server|privacy|terms)"/, `legacy internal link in ${slug}`);
  }
});

test('documentation reflects current commercial and product contracts', () => {
  const testDir = fileURLToPath(new URL('.', import.meta.url));
  const readDoc = (slug: string) => readFileSync(`${testDir}../public/docs/views/${slug}-view.html`, 'utf8');

  const plans = readDoc('subscription-plans');
  assert.match(plans, /20% off the first two monthly payments/i);
  assert.match(plans, /December 31, 2026/i);
  assert.match(plans, /Max.*emote awareness/is);
  assert.match(plans, /Fresh channel summaries.*0\/month.*0\/month.*100\/month.*300\/month/is);
  assert.match(plans, /Web image searches.*0\/month.*0\/month.*50\/month.*100\/month/is);
  assert.match(plans, /owner-only.*not a subscription benefit/i);

  const credits = readDoc('ai-credits');
  assert.match(credits, /Fuel Cell 25K/);
  assert.match(credits, /350/);
  assert.match(credits, /full maximum charge is reserved/i);
  assert.match(credits, /separate from Acosmicoins/i);
  assert.match(credits, /Server Boost Log/i);

  const stats = readDoc('stats');
  assert.match(stats, /reactions_received/);
  assert.match(stats, /August 9, 2026/);
  assert.match(stats, /most_loved/);

  const commands = readDoc('commands');
  assert.match(commands, /heist reset/);
  assert.match(commands, /ai credits/);
  assert.match(commands, /ai summary/);
  assert.match(commands, /ai style/);
  assert.match(commands, /ai-admin emote/);
  assert.match(commands, /confirmation for 350 AI Credits/);
  assert.doesNotMatch(commands, /350-Acosmicoin/i);
  assert.doesNotMatch(commands, /ai memory &lt;add/);

  const ai = readDoc('ai');
  assert.doesNotMatch(ai, /Admins can configure a server-wide daily interaction cap/i);
  assert.doesNotMatch(ai, /GPT-4o|DALL-E|GPT-4 Vision/i);
  assert.match(ai, /World of Warcraft/i);
  assert.match(ai, /same visual character card/i);
  assert.match(ai, /Channel Summaries/i);
  assert.match(ai, /Web Image Search/i);
  assert.match(ai, /base server-role flags/i);

  const wow = readDoc('wow');
  assert.match(wow, /\/wow profile/);
  assert.match(wow, /Classic Anniversary/);
  assert.match(wow, /full-body character card/i);
  assert.match(wow, /partial/i);

  assert.match(commands, /\/wow profile/);
});

test('feature landing routes expose substantial, interlinked product detail', () => {
  for (const feature of Object.values(FEATURE_LANDINGS)) {
    assert.ok(feature.capabilities.length >= 6);
    assert.ok(feature.steps.length >= 4);
    assert.ok(feature.related.length >= 3);
    assert.ok(INDEXABLE_PUBLIC_PATHS.includes(`/features/${feature.slug}`));
    assert.ok(INDEXABLE_PUBLIC_PATHS.includes(feature.documentationPath));
  }
});

test('unknown and private routes are noindex and omit public structured data', () => {
  const meta = getSeoMeta('/server/123/private-settings');
  assert.equal(meta.indexable, false);
  assert.equal(meta.kind, 'app');

  const aiMeta = getSeoMeta('/features/ai-discord-bot');
  const data = buildStructuredData(aiMeta);
  assert.equal(data['@context'], 'https://schema.org');
  assert.ok(data['@graph'].some(item => item['@type'] === 'SoftwareApplication'));
  assert.ok(data['@graph'].some(item => item['@type'] === 'BreadcrumbList'));
});
