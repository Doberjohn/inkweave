// Deck import/export in the community decklist format (#473).
//
// The interchange format is the one Duels.ink emits and Dreamborn accepts:
//
//     4 Strength of a Raging Fire (9-201)
//
// i.e. `{quantity} {fullName} ({setCode}-{number})`, one card per line. Dreamborn's
// own export omits the ` (set-number)` suffix, so the parser treats it as OPTIONAL.
//
// Matching is BY NAME, deliberately, with the set-number ref used only as a hint:
//   - Card names are unique across the Core pool (verified against allCards.json),
//     so a name is an unambiguous key.
//   - A ref can point at a printing we don't carry. Reprints shift sets (a list may
//     say `Strength of a Raging Fire (2-201)` where Core carries it as `9-201`), and
//     Enchanted/alternate printings use collector numbers above the base 204 that are
//     absent from our data entirely. Matching on the ref would drop all of those.
//
// Cards outside Core (sets 9+) legitimately fail to resolve; the caller surfaces them
// rather than silently shrinking the deck.

import type {DeckCard, LorcanaCard} from './types';

/** Where an exported deck opens, ready to play. */
const DUELS_INK_IMPORT_URL = 'https://duels.ink/decks/new?import=';

/** Core copy ceiling; an import is clamped to it rather than rejected. */
const MAX_COPIES = 4;

/** One parsed decklist line, before it is matched against the card pool. */
export interface ParsedDeckLine {
  quantity: number;
  name: string;
  /** The `(setCode-number)` ref when the line carried one — a hint, not the key. */
  ref?: string;
  /** The original line, for reporting a failure back to the user verbatim. */
  raw: string;
}

/** The outcome of resolving parsed lines against the card pool. */
export interface ResolvedDecklist {
  cards: DeckCard[];
  /** Lines that matched no card (out-of-Core, misspelled, or a format we can't read). */
  unmatched: string[];
}

/**
 * `{quantity} {fullName} ({setCode}-{number})` per line, in the given order.
 * Cards that no longer resolve are skipped — an export must not emit a line the
 * importer could never match.
 */
export function formatDecklist(
  cards: readonly DeckCard[],
  getCardById: (id: string) => LorcanaCard | undefined,
): string {
  return cards
    .flatMap((entry) => {
      const card = getCardById(entry.cardId);
      if (!card) return [];
      const name = card.fullName || card.name;
      return [`${entry.quantity} ${name} (${card.setCode}-${card.setNumber})`];
    })
    .join('\n');
}

/**
 * The Duels.ink one-click import URL for a decklist: the text base64-encoded into the
 * `import` query parameter. The base64 is percent-encoded — raw base64 can contain
 * `+`, which a query string would decode back as a space and corrupt the list.
 */
export function duelsInkUrl(decklistText: string): string {
  return DUELS_INK_IMPORT_URL + encodeURIComponent(toBase64(decklistText));
}

/** UTF-8-safe base64 (card names are ASCII today, but the encoder shouldn't assume it). */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * `4 Name`, `4x Name`, or `4 Name (11-191)`. Blank lines and `//` comments are
 * skipped; anything else that doesn't start with a quantity is returned as an
 * unparseable line so the caller can report it.
 */
const LINE_PATTERN = /^(\d+)\s*x?\s+(.+?)(?:\s*\((\d+-\d+)\))?$/;

/**
 * Lines that carry no card: blanks, and the `//` or `#` comments both Duels.ink
 * and Dreamborn allow as section headers. Skipped silently rather than reported
 * as unparsed, which is reserved for lines that LOOK like cards but are not.
 */
function isDecklistChrome(line: string): boolean {
  return line === '' || line.startsWith('//') || line.startsWith('#');
}

export function parseDecklist(text: string): {lines: ParsedDeckLine[]; unparsed: string[]} {
  const lines: ParsedDeckLine[] = [];
  const unparsed: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (isDecklistChrome(trimmed)) continue;

    const match = LINE_PATTERN.exec(trimmed);
    if (!match) {
      unparsed.push(trimmed);
      continue;
    }
    const quantity = Number(match[1]);
    if (quantity <= 0) {
      unparsed.push(trimmed);
      continue;
    }
    lines.push({quantity, name: match[2].trim(), ref: match[3], raw: trimmed});
  }

  return {lines, unparsed};
}

/** Normalizes a name for matching: case- and whitespace-insensitive. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Pool cards keyed by their normalised full name, for decklist lookup. */
function indexByName(pool: readonly LorcanaCard[]): Map<string, LorcanaCard> {
  const byName = new Map<string, LorcanaCard>();
  for (const card of pool) {
    const full = card.fullName || card.name;
    if (full) byName.set(nameKey(full), card);
  }
  return byName;
}

/** Quantities keyed by card id, plus the first-seen order to emit them in. */
interface DeckTally {
  quantities: Map<string, number>;
  order: string[];
}

/**
 * Folds one line into the running tally, preserving first-seen order. A decklist
 * may name the same card twice (two printings, or a hand-edited list), so the
 * quantities ADD and then clamp — taking the last line would silently drop copies.
 */
function tallyLine(tally: DeckTally, card: LorcanaCard, quantity: number): void {
  const current = tally.quantities.get(card.id);
  if (current === undefined) tally.order.push(card.id);
  tally.quantities.set(card.id, Math.min(MAX_COPIES, (current ?? 0) + quantity));
}

/**
 * Match parsed lines to card ids by name. Duplicate lines for the same card are
 * summed, and the total is clamped to the 4-copy Core ceiling. Unmatched lines are
 * returned verbatim so the UI can tell the user exactly what it skipped.
 */
export function resolveDecklist(lines: readonly ParsedDeckLine[], pool: readonly LorcanaCard[]): ResolvedDecklist {
  const byName = indexByName(pool);
  const tally: DeckTally = {quantities: new Map(), order: []};
  const unmatched: string[] = [];

  for (const line of lines) {
    const card = byName.get(nameKey(line.name));
    if (card) tallyLine(tally, card, line.quantity);
    else unmatched.push(line.raw);
  }

  return {
    cards: tally.order.map((cardId) => ({cardId, quantity: tally.quantities.get(cardId) ?? 0})),
    unmatched,
  };
}
