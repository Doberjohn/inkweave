import {describe, it, expect} from 'vitest';
import {transformCard, type LorcanaJSONCard} from '../utils';

const raw = (overrides: Partial<LorcanaJSONCard> = {}): LorcanaJSONCard => ({
  id: 1,
  name: 'Test',
  fullName: 'Test - Card',
  cost: 3,
  color: 'Amber',
  inkwell: true,
  type: 'Character',
  ...overrides,
});

const nativeSinger5 = {type: 'keyword', keyword: 'Singer', keywordValue: '5', fullText: 'Singer 5'};

describe('transformCard', () => {
  describe('keywords', () => {
    it('reads native keyword abilities with their value', () => {
      expect(transformCard(raw({abilities: [nativeSinger5]}))?.keywords).toEqual(['Singer 5']);
    });

    it('synthesizes conditional Shift from an ability effect', () => {
      const ability = {type: 'static', fullText: 'x', effect: "If a card left a player's discard this turn, this card gains Shift 0."};
      expect(transformCard(raw({abilities: [ability]}))?.keywords).toEqual(['Shift 0']);
    });

    it('synthesizes conditional Shift from fullText when the card has no abilities array', () => {
      const card = transformCard(raw({fullText: 'While you have an item in play, this character gains Shift 2.'}));
      expect(card?.keywords).toEqual(['Shift 2']);
    });

    it('reads a printed Shift paid in ink drops from fullText (Baymax - Amped Up)', () => {
      const card = transformCard(
        raw({
          fullText:
            'Shift Remove 2 ink drops (You may remove 2 ink drops to play this on top of one of your characters named Baymax.)\nSUPERCHARGE If you would get an ink drop, you may put the top card of your deck into your inkwell facedown and exerted instead.',
        }),
      );
      expect(card?.keywords).toEqual(['Shift Remove 2 ink drops']);
    });

    it('synthesizes conditional Singer from fullText when the card has no abilities array (Miguel)', () => {
      const card = transformCard(
        raw({fullText: 'SHARE THE MUSIC While you have a song card in your discard, this character gets +1 ◊ and gains Singer 3. (They count as cost 3 to sing songs.)'}),
      );
      expect(card?.keywords).toEqual(['Singer 3']);
    });

    it('synthesizes conditional Singer from an ability effect (Mickey - Amber Champion)', () => {
      const ability = {type: 'static', fullText: 'x', effect: 'While you have 2 or more other Amber characters in play, this character gains Singer 8. (They count as cost 8 to sing songs.)'};
      expect(transformCard(raw({abilities: [ability]}))?.keywords).toEqual(['Singer 8']);
    });

    it('lets a native keyword win even when the granting ability comes first', () => {
      const grantThenNative = raw({
        abilities: [
          {type: 'static', fullText: 'x', effect: "If a card left a player's discard this turn, this card gains Shift 0."},
          {type: 'keyword', keyword: 'Shift', keywordValue: '3', fullText: 'Shift 3'},
        ],
      });
      expect(transformCard(grantThenNative)?.keywords).toEqual(['Shift 3']);
    });

    it('lets a native Singer keyword win over a text grant', () => {
      const card = transformCard(raw({abilities: [nativeSinger5], fullText: 'Singer 5\nWhile you have a song in your discard, this character gains Singer 8.'}));
      expect(card?.keywords).toEqual(['Singer 5']);
    });

    it('ignores Singer granted to other characters', () => {
      expect(transformCard(raw({fullText: 'Your other characters gain Singer 4.'}))?.keywords).toBeUndefined();
      const grant = raw({fullText: 'Whenever this character quests, chosen character gains Singer 5 this turn.'});
      expect(transformCard(grant)?.keywords).toBeUndefined();
    });
  });

  it('returns null for an unknown ink or card type', () => {
    expect(transformCard(raw({color: 'Chartreuse'}))).toBeNull();
    expect(transformCard(raw({type: 'Spell'}))).toBeNull();
  });

  it('lifts the Song subtype into isSong and leaves it out of the classifications', () => {
    const card = transformCard(raw({type: 'Action', subtypes: ['Song']}));
    expect(card?.isSong).toBe(true);
    expect(card?.classifications).toBeUndefined();
  });
});
