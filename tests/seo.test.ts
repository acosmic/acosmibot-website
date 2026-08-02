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
