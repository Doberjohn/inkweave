import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  getAllRules,
  isCoreSet,
  transformCards,
  type LorcanaJSONCard,
} from 'inkweave-synergy-engine';

// Data guard for the synergy lines: every line names its cards with the {A}/{B} chip tokens, which
// the pair view draws as card chips and a tile's tooltip fills with card names. A line without
// them reads as a generic sentence beside two specific cards. Runs every rule over the real card
// pool, uncapped and in both directions, so it reaches every line a tile or the pair view can
// show: a new rule or a reworded line that drops the tokens turns CI red. Reads the pool the way
// the precompute builds it (main wins over preview on an id, Core sets only).

function readCards(file: string): LorcanaJSONCard[] {
  return (
    JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data', file), 'utf8')) as {
      cards: LorcanaJSONCard[];
    }
  ).cards;
}

const mainCards = readCards('allCards.json');
const mainIds = new Set(mainCards.map((c) => c.id));
const pool = transformCards(
  [...mainCards, ...readCards('previewCards.json').filter((c) => !mainIds.has(c.id))].filter((c) =>
    isCoreSet(c.setCode),
  ),
);

/** Each rule's lines over the whole pool, one entry per distinct wording. */
const linesByRule = new Map(
  getAllRules().map((rule) => {
    const lines = new Set<string>();
    for (const card of pool) {
      if (!rule.matches(card)) continue;
      for (const match of rule.findSynergies(card, pool)) lines.add(match.explanation);
    }
    return [rule.id, lines] as const;
  }),
);

describe('Synergy description chips', () => {
  it('names a card with {A} or {B} in every line a rule writes', () => {
    const chipFree = [...linesByRule].flatMap(([ruleId, lines]) =>
      [...lines].filter((text) => !/\{[AB]\}/.test(text)).map((text) => `${ruleId}: ${text}`),
    );
    expect(pool.length).toBeGreaterThan(0);
    expect(chipFree).toEqual([]);
  });
});
