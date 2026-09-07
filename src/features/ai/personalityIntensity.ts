export type PersonalityIntensity = 1 | 2 | 3 | 4 | 5;

export const INTENSITY_LEVELS = [
  { value: 1, label: 'Subtle', description: 'A hint of character, mostly natural conversation.' },
  { value: 2, label: 'Light', description: 'Occasional character vocabulary and comparisons.' },
  { value: 3, label: 'Balanced', description: 'A recognizable voice with an easy conversational feel.' },
  { value: 4, label: 'Strong', description: 'Distinctive vocabulary, rhythm, and recurring themes.' },
  { value: 5, label: 'Full character', description: 'The most expressive performance, while staying clear and useful.' },
] as const;

export function normalizePersonalityIntensity(value: unknown): PersonalityIntensity {
  if (value === 'subtle') return 1;
  if (value === 'full') return 5;
  if (typeof value !== 'number' && typeof value !== 'string') return 5;
  if (!/^[+-]?\d+$/.test(String(value).trim())) return 5;
  const parsed = Number(value);
  return Math.min(Math.max(parsed, 1), 5) as PersonalityIntensity;
}
