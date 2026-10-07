interface ContentAttachment {
  content_type: string;
  payload: unknown;
  truncated: boolean;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function textContent(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() ? value : null;
  if (!Array.isArray(value)) return null;
  const text = value.flatMap((part) => {
    const block = object(part);
    return block?.type === 'text' && typeof block.text === 'string' ? [block.text] : [];
  }).join('\n');
  return text.trim() ? text : null;
}

/** Read only existing owner-only attachments; never infer a prompt from tool or system text. */
export function getLiveActivityPrompt(content: readonly ContentAttachment[]) {
  for (const item of content) {
    if (item.content_type !== 'user_prompt') continue;
    const text = textContent(object(item.payload)?.prompt);
    if (text) return { text, source: 'original' as const, truncated: item.truncated };
  }
  // Older and slash-help traces may only capture the request. The last user
  // turn in the first request excludes preceding conversation history.
  for (const item of content) {
    if (item.content_type !== 'provider_request') continue;
    const messages = object(item.payload)?.messages;
    if (!Array.isArray(messages)) continue;
    const lastUser = [...messages].reverse().find((message) => object(message)?.role === 'user');
    if (!lastUser) continue;
    const text = textContent(object(lastUser)?.content);
    // Don't substitute a later rewritten request for a textless current turn.
    return text ? { text, source: 'provider' as const, truncated: item.truncated } : null;
  }
  return null;
}
