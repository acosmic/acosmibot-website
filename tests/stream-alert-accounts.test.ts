import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountLabel,
  linkedAccountMissing,
  orderAccounts,
  ownerPossessive,
  parseAccountParam,
  pickAccount,
  plainError,
} from '../src/utils/streamAlertAccounts.ts';

const mine = { id: 3, is_own: true, owner_username: 'Acosmic' };
const novas = { id: 7, is_own: false, owner_username: 'Nova' };
const echos = { id: 5, is_own: false, owner_username: 'echo' };

test('the ?account= value is read only as a plain positive number', () => {
  assert.equal(parseAccountParam('7'), 7);
  for (const value of [null, undefined, '', '0', '-7', '7.5', '07', ' 7', '7abc', 'abc', '1e3', '99999999999999999']) {
    assert.equal(parseAccountParam(value), null, String(value));
  }
});

test('a link to an account you can open wins over your own account', () => {
  assert.equal(pickAccount([mine, novas, echos], '7', 3), novas);
  assert.equal(pickAccount([mine, novas, echos], '3', 3), mine);
});

test('without a usable link the page falls back to your own account, else the first', () => {
  assert.equal(pickAccount([novas, mine], null, 3), mine);
  assert.equal(pickAccount([novas, mine], '', 3), mine);
  assert.equal(pickAccount([novas, mine], 'nope', 3), mine);
  // An account you cannot open (or that does not exist) is never selected.
  assert.equal(pickAccount([novas, mine], '99', 3), mine);
  // An editor with no account of their own lands on the first one they edit.
  assert.equal(pickAccount([novas, echos], null, null), novas);
  assert.equal(pickAccount([novas, echos], '99', null), novas);
  // own_account_id pointing at an account missing from the list is ignored too.
  assert.equal(pickAccount([novas, echos], null, 3), novas);
  assert.equal(pickAccount([], '7', null), null);
  assert.equal(pickAccount([], null, 3), null);
});

test('a link is reported as missed only when it names an account that is not in the list', () => {
  assert.equal(linkedAccountMissing([mine, novas], null), false);
  assert.equal(linkedAccountMissing([mine, novas], ''), false);
  assert.equal(linkedAccountMissing([mine, novas], '7'), false);
  assert.equal(linkedAccountMissing([mine, novas], '99'), true);
  assert.equal(linkedAccountMissing([mine, novas], 'junk'), true);
  assert.equal(linkedAccountMissing([], '7'), true);
});

test('the switcher lists your own account first, then the others by owner name', () => {
  const input = [novas, echos, mine];
  assert.deepEqual(orderAccounts(input).map((account) => account.id), [3, 5, 7]);
  assert.deepEqual(input.map((account) => account.id), [7, 5, 3]);
  assert.deepEqual(orderAccounts([novas, echos]).map((account) => account.id), [5, 7]);
});

test('accounts are labelled "Yours" or by their owner', () => {
  assert.equal(accountLabel(mine), 'Yours');
  assert.equal(accountLabel(novas), "Nova's");
  assert.equal(ownerPossessive('  '), "Someone's");
});

test('request failures read as plain sentences', () => {
  assert.equal(plainError(new Error('owner_required')), 'Only the owner of these stream alerts can do that.');
  assert.equal(plainError(new Error('Not found')), 'These stream alerts no longer exist, or you no longer have access to them.');
  assert.equal(plainError(new Error('Failed to fetch')), 'Could not reach Acosmibot. Check your connection and try again.');
  assert.equal(plainError(new Error('That person cannot be added as an editor')), 'That person cannot be added as an editor');
  assert.equal(plainError(new Error('')), 'Something went wrong.');
  assert.equal(plainError(null), 'Something went wrong.');
  assert.equal(plainError('API error 500'), 'API error 500');
});
