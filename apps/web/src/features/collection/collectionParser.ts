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
// Rows below the Core floor are COUNTED but not stored: the builder's pool is
// Core-only, and roughly two thirds of a real collection sits outside it. Saying
// so is the difference between an honest summary and one that reads as a broken
// import.

import {isCoreSet} from 'inkweave-synergy-engine';
import type {LorcanaCard} from '../deck/types';

/** Owned copies of one card, split by finish. */
export interface CollectionEntry {
  normal: number;
  foil: number;
}

/** Card id (`LorcanaCard.id`) to owned copies. Core cards only. */
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

/** What an import is worth reporting back to the person who ran it. */
export interface CollectionSummary {
  /** Distinct Core cards owned at one copy or more. */
  coreCardsOwned: number;
  /** Total Core copies, both finishes. */
  coreCopiesOwned: number;
  /** Distinct owned cards from below the Core floor. Expected, not an error. */
  nonCoreCardsOwned: number;
  /** `set-number` refs from a Core set that matched no card in the pool. */
  unmatched: string[];
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
export type RowOutcome =
  | {kind: 'owned'; cardId: string}
  | {kind: 'non-core'}
  | {kind: 'unmatched'};

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
  const count = parseInt(rawCount, 10);
  if (!Number.isFinite(count)) return null;
  if (rawVariant !== 'normal' && rawVariant !== 'foil') return null;
  return {set: parseInt(rawSet, 10), number, variant: rawVariant, count};
}

/** `set:number` to card id, for every pool card that carries both. */
function buildPoolIndex(pool: readonly LorcanaCard[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const card of pool) {
    // Explicitly against undefined: `setNumber` is legitimately 0 (fact 4).
    if (card.setCode === undefined || card.setNumber === undefined) continue;
    const set = parseInt(card.setCode, 10);
    if (!Number.isFinite(set)) continue;
    // `setNumber` is numeric, so stringifying it is already normalized — 0 stays
    // "0", which is a real card (fact 4) rather than an absent one.
    index.set(`${set}:${card.setNumber}`, card.id);
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
function classifyRow(row: CollectionRow, index: Map<string, string>): RowOutcome {
  const cardId = index.get(`${row.set}:${row.number}`);
  if (cardId !== undefined) return {kind: 'owned', cardId};

  // A miss below the rotation floor is the expected bulk of a real collection —
  // roughly two thirds of one — so reporting those as failures would show 1600
  // errors for a perfectly good file. A miss AT or above the floor is a real gap
  // worth surfacing: a set newer than our data, or a hand-edited file.
  //
  // The usual worry with this shape is that a garbled set number falls through to
  // the quiet branch and a broken file reads as clean. It cannot here: `readRow`
  // accepts a set only if it is all digits, so such a row became `unparsed` before
  // ever reaching this function.
  return isCoreSet(row.set) ? {kind: 'unmatched'} : {kind: 'non-core'};
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
  const nonCore = new Set<string>();
  const unmatched: string[] = [];
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
    if (outcome.kind === 'non-core') {
      nonCore.add(`${row.set}:${row.number}`);
    } else if (outcome.kind === 'unmatched') {
      unmatched.push(`${row.set}-${row.number}`);
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
      coreCardsOwned: owned.length,
      coreCopiesOwned: owned.reduce((total, entry) => total + totalOwned(entry), 0),
      nonCoreCardsOwned: nonCore.size,
      unmatched,
      unparsed,
    },
  };
}
