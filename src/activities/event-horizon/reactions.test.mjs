import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD, DEFAULT_QUICK, emojiKey, emojiSource, wireEmoji, searchEmojis, quickEmojis, recordUse, loadUsage, saveUsage, reactionForView, floatEmoji } from './reactions.mjs';

const servers = [{name: 'Home', emojis: [{id: '10', name: 'pog', animated: false}, {id: '11', name: 'partyParrot', animated: true}]},
  {name: 'Other', emojis: [{id: '20', name: 'gg', animated: false}]}];

test('search spans the viewer servers and standard emoji', () => {
  assert.deepEqual(searchEmojis(servers, '').map(s => s.title), ['Home', 'Other', 'Standard']);
  assert.deepEqual(searchEmojis(servers, ':PARTY:').map(s => [s.title, s.emojis.length]), [['Home', 1], ['Standard', 1]]);
  assert.deepEqual(searchEmojis(servers, 'rocket').map(s => s.emojis[0].char), ['🚀']);
  assert.deepEqual(searchEmojis(null, 'zzzz'), []);
});
test('quick buttons are the three most used, padded with defaults', () => {
  assert.deepEqual(quickEmojis({}, servers), DEFAULT_QUICK);
  let usage = {};
  for (const emoji of [servers[0].emojis[0], servers[0].emojis[0], {char: '🚀'}, servers[1].emojis[0], servers[1].emojis[0], servers[1].emojis[0], {char: '💀'}, {char: '💀'}])
    usage = recordUse(usage, emoji);
  assert.deepEqual(quickEmojis(usage, servers).map(emojiKey), ['c:20', 'c:10', '💀']);
  // A custom emoji that left the catalog is skipped, never sent blind.
  assert.deepEqual(quickEmojis(usage, []).map(emojiKey), ['💀', '🚀', '🔥']);
  assert.equal(new Set(quickEmojis({'🔥': 9}, servers).map(emojiKey)).size, 3);
});
test('quick buttons default to Acosmibot emotes when the catalog offers them', () => {
  const aco = name => ({id: String(name.length) + name.charCodeAt(3), name, animated: false});
  const featured = {name: 'Acosmibot', featured: true, emojis: [aco('acoez'), aco('acoflex'), aco('acoCelebrate'), aco('acowave')]};
  assert.deepEqual(quickEmojis({}, [featured, ...servers]).map(e => e.name), ['acoCelebrate', 'acoflex', 'acoez']);
  assert.deepEqual(quickEmojis({'🚀': 4}, [featured]).map(e => e.name), ['rocket', 'acoCelebrate', 'acoflex']);
  assert.deepEqual(quickEmojis({}, [{...featured, emojis: [aco('acoez')]}]).map(emojiKey), [emojiKey(aco('acoez')), '🔥', '👏']);
});
test('usage survives storage failures and stays bounded', () => {
  const store = new Map(), storage = {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v)};
  saveUsage(storage, {'🔥': 2}); assert.deepEqual(loadUsage(storage), {'🔥': 2});
  store.set('eh-emoji-usage', '[1'); assert.deepEqual(loadUsage(storage), {});
  assert.deepEqual(loadUsage({getItem() { throw Error('blocked'); }}), {});
  saveUsage({setItem() { throw Error('blocked'); }}, {});
  let usage = {}; for (let i = 0; i < 80; i++) usage = recordUse(usage, {id: String(i), animated: false});
  assert.equal(Object.keys(usage).length, 60);
});
test('wire and view forms never carry urls or markup', () => {
  assert.equal(wireEmoji({char: '🔥', name: 'fire'}), '🔥');
  assert.deepEqual(wireEmoji({id: '10', name: 'pog', animated: false}), {id: '10', animated: false});
  assert.equal(emojiSource({id: '10', animated: true}), '/discord-cdn/emojis/10.gif?size=64');
  assert.equal(emojiSource({id: '../x'}), null);
  assert.deepEqual(reactionForView({emoji: {id: '10', animated: true, url: 'https://example.com'}}), {id: '10', animated: true});
  assert.deepEqual(reactionForView({emoji: {char: '🔥'}}), {char: '🔥'});
  for (const emoji of [null, 'x', {id: 'abc'}, {char: 'x'.repeat(17)}, {}]) assert.equal(reactionForView({emoji}), null);
  assert.ok(STANDARD.length >= 30 && STANDARD.every(e => e.char && e.name));
});
test('the float layer is bounded and cleans up after each emoji', () => {
  const element = () => { const listeners = {}; const node = {children: [], style: {values: {}, setProperty(k, v) { this.values[k] = v; }}, listeners,
    get childElementCount() { return this.children.length; }, get firstElementChild() { return this.children[0]; },
    append(child) { child.parent = this; this.children.push(child); }, remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); },
    addEventListener(type, fn) { listeners[type] = fn; }}; return node; };
  const layer = element(); layer.ownerDocument = {createElement: element};
  for (let i = 0; i < 5; i++) floatEmoji(layer, {char: '🔥'}, {max: 3, random: () => .5});
  assert.equal(layer.children.length, 3);
  assert.equal(layer.children[0].children[0].textContent, '🔥');
  layer.children[0].listeners.animationend(); assert.equal(layer.children.length, 2);
  const custom = floatEmoji(layer, {id: '10', animated: false}, {random: () => .5});
  assert.equal(custom.children[0].src, '/discord-cdn/emojis/10.webp?size=64');
  custom.children[0].listeners.error(); assert.equal(layer.children.includes(custom), false);
});
