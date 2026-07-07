import {describe, it, expect} from 'vitest';
import {getAllPlaystyles} from '../playstyles';
import {getRuleById} from '../rules';
import {createCard} from '../../__tests__/fixtures.js';

/**
 * Snapshot-equivalence guard for the tuning.json refactor (Tasks 3-5).
 *
 * Pins the CURRENT scoring/text output that still comes from code literals
 * in rules.ts / playstyles.ts. Once scoring/explanations are sourced from
 * tuning.json instead, this test must keep passing unchanged — any drift
 * in a pinned value means the refactor altered behavior.
 */
describe('Tuning equivalence (pre-refactor snapshot)', () => {
  it('Ramp playstyle keeps its current name and tagline', () => {
    const ramp = getAllPlaystyles().find((p) => p.id === 'ramp');
    expect(ramp).toMatchObject({
      name: 'Ramp',
      tagline: 'Speed up your ink so you can play powerful cards earlier than your opponent.',
    });
  });

  it('a gap-3 Shift pair scores 5 with the "Wide 3-turn gap" explanation', () => {
    const shiftRule = getRuleById('shift-targets')!;
    // Base cost 2 + Shift 5 → curveGap = shiftCost(5) - baseCost(2) = 3.
    const base = createCard({id: 'elsa-base', name: 'Elsa', fullName: 'Elsa - Snow Queen', cost: 2});
    const shiftCard = createCard({
      id: 'elsa-shift',
      name: 'Elsa',
      fullName: 'Elsa - Ice Maker',
      cost: 7,
      keywords: ['Shift 5'],
    });

    const synergies = shiftRule.findSynergies(shiftCard, [shiftCard, base]);
    const match = synergies.find((s) => s.card.id === 'elsa-base');

    expect(match?.score).toBe(5);
    expect(match?.explanation).toContain('Wide 3-turn gap. Playable but slow to set up.');
  });

  it('a Ramp deck-ramp + repeating-trigger pair scores 9', () => {
    const rampRule = getRuleById('ramp')!;
    const mamaOdie = createCard({
      id: 'mama-odie',
      name: 'Mama Odie',
      fullName: 'Mama Odie - Mystical Maven',
      ink: 'Sapphire',
      cost: 3,
      text: 'THIS GOING TO BE GOOD Whenever you play a song,\nyou may put the top card of your deck into your inkwell\nfacedown and exerted.',
    });
    const jafar = createCard({
      id: 'jafar',
      name: 'Jafar',
      fullName: 'Jafar - Power-Hungry Vizier',
      ink: 'Steel',
      cost: 5,
      text: "YOU'LL GET WHAT'S COMING TO YOU During your turn,\nwhenever a card is put into your inkwell, deal 1 damage\nto chosen character.",
    });

    const synergies = rampRule.findSynergies(mamaOdie, [mamaOdie, jafar]);

    expect(synergies[0].score).toBe(9);
    // Exact string pins the {A}/{B} positional token mapping — the riskiest part
    // of the Task 5 Ramp refactor, where semantic {RAMP}/{TRIGGER} tuning tokens
    // must resolve back to exactly these positional tokens.
    expect(synergies[0].explanation).toBe(
      "{A} adds ink to your inkwell, triggering {B}'s inkwell effect.",
    );
  });
});
