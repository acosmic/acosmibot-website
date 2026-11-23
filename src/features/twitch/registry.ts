/// <reference types="vite/client" />
/**
 * Section registry (§11.3). Every slice owns one folder
 * `src/features/twitch/<slice>/` and registers itself by exporting
 *
 *   section.tsx → `export const sections: TwitchSection[]`
 *   public.tsx  → `export const publicPages: TwitchPublicPage[]` (optional)
 *
 * Nothing else changes: the glob below discovers the folder at build time and
 * the sidebar, dashboard routes, landing feature list and public channel pages
 * all read these two arrays. `section.tsx` must export metadata only and
 * import its pages lazily (`lazyRoute(() => import('./Page'))`), because
 * this glob is eager.
 */
import type { TwitchPublicPage, TwitchSection } from './types';
import { collectFromModules, sortPublicPages, validatePublicPages, validateSections } from './registryUtils';

const sectionModules = import.meta.glob<{ sections: TwitchSection[] }>('./*/section.tsx', { eager: true });
const publicModules = import.meta.glob<{ publicPages: TwitchPublicPage[] }>('./*/public.tsx', { eager: true });

const report = (kind: string, problems: string[]): void => {
  if (!problems.length) return;
  const message = `Twitch ${kind} registry: ${problems.join(' ')}`;
  // Fail loudly while developing so a slice cannot ship a broken entry;
  // in production drop only the invalid entries and keep the dashboard up.
  if (import.meta.env.DEV) throw new Error(message);
  console.error(message);
};

const sectionCheck = validateSections(
  collectFromModules<TwitchSection>(sectionModules as Record<string, Record<string, unknown>>, 'sections'),
);
report('section', sectionCheck.problems);

const publicCheck = validatePublicPages(
  collectFromModules<TwitchPublicPage>(publicModules as Record<string, Record<string, unknown>>, 'publicPages'),
);
report('public page', publicCheck.problems);

export const TWITCH_SECTIONS: TwitchSection[] = sectionCheck.valid;
export const TWITCH_PUBLIC_PAGES: TwitchPublicPage[] = sortPublicPages(publicCheck.valid);
