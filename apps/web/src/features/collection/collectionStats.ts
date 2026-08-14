import type {Ink} from 'inkweave-synergy-engine';
import type {LorcanaCard} from '../deck/types';
import type {CollectionEntries} from './collectionParser';

/**
 * Set-completion tallies for the stats panel (#553 stats spike).
 *
 * Separate from the panel because it is the part with rules in it, and rules
 * deserve tests: what counts as importable, what "complete" and "master" mean,
 * and how a dual-ink card is attributed.
 *
 * THE DENOMINATOR IS THE WHOLE DESIGN (owner, 2026-08-14). A Dreamborn export
 * contains exactly five rarities — verified across all 5,329 rows of a real one.
 * Enchanted, Special, Epic and Iconic are never in it, so those slots can never
 * be filled by an import and counting them would put 100% permanently out of
 * reach. Set 1 is 216 binder slots but only 204 importable.
 */

/** The rarities a Dreamborn export can actually contain. */
const IMPORTABLE_RARITIES = new Set(['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary']);

interface Tally {
  /** Cards an import can reach. */
  importable: number;
  /** Held in at least one finish. */
  complete: number;
  /** Held in BOTH finishes. */
  master: number;
  /** Enchanted/Epic/Iconic — in the binder, never in an export. */
  chase: number;
  chaseHeld: number;
  byInk: {ink: Ink; complete: number; master: number; total: number}[];
  byRarity: {rarity: string; complete: number; master: number; total: number}[];
}

/** All inks on a card — dual-ink counts toward both, matching `inkDistribution`. */
function inksOf(card: LorcanaCard): Ink[] {
  return [card.ink, card.ink2].filter((i): i is Ink => i !== undefined);
}

export function tallySet(cards: LorcanaCard[], entries: CollectionEntries): Tally {
  const ink = new Map<Ink, {complete: number; master: number; total: number}>();
  const rarity = new Map<string, {complete: number; master: number; total: number}>();
  const t: Tally = {
    importable: 0,
    complete: 0,
    master: 0,
    chase: 0,
    chaseHeld: 0,
    byInk: [],
    byRarity: [],
  };

  for (const card of cards) {
    const held = entries[card.id];
    const hasAny = held !== undefined && held.normal + held.foil > 0;
    const hasBoth = held !== undefined && held.normal > 0 && held.foil > 0;

    if (!IMPORTABLE_RARITIES.has(card.rarity ?? '')) {
      t.chase++;
      if (hasAny) t.chaseHeld++;
      continue;
    }

    t.importable++;
    if (hasAny) t.complete++;
    if (hasBoth) t.master++;

    for (const i of inksOf(card)) {
      const slot = ink.get(i) ?? {complete: 0, master: 0, total: 0};
      slot.total++;
      if (hasAny) slot.complete++;
      if (hasBoth) slot.master++;
      ink.set(i, slot);
    }
    const r = card.rarity ?? 'Unknown';
    const slot = rarity.get(r) ?? {complete: 0, master: 0, total: 0};
    slot.total++;
    if (hasAny) slot.complete++;
    if (hasBoth) slot.master++;
    rarity.set(r, slot);
  }

  t.byInk = [...ink.entries()]
    .map(([k, v]) => ({ink: k, ...v}))
    .sort((a, b) => b.total - a.total);
  // Scarcest last, so the row order reads as a difficulty ramp.
  const ORDER = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'];
  t.byRarity = [...rarity.entries()]
    .map(([k, v]) => ({rarity: k, ...v}))
    .sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity));
  return t;
}

