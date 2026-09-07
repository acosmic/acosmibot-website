import catalog from './personaCatalog.json';
import type { PersonalityIntensity } from './personalityIntensity';

// Authored examples, not generated responses. Each slider step has its own
// example so managers can compare the intended strength of the same voice.
const DEFAULT_SAMPLES = [
  'We split up too much. Next round, pick one fight and stay together.',
  'We had five separate plans. Let’s aim for one shared plan next round. Radical, I know.',
  'Our teamwork apparently took separate holidays. Pick one fight and stick together next round.',
  'We field-tested five bad ideas simultaneously. Efficient research, terrible teamwork. One shared fight next round.',
  'Five players, five plans, one beautifully synchronized disaster. Next round, pick ONE fight and bring everyone. I believe in us. Cautiously.',
];

export const PERSONALITY_PRESENTATION: Record<string, { description: string; samples: { subtle: string; full: string } }> = {
  default: {
    description: 'Your sharp, mischievous server AI: practical help, cosmic oddities, and a clean punchline.',
    samples: { subtle: DEFAULT_SAMPLES[0], full: DEFAULT_SAMPLES[4] },
  },
  ...Object.fromEntries(catalog.map(item => [item.id, item])),
};

export function personalityExample(id: string, intensity: PersonalityIntensity): string {
  if (id === 'default') return DEFAULT_SAMPLES[intensity - 1];
  const preset = catalog.find(item => item.id === id);
  if (!preset) return '';
  return [preset.samples.subtle, ...preset.middle, preset.samples.full][intensity - 1];
}

export const FEATURED_PERSONALITY_IDS = ['default', 'cowboy', 'shakespearean', 'mission-control', 'goblin-consultant'];

export const CATEGORY_LABELS: Record<string, string> = {
  mood: 'Mood', register: 'Vocabulary', brevity: 'Reply length', imagination: 'Imagination', attitude: 'Attitude', delivery: 'Delivery',
};

export const EFFECT_DESCRIPTIONS: Record<string, string> = {
  'maximum-weirdness': 'Surreal comparisons and unexpected turns of phrase.',
  'extremely-formal': 'Impeccable manners and delightfully formal wording.',
  'ultra-terse': 'Short replies that get straight to the point.',
  overenthusiastic: 'A little more celebration in every conversation.',
  'cosmic-melancholy': 'Quietly wistful, with a touch of space-age sadness.',
  'excessively-suspicious': 'Playful suspicion about even the most ordinary things.',
  'shakespearean-vocabulary': 'A little “alas” and “good friend” in the conversation.',
  'sports-commentator-delivery': 'Everyday moments delivered like the big game.',
};

export const effectName = (id: string, fallback: string) => id === 'ultra-terse' ? 'Super Concise' : fallback;

export function remainingEffectTime(expiresAt: string, now: number): string {
  const minutes = Math.ceil((Date.parse(expiresAt) - now) / 60000);
  return minutes < 60 ? `${minutes} min left` : `ends ${new Date(expiresAt).toLocaleString()}`;
}
