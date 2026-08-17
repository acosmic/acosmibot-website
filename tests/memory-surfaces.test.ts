import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('memory routes and independent server-authoritative rollout flags are present', async () => {
  const app = await read('../src/App.tsx');
  const graphApi = await read('../src/api/memoryGraph.ts');
  const adminApi = await read('../src/api/admin.ts');
  const settings = await read('../src/pages/admin/FeatureSettingsTab.tsx');
  const panel = await read('../src/features/memory/MemoryConstellationPanel.tsx');
  for (const route of ['/server/:guildId', '/admin/ai-memory/constellation']) assert.match(app, new RegExp(route.replaceAll('/', '\\/')));
  for (const flag of ['member', 'home', 'manager', 'admin']) assert.match(graphApi, new RegExp(`${flag}: boolean`));
  for (const flag of ['memory_declared_enabled', 'memory_derived_enabled', 'memory_proposals_enabled', 'memory_ambient_capture_enabled', 'memory_ambient_processing_enabled', 'memory_tier3_serving_enabled']) {
    assert.match(adminApi, new RegExp(flag));
    assert.match(settings, new RegExp(flag));
  }
  assert.match(panel, /enabled &&/);
  assert.match(panel, /DisabledSurface/);
});

test('personal controls retain typed optimistic/concurrency and privacy safeguards', async () => {
  const api = await read('../src/api/memory.ts');
  const section = await read('../src/features/memory/PersonalMemorySection.tsx');
  assert.match(api, /expected_version/);
  assert.match(section, /CLEAR MY MEMORY/);
  assert.match(section, /DELETE THIS FACT/);
  assert.match(section, /onKeyDown/);
  assert.match(section, /Escape/);
  assert.match(section, /shared_guilds/);
  assert.match(section, /visibility/);
  assert.match(section, /conflict|changed in another tab/i);
  assert.doesNotMatch(section, /display_text:\s*form/);
});

test('privacy source discloses retention, providers, configured channels, and tier boundaries', async () => {
  const privacy = await read('../src/pages/legal/PrivacyPolicyPage.tsx');
  for (const phrase of ['Tier 1', 'Tier 3', '24 hours', 'encrypted', 'configured channels', 'OpenAI', 'Gemini', 'opt out', 'rollout']) {
    assert.match(privacy, new RegExp(phrase, 'i'));
  }
});

test('private memory queries are purged before identity is cleared', async () => {
  const auth = await read('../src/lib/auth.ts');
  const queryClient = await read('../src/lib/queryClient.ts');
  assert.match(auth, /purgePrivateMemoryQueries\(\)/);
  assert.match(auth, /clearExpiredSession/);
  assert.match(queryClient, /personal-memory/);
  assert.match(queryClient, /memory-graph/);
  assert.match(queryClient, /removeQueries/);
});
