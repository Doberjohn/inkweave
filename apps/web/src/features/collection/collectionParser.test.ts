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
    expect(summary.cardsOwned).toBe(0);
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
    expect(summary.unidentified).toEqual([]);
  });

  it('reads a card that ships in one finish only', () => {
    const {entries} = parseCollectionCsv(csv('013,1,foil,2,"Woody - Helping a Friend",Amber,Rare'), pool);
    expect(entries['2002']).toEqual({normal: 0, foil: 2});
  });

  it('stores a card from an older set like any other, now the pool spans every set', () => {
    // This used to assert the opposite — that a set-4 card was counted and
    // discarded. It was right when the pool was Core-only; keeping it would pin
    // the behaviour that lost five owned cards behind a reassuring message.
    const withOld = [
      ...pool,
      createCard({id: '4223', fullName: 'Some Old Promo', setCode: '4', setNumber: 223}),
    ];
    const {entries, summary} = parseCollectionCsv(
      csv('004,223,foil,1,"Some Old Promo",Ruby,Promo'),
      withOld,
    );
    expect(entries['4223']).toEqual({normal: 0, foil: 1});
    expect(summary.cardsOwned).toBe(1);
    expect(summary.unidentified).toEqual([]);
  });

  it('reports a Core-set row that matches no card as unmatched', () => {
    const {summary} = parseCollectionCsv(csv('014,7,normal,1,"A Card From Next Set",Steel,Rare'), pool);
    expect(summary.unidentified).toEqual(['14-7']);
  });

  it('reports rows it cannot read as unparsed, without losing the rest', () => {
    const {entries, summary} = parseCollectionCsv(
      csv('not,a,row', '011,191,normal,2,"Angel - Experiment 624",Amber,Rare'),
      pool,
    );
    expect(totalOwned(entries['2001'])).toBe(2);
    expect(summary.unparsed).toEqual(['not,a,row']);
  });

  /*
    `parseInt` is a PREFIX parser, so "3x" silently imported as 3 copies and
    "1.5" as 1. The whole point of `unparsed` is to put a row the format cannot
    describe in front of the user, and a prefix parse routed malformed counts
    around it. Asserting the entry is ABSENT is what catches it: asserting only
    that `unparsed` is non-empty would pass while the bad count still imported.
  */
  it('reports a malformed count as unparsed instead of importing its numeric prefix', () => {
    const row = '011,191,normal,3x,"Angel - Experiment 624",Amber,Rare';
    const {entries, summary} = parseCollectionCsv(csv(row), pool);
    expect(summary.unparsed).toEqual([row]);
    expect(entries['2001']).toBeUndefined();
  });

  it('rejects a digits-only count that has already lost precision', () => {
    // Digits alone are not enough: this rounds to ...992 before anything sees it,
    // and a longer run of digits becomes Infinity. Either would be summed into
    // `copiesOwned` as though it were a real number of cards.
    const row = '011,191,normal,9007199254740993,"Angel - Experiment 624",Amber,Rare';
    const {entries, summary} = parseCollectionCsv(csv(row), pool);
    expect(summary.unparsed).toEqual([row]);
    expect(entries['2001']).toBeUndefined();
  });

  it('gives a contested collector number to the base card, not a Special reprint', () => {
    // Special-rarity promos REUSE base collector numbers — 98 contested numbers
    // across the non-Core sets, and a Special is listed last in 97 of them. Set 1
    // #1 is both "Ariel - On Human Legs" (Uncommon) and, later in the file,
    // "Ariel - Spectacular Singer" (Special).
    //
    // The CSV row `001,1` means the card printed in that slot. Letting the
    // Special win recorded ownership against a card the binder does not even
    // render (it excludes Specials, or five would fight for one pocket), so a
    // card the user owns showed as unowned. Measured: 18 of Set 1's 30 gaps.
    const contested = [
      createCard({id: '1', fullName: 'Ariel - On Human Legs', setCode: '1', setNumber: 1, rarity: 'Uncommon'}),
      createCard({id: '3237', fullName: 'Ariel - Spectacular Singer', setCode: '1', setNumber: 1, rarity: 'Special'}),
    ];
    const {entries} = parseCollectionCsv(csv('001,1,normal,2,"Ariel - On Human Legs",Amber,Uncommon'), contested);
    expect(entries['1']).toEqual({normal: 2, foil: 0});
    expect(entries['3237']).toBeUndefined();
  });

  it('lets the base card win even when the Special is listed first', () => {
    // Order must not decide it: 1 of the 98 has the Special first.
    const contested = [
      createCard({id: '3237', fullName: 'Ariel - Spectacular Singer', setCode: '1', setNumber: 1, rarity: 'Special'}),
      createCard({id: '1', fullName: 'Ariel - On Human Legs', setCode: '1', setNumber: 1, rarity: 'Uncommon'}),
    ];
    const {entries} = parseCollectionCsv(csv('001,1,normal,1,"Ariel - On Human Legs",Amber,Uncommon'), contested);
    expect(entries['1']).toEqual({normal: 1, foil: 0});
  });

  it('resolves a lettered variant to the printed card it is a variant of', () => {
    // Dreamborn numbers Set 3's Dalmatian Puppy 4a-4e; our data carries it once,
    // as plain 4. Without a fallback all five read as unidentified, which is how
    // a real import reported five owned cards as "sets Core does not use".
    const withPuppy = [
      ...pool,
      createCard({id: '3004', fullName: 'Dalmatian Puppy - Tail Wagger', setCode: '3', setNumber: 4}),
    ];
    const {entries, summary} = parseCollectionCsv(
      csv(
        '003,4a,normal,1,"Dalmatian Puppy - Tail Wagger",Amber,Common',
        '003,4b,normal,2,"Dalmatian Puppy - Tail Wagger",Amber,Common',
      ),
      withPuppy,
    );
    // One printed card, so the variants fold into its copy count.
    expect(entries['3004']).toEqual({normal: 3, foil: 0});
    expect(summary.unidentified).toEqual([]);
  });

  it('reports each unidentified card once, not once per finish', () => {
    // The export is a census with a row per finish, so a card we cannot place
    // appears twice. Counting rows would tell someone they had lost twice as
    // many cards as they had.
    const {summary} = parseCollectionCsv(
      csv(
        '003,999,normal,1,"Nothing We Carry",Amber,Common',
        '003,999,foil,1,"Nothing We Carry",Amber,Common',
      ),
      pool,
    );
    expect(summary.unidentified).toEqual(['3-999']);
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
    expect(summary.cardsOwned).toBe(2);
    expect(summary.copiesOwned).toBe(6);
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
