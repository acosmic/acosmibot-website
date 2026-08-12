import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('dormant RAG implementation is retained without an active admin surface', () => {
  const testDir = fileURLToPath(new URL('.', import.meta.url));
  const adminPage = readFileSync(`${testDir}../src/pages/admin/AdminPage.tsx`, 'utf8');

  assert.ok(existsSync(`${testDir}../src/pages/admin/RagTab.tsx`));
  assert.doesNotMatch(adminPage, /RAG Documents|<RagTab|from '.\/RagTab'/);
});
