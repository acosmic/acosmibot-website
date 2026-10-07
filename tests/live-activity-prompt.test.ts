import assert from 'node:assert/strict';
import test from 'node:test';
import { getLiveActivityPrompt } from '../src/utils/liveActivityPrompt.ts';

const request = (messages: unknown[]) => ({ content_type: 'provider_request', payload: { messages }, truncated: false });
test('extracts slash help input without exposing system documentation', () => {
  assert.deepEqual(getLiveActivityPrompt([request([
    { role: 'system', content: 'Long internal documentation' },
    { role: 'user', content: 'example question' },
  ])]), { text: 'example question', source: 'provider', truncated: false });
});
test('original capture takes precedence over provider-added context', () => {
  assert.deepEqual(getLiveActivityPrompt([
    request([{ role: 'user', content: 'Enriched input' }]),
    { content_type: 'user_prompt', payload: { prompt: 'Original\nquestion' }, truncated: true },
  ]), { text: 'Original\nquestion', source: 'original', truncated: true });
});
test('uses latest user turn from first request, not history or later rewrites', () => {
  assert.equal(getLiveActivityPrompt([
    request([{ role: 'user', content: 'Old question' }, { role: 'assistant', content: 'Answer' }, { role: 'user', content: 'Current question' }]),
    request([{ role: 'user', content: 'Rewritten question' }]),
  ])?.text, 'Current question');
});
test('multimodal content extracts only text and preserves literal markup', () => {
  assert.equal(getLiveActivityPrompt([request([{ role: 'user', content: [
    { type: 'text', text: '<script>literal</script>' },
    { type: 'image_url', image_url: { url: 'private-image' } },
    { type: 'text', text: 'Second line' },
  ] }])])?.text, '<script>literal</script>\nSecond line');
});
test('missing, malformed, or textless content never substitutes other roles or later input', () => {
  for (const payload of [null, {}, { messages: 'bad' }, { messages: [null, { role: 'system', content: 'secret' }] }]) {
    assert.equal(getLiveActivityPrompt([{ content_type: 'provider_request', payload, truncated: false }]), null);
  }
  assert.equal(getLiveActivityPrompt([]), null);
  assert.equal(getLiveActivityPrompt([
    request([{ role: 'user', content: [{ type: 'image_url' }] }]),
    request([{ role: 'user', content: 'Later synthetic input' }]),
  ]), null);
});
