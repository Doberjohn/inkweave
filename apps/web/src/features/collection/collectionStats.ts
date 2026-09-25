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

/** One breakdown bucket: an ink, or a rarity. Both are counted identically. */
interface Slot {
  complete: number;
  master: number;
  total: number;
}

/** What the owner holds of one card, reduced to the two questions a tally asks. */
interface Holding {
  /** At least one copy, in either finish. */
  any: boolean;
  /** At least one of BOTH finishes. */
  both: boolean;
}

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
  byInk: ({ink: Ink} & Slot)[];
  byRarity: ({rarity: string} & Slot)[];
}

/** The running state of one `tallySet` pass. */
interface Accumulator {
  totals: Tally;
  ink: Map<Ink, Slot>;
  rarity: Map<string, Slot>;
}

/** All inks on a card — dual-ink counts toward both, matching `inkDistribution`. */
function inksOf(card: LorcanaCard): Ink[] {
  return [card.ink, card.ink2].filter((i): i is Ink => i !== undefined);
}

function holdingOf(entry: {normal: number; foil: number} | undefined): Holding {
  if (entry === undefined) return {any: false, both: false};
  return {any: entry.normal + entry.foil > 0, both: entry.normal > 0 && entry.foil > 0};
}

/**
 * Fold one card into a keyed bucket. Extracted because the ink and rarity
 * breakdowns count in exactly the same way, and having that three-line increment
 * written twice inside the loop was most of what made the loop hard to read.
 */
function bump<K>(into: Map<K, Slot>, key: K, held: Holding): void {
  const slot = into.get(key) ?? {complete: 0, master: 0, total: 0};
  slot.total++;
  if (held.any) slot.complete++;
  if (held.both) slot.master++;
  into.set(key, slot);
}

/**
 * Fold one card into the running tallies.
 *
 * Separate from `tallySet` so the per-card RULES (what is importable, what a
 * chase card contributes, how a dual-ink card is attributed) sit apart from the
 * setup and the final sort.
 */
function addCard(acc: Accumulator, card: LorcanaCard, entries: CollectionEntries): void {
  const held = holdingOf(entries[card.id]);
  const rarity = card.rarity ?? 'Unknown';

  if (!IMPORTABLE_RARITIES.has(rarity)) {
    acc.totals.chase++;
    if (held.any) acc.totals.chaseHeld++;
    return;
  }

  acc.totals.importable++;
  if (held.any) acc.totals.complete++;
  if (held.both) acc.totals.master++;

  for (const i of inksOf(card)) bump(acc.ink, i, held);
  bump(acc.rarity, rarity, held);
}

/** Common first, scarcest last, so the rarity rows read as a difficulty ramp. */
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'];

export function tallySet(cards: LorcanaCard[], entries: CollectionEntries): Tally {
  const acc: Accumulator = {
    totals: {
      importable: 0,
      complete: 0,
      master: 0,
      chase: 0,
      chaseHeld: 0,
      byInk: [],
      byRarity: [],
    },
    ink: new Map(),
    rarity: new Map(),
  };

  for (const card of cards) addCard(acc, card, entries);

  acc.totals.byInk = [...acc.ink.entries()]
    .map(([ink, slot]) => ({ink, ...slot}))
    .sort((a, b) => b.total - a.total);
  acc.totals.byRarity = [...acc.rarity.entries()]
    .map(([rarity, slot]) => ({rarity, ...slot}))
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  return acc.totals;
}

