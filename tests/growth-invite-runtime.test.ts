import test from 'node:test';
import assert from 'node:assert/strict';
import { inviteUrl } from '../src/lib/runtimeConfig.ts';

test('test invites reject production tracked and direct bot links', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const config = { environment: 'test', inviteUrl: '' };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AppConfig: config } });
  try {
    for (const value of ['', 'https://api.acosmibot.com/auth/install/website', 'https://discord.com/oauth2/authorize?client_id=1186802023799214223']) {
      config.inviteUrl = value;
      assert.equal(inviteUrl(), null);
    }
    config.inviteUrl = 'https://discord.com/oauth2/authorize?client_id=999';
    assert.equal(inviteUrl(), config.inviteUrl);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
