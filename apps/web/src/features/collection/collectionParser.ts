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
// Measured against the real export and `allCards.json` on 2026-08-10. Seven facts
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
//   7. THE `(set, number)` KEY IS NOT UNIQUE IN THE POOL, though no export slot has
//      two rows. Measured 2026-10-16 on the 3,445-card pool: 181 keys had more than
//      one card. 180 were one base card plus LorcanaJSON's promo cards, which reused
//      its number, and which the pool no longer holds (#805): its promos are in their
//      promo sets. One, Set 3 #4, is five base printings of the puppy, which nothing in
//      a row settles. See `buildPoolIndex`.
//   8. A PROMO'S ROW CARRIES ITS CODE (#805, the owner's promo export, 2026-10-17): its
//      Card Number is the code printed on it (`5/PD1`), its Set Number its card's own
//      set. So a promo is matched by its code, never its set: see `classifyPromoRow`.
//      A promo printed in two arts under one number has Dreamborn's letter (`24A/P2`),
//      and twins under one code tell apart by the row's finish (`3/C1`, normal and foil).
//
// The pool this parses against SPANS EVERY SET (since #553 Phase C), so a card
// from set 3 is stored like any other and there is no "below the floor" branch.
// It was Core-only once, and the summary still described misses as "sets the Core
// format does not use" long after that stopped being true — which reported five
// genuinely lost cards as a routine fact about the format.

import type {LorcanaCard} from 'inkweave-synergy-engine';
import {PROMO_RARITY} from '../cards/loader';

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
  /**
   * `set-number` refs whose number two printings of a card share in our data, so the
   * row cannot say which one it owns (#553: reported, never guessed). Today that is Set
   * 3's Dalmatian Puppy - Tail Wagger, five printings numbered 4 (Dreamborn's 4a-4e), or
   * a promo's code two printings share with nothing in the row to tell them apart (#805).
   * A promo's ref is its code alone (`28/C3`).
   */
  ambiguous: string[];
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
  /** The card's name as the row gives it, which only tells apart two promos named differently (fact 8). */
  name: string;
}

/** What a row turned out to be. Drives both `entries` and the summary. */
export type RowOutcome = {kind: 'owned'; cardId: string} | {kind: 'ambiguous'} | {kind: 'unidentified'};

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
  const [rawSet, rawNumber, rawVariant, rawCount, rawName = ''] = fields;
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
  // The DIGIT BUDGET does both jobs in one test. `\d{1,15}` tops out at
  // 999,999,999,999,999, comfortably inside 2^53, so matching the whole field
  // proves the value is representable without a second `isSafeInteger` branch
  // after the parse. Conservative by one digit, which is meaningless for a
  // count whose real-world maximum is 10 (fact 5).
  if (!/^\d{1,15}$/.test(rawCount.trim())) return null;
  const count = parseInt(rawCount, 10);
  if (rawVariant !== 'normal' && rawVariant !== 'foil') return null;
  return {set: parseInt(rawSet, 10), number, variant: rawVariant, count, name: rawName.trim()};
}

/**
 * A card's `set:number` index key, or null when it cannot have one.
 *
 * Set numbering is 1-based, so ONE comparison rejects every non-key: a missing
 * setCode and a non-numeric one ("Q1" and friends, and a promo's promo set, matched by
 * its code instead: fact 8) are both NaN, and `NaN > 0` is false; an empty setCode is 0,
 * which matters because `Number('')` is 0 where the `parseInt` this replaced gave NaN.
 *
 * `setNumber`, by contrast, is checked explicitly against undefined rather than
 * falsily, because 0 is a real collector number (fact 4). It is numeric, so
 * stringifying it is already normalized.
 */
function poolKey(card: LorcanaCard): PoolKey | null {
  const set = Number(card.setCode);
  if (!(set > 0) || card.setNumber === undefined) return null;
  return `${set}:${card.setNumber}`;
}

/** A `set:number` join key, as `poolKey` builds it from a card and `classifyRow` from a row. */
type PoolKey = `${number}:${string}`;

/** A promo as its rows name it: its id, and what tells two under one code apart (fact 8). */
type PromoClaim = Pick<LorcanaCard, 'id' | 'finish' | 'artVariant' | 'fullName'>;

/** The pool, keyed for joining rows. */
interface PoolIndex {
  /** Each key to the one card it settles on. */
  cards: Map<PoolKey, string>;
  /** Keys with more than one card and nothing to choose between them: a row on one is never guessed. */
  shared: Set<PoolKey>;
  /** The promos, by code and number (`P2:24`), every printing under each (fact 8). */
  promos: Map<string, PromoClaim[]>;
}

/** Every key's claimants, in pool order. */
function claimsByKey(pool: readonly LorcanaCard[]): Map<PoolKey, string[]> {
  const claims = new Map<PoolKey, string[]>();
  for (const card of pool) {
    const key = poolKey(card);
    if (key !== null) claims.set(key, [...(claims.get(key) ?? []), card.id]);
  }
  return claims;
}

/** A promo's key, from its code and its number: `P2:24`. */
const promoKey = (code: string, number: number) => `${code}:${number}`;

/** The pool's promos by code and number: a promo's card is in its promo set (#805). */
function promosByCode(pool: readonly LorcanaCard[]): Map<string, PromoClaim[]> {
  const promos = new Map<string, PromoClaim[]>();
  for (const card of pool) {
    if (card.rarity !== PROMO_RARITY) continue;
    if (card.setCode === undefined || card.setNumber === undefined) continue;
    const key = promoKey(card.setCode, card.setNumber);
    promos.set(key, [...(promos.get(key) ?? []), card]);
  }
  return promos;
}

/**
 * The pool keyed by `set:number`, for every card that carries both, and its promos by code.
 *
 * THE KEY IS NOT UNIQUE (fact 7), so this cannot be a plain `set()`: whichever card
 * happened to be last would win. Until #805, LorcanaJSON's promo cards reused base
 * collector numbers, with five cards claiming Set 1's slot #1, and a promo won 97 of the
 * 98 contested numbers outside Core: ownership was then recorded against a card the binder
 * did not even render, so a card the user owned showed as unowned (measured on a real
 * import: 18 of Set 1's 30 apparent gaps). The pool's promos are in their promo sets now,
 * matched by their codes (`classifyPromoRow`).
 *
 * So order never decides: one claimant settles the key, and more than one makes it SHARED.
 * Set 3's Dalmatian Puppy is the one shared key today, five Common printings all numbered
 * 4, and its rows are reported rather than given to whichever printing came first (#553).
 */
function buildPoolIndex(pool: readonly LorcanaCard[]): PoolIndex {
  const index: PoolIndex = {cards: new Map(), shared: new Set(), promos: promosByCode(pool)};
  for (const [key, claimants] of claimsByKey(pool)) {
    if (claimants.length === 1) index.cards.set(key, claimants[0]);
    else index.shared.add(key);
  }
  return index;
}

/** A promo's Card Number in the export: its number, an art's letter, and its promo set (`24A/P2`). */
const PROMO_NUMBER = /^(\d+)([A-Za-z]?)\/([A-Za-z0-9]+)$/;

/**
 * What a promo row is (fact 8), or undefined for a row that is no promo's. Its code and
 * number name the printings under them; a letter keeps the art it names, and the row's
 * finish keeps the twin of that finish (a promo with no finish of its own has no twin). Of
 * several left, the row's card name keeps the one printed under it (26/P2's Moana and its
 * European Vaiana, owner 2026-10-18). One left is the row's; more are reported, never
 * guessed; none is a promo the pool lacks.
 */
function classifyPromoRow(row: CollectionRow, promos: PoolIndex['promos']): RowOutcome | undefined {
  const match = PROMO_NUMBER.exec(row.number);
  if (match === null) return undefined;
  const [, number, letter, code] = match;
  const printings = (promos.get(promoKey(code.toUpperCase(), Number(number))) ?? []).filter(
    (promo) =>
      (letter === '' || promo.artVariant === letter.toUpperCase()) &&
      (promo.finish === undefined || promo.finish === row.variant),
  );
  const settled = printings.length > 1 ? printings.filter((promo) => promo.fullName === row.name) : printings;
  if (settled.length === 1) return {kind: 'owned', cardId: settled[0].id};
  return {kind: printings.length === 0 ? 'unidentified' : 'ambiguous'};
}

/**
 * Strip a trailing variant letter: `4a` -> `4`. Empty when there is none.
 *
 * Dreamborn numbers a card's printing variants with a letter suffix (Set 3's
 * Dalmatian Puppy is 4a through 4e), where our data numbers them plainly. A
 * lettered row on a card we carry once folds into it, since `totalOwned` already
 * folds copies. The puppy itself we carry five times, all as `4`, so its rows
 * land on a shared key and are reported instead.
 */
function printedNumber(number: string): string {
  const match = /^(\d+)[a-z]$/.exec(number);
  return match ? match[1] : '';
}

/** What a key says about a row, or undefined when no card claims it. */
function lookUp(index: PoolIndex, key: PoolKey): RowOutcome | undefined {
  if (index.shared.has(key)) return {kind: 'ambiguous'};
  const cardId = index.cards.get(key);
  return cardId === undefined ? undefined : {kind: 'owned', cardId};
}

/**
 * Decide what an owned row is: a card we can store, a number two printings share
 * so the row cannot say which it owns, or a card the pool does not have.
 */
function classifyRow(row: CollectionRow, index: PoolIndex): RowOutcome {
  const promo = classifyPromoRow(row, index.promos);
  if (promo !== undefined) return promo;

  const exact = lookUp(index, `${row.set}:${row.number}`);
  if (exact !== undefined) return exact;

  // Exact first, always: the fallback must never shadow a real key. Only after a
  // genuine miss do we ask whether this was a lettered variant of a card we have.
  const printed = printedNumber(row.number);
  if (printed !== '') {
    const variantOf = lookUp(index, `${row.set}:${printed}`);
    if (variantOf !== undefined) return variantOf;
  }

  // Everything else is simply unidentified. There is no longer a quiet branch for
  // "below the rotation floor": the pool spans every set, so a set-3 card is
  // stored like any other and a miss is a miss. Splitting them was right when the
  // pool was Core-only and two thirds of a collection was discarded by design; it
  // now hides real losses behind a routine-sounding explanation.
  return {kind: 'unidentified'};
}

/** Add a row's copies to its card's entry, which the card's first row creates. */
function addCopies(entries: CollectionEntries, cardId: string, row: CollectionRow): void {
  const entry = entries[cardId] ?? {normal: 0, foil: 0};
  entry[row.variant] += row.count;
  entries[cardId] = entry;
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
  /** Refs left out, by why. Sets, because the census lists each card twice (normal + foil). */
  const missed = {unidentified: new Set<string>(), ambiguous: new Set<string>()};
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
    if (outcome.kind === 'owned') {
      addCopies(entries, outcome.cardId, row);
    } else {
      // One card we cannot place must not be reported twice, once per finish. A promo's
      // code names it alone; its row's Set Number is its card's set (fact 8).
      missed[outcome.kind].add(PROMO_NUMBER.test(row.number) ? row.number : `${row.set}-${row.number}`);
    }
  }

  const owned = Object.values(entries);
  return {
    entries,
    summary: {
      cardsOwned: owned.length,
      copiesOwned: owned.reduce((total, entry) => total + totalOwned(entry), 0),
      unidentified: [...missed.unidentified],
      ambiguous: [...missed.ambiguous],
      unparsed,
    },
  };
}
