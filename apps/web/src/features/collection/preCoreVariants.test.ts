import {describe, expect, it} from 'vitest';
import {createCard} from '../../shared/test-utils';
import type {CollectionPromo} from './collectionPromos';
import {withPreCoreVariants} from './preCoreVariants';

/**
 * Yen Sid - Powerful Sorcerer (4/59) as Set 4's chunk holds him, beside his two printings: the
 * Enchanted (#209) and the foil-only alt foil numbered past the Enchanteds (#223), each a card of
 * its own that names him in `baseId`.
 */
const YEN_SID = createCard({
  id: '750',
  fullName: 'Yen Sid - Powerful Sorcerer',
  setCode: '4',
  setNumber: 59,
  rarity: 'Legendary',
});
const ENCHANTED = createCard({
  ...YEN_SID,
  id: '900',
  setNumber: 209,
  rarity: 'Enchanted',
  baseId: '750',
  imageUrl: '/card-images/900.avif',
  imageHashSm: 'c0ed',
});
const ALT_FOIL = createCard({
  ...YEN_SID,
  id: '946',
  setNumber: 223,
  baseId: '750',
  finishes: ['foil'],
  imageUrl: '/card-images/946.avif',
});

/** Mickey Mouse - Brave Little Tailor (1/115), whose five promos are the most any card has. */
const MICKEY = createCard({
  id: '115',
  fullName: 'Mickey Mouse - Brave Little Tailor',
  setCode: '1',
  setNumber: 115,
  rarity: 'Legendary',
});

/** One of Mickey's promos as collection mode holds it, from `collection/promos.json`. */
const mickeyPromo = (
  id: string,
  number: number,
  promoGrouping: string,
  extra: Partial<CollectionPromo> = {},
): CollectionPromo => ({
  id,
  rarity: 'Special',
  number,
  promoGrouping,
  fullName: MICKEY.fullName,
  baseId: MICKEY.id,
  ...extra,
});

/** 5/C1, foil alone and with no LorcanaJSON art, and 1/D23, with its art. */
const C1 = mickeyPromo('80003', 5, 'C1', {finishes: ['foil']});
const D23 = mickeyPromo('1191', 1, 'D23', {imageUrl: '/card-images/1191.avif'});

describe('withPreCoreVariants', () => {
  it("gives a pre-Core card its set's printings of it, by number, with their art and finishes", () => {
    // Out of collector order, as the chunks arrive.
    const [yenSid] = withPreCoreVariants([YEN_SID, ALT_FOIL, ENCHANTED], []);

    expect(yenSid.variants).toEqual([
      {
        id: '900',
        rarity: 'Enchanted',
        number: 209,
        imageUrl: '/card-images/900.avif',
        imageHashSm: 'c0ed',
      },
      {
        id: '946',
        rarity: 'Legendary',
        number: 223,
        imageUrl: '/card-images/946.avif',
        finishes: ['foil'],
      },
    ]);
  });

  it("gives a pre-Core card its promos as printings in their promo sets, without the card's own name", () => {
    const [mickey] = withPreCoreVariants([MICKEY], [C1, D23]);

    expect(mickey.variants).toEqual([
      {id: '80003', rarity: 'Special', number: 5, promoGrouping: 'C1', finishes: ['foil']},
      {
        id: '1191',
        rarity: 'Special',
        number: 1,
        promoGrouping: 'D23',
        imageUrl: '/card-images/1191.avif',
      },
    ]);
  });

  it("keeps a two-art promo's letter, so Hiro Hamada's 24A/P2 and 24B/P2 stay apart", () => {
    const hiro = createCard({
      id: '1529',
      fullName: 'Hiro Hamada - Armor Designer',
      setCode: '7',
      setNumber: 96,
    });
    const p2 = (id: string, artVariant: string): CollectionPromo => ({
      id,
      rarity: 'Special',
      number: 24,
      promoGrouping: 'P2',
      artVariant,
      fullName: hiro.fullName,
      baseId: hiro.id,
    });

    const [withPromos] = withPreCoreVariants([hiro], [p2('1661', 'A'), p2('1662', 'B')]);

    expect(withPromos.variants?.map((printing) => printing.artVariant)).toEqual(['A', 'B']);
  });

  it("keeps the name a promo was printed under, so Moana's European 26/P2 can read Vaiana", () => {
    const moana = createCard({
      id: '1589',
      fullName: 'Moana - Adventurer of Land and Sea',
      setCode: '7',
    });
    const vaiana: CollectionPromo = {
      id: '1663',
      rarity: 'Special',
      number: 26,
      promoGrouping: 'P2',
      printedName: 'Vaiana',
      fullName: moana.fullName,
      baseId: moana.id,
    };

    const [withPromo] = withPreCoreVariants([moana], [vaiana]);

    expect(withPromo.variants?.map((printing) => printing.printedName)).toEqual(['Vaiana']);
  });
});
