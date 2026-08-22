import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRuntimeLogTimestamp } from '../src/utils/runtimeLogTimestamp.ts';

test('parses legacy file timestamps as UTC', () => {
  assert.equal(
    parseRuntimeLogTimestamp('2026-06-10 19:08:20,747')?.toISOString(),
    '2026-06-10T19:08:20.747Z',
  );
});

test('parses structured journal ISO timestamps without appending a second timezone', () => {
  assert.equal(
    parseRuntimeLogTimestamp('2026-08-22T07:19:00.744Z')?.toISOString(),
    '2026-08-22T07:19:00.744Z',
  );
  assert.equal(
    parseRuntimeLogTimestamp('2026-08-22T02:19:00.744-05:00')?.toISOString(),
    '2026-08-22T07:19:00.744Z',
  );
});

test('rejects empty and malformed runtime timestamps', () => {
  assert.equal(parseRuntimeLogTimestamp(''), null);
  assert.equal(parseRuntimeLogTimestamp('not-a-timestamp'), null);
});
