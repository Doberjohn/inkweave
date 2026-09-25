import {describe, expect, it} from 'vitest';
import type {Ink} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import {tallySet} from './collectionStats';
import type {CollectionEntries} from './collectionParser';

const card = (id: string, rarity: string, ink: Ink = 'Amber', ink2?: Ink) =>
  createCard({id, setCode: '1', rarity, ink, ...(ink2 === undefined ? {} : {ink2})});

describe('tallySet', () => {
  it('counts a card held in either finish as complete, both finishes as master', () => {
    const entries: CollectionEntries = {
      a: {normal: 1, foil: 0},
      b: {normal: 0, foil: 2},
      c: {normal: 1, foil: 1},
    };
    const t = tallySet([card('a', 'Common'), card('b', 'Common'), card('c', 'Common')], entries);
    expect(t.complete).toBe(3);
    expect(t.master).toBe(1);
  });

  it('excludes chase rarities from the denominator, and counts them separately', () => {
    // The whole design rests on this: a Dreamborn export contains five rarities,
    // so counting Enchanted would put 100% permanently out of reach.
    const t = tallySet([card('a', 'Common'), card('b', 'Enchanted'), card('c', 'Iconic')], {
      a: {normal: 1, foil: 0},
    });
    expect(t.importable).toBe(1);
    expect(t.complete).toBe(1);
    expect(t.chase).toBe(2);
  });

  it('counts a held chase card without letting it inflate completion', () => {
    const t = tallySet([card('a', 'Common'), card('b', 'Enchanted')], {
      a: {normal: 1, foil: 0},
      b: {normal: 1, foil: 0},
    });
    expect(t.chaseHeld).toBe(1);
    expect(t.complete).toBe(1);
    expect(t.importable).toBe(1);
  });

  it('attributes a dual-ink card to BOTH inks, matching inkDistribution', () => {
    const t = tallySet([card('a', 'Common', 'Amber', 'Steel')], {a: {normal: 1, foil: 0}});
    const byInk = Object.fromEntries(t.byInk.map((r) => [r.ink, r]));
    expect(byInk.Amber).toMatchObject({complete: 1, total: 1});
    expect(byInk.Steel).toMatchObject({complete: 1, total: 1});
  });

  it('ignores a zero-copy entry, which the parser can leave behind', () => {
    const t = tallySet([card('a', 'Common')], {a: {normal: 0, foil: 0}});
    expect(t.complete).toBe(0);
  });

  it('orders rarity rows common-to-scarce, so the rows read as a difficulty ramp', () => {
    const t = tallySet(
      [card('a', 'Legendary'), card('b', 'Common'), card('c', 'Rare')],
      {},
    );
    expect(t.byRarity.map((r) => r.rarity)).toEqual(['Common', 'Rare', 'Legendary']);
  });
});
