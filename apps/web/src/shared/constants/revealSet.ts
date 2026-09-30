import type {Ink, VariantRarity} from 'inkweave-synergy-engine';
import {ALL_INKS, type SetCode} from './theme';

/**
 * The set currently in reveal season. This file is the ONE place to change when
 * a new season starts (runbook: docs/reveals/START_REVEAL_SEASON.md).
 *
 * `satisfies SetCode` ties it to theme.ts: forgetting to add the new set to
 * SetCode / SET_NAMES / SET_ABBREVIATIONS is a compile error here, instead of a
 * bare "Set N" label at runtime.
 */
export const REVEAL_SET_CODE = '14' satisfies SetCode;
export const REVEAL_SET_NUMBER = Number(REVEAL_SET_CODE);

/**
 * Preview card ids are `setNumber * 1000 + collector number`, which stays clear
 * of allCards.json's sequential ids (the loader silently drops a preview card
 * whose id collides). Cards revealed without a collector number take an id in
 * the reserved `+900..+999` band instead (docs/PREVIEW_CARD_PARSER.md).
 */
export const REVEAL_ID_BASE = REVEAL_SET_NUMBER * 1000;

export const REVEAL_SET_LOGO = '/art/sets/hyperia-city.webp';

/**
 * 320px-wide REVEAL_SET_LOGO for the promo card, which renders it at 100 to 160 CSS px
 * on every page during reveal season. The full-size file stays for RevealHero (up to
 * 300 CSS px). width/height are the file's pixel size: the card uses them to reserve its
 * box before the image loads, so they live here with the path and change with it each
 * season (runbook, #627).
 */
export const REVEAL_SET_LOGO_SM = {
  src: '/art/sets/hyperia-city-sm.webp',
  width: 320,
  height: 237,
} as const;

/**
 * Cards per ink. These are fixed denominators: an ink board renders all of its
 * slots and fills them as cards reveal, so the page works mid-season with only
 * part of the set out. Never derive them from the live, incomplete card data.
 *
 * Set 14 (Hyperia City) is an even split: 6 x 34 = 204.
 */
export const PER_INK: Record<Ink, number> = {
  Amber: 34,
  Amethyst: 34,
  Emerald: 34,
  Ruby: 34,
  Sapphire: 34,
  Steel: 34,
};

/** Total cards in the set: the sum of the per-ink boards. */
export const SET_TOTAL = Object.values(PER_INK).reduce((sum, n) => sum + n, 0);

/**
 * First collector number of each ink's block. A set is numbered ink by ink in
 * ALL_INKS order, so each block starts where the previous one ended. Derived
 * from PER_INK so the two cannot drift apart.
 */
export const INK_BASE = (() => {
  const base = {} as Record<Ink, number>;
  let next = 1;
  for (const ink of ALL_INKS) {
    base[ink] = next;
    next += PER_INK[ink];
  }
  return base;
})();

/**
 * The collector-number range of an ink's block, inclusive. A dual-ink card sits
 * in the block of its FIRST ink.
 */
export function inkBlock(ink: Ink): {first: number; last: number} {
  return {first: INK_BASE[ink], last: INK_BASE[ink] + PER_INK[ink] - 1};
}

/** One rarity's run of special printings: `perInk` of them per ink, in ALL_INKS order from `first`. */
export interface SpecialBlock {
  rarity: VariantRarity;
  first: number;
  perInk: Record<Ink, number>;
}

const THREE_PER_INK: Record<Ink, number> = {Amber: 3, Amethyst: 3, Emerald: 3, Ruby: 3, Sapphire: 3, Steel: 3};

/**
 * The set's special printings (#625): Epic and Enchanted alternate art of its own cards,
 * numbered after the main set. Each rarity's block runs ink by ink in ALL_INKS order, like
 * the main set, so an ink's slots follow from the counts. Like PER_INK these are fixed
 * denominators: the ink boards show a slot for every printing and fill it once revealed.
 *
 * Set 14: Epic #205-222 and Enchanted #223-240, 3 per ink (the Set 9-12 pattern; the Epic
 * Baymax #213 is Emerald).
 */
export const SPECIAL_BLOCKS: readonly SpecialBlock[] = [
  {rarity: 'Epic', first: 205, perInk: THREE_PER_INK},
  {rarity: 'Enchanted', first: 223, perInk: THREE_PER_INK},
];

/** Iconic printings are too few for a per-ink block, so each is listed with its ink. Set 14: #241-242. */
export const ICONIC_INKS: Readonly<Record<number, Ink>> = {241: 'Amber', 242: 'Sapphire'};

/** One special printing slot on an ink board. */
export interface SpecialSlotSpec {
  number: number;
  rarity: VariantRarity;
}

/** First collector number of `ink`'s run inside a special block. */
function blockStart({first, perInk}: SpecialBlock, ink: Ink): number {
  const before = ALL_INKS.slice(0, ALL_INKS.indexOf(ink));
  return first + before.reduce((sum, other) => sum + perInk[other], 0);
}

/** An ink's special printing slots in collector-number order: its Epics, its Enchanteds, then any Iconic. */
export function specialSlotsFor(ink: Ink): SpecialSlotSpec[] {
  const blockSlots = SPECIAL_BLOCKS.flatMap((block) => {
    const start = blockStart(block, ink);
    return Array.from({length: block.perInk[ink]}, (_, i) => ({number: start + i, rarity: block.rarity}));
  });
  const iconicSlots = Object.entries(ICONIC_INKS)
    .filter(([, owner]) => owner === ink)
    .map(([number]): SpecialSlotSpec => ({number: Number(number), rarity: 'Iconic'}));
  return [...blockSlots, ...iconicSlots];
}
