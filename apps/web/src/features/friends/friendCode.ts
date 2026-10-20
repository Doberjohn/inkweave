/** Crockford base32: digits and capital letters, without I, L, O or U. */
const FRIEND_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/**
 * The 8 characters a typed code stands for, read the way `send_friend_request` reads it:
 * any case, spaces and hyphens ignored, O as 0, I and L as 1. Null when `typed` can't be
 * a code, which keeps Send off rather than sending a request the database would refuse.
 */
export function normalizeFriendCode(typed: string): string | null {
  const bare = typed.replace(/[\s-]/g, '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
  return FRIEND_CODE.test(bare) ? bare : null;
}

/** A stored code as players see it: ABCD2345 as ABCD-2345. */
export function formatFriendCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
