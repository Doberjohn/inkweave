import {describe, it, expect} from 'vitest';
import {getRedPandaRoles} from '../utils';
import {getRuleById} from '../engine';
import {createCard} from './fixtures';

describe('Red Panda', () => {
  const rule = getRuleById('red-panda')!;
  const member = createCard({id: 'ming', name: 'Ming Lee', cost: 3, classifications: ['Red Panda'], text: 'Quests for 2.'});
  const searcher = createCard({id: 'meilin-lc', name: 'Meilin Lee', fullName: 'Meilin Lee - Losing Control', cost: 3, classifications: ['Red Panda'], text: 'RED PANDA POWER When you play this character, look at the top 4 cards of your deck. You may reveal a Red Panda character card or a song card and put it into your hand.'});
  const sunYee = createCard({id: 'sun-yee', name: 'Sun Yee', cost: 5, classifications: ['Red Panda'], keywords: ['Temporary Red Panda Shift 2'], text: 'Temporary Red Panda Shift 2 ⬡ (You may pay 2 ⬡ to play this on top of one of your Red Panda characters.)'});
  const scoreWith = (a, b) => rule.findSynergies(a, [a, b]).find((m) => m.card.id === b.id);

  it('detects the search payoff', () => {
    expect(getRedPandaRoles(searcher)).toEqual(['member', 'search']);
  });
  it('does not treat a Red Panda Shift reminder as search', () => {
    expect(getRedPandaRoles(sunYee)).toEqual(['member']);
  });
  it('scores search + member at 8', () => { expect(scoreWith(searcher, member)?.score).toBe(8); });
  it('scores member + member at 5', () => {
    const m2 = createCard({id: 'meilin-lv', name: 'Meilin Lee', cost: 1, classifications: ['Red Panda'], text: 'Has Singer.'});
    expect(scoreWith(member, m2)?.score).toBe(5);
  });
});
