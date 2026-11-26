import assert from 'node:assert/strict';
import test from 'node:test';
import { eventSentence, eventSource, eventText, relativeTime, tierText } from '../src/utils/streamAlertActivity.ts';

const NOW = Date.UTC(2026, 10, 26, 12, 0, 0);
const ago = (seconds: number) => NOW / 1000 - seconds;

test('relative times read like a feed', () => {
  assert.equal(relativeTime(ago(3), NOW), 'now');
  assert.equal(relativeTime(ago(45), NOW), '45s');
  assert.equal(relativeTime(ago(12 * 60), NOW), '12m');
  assert.equal(relativeTime(ago(3 * 3600), NOW), '3h');
  assert.equal(relativeTime(ago(4 * 86400), NOW), '4d');
  assert.equal(relativeTime(ago(65 * 86400), NOW), '2mo');
  assert.equal(relativeTime(ago(800 * 86400), NOW), '2yr');
  // A clock a little behind never shows a negative time.
  assert.equal(relativeTime(ago(-30), NOW), 'now');
});

test('each alert kind becomes a sentence with the name and numbers stressed', () => {
  assert.equal(eventText({ type: 'follow', name: 'bat4fr' }), 'bat4fr has followed.');
  assert.equal(eventText({ type: 'raid', name: 'Somberkitty', value: 2 }), 'Somberkitty has raided you with a party of 2.');
  assert.equal(eventText({ type: 'sub', name: 'Pita', tier: '1000' }), 'Pita has subscribed (Tier 1).');
  assert.equal(eventText({ type: 'sub', name: 'Pita', tier: 'prime' }), 'Pita has subscribed with Prime.');
  assert.equal(eventText({ type: 'resub', name: 'Nova', tier: '2000', value: 14 }), 'Nova has resubscribed (Tier 2) for 14 months.');
  assert.equal(eventText({ type: 'resub', name: 'Nova', value: 1 }), 'Nova has resubscribed for 1 month.');
  assert.equal(eventText({ type: 'gift', name: 'rino', tier: '1000', value: 5 }), 'rino has gifted 5 subs (Tier 1).');
  assert.equal(eventText({ type: 'gift', name: 'rino', value: 1 }), 'rino has gifted 1 sub.');
  assert.equal(eventText({ type: 'cheer', name: 'Miizta', value: 1500 }), 'Miizta has cheered 1,500 bits.');
  assert.equal(eventText({ type: 'cheer', name: 'Miizta', value: 1 }), 'Miizta has cheered 1 bit.');
  assert.equal(eventText({ type: 'hypetrain', name: '', value: 3 }), 'A hype train reached level 3.');
  assert.equal(eventText({ type: 'donation', name: 'Ash', amount_display: '$5.00' }), 'Ash has donated $5.00.');
  assert.equal(eventText({ type: 'follow', name: '  ' }), 'Someone has followed.');

  const raid = eventSentence({ type: 'raid', name: 'geffres', value: 6 });
  assert.deepEqual(raid.filter((part) => part.strong).map((part) => part.text), ['geffres', '6']);
});

test('tiers and sources', () => {
  assert.equal(tierText('3000'), 'Tier 3');
  assert.equal(tierText(undefined), '');
  assert.equal(eventSource({ type: 'follow', test: true, sandbox: false }), 'test');
  assert.equal(eventSource({ type: 'follow', test: false, sandbox: false, source: 'twitch' }), 'twitch');
  assert.equal(eventSource({ type: 'donation', test: false, sandbox: false }), 'donation');
  assert.equal(eventSource({ type: 'cheer', test: false, sandbox: false }), 'other');
});
