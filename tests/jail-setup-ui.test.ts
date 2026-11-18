import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configApi = await readFile(new URL('../src/api/config.ts', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/features/jail/JailPage.tsx', import.meta.url), 'utf8');

test('Jail setup uses the typed API response contract', () => {
  assert.match(configApi, /api\.fetch<JailSetupResponse>/);
  assert.match(page, /const jail = response\.data\.settings\.jail;/);
  assert.doesNotMatch(page, /response\?\.data\?\.data/);
});

test('successful setup hydrates the persisted channel and enabled state and confirms success', () => {
  assert.match(page, /channel_id: jail\.channel_id/);
  assert.match(page, /inmate_role_id: jail\.inmate_role_id/);
  assert.match(page, /enabled: jail\.enabled/);
  assert.match(page, /showToast\(response\.message \?\? 'Jail channel and Inmate role are ready\.', 'success'\)/);
});

test('Jail role pickers never offer @everyone, which the API rejects', () => {
  // A brand-new server often has only @everyone plus the bot role; offering it
  // as a staff choice made every setup attempt fail (TrashRoom, 2026-11-17).
  const pickers = page.match(/<RoleMultiSelect[\s\S]*?\/>/g) ?? [];
  assert.equal(pickers.length, 2);
  for (const picker of pickers) assert.match(picker, /\bexcludeEveryone\b/);
});
