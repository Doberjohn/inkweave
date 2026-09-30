import type {Ink} from 'inkweave-synergy-engine';
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
 * the reserved `+900..+999` band instead (docs/PREVIEW_CARD_PARSER.md in
 * Doberjohn/inkweave-admin).
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
