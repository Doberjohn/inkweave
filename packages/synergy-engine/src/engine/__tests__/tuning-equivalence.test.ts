import {describe, it, expect} from 'vitest';
import {TUNING} from '../../data/tuning';
import {getAllPlaystyles} from '../playstyles';
import {getRuleById} from '../rules';
import {createCard} from '../../__tests__/fixtures.js';

/**
 * Checks that values from tuning.json reach the engine's output: a playstyle's copy, a Shift
 * tier's score and text, and a Ramp score and template. Admin's tuning editor changes these
 * values, so the expected ones are read from TUNING, never written as literals.
 */
describe('Tuning values reach the engine', () => {
  it('Ramp playstyle takes its name and tagline from tuning.json', () => {
    const ramp = getAllPlaystyles().find((p) => p.id === 'ramp');
    expect(ramp).toMatchObject(TUNING.playstyles.ramp);
  });

  it('a gap-3 Shift pair reads the curve.gap3 tier', () => {
    const shiftRule = getRuleById('shift-targets')!;
    const tier = TUNING.ruleTexts['shift-targets']['curve.gap3'];
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

    expect(match?.score).toBe(tier.score);
    // The Shift card is the searcher, so <SHIFT> reads as {A} and <BASE> as {B}.
    expect(match?.explanation).toBe(
      tier.text!.replaceAll('<SHIFT>', '{A}').replaceAll('<BASE>', '{B}'),
    );
  });

  it('a Ramp deck-ramp + repeating-trigger pair reads chain.deckRepeating', () => {
    const rampRule = getRuleById('ramp')!;
    const {scores, templates} = TUNING.ruleTexts.ramp;
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

    expect(synergies[0].score).toBe(scores['chain.deckRepeating']);
    // From the ramp card's page, the semantic {RAMP}/{TRIGGER} tokens must resolve to the
    // positional {A}/{B} chips this way round (the engine swaps each token once, as here).
    expect(synergies[0].explanation).toBe(
      templates['ramp-trigger'].replace('{RAMP}', '{A}').replace('{TRIGGER}', '{B}'),
    );
  });
});
