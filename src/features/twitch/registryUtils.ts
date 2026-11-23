/**
 * Pure helpers behind the section registry (§11.3). No React, no Vite APIs,
 * so `tests/twitch-registry.test.ts` imports this file directly.
 */
import type { Role, SectionGroup, TwitchPublicPage, TwitchSection } from './types.ts';
import { hasRole, isRole, roleRank } from './shared/roles.ts';

export { roleRank };

/** Sidebar group order and labels; `overview` renders without a heading. */
export const SECTION_GROUPS: ReadonlyArray<{ id: SectionGroup; label: string | null }> = [
  { id: 'overview', label: null },
  { id: 'chat', label: 'Chat' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'community', label: 'Community' },
  { id: 'stream', label: 'Stream' },
  { id: 'channel', label: 'Channel' },
];

const GROUP_IDS = new Set<string>(SECTION_GROUPS.map((group) => group.id));
export const SECTION_ID_PATTERN = /^[a-z0-9-]+$/;

export interface ValidationResult<T> {
  /** Entries that passed, in input order; for duplicate ids the first wins. */
  valid: T[];
  /** One human sentence per rejected entry. Empty when everything passed. */
  problems: string[];
}

const describe = (entry: unknown, index: number): string => {
  const id = (entry as { id?: unknown } | null)?.id;
  return typeof id === 'string' && id ? `"${id}"` : `#${index}`;
};

/**
 * Checks every section a slice registered: URL-safe unique ids, known group
 * and role, a label, a finite order and a component. Returns the valid ones
 * plus a problem list instead of throwing, so the caller decides how loud to be.
 */
export function validateSections(sections: readonly TwitchSection[]): ValidationResult<TwitchSection> {
  const valid: TwitchSection[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  sections.forEach((section, index) => {
    const name = describe(section, index);
    if (!section || typeof section !== 'object') {
      problems.push(`Section ${name} is not an object.`);
      return;
    }
    if (typeof section.id !== 'string' || !SECTION_ID_PATTERN.test(section.id)) {
      problems.push(`Section ${name} has an id that is not a lowercase URL segment (^[a-z0-9-]+$).`);
      return;
    }
    if (seen.has(section.id)) {
      problems.push(`Section ${name} is registered more than once.`);
      return;
    }
    if (typeof section.label !== 'string' || !section.label.trim()) {
      problems.push(`Section ${name} has no label.`);
      return;
    }
    if (!GROUP_IDS.has(section.group)) {
      problems.push(`Section ${name} uses an unknown group "${String(section.group)}".`);
      return;
    }
    if (!isRole(section.minRole)) {
      problems.push(`Section ${name} uses an unknown minRole "${String(section.minRole)}".`);
      return;
    }
    if (typeof section.order !== 'number' || !Number.isFinite(section.order)) {
      problems.push(`Section ${name} has no numeric order.`);
      return;
    }
    if (!section.component) {
      problems.push(`Section ${name} has no component.`);
      return;
    }
    seen.add(section.id);
    valid.push(section);
  });

  return { valid, problems };
}

/** Same rules for public pages (no group or role). */
export function validatePublicPages(pages: readonly TwitchPublicPage[]): ValidationResult<TwitchPublicPage> {
  const valid: TwitchPublicPage[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  pages.forEach((page, index) => {
    const name = describe(page, index);
    if (!page || typeof page !== 'object') {
      problems.push(`Public page ${name} is not an object.`);
      return;
    }
    if (typeof page.id !== 'string' || !SECTION_ID_PATTERN.test(page.id)) {
      problems.push(`Public page ${name} has an id that is not a lowercase URL segment (^[a-z0-9-]+$).`);
      return;
    }
    if (seen.has(page.id)) {
      problems.push(`Public page ${name} is registered more than once.`);
      return;
    }
    if (typeof page.label !== 'string' || !page.label.trim()) {
      problems.push(`Public page ${name} has no label.`);
      return;
    }
    if (typeof page.order !== 'number' || !Number.isFinite(page.order)) {
      problems.push(`Public page ${name} has no numeric order.`);
      return;
    }
    if (!page.component) {
      problems.push(`Public page ${name} has no component.`);
      return;
    }
    seen.add(page.id);
    valid.push(page);
  });

  return { valid, problems };
}

const byOrderThenLabel = <T extends { order: number; label: string }>(a: T, b: T): number =>
  a.order - b.order || a.label.localeCompare(b.label);

export interface SectionGroupView {
  id: SectionGroup;
  label: string | null;
  sections: TwitchSection[];
}

/**
 * Sidebar model: groups in §11.3 order, each holding the sections the role may
 * open, sorted by `order` (then label). Empty groups are omitted, so a group
 * appears only once a slice registers something the user can use.
 */
export function groupSections(sections: readonly TwitchSection[], role: Role | null | undefined): SectionGroupView[] {
  if (roleRank(role) === 0) return [];
  return SECTION_GROUPS
    .map((group) => ({
      id: group.id,
      label: group.label,
      sections: sections
        .filter((section) => section.group === group.id && hasRole(role, section.minRole))
        .sort(byOrderThenLabel),
    }))
    .filter((group) => group.sections.length > 0);
}

export function findSection(sections: readonly TwitchSection[], id: string | null | undefined): TwitchSection | undefined {
  if (!id) return undefined;
  return sections.find((section) => section.id === id);
}

export function sortPublicPages(pages: readonly TwitchPublicPage[]): TwitchPublicPage[] {
  return [...pages].sort(byOrderThenLabel);
}

/** Flattens the arrays a glob returns (`{ sections }` / `{ publicPages }` per module). */
export function collectFromModules<T>(modules: Record<string, Record<string, unknown>>, exportName: string): T[] {
  return Object.keys(modules)
    .sort()
    .flatMap((path) => {
      const value = modules[path]?.[exportName];
      return Array.isArray(value) ? (value as T[]) : [];
    });
}
