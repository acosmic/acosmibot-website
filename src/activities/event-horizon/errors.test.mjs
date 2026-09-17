import test from 'node:test';
import assert from 'node:assert/strict';
import { flightError, needsReconnect } from './errors.mjs';
const response = (status, body) => ({status, json: async () => body});
test('active-run limit explains recovery without treating authentication as failed', async () => {
  const error = await flightError(response(429, {code:'active_run_limit'}));
  assert.match(error.message,/Reconnect.*previous flights/);
  assert.equal(error.code,'active_run_limit');
  assert.equal(needsReconnect(error),false);
});
test('only auth failures require reconnect; transient failures allow launch retry', async () => {
  for (const status of [401,403,409,429,500,503]) {
    assert.equal(needsReconnect(await flightError(response(status,{}))), [401,403].includes(status));
  }
  assert.equal(needsReconnect(new Error('network failure')),false);
});
test('expired session explains takeover and arbitrary server text is never shown', async () => {
  assert.match((await flightError(response(401,{code:'session_expired'}))).message,/replaced by another Activity/);
  assert.doesNotMatch((await flightError(response(500,{code:'unknown',error:'secret driver detail'}))).message,/secret/);
  assert.match((await flightError(response(500,{code:'__proto__'}))).message,/500/);
});
test('invalid response body falls back safely', async () => {
  assert.match((await flightError({status:429,json:async()=>{throw new Error('not json')}})).message,/wait a minute/);
  assert.match((await flightError(response(503,null))).message,/503/);
});
