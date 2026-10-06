// Dreamborn collection import (#553, Phase 2 of the deck-builder epic).
//
// Dreamborn exports a CSV that is a CENSUS of every printed card, not a list of
// what you have — `Count` is 0 for cards you do not own, and there are normally
// two rows per card, one per finish:
//
//     Set Number,Card Number,Variant,Count,Name,Color,Rarity
//     013,1,normal,0,"Woody - Helping a Friend",Amber,Rare
//     013,1,foil,0,"Woody - Helping a Friend",Amber,Rare
//
// Measured against the real export and `allCards.json` on 2026-08-10. Five facts
// this parser is built on, each of which contradicts a plausible assumption:
//
//   1. THE JOIN IS EXACT. `(parseInt(Set Number), Card Number)` against
//      `(setCode, setNumber)` matched 1024 of 1024 Core pairs with zero unmatched
//      and zero cards left unclaimed. So there is NO name matching here, unlike
//      `deckTransfer.ts`, which matches decklists by name because their refs cite
//      printings we do not carry. A collection export cites our own printings.
//   2. `Set Number` IS ZERO-PADDED (`001`..`013`) while `setCode` is an unpadded
//      string, so both sides go through `parseInt`.
//   3. NOT EVERY CARD HAS TWO ROWS. Nine cards (sets 3-8, numbers 223-225) ship a
//      foil row and no normal row. Core is unaffected today, but pairing is not a
//      property of the format and must not be assumed.
//   4. `setNumber` CAN BE 0 (Bruno Madrigal, set 9) and the engine types it
//      `number | undefined`, so a falsy guard silently drops it. Every check here
//      is against `undefined` explicitly.
//   5. `Count` EXCEEDS A PLAYSET — max 10 observed, 602 rows above 4. A collection
//      quantity is not a deck quantity, so nothing here reaches for MAX_COPIES.
//   6. `Card Number` IS NOT ALWAYS NUMERIC. Set 3's Dalmatian Puppy ships as five
//      collector variants, `4a` through `4e`. `parseInt` reads all five as 4 and
//      returns no error, which silently merges five cards into one — measured, it
//      undercounted distinct non-Core cards by exactly 4. So card numbers are
//      NORMALIZED STRINGS here, never integers. Set numbers are always numeric
//      (verified across all 5329 rows) and stay parsed, because they are padded.
//
// The pool this parses against SPANS EVERY SET (since #553 Phase C), so a card
// from set 3 is stored like any other and there is no "below the floor" branch.
// It was Core-only once, and the summary still described misses as "sets the Core
// format does not use" long after that stopped being true — which reported five
// genuinely lost cards as a routine fact about the format.

import type {LorcanaCard} from 'inkweave-synergy-engine';

/** The two ways a card is printed. `CollectionEntry` is keyed by it. */
export type Finish = 'normal' | 'foil';

/** Owned copies of one card, split by finish. */
export interface CollectionEntry {
  normal: number;
  foil: number;
}

/** Card id (`LorcanaCard.id`) to owned copies, across every set. */
export type CollectionEntries = Record<string, CollectionEntry>;

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
 * Lives beside the type rather than in either consumer, because the same data
 * arrives through two doors that had each grown their own half-check: the
 * localStorage read and the server row. Validating the container and trusting
 * the values is the mistake both made, and `holdingOf` in `collectionStats`
 * guards `entry === undefined`, which is correct for an unowned card and does
 * nothing for a `null` that is present. One definition, both doors.
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

/**
 * Copies owned regardless of finish.
 *
 * THE accessor for the two-field shape, and the reason storing finish separately
 * costs nothing: no consumer writes `normal + foil` inline, so folding the two
 * later is one edit here rather than a hunt through every call site.
 */
export function totalOwned(entry: CollectionEntry | undefined): number {
  return entry ? entry.normal + entry.foil : 0;
}

/**
 * What an import is worth reporting back to the person who ran it.
 *
 * RENAMED 2026-08-14, because the old names had become lies. They dated from
 * when the pool was Core-only and roughly two thirds of a real collection was
 * legitimately discarded, so a miss meant "older set" and was worth explaining.
 * The pool now spans every set, so a card from set 3 is stored like any other
 * and a miss means only one thing: we could not identify the row. Reporting that
 * as "sets the Core format does not use" described a failure as routine — a real
 * import lost five owned cards behind that sentence.
 */
export interface CollectionSummary {
  /** Distinct cards owned at one copy or more, across every set. */
  cardsOwned: number;
  /** Total copies of those, both finishes. */
  copiesOwned: number;
  /**
   * `set-number` refs that matched no card in the pool, deduped and capped for
   * display. A LIST rather than a count: five unidentified cards is a thing
   * someone can act on, where "another 5 cards" is only a thing to worry about.
   */
  unidentified: string[];
  /** Rows that could not be read at all, verbatim. */
  unparsed: string[];
}

export interface ParsedCollection {
  entries: CollectionEntries;
  summary: CollectionSummary;
}

/** One CSV row after reading, before it is matched against the pool. */
interface CollectionRow {
  set: number;
  /** Normalized card number — a STRING, because `4a` is a real one (fact 6). */
  number: string;
  variant: 'normal' | 'foil';
  count: number;
}

/** What a row turned out to be. Drives both `entries` and the summary. */
export type RowOutcome = {kind: 'owned'; cardId: string} | {kind: 'unidentified'};

/**
 * Split one CSV line. Fields may be quoted and a quoted field may contain commas
 * (`"Hi, Diddly-Dee"`), so this cannot be a `.split(',')`.
 */
function splitCsvRow(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      fields.push(field);
      field = '';
    } else field += ch;
  }
  fields.push(field);
  return fields;
}

/**
 * Drop the zero padding from a numeric card number so `001` and `1` are one key,
 * while leaving a suffixed one (`4a`) alone. Both sides of the join go through
 * this, which is what makes the pool's numeric `setNumber` comparable to the
 * CSV's text field.
 */
function normalizeCardNumber(raw: string): string {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? String(parseInt(trimmed, 10)) : trimmed;
}

/** Dreamborn's header line, recognised by its first field rather than in full. */
function looksLikeHeader(line: string | undefined): boolean {
  return line !== undefined && splitCsvRow(line)[0].trim().toLowerCase() === 'set number';
}

/** Read one line, or null when it is not a row this format can describe. */
function readRow(line: string): CollectionRow | null {
  const fields = splitCsvRow(line);
  if (fields.length < 4) return null;
  const [rawSet, rawNumber, rawVariant, rawCount] = fields;
  if (!/^\d+$/.test(rawSet.trim())) return null;
  const number = normalizeCardNumber(rawNumber);
  if (number === '') return null;
  // The WHOLE field, not `parseInt` alone. `parseInt` is a prefix parser, so
  // "3x" reads as 3, "1.5" as 1 and "-2" as -2, and `Number.isFinite` waves all
  // three through. A null return puts the line in `unparsed` for the user to
  // see; a prefix parse routes a malformed count silently around that, which is
  // the one outcome this format should never produce. `normalizeCardNumber`
  // above already tests its whole field for exactly this reason.
  //
  // Digits alone are still not enough: `9007199254740993` silently rounds to
  // ...992, and a long enough run of digits becomes `Infinity`. Both would be
  // added straight into `copiesOwned`.
  const rawCountTrimmed = rawCount.trim();
  if (!/^\d+$/.test(rawCountTrimmed)) return null;
  const count = parseInt(rawCountTrimmed, 10);
  if (!Number.isSafeInteger(count)) return null;
  if (rawVariant !== 'normal' && rawVariant !== 'foil') return null;
  return {set: parseInt(rawSet, 10), number, variant: rawVariant, count};
}

/**
 * A card's `set:number` index key, or null when it cannot have one.
 *
 * Set numbering is 1-based, so ONE comparison rejects every non-key: a missing
 * setCode and a non-numeric one ("Q1" and friends, which the binder does not index)
 * are both NaN, and `NaN > 0` is false; an empty setCode is 0, which matters because
 * `Number('')` is 0 where the `parseInt` this replaced gave NaN.
 *
 * `setNumber`, by contrast, is checked explicitly against undefined rather than
 * falsily, because 0 is a real collector number (fact 4). It is numeric, so
 * stringifying it is already normalized.
 */
function poolKey(card: LorcanaCard): string | null {
  const set = Number(card.setCode);
  if (!(set > 0) || card.setNumber === undefined) return null;
  return `${set}:${card.setNumber}`;
}

/**
 * Award one `set:number` key to a card, resolving a contested one.
 *
 * FIRST WINS, EXCEPT that a base card evicts a Special. See `buildPoolIndex` for
 * why: order must not decide it, and one of the 98 contested numbers lists its
 * Special first. Two base cards sharing a number stay a data fault rather than a
 * silent load-order swap.
 */
function claimKey(
  index: Map<string, string>,
  heldBySpecial: Set<string>,
  key: string,
  card: LorcanaCard,
): void {
  const isSpecial = card.rarity === 'Special';
  if (!index.has(key)) {
    index.set(key, card.id);
    if (isSpecial) heldBySpecial.add(key);
    return;
  }
  if (!isSpecial && heldBySpecial.has(key)) {
    index.set(key, card.id);
    heldBySpecial.delete(key);
  }
}

/**
 * `set:number` to card id, for every pool card that carries both.
 *
 * THE KEY IS NOT UNIQUE OUTSIDE CORE (fact 7). Special-rarity promos reuse base
 * collector numbers: 98 contested numbers across the non-Core sets, with five
 * cards claiming Set 1's slot #1. So this cannot be a plain `set()` — whichever
 * card happened to be last would win, and a Special won 97 of the 98.
 *
 * THE BASE CARD WINS, because that is what the CSV row means: `001,1` is the card
 * printed in Set 1's first slot, not a promo reprinted with the same number. When
 * a Special took the key, ownership was recorded against a card the binder does
 * not even render — it excludes Specials, or five would fight for one pocket — so
 * a card the user owned showed as unowned. Measured on a real import: 18 of Set
 * 1's 30 apparent gaps.
 *
 * Order must not decide it, so this is first-wins EXCEPT that a base card evicts
 * a Special. One of the 98 lists the Special first.
 */
function buildPoolIndex(pool: readonly LorcanaCard[]): Map<string, string> {
  const index = new Map<string, string>();
  /** Keys currently held by a Special, i.e. still open to eviction. */
  const heldBySpecial = new Set<string>();

  for (const card of pool) {
    const key = poolKey(card);
    if (key !== null) claimKey(index, heldBySpecial, key, card);
  }
  return index;
}

/**
 * Decide what an owned row is: a card we can store, a card from outside Core, or
 * a Core card the pool does not have.
 *
 * The pool is Core-only (the card loader filters on the rotation floor), so a
 * miss against the index is ambiguous on its own and the two readings are treated
 * oppositely by the summary: one is the expected bulk of a real collection, the
 * other is a genuine failure worth showing someone.
 */
/**
 * Strip a trailing variant letter: `4a` -> `4`. Empty when there is none.
 *
 * Dreamborn numbers a card's printing variants with a letter suffix — Set 3's
 * Dalmatian Puppy is 4a through 4e — while our data carries the printed card
 * once, as plain `4`. They are the same card, and `totalOwned` already folds
 * copies, so five variant rows correctly become five copies of one card.
 */
function printedNumber(number: string): string {
  const match = /^(\d+)[a-z]$/.exec(number);
  return match ? match[1] : '';
}

function classifyRow(row: CollectionRow, index: Map<string, string>): RowOutcome {
  const cardId = index.get(`${row.set}:${row.number}`);
  if (cardId !== undefined) return {kind: 'owned', cardId};

  // Exact first, always: the fallback must never shadow a real key. Only after a
  // genuine miss do we ask whether this was a lettered variant of a card we have.
  const printed = printedNumber(row.number);
  if (printed !== '') {
    const variantOf = index.get(`${row.set}:${printed}`);
    if (variantOf !== undefined) return {kind: 'owned', cardId: variantOf};
  }

  // Everything else is simply unidentified. There is no longer a quiet branch for
  // "below the rotation floor": the pool spans every set, so a set-3 card is
  // stored like any other and a miss is a miss. Splitting them was right when the
  // pool was Core-only and two thirds of a collection was discarded by design; it
  // now hides real losses behind a routine-sounding explanation.
  return {kind: 'unidentified'};
}

/**
 * Parse a Dreamborn collection export against the Core card pool.
 *
 * Unowned rows are dropped rather than stored as zeroes: the file describes every
 * printed card, so keeping them would persist ~5000 entries to say nothing.
 */
export function parseCollectionCsv(csv: string, pool: readonly LorcanaCard[]): ParsedCollection {
  const index = buildPoolIndex(pool);
  const entries: CollectionEntries = {};
  const unidentified = new Set<string>();
  const unparsed: string[] = [];

  // Skip the header only when there IS one. An unconditional `.slice(1)` would
  // silently eat the first card of a file that had been pasted without it, and a
  // one-card shortfall in a 5000-row import is not something anyone would notice.
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== '');
  const body = looksLikeHeader(lines[0]) ? lines.slice(1) : lines;
  for (const line of body) {
    const row = readRow(line);
    if (row === null) {
      unparsed.push(line);
      continue;
    }
    if (row.count <= 0) continue;

    const outcome = classifyRow(row, index);
    if (outcome.kind === 'unidentified') {
      // A Set, because the census lists each card twice (normal + foil) and one
      // unidentified card must not be reported as two.
      unidentified.add(`${row.set}-${row.number}`);
    } else {
      const entry = entries[outcome.cardId] ?? {normal: 0, foil: 0};
      entry[row.variant] += row.count;
      entries[outcome.cardId] = entry;
    }
  }

  const owned = Object.values(entries);
  return {
    entries,
    summary: {
      cardsOwned: owned.length,
      copiesOwned: owned.reduce((total, entry) => total + totalOwned(entry), 0),
      unidentified: [...unidentified],
      unparsed,
    },
  };
}
