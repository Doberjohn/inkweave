// Runtime guards for a `CollectionEntries` map that arrived from OUTSIDE the app
// (#553).
//
// Separate from `collectionParser` because the parser does not use them. It
// builds a map from a file it has already validated field by field; these guard
// the two doors where a finished map arrives from somewhere we do not control:
// localStorage, and the `collections` table's `jsonb` column.
//
// SHARED, not written once per reader, which is the whole reason this file
// exists. Both doors had grown their own half-check, and the localStorage one
// was tightened while the server one was left as a container-only test. Two
// near-copies of a guard is precisely how one of them falls behind.

import type {CollectionEntries, CollectionEntry} from './collectionParser';

/**
 * A real copy count: a NON-NEGATIVE SAFE INTEGER, not merely a number.
 *
 * `typeof n === 'number'` is the check that looks sufficient and is not. `-1`
 * drives ownership totals negative, `1.5` is not a number of cards, `NaN`
 * poisons every sum it reaches, and anything past 2^53 has already lost
 * precision before we see it.
 */
function isCopyCount(value: unknown): value is number {
  if (typeof value !== 'number') return false;
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Runtime guard for one {@link CollectionEntry}.
 *
 * The SUM is checked as well as each field, because `totalOwned` folds the two
 * and is the accessor every consumer goes through. Two individually safe counts
 * can add past 2^53, and an entry whose own total is unrepresentable has not
 * really been validated: the one number it exists to report is already wrong.
 */
export function isCollectionEntry(value: unknown): value is CollectionEntry {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  const entry = value as Partial<CollectionEntry>;
  if (!isCopyCount(entry.normal)) return false;
  if (!isCopyCount(entry.foil)) return false;
  return Number.isSafeInteger(entry.normal + entry.foil);
}

/**
 * Runtime guard for a whole {@link CollectionEntries} map, CONTENTS INCLUDED.
 *
 * Validating the container and trusting the values is the mistake both readers
 * made. `holdingOf` in `collectionStats` guards `entry === undefined`, which is
 * correct for a card nobody owns and does nothing for a `null` that is present:
 * `null !== undefined`, so it reached `entry.normal` and took the binder down.
 *
 * Separate returns rather than one `||` chain, because each rejects a DIFFERENT
 * thing: absent, scalar, array. The array case is the one that slips through a
 * bare `typeof value === 'object'`, and a stored or returned `[]` would then
 * read as a perfectly valid empty collection.
 */
export function isCollectionEntries(value: unknown): value is CollectionEntries {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  return Object.values(value).every(isCollectionEntry);
}
