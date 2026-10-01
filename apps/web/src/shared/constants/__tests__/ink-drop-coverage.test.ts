import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  SynergyEngine,
  canShareDeck,
  getInkDropRoles,
  isCoreSet,
  isDropGainGate,
  isDropRemoveTrigger,
  isDropSink,
  isOpponentGatedDrop,
  isRepeatingDropMaker,
  transformCards,
  type LorcanaCard,
  type LorcanaJSONCard,
} from 'inkweave-synergy-engine';

// Data guard for the Ink Drops playstyle (#624). New Set 14 reveals keep landing on master through
// admin's reveal publisher, and a drop wording the detectors have never seen would silently drop that card from
// the playstyle, or get scoring copy written for a different card. CI runs this on every push to
// master, reveal publishes included, so an unmodeled wording turns CI red until utils/inkDrops.ts (or
// the scoring table in engine/inkDropScoring.ts) learns it; deploys are unaffected. That alarm is
// intended. Reads both data files so it keeps working after Set 14 graduates into allCards.json, and
// checks invariants or pins by fullName, never by id, since preview ids renumber at graduation.
//
// Deliberately NOT in reveal-set-integrity.test.ts, which must stay engine-agnostic.

function readCards(file: string): LorcanaJSONCard[] {
  return (
    JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data', file), 'utf8')) as {
      cards: LorcanaJSONCard[];
    }
  ).cards;
}

const pool = transformCards(
  [...readCards('allCards.json'), ...readCards('previewCards.json')].filter((c) => isCoreSet(c.setCode)),
);
const dropCards = pool.filter((c) => /ink\s+drops?/i.test(c.text ?? ''));
const makers = dropCards.filter((c) => getInkDropRoles(c).includes('drop-maker'));

/** A card's text on one line, so a pattern never trips on the printed line breaks. */
const flatText = (card: LorcanaCard): string => (card.text ?? '').replace(/\s+/g, ' ');

function byFullName(fullName: string): LorcanaCard {
  const card = pool.find((c) => c.fullName === fullName);
  if (!card) throw new Error(`${fullName} is not in the card pool`);
  return card;
}

/** Each drop card's Ink Drops partners (uncapped), keyed by the card id, as the precompute emits them. */
const engine = new SynergyEngine({maxResultsPerGroup: 100000});
const inkDropGroups = new Map(
  dropCards.map((card) => {
    const group = engine.findSynergies(card, pool).find((g) => g.groupKey === 'ink-drops');
    return [card.id, group?.synergies ?? []] as const;
  }),
);

describe('Ink Drops data coverage', () => {
  it('gives every card that mentions ink drops at least one Ink Drops role', () => {
    const unmodeled = dropCards
      .filter((c) => getInkDropRoles(c).length === 0)
      .map((c) => `${c.fullName}: ${c.text}`);
    expect(dropCards.length).toBeGreaterThan(0);
    expect(unmodeled).toEqual([]);
  });

  it('has no card that is both a maker and a payoff (the scoring table has no row for one yet)', () => {
    const dual = dropCards
      .filter((c) => {
        const roles = getInkDropRoles(c);
        return roles.includes('drop-maker') && roles.includes('drop-payoff');
      })
      .map((c) => c.fullName);
    expect(dual).toEqual([]);
  });

  it('keeps the key cards in the roles the scoring table was designed around', () => {
    const arthur = byFullName('Arthur - Jousting Knight');
    expect(getInkDropRoles(arthur)).toContain('drop-maker');
    expect(isRepeatingDropMaker(arthur)).toBe(true);

    const baymax = byFullName('Baymax - Amped Up');
    expect(getInkDropRoles(baymax)).toEqual(['drop-payoff']);

    expect(isOpponentGatedDrop(byFullName('This Is Business'))).toBe(true);
    // Its drop is one option of a "Whenever this character quests, choose one:" ability.
    expect(isRepeatingDropMaker(byFullName('Kit Cloudkicker - Sure Shot'))).toBe(true);
  });

  it('only uses payoff wordings the scoring copy describes', () => {
    // The remove-trigger copy says the payoff draws a card; the sink copy covers a drop-paid Shift
    // AND an "if you would get an ink drop" conversion; the gain-gate copy says the gated card can
    // quest and challenge. A new shape needs its own row and copy.
    const removeTriggersThatDoNotDraw = dropCards
      .filter((c) => isDropRemoveTrigger(c) && !/whenever you remove[^.]*ink drops?[^.]*\bdraw\b/i.test(flatText(c)))
      .map((c) => c.fullName);
    const sinksOfAnotherShape = dropCards
      .filter((c) => {
        const t = flatText(c);
        return isDropSink(c) && !(/\bshift remove \d+ ink drops?\b/i.test(t) && /\bif you would get an ink drop\b/i.test(t));
      })
      .map((c) => c.fullName);
    const gatesOfAnotherShape = dropCards
      .filter((c) => isDropGainGate(c) && !/\bcan['’]t quest or challenge unless you (?:gained|got)\b/i.test(flatText(c)))
      .map((c) => c.fullName);
    // A gain that goes ONLY to opponents would read as a maker for its controller.
    const opponentOnlyGains = dropCards
      .filter((c) => /\b(?:each opponent|opponents|an opponent|chosen opponent) (?:gets?|each get)\s+\d+\s+ink\s+drops?\b/i.test(flatText(c)))
      .map((c) => c.fullName);
    expect({removeTriggersThatDoNotDraw, sinksOfAnotherShape, gatesOfAnotherShape, opponentOnlyGains}).toEqual({
      removeTriggersThatDoNotDraw: [],
      sinksOfAnotherShape: [],
      gatesOfAnotherShape: [],
      opponentOnlyGains: [],
    });
  });
});

describe('Ink Drops pairs on the live pool', () => {
  it('gives every drop card partners and never pairs two makers', () => {
    const makerIds = new Set(makers.map((c) => c.id));
    const partnerless = dropCards.filter((c) => inkDropGroups.get(c.id)!.length === 0).map((c) => c.fullName);
    const makerPairs = makers.flatMap((m) =>
      inkDropGroups
        .get(m.id)!
        .filter((s) => makerIds.has(s.card.id))
        .map((s) => `${m.fullName} x ${s.card.fullName}`),
    );
    expect(partnerless).toEqual([]);
    expect(makerPairs).toEqual([]);
  });

  it('scores 8 with the per-turn payoffs exactly for the steady makers the opponent cannot deny', () => {
    for (const payoff of [byFullName('Madam Mim - Resourceful Trickster'), byFullName('Baymax - Amped Up')]) {
      const partners = inkDropGroups.get(payoff.id)!;
      const eights = partners.filter((s) => s.score === 8).map((s) => s.card.fullName).sort();
      const steady = makers
        .filter((m) => canShareDeck(m, payoff) && isRepeatingDropMaker(m) && !isOpponentGatedDrop(m))
        .map((m) => m.fullName)
        .sort();
      expect(eights).toEqual(steady);
      // Named anchors: both lists come from the same detectors, so a detector regression would
      // shrink them together and still match.
      expect(eights).toEqual(expect.arrayContaining(['Arthur - Jousting Knight', 'Kit Cloudkicker - Sure Shot']));
      expect(partners.every((s) => s.score <= 8)).toBe(true);
    }
  });
});
