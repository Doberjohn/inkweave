import {describe, expect, it} from 'vitest';
import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import type {CollectionEntries} from './collectionParser';
import type {CollectionPromo} from './collectionPromos';
import {editAsShown, placeCopies, placementsFor} from './placeCopies';

/** A promo of Mother Knows Best's (2035) in Challenge Set 3, as a Core card's variants hold it. */
const c3 = (id: string, number: number, finish: 'normal' | 'foil'): CardPrinting => ({
  id,
  rarity: 'Special',
  number,
  promoGrouping: 'C3',
  finishes: [finish],
});

/** Mother Knows Best: 1/C3 in normal alone, and 13/C3, its foil twin. */
const MOTHER: LorcanaCard = createCard({
  id: '2035',
  rarity: 'Uncommon',
  variants: [c3('80017', 1, 'normal'), c3('80024', 13, 'foil')],
});

/** Yen Sid - Powerful Sorcerer #223, a Set 4 alt foil from the collection's chunks. */
const YEN_SID: LorcanaCard = createCard({
  id: '946',
  setCode: '4',
  rarity: 'Legendary',
  baseId: '750',
  finishes: ['foil'],
});

const placements = placementsFor([MOTHER, YEN_SID], []);

const totalCopies = (entries: CollectionEntries) =>
  Object.values(entries).reduce((total, {normal, foil}) => total + normal + foil, 0);

describe('placeCopies', () => {
  it("shows an alt foil's normal copies in its foil, added to those already there", () => {
    const placed = placeCopies({'946': {normal: 2, foil: 1}}, placements);
    expect(placed).toEqual({'946': {normal: 0, foil: 3}});
  });

  it("shows a promo's copies on its one twin in the missing finish: a foil on 1/C3 as a foil 13/C3", () => {
    const placed = placeCopies({'80017': {normal: 1, foil: 2}}, placements);
    expect(placed).toEqual({'80017': {normal: 1, foil: 0}, '80024': {normal: 0, foil: 2}});
  });

  it('leaves a printing with no copies left to show out of the collection, as an edit does', () => {
    const placed = placeCopies({'80024': {normal: 1, foil: 0}}, placements);
    expect(placed).toEqual({'80017': {normal: 1, foil: 0}});
  });

  it("shows a promo's copies in its own other finish when it has no twin, or more than one", () => {
    const twinless = createCard({id: '2044', variants: [c3('80051', 61, 'normal')]});
    const torn = createCard({
      id: '2045',
      variants: [c3('90001', 1, 'normal'), c3('90002', 2, 'foil'), c3('90003', 3, 'foil')],
    });
    const placed = placeCopies(
      {'80051': {normal: 0, foil: 1}, '90001': {normal: 0, foil: 1}},
      placementsFor([twinless, torn], []),
    );
    expect(placed).toEqual({'80051': {normal: 1, foil: 0}, '90001': {normal: 1, foil: 0}});
  });

  it("finds a pre-Core promo's twin among the collection's promos, by its promo set and card", () => {
    // 12/C3 and 24/C3, Mickey Mouse - Brave Little Tailor's (115, Set 1) normal and foil.
    const promo = (id: string, number: number, finish: 'normal' | 'foil'): CollectionPromo => ({
      ...c3(id, number, finish),
      fullName: 'Mickey Mouse - Brave Little Tailor',
      baseId: '115',
    });
    const pair = placementsFor([], [promo('80023', 12, 'normal'), promo('80030', 24, 'foil')]);
    expect(placeCopies({'80023': {normal: 0, foil: 1}}, pair)).toEqual({
      '80030': {normal: 0, foil: 1},
    });
  });

  it("places a promo by the collection's copy, which its pocket is built from, before a card's variant", () => {
    // Were the variant kept, which names no finish, 1/C3 would come in both by its rarity.
    const card = createCard({
      id: '2035',
      variants: [{id: '80017', rarity: 'Special', number: 1, promoGrouping: 'C3'}],
    });
    const promo: CollectionPromo = {
      ...c3('80017', 1, 'normal'),
      fullName: 'Mother Knows Best',
      baseId: '2035',
    };
    expect(placeCopies({'80017': {normal: 0, foil: 1}}, placementsFor([card], [promo]))).toEqual({
      '80017': {normal: 1, foil: 0},
    });
  });

  it('follows the rarity rule where the data names no finish: an Enchanted preview card in foil alone', () => {
    const preview = placementsFor([createCard({id: 'preview-1', rarity: 'Enchanted'})], []);
    expect(placeCopies({'preview-1': {normal: 1, foil: 0}}, preview)).toEqual({
      'preview-1': {normal: 0, foil: 1},
    });
  });

  it('returns the same copies, untouched, when every copy shows where it was counted', () => {
    const entries: CollectionEntries = {
      '2035': {normal: 3, foil: 1},
      '80017': {normal: 1, foil: 0},
      unknown: {normal: 1, foil: 1},
    };
    expect(placeCopies(entries, placements)).toBe(entries);
  });

  it('keeps the total, and changes nothing when placed again', () => {
    const entries: CollectionEntries = {
      '946': {normal: 2, foil: 0},
      '80017': {normal: 1, foil: 1},
      '80024': {normal: 4, foil: 0},
    };
    const placed = placeCopies(entries, placements);
    expect(totalCopies(placed)).toBe(totalCopies(entries));
    expect(placeCopies(placed, placements)).toBe(placed);
  });
});

describe('editAsShown', () => {
  it('saves the count as shown, clearing the copies shown in it from where they were counted', () => {
    // 13/C3's Foil shows 3: its own 2, and the 1 foil counted on 1/C3. The player makes it 4.
    const saved: CollectionEntries = {'80017': {normal: 1, foil: 1}, '80024': {normal: 0, foil: 2}};
    const edited = editAsShown(saved, placements, {id: '80024', finish: 'foil'}, 4);

    expect(edited).toEqual({'80017': {normal: 1, foil: 0}, '80024': {normal: 0, foil: 4}});
    expect(placeCopies(edited, placements)).toBe(edited);
  });

  it("saves an alt foil's foil as shown, its normal copies cleared, none counted twice", () => {
    const edited = editAsShown(
      {'946': {normal: 2, foil: 1}},
      placements,
      {id: '946', finish: 'foil'},
      2,
    );
    expect(edited).toEqual({'946': {normal: 0, foil: 2}});
  });

  it('leaves every other count as saved, copies shown elsewhere included', () => {
    // 1/C3's Normal goes from 1 to 2; its foil copy still shows on 13/C3, and stays saved on 1/C3.
    const saved: CollectionEntries = {'80017': {normal: 1, foil: 1}, '2035': {normal: 0, foil: 1}};
    const edited = editAsShown(saved, placements, {id: '80017', finish: 'normal'}, 2);

    expect(edited).toEqual({'80017': {normal: 2, foil: 1}, '2035': {normal: 0, foil: 1}});
  });

  it('drops a printing left with no copies, the copies shown in it cleared too', () => {
    const edited = editAsShown(
      {'80024': {normal: 1, foil: 0}, '946': {normal: 0, foil: 1}},
      placements,
      {id: '80017', finish: 'normal'},
      0,
    );
    expect(edited).toEqual({'946': {normal: 0, foil: 1}});
  });
});
