import {describe, it, expect} from 'vitest';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {SPECS} from '../specs/index.mjs';
import inkDrops from '../specs/ink-drops.mjs';
import namedCompanions from '../specs/named-companions.mjs';
import {buildPool, createCoverage, groupByRole} from '../stats.mjs';

const ENGINE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/synergy-engine/dist/index.js',
);

const blocks = SPECS.flatMap((spec) =>
  Object.entries(spec.blocks).map(([name, render]) => [`${spec.doc} ${name}`, render]),
);

describe('coverage specs over an empty pool', () => {
  // A set rotation can take a rule's every anchor out of the pool (#479).
  it.each(blocks)('%s renders with no Infinity, NaN or undefined', async (_, render) => {
    const engine = await import(pathToFileURL(ENGINE).href);
    const pool = buildPool({main: {cards: [], sets: {}}, preview: null, engine});
    expect(render(createCoverage({engine, pool}))).not.toMatch(/Infinity|NaN|undefined/);
  });
});

describe('coverage specs that list anchors', () => {
  // A pool of one anchor: no payoff, so no pair names it.
  const loneAnchor = async (text) => {
    const engine = await import(pathToFileURL(ENGINE).href);
    const card = {
      id: '1',
      name: 'Test',
      fullName: 'Test - Anchor',
      type: 'Character',
      ink: 'Amber',
      cost: 2,
      text,
    };
    return createCoverage({engine, pool: {cards: [card], label: 'a test pool'}});
  };
  const render = (doc, coverage) =>
    SPECS.find((spec) => spec.doc === doc).blocks.coverage(coverage);

  it.each([
    ['FREE_PLAY_RULE.md', 'You may play a character with cost 1 for free.'],
    ['SPIKE_SUIT_RULE.md', 'Your characters deal damage with their ⛉ instead of their ¤.'],
    [
      'MERIDA_ARCHER_RULE.md',
      'Whenever one of your actions deals damage to an opposing character.',
    ],
    [
      'MERIDA_WISP_RULE.md',
      'Whenever another character of yours enters play exerted, draw a card.',
    ],
  ])('%s lists an anchor that nothing pairs with', async (doc, text) => {
    expect(render(doc, await loneAnchor(text))).toContain('**1 anchor**: Test - Anchor');
  });

  it('gives a Free Play anchor with no payoff its own row', async () => {
    const coverage = await loneAnchor('You may play a character with cost 1 for free.');
    expect(render('FREE_PLAY_RULE.md', coverage)).toContain(
      '| Test - Anchor | Amber | 0 | none | none |',
    );
  });
});

describe('coverage specs that count by explanation or role', () => {
  const card = {id: '1', fullName: 'Test - Card'};

  it('fail on a Named Companions pair whose explanation names no effect tier', () => {
    const coverage = {
      pool: {cards: [], label: 'a test pool'},
      engine: {NAMED_EFFECT_SCORES: {minor: 6}},
      pairs: () => [{score: 6, explanation: 'Plays well with {B}.'}],
    };
    expect(() => namedCompanions.blocks.tiers(coverage)).toThrow(
      'no effect tier for the pair: Plays well with {B}.',
    );
  });

  it('fail on an Ink Drops card that no role composition slice takes', () => {
    const no = () => false;
    const engine = {
      getInkDropRoles: () => ['drop-payoff'],
      isDropSpendRider: no,
      isDropRemoveTrigger: no,
      isDropHoldPayoff: no,
      isDropSink: no,
      isDropGainGate: no,
    };
    const coverage = {
      engine,
      roles: (roleFn, order) => groupByRole([card], roleFn, order),
      inks: () => ['Amber'],
    };
    expect(() => inkDrops.blocks.coverage(coverage)).toThrow(
      'no role composition slice for Test - Card',
    );
  });
});
