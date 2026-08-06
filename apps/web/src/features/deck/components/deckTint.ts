import type {Ink} from 'inkweave-synergy-engine';
import {COLORS, INK_COLORS} from '../../../shared/constants';

/**
 * A deck's tile background, built from its own inks and nothing else.
 *
 * Owner ruling 2026-08-05: the gradient uses only the deck's two ink colours.
 * An earlier pass mixed each ink toward `COLORS.surface` to protect legibility.
 * That hedge was unnecessary, because all six ink tints are dark by
 * construction (they were designed as chip backgrounds for a dark theme), and
 * it cost the identity it was meant to carry. The worst case for light-on-dark
 * text is Emerald, the LIGHTEST of the six tints, and it still measures 10.38:1
 * for body text and 7.39:1 for the gold count.
 *
 * (The hex is named nowhere here on purpose: `check:design` greps literal token
 * values across the tree and does not strip comments, so quoting one to make the
 * measurement checkable fails the gate. Re-measure from `INK_COLORS` instead.)
 *
 * A deck with NO inks gets the plain surface rather than a gradient: a fresh
 * draft has not earned a colour identity. A deck with MORE than two (illegal in
 * Core, but reachable mid-edit) takes its first two: the tile must still render
 * a deck the legality bar is already complaining about.
 */
export function deckTint(inks: readonly Ink[]): string {
  if (inks.length === 0) return COLORS.surface;
  const from = INK_COLORS[inks[0]].bg;
  // A mono-ink deck repeats its one ink, which renders flat. Cheaper than a
  // third branch, and it keeps every deck on one code path.
  //
  // The `??` looks redundant to the type-checker and is not: `noUncheckedIndexedAccess`
  // is off, so `inks[1]` types as `Ink` even when it is undefined at runtime. The
  // mono-ink test is the only thing standing between this and a "cleanup" that
  // passes every gate and renders `undefined` into the gradient.
  const to = INK_COLORS[inks[1] ?? inks[0]].bg;
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
