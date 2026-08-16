import test from 'node:test';
import assert from 'node:assert/strict';

import { useAuthStore } from '../src/store/auth.ts';

const user = {
  id: '42',
  username: 'operator',
  avatar: null,
  global_name: 'Operator',
};

const resetAuthStore = () => {
  useAuthStore.setState({
    user: null,
    status: 'checking',
    isAuthReady: false,
    isAuthenticated: false,
  });
};

test('the initial session check keeps protected routes behind the loading gate', () => {
  resetAuthStore();

  useAuthStore.getState().setChecking();

  assert.equal(useAuthStore.getState().isAuthReady, false);
  assert.equal(useAuthStore.getState().isAuthenticated, false);
});

test('background session checks preserve the mounted authenticated workspace', () => {
  resetAuthStore();
  useAuthStore.getState().setUser(user);

  useAuthStore.getState().setChecking();

  assert.equal(useAuthStore.getState().status, 'checking');
  assert.equal(useAuthStore.getState().isAuthReady, true);
  assert.equal(useAuthStore.getState().isAuthenticated, true);
  assert.deepEqual(useAuthStore.getState().user, user);
});
