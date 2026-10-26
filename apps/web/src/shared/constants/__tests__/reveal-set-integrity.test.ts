import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {cardSlug, type Ink} from 'inkweave-synergy-engine';
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
import {rarityConfigOf} from '../../../features/reveals/rarity';

// Guards the reveal season's one-constant switch (revealSet.ts) against the data
// it must agree with. A half-done switch is otherwise silent: the page renders,
// but the trackers read zero, or the gate never opens, with no error anywhere.
//
// Invariants only. CI runs this on every reveal-publisher commit from admin, which lands
// a card BEFORE its AVIFs (the convert workflow commits those afterwards), so
// nothing here may depend on a card's image files existing. Spotlight art is the one
// exception: it is copied in by hand, in the same commit as the spotlight that shows it.

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
  /** The type line's subtypes: "Song", a classification, a set subtype like "Hyperia City". */
  subtypes?: string[];
  /** One of the five base rarities; Epic/Enchanted/Iconic live on `variants`. */
  rarity?: string;
}

/** Card types, which belong in `type`, never in `subtypes`. */
const CARD_TYPES = new Set(['Character', 'Action', 'Item', 'Location']);

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

/** Every image a spotlight shows, hero and fan, mechanics and franchises alike. */
function spotlightImages(): string[] {
  return [...FRANCHISE_SPOTLIGHTS.map((s) => s.data), ...SET_SPOTLIGHTS.flatMap((g) => g.items)].flatMap((data) => [
    data.heroImage,
    ...data.support.map((s) => s.src),
  ]);
}

/** Every image a spotlight shows that isn't committed under public/. */
function missingSpotlightImages(): string[] {
  return spotlightImages().filter((src) => !fs.existsSync(path.join(process.cwd(), 'public', src)));
}

/** Card art a spotlight shows: a copy kept under public/art/spotlights/, named by card slug. */
const SPOTLIGHT_ART = /^\/art\/spotlights\/(.+)\.avif$/;

/** A debut franchise's logo, which its spotlight shows until the franchise has card art. */
const FRANCHISE_LOGO = /^\/art\/franchises\/[^/]+\.webp$/;

/**
 * Spotlight images that don't show a revealed card of the reveal set. Card art is named by card
 * slug, so a typo or a card that isn't revealed yet lands here, and so does an image kept
 * anywhere else, such as a preview scan named by card id, which graduation renumbers. A
 * franchise's logo is the one image that isn't card art. The set's cards are preview cards
 * during the season and canonical cards once it graduates, so both files count.
 */
function spotlightArtWithoutCard(cards: PreviewCard[]): string[] {
  const slugs = new Set(
    cards.flatMap((c) => (c.setCode === REVEAL_SET_CODE && c.fullName ? [cardSlug({fullName: c.fullName})] : [])),
  );
  return spotlightImages().filter((src) => {
    if (FRANCHISE_LOGO.test(src)) return false;
    const name = SPOTLIGHT_ART.exec(src)?.[1];
    return name === undefined || !slugs.has(name);
  });
}

describe('reveal-set integrity', () => {
  const preview = readData<PreviewFile>('previewCards.json');
  const missingSpotlightArt = missingSpotlightImages();
  const spotlightArtOffSet = spotlightArtWithoutCard([
    ...preview.cards,
    ...readData<{cards: PreviewCard[]}>('allCards.json').cards,
  ]);

  it('previewCards.json has a dated entry for the reveal set', () => {
    const set = preview.sets[REVEAL_SET_CODE];
    expect(set?.number).toBe(REVEAL_SET_NUMBER);
    // The page's copy reads appConstants.ts; the E2E spec reads this file. They must agree.
    expect(set?.name).toBe(SET_NAMES[REVEAL_SET_CODE]);
    expect(set?.prereleaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(set?.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('every preview card belongs to the reveal set and has a well-formed id', () => {
    const malformed = preview.cards.filter((c) => !hasWellFormedId(c)).map((c) => `${c.id} ${c.fullName}`);
    expect(malformed).toEqual([]);
  });

  // The publisher's subtypes are typed by hand, and a card type typed there became a
  // bogus Classification chip in Browse's filters ("Action", "Item"; fixed 2026-10-08).
  // "Song" and set subtypes such as "Hyperia City" are printed on the card and valid.
  it('no preview card lists its card type among its subtypes', () => {
    const misfiled = preview.cards
      .filter((c) => (c.subtypes ?? []).some((subtype) => CARD_TYPES.has(subtype)))
      .map((c) => `${c.id} ${c.fullName}: ${JSON.stringify(c.subtypes)}`);
    expect(misfiled).toEqual([]);
  });

  // A card without one matches no Rarity filter and drops out of every rarity count
  // (Judy Hopps - Helpful Officer shipped without one; fixed 2026-10-08).
  it('every preview card has one of the five base rarities', () => {
    const missing = preview.cards
      .filter((c) => rarityConfigOf(c.rarity) === undefined)
      .map((c) => `${c.id} ${c.fullName}: ${JSON.stringify(c.rarity)}`);
    expect(missing).toEqual([]);
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

  it('every image a spotlight shows is committed', () => {
    expect(missingSpotlightArt).toEqual([]);
  });

  it('every spotlight image is named after a revealed card of the set', () => {
    expect(spotlightArtOffSet).toEqual([]);
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
    const bad = (code?: string) => code !== undefined && !/^(?!en$)[a-z]{2}$/.test(code);
    const badCodes = preview.cards.flatMap((c) => [
      ...(bad(c.scanLanguage) ? [`${c.id} ${c.fullName}`] : []),
      ...(c.variants ?? []).filter((v) => bad(v.scanLanguage)).map((v) => `${v.id} ${c.fullName}`),
    ]);
    expect(badCodes).toEqual([]);
  });
});
