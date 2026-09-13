import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarSource } from './avatar.mjs';

test('uses the API avatar field through the Discord proxy', () => {
  assert.equal(avatarSource({ avatar: 'https://cdn.discordapp.com/avatars/123/abc.png?size=64' }), '/discord-cdn/avatars/123/abc.png?size=64');
});
test('retains legacy avatar aliases and mapped paths', () => {
  for (const key of ['avatarUrl', 'avatar_url']) assert.equal(avatarSource({ [key]: 'https://cdn.discordapp.com/avatars/123/a.png' }), '/discord-cdn/avatars/123/a.png');
  assert.equal(avatarSource({ avatar: '/discord-cdn/avatars/123/a.png' }), '/discord-cdn/avatars/123/a.png');
});
test('missing and untrusted avatars safely use initials', () => {
  for (const avatar of [null, 42, '', 'https://evil.example/a.png', 'https://discordapp.com.evil.example/a.png', 'javascript:alert(1)', 'http://cdn.discordapp.com/a.png']) assert.equal(avatarSource({ avatar }), null);
});
