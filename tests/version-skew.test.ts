import test from 'node:test';
import assert from 'node:assert/strict';

import { isChunkLoadError, recoverChunk, reloadForNewDeploy } from '../src/lib/versionSkew.ts';

/** The module keeps a one-reload-per-page-load guard, so these tests run in
 * sequence as one tab's lifetime: stale import → reload → still stale. */
const storage = new Map<string, string>();
let reloads = 0;
Object.assign(globalThis, {
  sessionStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
  window: { location: { reload: () => { reloads += 1; } } },
});

const staleChunk = () => Promise.reject(
  new Error('Failed to fetch dynamically imported module: https://acosmibot.com/assets/GuildSelectPage-CDYIex9b.js'),
);
const settled = <T,>(promise: Promise<T>) => Promise.race([
  promise.then(() => 'resolved', () => 'rejected'),
  new Promise<string>(resolve => setTimeout(() => resolve('pending'), 20)),
]);

test('recognises the browser wordings for a missing route chunk', () => {
  const stale = [
    new Error('Failed to fetch dynamically imported module: https://acosmibot.com/assets/GuildSelectPage-CDYIex9b.js'),
    new Error('error loading dynamically imported module: /assets/AdminPage-Csp0TneT.js'),
    new Error('Importing a module script failed.'),
    new Error("Expected a JavaScript module script but the server responded with a MIME type of 'text/html'. Strict MIME type checking is enforced for module scripts per HTML spec."),
  ];
  for (const error of stale) {
    assert.equal(isChunkLoadError(error), true, error.message);
  }

  assert.equal(isChunkLoadError(new Error('Request failed with status code 500')), false);
  assert.equal(isChunkLoadError(undefined), false);
});

test('a chunk missing after a deploy reloads the page and holds the fallback', async () => {
  const result = await settled(recoverChunk(staleChunk)());

  assert.equal(reloads, 1);
  assert.equal(result, 'pending', 'must not flash UI that the reload is about to replace');
});

test('a second failure rejects instead of looping the reload', async () => {
  await assert.rejects(recoverChunk(staleChunk)(), /Failed to fetch dynamically imported module/);
  assert.equal(reloads, 1, 'guard blocks the reload loop');
  assert.equal(reloadForNewDeploy(), false);
});

test('errors that are not chunk failures propagate untouched', async () => {
  const boom = new Error('Cannot read properties of undefined');
  await assert.rejects(recoverChunk(() => Promise.reject(boom))(), /Cannot read properties/);
  assert.equal(reloads, 1);
});
