import type {FilterVocabulary} from '../lib/filterModel';
import {ALL_INKS, COST_BUTTONS} from '../tokens/lorcana';

const STANDARD = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'];
const ALT_ART = ['Epic', 'Enchanted', 'Iconic', 'Special'];

/**
 * A stand-in for the app's `FILTER_VOCABULARY`, close enough that FilterContent's stories read as
 * the app's filters do. It has no set logos, so sets show their names. Tests swap one member for
 * words the app never uses, to prove FilterContent reads it.
 */
export const TEST_FILTER_VOCABULARY: FilterVocabulary = {
  allButtons: {
    inks: ALL_INKS,
    costs: COST_BUTTONS,
    types: ['Character', 'Action', 'Song', 'Item', 'Location'],
    inkwell: ['inkable', 'uninkable'],
  },
  setLogo: () => undefined,
  rarityLabel: (rarity) => (rarity === 'Special' ? 'Promo' : rarity),
  artPresets: (offered) => [
    {
      value: 'standard',
      label: 'Standard cards',
      title: 'Pick the five standard rarities',
      rarities: offered.filter((rarity) => STANDARD.includes(rarity)),
    },
    {
      value: 'alt',
      label: 'Alt art cards',
      title: 'Pick the alt art rarities',
      rarities: offered.filter((rarity) => ALT_ART.includes(rarity)),
    },
  ],
  offersDualInk: (inkCount) => inkCount === 1 || inkCount === 2,
};
