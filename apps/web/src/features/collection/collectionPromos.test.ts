import {describe, expect, it} from 'vitest';
import {createCard} from '../../shared/test-utils';
import {
  transformPromos,
  waitingPromos,
  withPromoPockets,
  type RawCollectionPromo,
} from './collectionPromos';

const ART = 'https://api.lorcana.ravensburger.com/images/en/promo1/25_x.jpg';

/** Mickey Mouse - True Friend's 25/P1 as `collection/promos.json` lists it, and Hades, whose card is not out. */
const RAW: RawCollectionPromo[] = [
  {
    id: 80042,
    rarity: 'Special',
    number: 25,
    promoGrouping: 'P1',
    images: {thumbnail: ART},
    fullName: 'Mickey Mouse - True Friend',
    baseId: 1949,
  },
  {id: 80033, rarity: 'Special', number: 29, promoGrouping: 'C3', fullName: 'Hades - Dark Usurper'},
];

const MICKEY = createCard({
  id: '1949',
  fullName: 'Mickey Mouse - True Friend',
  setCode: '9',
  setNumber: 13,
  rarity: 'Rare',
});

describe('transformPromos', () => {
  it("resolves a promo's art as a printing's, and keeps the card it reprints", () => {
    const [mickey, hades] = transformPromos(RAW);

    expect(mickey).toMatchObject({id: '80042', number: 25, promoGrouping: 'P1', baseId: '1949'});
    expect(mickey.imageUrl).toBe('/card-images/en/promo1/25_x.jpg');
    expect(hades.baseId).toBeUndefined();
  });
});

describe('withPromoPockets', () => {
  const promos = transformPromos(RAW);

  it("gives a promo whose card the pool holds a pocket card: the card's text in its promo set", () => {
    const [, pocket] = withPromoPockets([MICKEY], promos);

    expect(pocket).toMatchObject({
      id: '80042',
      fullName: 'Mickey Mouse - True Friend',
      baseId: '1949',
      rarity: 'Special',
      setCode: 'P1',
      setNumber: 25,
    });
  });

  it('names a promo printed under another name by that name, with its card\'s version: 26/P2\'s Vaiana', () => {
    const moana = createCard({id: '1589', name: 'Moana', version: 'Adventurer of Land and Sea', fullName: 'Moana - Adventurer of Land and Sea'});
    const vaiana = transformPromos([
      {id: 1663, rarity: 'Special', number: 26, promoGrouping: 'P2', printedName: 'Vaiana', fullName: moana.fullName, baseId: 1589},
    ]);
    const [, pocket] = withPromoPockets([moana], vaiana);

    expect(pocket).toMatchObject({id: '1663', name: 'Vaiana', fullName: 'Vaiana - Adventurer of Land and Sea', baseId: '1589'});
  });

  it('gives a promo whose card the pool lacks no pocket card: it waits for the card', () => {
    const pool = withPromoPockets([MICKEY], promos);

    expect(pool.map((card) => card.id)).toEqual(['1949', '80042']);
    expect(waitingPromos([MICKEY], promos).map((promo) => promo.id)).toEqual(['80033']);
  });
});
