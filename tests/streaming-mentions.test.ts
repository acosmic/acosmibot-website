import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStreamingMentions } from '../src/utils/streamingMentions.ts';

const guild = '123';
test('everyone role workaround loads as the dedicated checkbox without dropping other roles', () => {
  assert.deepEqual(normalizeStreamingMentions({ mention_everyone: false, mention_role_ids: ['123', '456', '456'] }, guild), {
    mention_everyone: true, mention_here: false, mention_role_ids: ['456'],
  });
});
test('legacy settings are visible and an explicit checkbox opt-out wins', () => {
  assert.equal(normalizeStreamingMentions({ mention: 'everyone' }, guild).mention_everyone, true);
  assert.equal(normalizeStreamingMentions({ mention: 'here' }, guild).mention_here, true);
  assert.equal(normalizeStreamingMentions({ mention: 'everyone', mention_everyone: false }, guild).mention_everyone, false);
  assert.deepEqual(normalizeStreamingMentions({ mention: '<@&456>' }, guild).mention_role_ids, ['456']);
});
test('normalization preserves checkbox choices and does not mutate saved data', () => {
  const input = { mention_everyone: true, mention_here: true, mention_role_ids: ['456'] };
  assert.deepEqual(normalizeStreamingMentions(input, guild), input);
  assert.deepEqual(input.mention_role_ids, ['456']);
  assert.deepEqual(normalizeStreamingMentions({ mention: null, mention_role_ids: null }, guild), {
    mention_everyone: false, mention_here: false, mention_role_ids: [],
  });
});

test('streaming role picker hides the default role while other role pickers retain it', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const source = await readFile(new URL('../src/components/ui/RoleMultiSelect.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, any> = {};
  const mockRequire = (name: string) => name === '@/hooks/useGuildRoles'
    ? { useGuildRoles: () => ({ data: [{ id: guild, name: '@everyone', color: 0 }, { id: '456', name: 'Members', color: 0 }], isLoading: false }) }
    : require(name);
  new Function('require', 'exports', compiled)(mockRequire, exports);
  const props = { guildId: guild, value: [], onChange: () => {} };
  const streaming = renderToStaticMarkup(React.createElement(exports.RoleMultiSelect, { ...props, excludeEveryone: true }));
  assert.doesNotMatch(streaming, /everyone/);
  assert.match(streaming, /@Members/);
  const generic = renderToStaticMarkup(React.createElement(exports.RoleMultiSelect, props));
  assert.match(generic, /everyone/);
});
