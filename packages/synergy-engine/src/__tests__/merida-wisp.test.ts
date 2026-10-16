import {describe, it, expect} from 'vitest';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';

describe('Merida - Wisp Conjurer (BECKON)', () => {
  const beckonRule = getRuleById('merida-wisp')!;

  const merida = createCard({
    id: '13050',
    name: 'Merida',
    fullName: 'Merida - Wisp Conjurer',
    ink: 'Amethyst',
    text: 'FOCUSED ENERGY This character may enter play exerted to draw a card. BECKON During your turn, whenever another character of yours enters play exerted, you may draw a card.',
  });

  // engine (8): pushes OTHER of your characters into play exerted, board-wide.
  const hornedKing = createCard({
    id: '13022',
    name: 'The Horned King',
    fullName: 'The Horned King - Merciless Master',
    ink: 'Amber',
    text: 'THE POWER OF THE CAULDRON While this character is exerted, you may play characters from your discard. If you do, they enter play exerted. (You pay all costs.)',
  });
  const simba = createCard({
    id: '2209',
    name: 'Simba',
    fullName: 'Simba - King in the Making',
    ink: 'Amber',
    text: 'TIMELY ALLIANCE Whenever you put a card under this character, you may reveal the top card of your deck. If it’s a character card, you may play that character for free and they enter play exerted.',
  });
  // engine (8), ITEM — admitted even though type !== Character (it pushes a CHARACTER exerted).
  const powhatansStaff = createCard({
    id: '13036',
    name: "Powhatan's Staff",
    fullName: "Powhatan's Staff",
    type: 'Item',
    ink: 'Amber',
    text: 'STEP FORWARD ⟳, 1 ⬡ – The next character you play this turn enters play exerted and gains Bodyguard until the start of your next turn.',
  });

  // reanimator (7): replays ITSELF exerted from your discard.
  const lilo = createCard({
    id: '1201',
    name: 'Lilo',
    fullName: 'Lilo - Escape Artist',
    ink: 'Amber',
    text: "NO PLACE I'D RATHER BE At the start of your turn, if this card is in your discard, you may play her and she enters play exerted.",
  });

  // self (5): a Bodyguard self-only body — enters play exerted once when played.
  const fixItFelix = createCard({
    id: '966',
    name: 'Fix-It Felix, Jr.',
    fullName: 'Fix-It Felix, Jr. - Trusty Builder',
    ink: 'Amber',
    text: 'Bodyguard (This character may enter play exerted. An opposing character who challenges one of your characters must choose one with Bodyguard if able.)',
  });

  // excluded: makes the OPPONENT's characters enter exerted (not an enabler).
  const jiminy = createCard({
    id: '1726',
    name: 'Jiminy Cricket',
    fullName: 'Jiminy Cricket - Level-Headed and Wise',
    ink: 'Amethyst',
    text: "ENOUGH'S ENOUGH While this character is exerted, opposing characters with Rush enter play exerted.",
  });
  // excluded: an ITEM that enters exerted ITSELF (character-only trigger).
  const chromicon = createCard({
    id: '1124',
    name: 'Sapphire Chromicon',
    fullName: 'Sapphire Chromicon',
    type: 'Item',
    ink: 'Sapphire',
    text: 'POWERING UP This item enters play exerted. SAPPHIRE LIGHT ⟳, 2 ⬡, Banish one of your items — Gain 2 lore.',
  });

  it('matches the BECKON anchor by ability text', () => {
    expect(beckonRule.matches(merida)).toBe(true);
  });

  it('matches enablers across all three tiers', () => {
    expect(beckonRule.matches(hornedKing)).toBe(true); // engine
    expect(beckonRule.matches(lilo)).toBe(true); // reanimator
    expect(beckonRule.matches(fixItFelix)).toBe(true); // self
    expect(beckonRule.matches(powhatansStaff)).toBe(true); // item engine
  });

  it('excludes opposing-side exerts and items that enter exerted themselves', () => {
    expect(beckonRule.matches(jiminy)).toBe(false);
    expect(beckonRule.matches(chromicon)).toBe(false);
  });

  it('scores enablers by tier: engine 8, reanimator 7, self 5', () => {
    const pool = [merida, hornedKing, simba, powhatansStaff, lilo, fixItFelix];
    const syn = beckonRule.findSynergies(merida, pool);
    const scoreOf = (id: string) => syn.find((s) => s.card.id === id)?.score;
    expect(scoreOf('13022')).toBe(8); // Horned King (engine)
    expect(scoreOf('2209')).toBe(8); // Simba (engine)
    expect(scoreOf('13036')).toBe(8); // Powhatan's Staff (item engine)
    expect(scoreOf('1201')).toBe(7); // Lilo (reanimator)
    expect(scoreOf('966')).toBe(5); // Fix-It Felix (self-only body)
  });

  it('does not self-pair (FOCUSED ENERGY self-exert never triggers BECKON)', () => {
    const syn = beckonRule.findSynergies(merida, [merida, hornedKing, fixItFelix]);
    expect(syn.some((s) => s.card.id === '13050')).toBe(false);
    expect(syn.map((s) => s.card.id).sort()).toEqual(['13022', '966']);
  });

  it('reverse: a self-only body finds only the anchor', () => {
    const syn = beckonRule.findSynergies(fixItFelix, [fixItFelix, merida, hornedKing, chromicon]);
    expect(syn).toHaveLength(1);
    expect(syn[0].card.id).toBe('13050');
  });

  it('frames Merida as the payoff in both directions (token-swap)', () => {
    const fwd = beckonRule.findSynergies(merida, [merida, fixItFelix])[0];
    const rev = beckonRule.findSynergies(fixItFelix, [fixItFelix, merida])[0];
    // Forward: Merida is the searcher ({A}); the enabler is {B}.
    expect(fwd.explanation).toContain('{B} enters play exerted, so {A} draws');
    // Reverse: the enabler is the searcher ({A}); Merida swaps to {B} but stays the payoff.
    expect(rev.explanation).toContain('{A} enters play exerted, so {B} draws');
  });

  it('marks synergies as bidirectional', () => {
    const syn = beckonRule.findSynergies(merida, [merida, hornedKing, lilo, fixItFelix]);
    expect(syn.every((s) => s.bidirectional)).toBe(true);
  });
});
