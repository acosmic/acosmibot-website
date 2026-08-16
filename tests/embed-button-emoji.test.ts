import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const builder = await readFile(new URL('../src/features/embeds/EmbedBuilderPage.tsx', import.meta.url), 'utf8');
const preview = await readFile(new URL('../src/components/ui/DiscordEmbedPreview.tsx', import.meta.url), 'utf8');

test('embed link buttons use the shared server-aware emoji picker', () => {
  assert.match(builder, /useGuildEmojis\(guildId!\)/);
  assert.match(builder, /<EmojiPickerField/);
  assert.match(builder, /<EmojiPicker/);
  assert.doesNotMatch(builder, /placeholder="Emoji \(optional\)"/);
});

test('the embed preview renders selected custom emoji instead of their raw token', () => {
  assert.match(preview, /<EmojiDisplay emoji=\{b\.emoji\}/);
});
