/** Pure helpers for the stream alerts page: which account is shown, and how it is named. */

interface AccountLike {
  id: number;
  is_own: boolean;
  owner_username: string;
}

/** The `?account=` value as an account id, or null when it is missing or not a plain positive number. */
export function parseAccountParam(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d{0,15}$/.test(value)) return null;
  return Number(value);
}

/**
 * The account to show. A link's `?account=` wins when the person can open that account;
 * otherwise their own account; otherwise the first one they edit.
 */
export function pickAccount<T extends { id: number }>(
  accounts: readonly T[], requested: string | null | undefined, ownAccountId: number | null,
): T | null {
  const wanted = parseAccountParam(requested);
  return accounts.find((account) => account.id === wanted)
    ?? accounts.find((account) => account.id === ownAccountId)
    ?? accounts[0]
    ?? null;
}

/** True when a link asked for an account this person cannot open, so the page shows another one. */
export function linkedAccountMissing(accounts: readonly { id: number }[], requested: string | null | undefined): boolean {
  if (!requested) return false;
  const wanted = parseAccountParam(requested);
  return !accounts.some((account) => account.id === wanted);
}

/** Your own account first, then the ones you edit by owner name. */
export function orderAccounts<T extends AccountLike>(accounts: readonly T[]): T[] {
  return [...accounts].sort((a, b) => (
    Number(b.is_own) - Number(a.is_own)
    || a.owner_username.localeCompare(b.owner_username, undefined, { sensitivity: 'base' })
    || a.id - b.id
  ));
}

export function ownerPossessive(ownerUsername: string): string {
  return `${ownerUsername.trim() || 'Someone'}'s`;
}

/** Switcher label: "Yours" or "<owner_username>'s". */
export function accountLabel(account: AccountLike): string {
  return account.is_own ? 'Yours' : ownerPossessive(account.owner_username);
}

/** A request failure in plain words, without the "Error:" prefix or the API's internal codes. */
export function plainError(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error ?? '')).trim();
  if (text === 'owner_required') return 'Only the owner of these stream alerts can do that.';
  if (text === 'Not found') return 'These stream alerts no longer exist, or you no longer have access to them.';
  if (text === 'Failed to fetch' || text === 'Load failed') return 'Could not reach Acosmibot. Check your connection and try again.';
  return text || 'Something went wrong.';
}
