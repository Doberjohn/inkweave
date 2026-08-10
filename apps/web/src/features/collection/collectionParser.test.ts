import {describe, expect, it} from 'vitest';
import {createCard} from '../../shared/test-utils';
import {parseCollectionCsv, totalOwned} from './collectionParser';

const HEADER = 'Set Number,Card Number,Variant,Count,Name,Color,Rarity';

/** Build a CSV the way Dreamborn writes one: header, then `rows`. */
function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n');
}

const pool = [
  createCard({id: '1936', fullName: 'Bruno Madrigal - Undetected Uncle', setCode: '9', setNumber: 0}),
  createCard({id: '2001', fullName: 'Angel - Experiment 624', setCode: '11', setNumber: 191}),
  createCard({id: '2002', fullName: 'Woody - Helping a Friend', setCode: '13', setNumber: 1}),
];

describe('parseCollectionCsv', () => {
  it('joins a row to its card by (set, number)', () => {
    const {entries} = parseCollectionCsv(csv('011,191,normal,3,"Angel - Experiment 624",Amber,Rare'), pool);
    expect(entries['2001']).toEqual({normal: 3, foil: 0});
  });

  it('keeps normal and foil apart rather than folding them', () => {
    const {entries} = parseCollectionCsv(
      csv(
        '011,191,normal,3,"Angel - Experiment 624",Amber,Rare',
        '011,191,foil,1,"Angel - Experiment 624",Amber,Rare',
      ),
      pool,
    );
    expect(entries['2001']).toEqual({normal: 3, foil: 1});
  });

  it('ignores rows owning zero copies, because the file is a census of every card', () => {
    const {entries, summary} = parseCollectionCsv(
      csv('011,191,normal,0,"Angel - Experiment 624",Amber,Rare'),
      pool,
    );
    expect(entries['2001']).toBeUndefined();
    expect(summary.coreCardsOwned).toBe(0);
  });

  it('keeps a quantity above a playset intact — a collection count is not a deck count', () => {
    const {entries} = parseCollectionCsv(csv('011,191,normal,10,"Angel - Experiment 624",Amber,Rare'), pool);
    expect(totalOwned(entries['2001'])).toBe(10);
  });

  it('matches a card numbered 0, which a falsy guard would silently drop', () => {
    const {entries, summary} = parseCollectionCsv(
      csv('009,0,normal,1,"Bruno Madrigal - Undetected Uncle",Amethyst,Rare'),
      pool,
    );
    expect(entries['1936']).toEqual({normal: 1, foil: 0});
    expect(summary.unmatched).toEqual([]);
  });

  it('reads a card that ships in one finish only', () => {
    const {entries} = parseCollectionCsv(csv('013,1,foil,2,"Woody - Helping a Friend",Amber,Rare'), pool);
    expect(entries['2002']).toEqual({normal: 0, foil: 2});
  });

  it('counts owned cards from below the Core floor without calling them unmatched', () => {
    const {entries, summary} = parseCollectionCsv(
      csv('004,223,foil,1,"Some Old Promo",Ruby,Promo'),
      pool,
    );
    expect(entries).toEqual({});
    expect(summary.nonCoreCardsOwned).toBe(1);
    expect(summary.unmatched).toEqual([]);
  });

  it('reports a Core-set row that matches no card as unmatched', () => {
    const {summary} = parseCollectionCsv(csv('014,7,normal,1,"A Card From Next Set",Steel,Rare'), pool);
    expect(summary.unmatched).toEqual(['14-7']);
  });

  it('reports rows it cannot read as unparsed, without losing the rest', () => {
    const {entries, summary} = parseCollectionCsv(
      csv('not,a,row', '011,191,normal,2,"Angel - Experiment 624",Amber,Rare'),
      pool,
    );
    expect(totalOwned(entries['2001'])).toBe(2);
    expect(summary.unparsed).toEqual(['not,a,row']);
  });

  it('keeps suffixed collector numbers distinct, which parseInt would merge', () => {
    // Set 3's Dalmatian Puppy ships as 4a-4e. All five read as 4 under parseInt,
    // so a numeric key would count five owned cards as one.
    const {summary} = parseCollectionCsv(
      csv(
        '003,4a,normal,1,"Dalmatian Puppy - Tail Wagger",Amber,Common',
        '003,4b,normal,1,"Dalmatian Puppy - Tail Wagger",Amber,Common',
        '003,4,normal,1,"Some Other Card",Amber,Common',
      ),
      pool,
    );
    expect(summary.nonCoreCardsOwned).toBe(3);
  });

  it('reads a quoted name containing a comma', () => {
    const named = [createCard({id: '3', fullName: 'Hi, Diddly-Dee', setCode: '10', setNumber: 5})];
    const {entries} = parseCollectionCsv(csv('010,5,normal,1,"Hi, Diddly-Dee",Amber,Common'), named);
    expect(entries['3']).toEqual({normal: 1, foil: 0});
  });

  it('counts distinct cards rather than rows, so both finishes of one card count once', () => {
    const {summary} = parseCollectionCsv(
      csv(
        '011,191,normal,3,"Angel - Experiment 624",Amber,Rare',
        '011,191,foil,1,"Angel - Experiment 624",Amber,Rare',
        '013,1,normal,2,"Woody - Helping a Friend",Amber,Rare',
      ),
      pool,
    );
    expect(summary.coreCardsOwned).toBe(2);
    expect(summary.coreCopiesOwned).toBe(6);
  });

  it('reads a file pasted without its header rather than eating the first card', () => {
    const {entries} = parseCollectionCsv('011,191,normal,2,"Angel - Experiment 624",Amber,Rare', pool);
    expect(totalOwned(entries['2001'])).toBe(2);
  });

  it('tolerates CRLF line endings and a trailing newline', () => {
    const {entries} = parseCollectionCsv(
      `${HEADER}\r\n011,191,normal,4,"Angel - Experiment 624",Amber,Rare\r\n`,
      pool,
    );
    expect(entries['2001']).toEqual({normal: 4, foil: 0});
  });
});

describe('totalOwned', () => {
  it('folds the two finishes, and reads an absent card as zero', () => {
    expect(totalOwned({normal: 3, foil: 1})).toBe(4);
    expect(totalOwned(undefined)).toBe(0);
  });
});
