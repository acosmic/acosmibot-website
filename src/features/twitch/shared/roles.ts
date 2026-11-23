/**
 * Role helpers (§10.3). Presentation only: the API re-checks every request and
 * answers 403 `insufficient_role`; the dashboard merely hides what it knows
 * the user cannot do.
 *
 * Pure module (no React, no aliases) so Node tests can import it.
 */
import type { Role } from '../types.ts';

export const ROLES: readonly Role[] = ['moderator', 'editor', 'broadcaster'];

const RANK: Record<Role, number> = { moderator: 1, editor: 2, broadcaster: 3 };

export const ROLE_LABELS: Record<Role, string> = {
  moderator: 'Moderator',
  editor: 'Editor',
  broadcaster: 'Broadcaster',
};

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(RANK, value);

/** 0 for no role or an unknown value; otherwise 1–3. */
export const roleRank = (role: Role | null | undefined): number =>
  role && isRole(role) ? RANK[role] : 0;

/** True when `role` is at least `min`. */
export const hasRole = (role: Role | null | undefined, min: Role): boolean =>
  roleRank(role) >= roleRank(min);

export const roleLabel = (role: Role | null | undefined): string =>
  role && isRole(role) ? ROLE_LABELS[role] : 'No access';

/**
 * Fallback for `SECTION_WRITE_ROLE` (§10.3) used until `GET /meta` has loaded.
 * `meta.sections[].write_role` wins whenever it is available.
 */
const MODERATOR_WRITABLE = new Set([
  'commands', 'timers', 'moderation', 'quotes', 'giveaways', 'polls', 'viewer_queue', 'song_requests',
]);

export const fallbackSectionWriteRole = (section: string): Role => {
  if (section === 'ai') return 'broadcaster';
  return MODERATOR_WRITABLE.has(section) ? 'moderator' : 'editor';
};
