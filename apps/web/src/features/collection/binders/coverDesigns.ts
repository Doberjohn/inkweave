import {INK_COLORS, blackRgba, hexRgba, whiteRgba} from '../../../shared/constants';

/**
 * The covers a binder takes (owner, 2026-11-10: "3C is locked"): eight patterns, each drawn
 * across the board's face inside the zip, with the binder's name and rule in its foil colour.
 *
 * A row keeps a design by its id (`cover` in `collection_binders` and `collection_shelf`), whose
 * check holds only its shape, so a design added later needs no migration. An id never changes
 * once a binder can hold it.
 *
 * A declaration site, as `binderLook.ts` is: these colours are the designs themselves, not the
 * app's theme, so the colour rules leave them be. A colour a token already holds comes from it,
 * so the value gate never finds a copy.
 */

/** A cover: its id as the row keeps it, its name in the pickers, its pattern, and the colour its words take. */
export interface CoverDesign {
  id: string;
  label: string;
  /** The pattern, as a CSS `background`. */
  ground: string;
  foil: string;
}

/** A design's id as the column's check allows it: lowercase words joined by hyphens. */
export const DESIGN_ID = /^[a-z][a-z-]{0,23}$/;

const HONEYCOMB = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='48'%3E%3Cpath d='M14 0 28 8v16L14 32 0 24V8zM14 32v16' fill='none' stroke='%23c7ccd6' stroke-opacity='.35' stroke-width='1.2'/%3E%3C/svg%3E")`;

/** Rows of fish scales: two offset tilings of the same arc over a green ground. */
const SCALE = `radial-gradient(circle at 50% 100%, transparent 52%, ${hexRgba(INK_COLORS.Emerald.text, 0.4)} 54% 58%, transparent 60%)`;

/** Argyle's dark diamonds: two offset tilings of the same checker, turned 45°. */
const DIAMOND = `linear-gradient(45deg, ${blackRgba(0.3)} 25%, transparent 25% 75%, ${blackRgba(0.3)} 75%)`;

/** The eight, in the pickers' order. The first is every binder's until one is picked. */
export const COVER_DESIGNS: readonly CoverDesign[] = [
  {
    id: 'starry-night',
    label: 'Starry night',
    foil: '#f7d27a',
    ground: [
      'radial-gradient(1.6px 1.6px at 12px 18px, #fff8 60%, transparent 70%) 0 0 / 47px 53px',
      'radial-gradient(1.2px 1.2px at 30px 8px, #fff6 60%, transparent 70%) 0 0 / 71px 61px',
      'radial-gradient(2.4px 2.4px at 50px 40px, #f7d27acc 55%, transparent 70%) 0 0 / 113px 97px',
      'radial-gradient(1px 1px at 5px 5px, #fff5 60%, transparent 70%) 0 0 / 23px 29px',
      'radial-gradient(ellipse at 30% 20%, #2a3a72, #0b1026 72%)',
    ].join(', '),
  },
  {
    id: 'sunburst',
    label: 'Sunburst',
    foil: '#fff1c9',
    ground: [
      'radial-gradient(circle at 50% 38%, transparent 20%, #0006 85%)',
      'repeating-conic-gradient(from 0deg at 50% 38%, #c98a14 0deg 6deg, #8a5a0c 6deg 12deg)',
    ].join(', '),
  },
  {
    id: 'tartan',
    label: 'Tartan',
    foil: '#f7d27a',
    ground: [
      `repeating-linear-gradient(0deg, ${whiteRgba(0.07)} 0 6px, transparent 6px 24px)`,
      `repeating-linear-gradient(90deg, ${whiteRgba(0.07)} 0 6px, transparent 6px 24px)`,
      `repeating-linear-gradient(0deg, ${blackRgba(0.25)} 0 2px, transparent 2px 12px)`,
      `repeating-linear-gradient(90deg, ${blackRgba(0.25)} 0 2px, transparent 2px 12px)`,
      'repeating-linear-gradient(90deg, transparent 0 15px, #f7d27a40 15px 16px, transparent 16px 24px)',
      '#4b2470',
    ].join(', '),
  },
  {
    id: 'pinstripe',
    label: 'Pinstripe',
    foil: '#e6c36a',
    ground: 'repeating-linear-gradient(135deg, #e6c36a66 0 1px, transparent 1px 11px), linear-gradient(160deg, #1d1d24, #0b0b0f)',
  },
  {
    id: 'scales',
    label: 'Scales',
    foil: '#b9f5cf',
    ground: `${SCALE} 0 0 / 28px 14px, ${SCALE} 14px 7px / 28px 14px, linear-gradient(160deg, #14492c, #0a2617)`,
  },
  {
    id: 'argyle',
    label: 'Argyle',
    foil: '#ffe0b0',
    ground: [
      'repeating-linear-gradient(45deg, transparent 0 22px, #f7d27a55 22px 23px)',
      'repeating-linear-gradient(-45deg, transparent 0 22px, #f7d27a55 22px 23px)',
      `${DIAMOND} 0 0 / 32px 32px`,
      `${DIAMOND} 16px 16px / 32px 32px`,
      '#8a1f26',
    ].join(', '),
  },
  {
    id: 'honeycomb',
    label: 'Honeycomb',
    foil: '#eef1f6',
    ground: `${HONEYCOMB} 0 0 / 28px 48px, linear-gradient(160deg, #4a515e, #20242b)`,
  },
  {
    id: 'ripples',
    label: 'Ripples',
    foil: '#cfe4ff',
    ground: `repeating-radial-gradient(circle at 0 100%, transparent 0 10px, ${hexRgba(INK_COLORS.Sapphire.text, 0.3)} 10px 12px), linear-gradient(160deg, #164381, #0a1f44)`,
  },
];

/** A row's cover as a design: null, or an id this build doesn't know, is the first. */
export function coverDesign(id: string | null): CoverDesign {
  return COVER_DESIGNS.find((design) => design.id === id) ?? COVER_DESIGNS[0];
}

/**
 * Whether two stored covers are the same choice. No cover is the first design's, but an id this
 * build doesn't know is a choice of its own, though it draws as the first: a pick of the first
 * must still replace it, or a build that knows it keeps showing it.
 */
export function sameCover(a: string | null, b: string | null): boolean {
  return (a ?? COVER_DESIGNS[0].id) === (b ?? COVER_DESIGNS[0].id);
}
