// Bot telemetry records each source of a call's input as a `ctx_<part>` metadata
// field. The bar groups them by who wrote the text.
const CONTEXT_GROUPS = [
  { key: 'instructions', label: 'Our instructions', parts: ['instructions'] },
  { key: 'tool_definitions', label: 'Tool definitions', parts: ['tool_definitions'] },
  { key: 'conversation', label: 'Conversation', parts: ['memory', 'history', 'reply', 'message', 'images'] },
  { key: 'tool_activity', label: 'Tool returns', parts: ['tool_calls', 'tool_results'] },
] as const;

export const CONTEXT_PART_LABELS: Record<string, string> = {
  instructions: 'Instructions',
  tool_definitions: 'Tool definitions',
  memory: 'Memory',
  history: 'Chat history',
  reply: 'Reply target',
  message: 'Current message',
  tool_calls: 'Tool calls',
  tool_results: 'Tool results',
  images: 'Images',
};

export interface ContextGroup {
  key: string;
  label: string;
  tokens: number;
  share: number;
}

export function contextPartTokens(metadata: Record<string, unknown> | null | undefined): Record<string, number> {
  const tokens: Record<string, number> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    const count = Number(value);
    if (key.startsWith('ctx_') && Number.isFinite(count) && count > 0) tokens[key.slice(4)] = count;
  }
  return tokens;
}

export function contextGroups(partTokens: Record<string, number>): ContextGroup[] {
  const total = Object.values(partTokens).reduce((sum, value) => sum + value, 0);
  if (!total) return [];
  return CONTEXT_GROUPS
    .map(({ key, label, parts }) => {
      const tokens = parts.reduce((sum: number, part: string) => sum + (partTokens[part] ?? 0), 0);
      return { key, label, tokens, share: tokens / total };
    })
    .filter(group => group.tokens > 0);
}

export function peakContextSpan<T extends { context_share?: number | null }>(spans: T[]): T | null {
  return spans.reduce<T | null>(
    (peak, span) => (span.context_share != null && span.context_share > (peak?.context_share ?? -1) ? span : peak),
    null,
  );
}

export function contextLimitLabel(limit: number): string {
  return limit >= 1_000_000 ? `${(limit / 1_000_000).toFixed(2)}M` : `${Math.round(limit / 1_000)}K`;
}

// Calls sit near 1% of the window, so whole percents would all read the same.
export function contextPercent(share: number | null | undefined): string {
  return share == null ? '—' : `${(share * 100).toFixed(share < 0.1 ? 2 : 1)}%`;
}
