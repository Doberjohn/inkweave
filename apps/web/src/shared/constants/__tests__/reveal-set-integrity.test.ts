import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type {Ink} from 'inkweave-synergy-engine';
import {
  ALL_INKS,
  REVEAL_ID_BASE,
  REVEAL_SET_CODE,
  REVEAL_SET_NUMBER,
  SET_NAMES,
  SET_TOTAL,
  inkBlock,
  specialSlotsFor,
} from '..';
import {FRANCHISE_SPOTLIGHTS, SET_SPOTLIGHTS} from '../../../features/reveals/setSpotlights';

// Guards the reveal season's one-constant switch (revealSet.ts) against the data
// it must agree with. A half-done switch is otherwise silent: the page renders,
// but the trackers read zero, or the gate never opens, with no error anywhere.
//
// Invariants only. CI runs this on every reveal-publisher commit from admin, which lands
// a card BEFORE its AVIFs (the convert workflow commits those afterwards), so
// nothing here may depend on image files existing.

/** An alternate printing folded into its base card (#625). */
interface VariantEntry {
  id: number;
  rarity: string;
  number: number;
  /** A hand-supplied scan's language when it is not English (#681). */
  scanLanguage?: string;
}

interface PreviewCard {
  id: number;
  number?: number;
  setCode?: string;
  fullName?: string;
  /** Ink, or "First-Second" for a dual-ink card. */
  color?: string;
  scanLanguage?: string;
  variants?: VariantEntry[];
}

interface PreviewFile {
  sets: Record<string, {name?: string; number?: number; prereleaseDate?: string; releaseDate?: string} | undefined>;
  cards: PreviewCard[];
}

function readData<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data', file), 'utf8')) as T;
}

/** Numbered cards are base + collector number; numberless ones use the reserved +900..+999 band. */
function hasWellFormedId(card: PreviewCard): boolean {
  if (card.setCode !== REVEAL_SET_CODE) return false;
  if (card.number == null) return card.id >= REVEAL_ID_BASE + 900 && card.id <= REVEAL_ID_BASE + 999;
  return card.id === REVEAL_ID_BASE + card.number;
}

/** The preview-card ids a spotlight's art points at. */
function spotlightCardIds(): number[] {
  const srcs = [...FRANCHISE_SPOTLIGHTS.map((s) => s.data), ...SET_SPOTLIGHTS.flatMap((g) => g.items)].flatMap((data) => [
    data.heroImage,
    ...data.support.map((s) => s.src),
  ]);
  return srcs.flatMap((src) => {
    const id = /\/card-images-preview\/(\d+)\.avif$/.exec(src)?.[1];
    return id ? [Number(id)] : [];
  });
}

describe('reveal-set integrity', () => {
  const preview = readData<PreviewFile>('previewCards.json');

  it('previewCards.json has a dated entry for the reveal set', () => {
    const set = preview.sets[REVEAL_SET_CODE];
    expect(set?.number).toBe(REVEAL_SET_NUMBER);
    // The page's copy reads theme.ts; the E2E spec reads this file. They must agree.
    expect(set?.name).toBe(SET_NAMES[REVEAL_SET_CODE]);
    expect(set?.prereleaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(set?.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('every preview card belongs to the reveal set and has a well-formed id', () => {
    const malformed = preview.cards.filter((c) => !hasWellFormedId(c)).map((c) => `${c.id} ${c.fullName}`);
    expect(malformed).toEqual([]);
  });

  it('no preview card id collides with a canonical card (the loader would silently drop it)', () => {
    const canonical = new Set(readData<{cards: {id: number}[]}>('allCards.json').cards.map((c) => c.id));
    expect(preview.cards.filter((c) => canonical.has(c.id)).map((c) => c.id)).toEqual([]);
  });

  // Variant printings (Epic/Enchanted/Iconic) are numbered after the set's base cards, and
  // take the same REVEAL_ID_BASE + number id whether they came from a manual scan or from
  // `pnpm sync-variants`, so the two paths land on one id.
  it('every variant printing has a reveal-convention id, numbered after the base cards', () => {
    const malformed = preview.cards.flatMap((c) =>
      (c.variants ?? [])
        .filter(
          (v) =>
            v.id !== REVEAL_ID_BASE + v.number ||
            v.number <= SET_TOTAL ||
            !['Enchanted', 'Epic', 'Iconic'].includes(v.rarity),
        )
        .map((v) => `${v.id} (${v.rarity} #${v.number}) on ${c.fullName}`),
    );
    expect(malformed).toEqual([]);
  });

  it('no variant printing id collides with a card or another printing (they share one image namespace)', () => {
    const canonical = readData<{cards: PreviewCard[]}>('allCards.json').cards;
    const cards = [...canonical, ...preview.cards];
    const ids = [...cards.map((c) => c.id), ...cards.flatMap((c) => (c.variants ?? []).map((v) => v.id))];
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  // The ink boards give every special printing a slot from SPECIAL_BLOCKS and ICONIC_INKS.
  it('the special printing lineups number each printing once, after the base cards', () => {
    const numbers = ALL_INKS.flatMap((ink) => specialSlotsFor(ink).map((slot) => slot.number));
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.filter((n) => n <= SET_TOTAL)).toEqual([]);
  });

  // A printing sits on its base card's board, so a mistyped number or rarity would land it in a
  // slot that belongs to another card (or append it as a stray).
  it('every variant printing fills a special slot of its base card ink, with its rarity', () => {
    const misplaced = preview.cards.flatMap((c) => {
      const lineup = specialSlotsFor((c.color ?? '').split('-')[0] as Ink);
      return (c.variants ?? [])
        .filter((v) => !lineup.some((slot) => slot.number === v.number && slot.rarity === v.rarity))
        .map((v) => `${v.id} (${v.rarity} #${v.number}) on ${c.fullName} (${c.color})`);
    });
    expect(misplaced).toEqual([]);
  });

  it('every card a spotlight shows has been revealed', () => {
    const revealed = new Set(preview.cards.map((c) => c.id));
    expect(spotlightCardIds().filter((id) => !revealed.has(id))).toEqual([]);
  });

  it('ink blocks tile the set from 1 to SET_TOTAL with no gap or overlap', () => {
    let next = 1;
    for (const ink of ALL_INKS) {
      const {first, last} = inkBlock(ink);
      expect(first).toBe(next);
      next = last + 1;
    }
    expect(next - 1).toBe(SET_TOTAL);
  });

  // `scanLanguage` marks a non-English official scan, a card's own or a variant printing's
  // (#681), and is the mark's only record: the app offers the card's English text over a
  // scan only when it is set. An "en" or malformed code would offer it over an English scan.
  it('every scanLanguage is a two-letter code other than en', () => {
    const bad = (code?: string) => !!code && !/^(?!en$)[a-z]{2}$/.test(code);
    const badCodes = preview.cards.flatMap((c) => [
      ...(bad(c.scanLanguage) ? [`${c.id} ${c.fullName}`] : []),
      ...(c.variants ?? []).filter((v) => bad(v.scanLanguage)).map((v) => `${v.id} ${c.fullName}`),
    ]);
    expect(badCodes).toEqual([]);
  });
});
