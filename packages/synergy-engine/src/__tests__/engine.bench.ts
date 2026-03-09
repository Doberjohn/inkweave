import {bench, describe} from 'vitest';
import {SynergyEngine} from '../engine/SynergyEngine';
import {getAllRules} from '../engine/rules';
import {createCard} from './fixtures';
import type {LorcanaCard} from '../types';

/**
 * Generate a pool of diverse mock cards for benchmarking.
 * Includes characters, actions, items, locations across all inks
 * with varied keywords and abilities to exercise all rule paths.
 */
function generateCardPool(size: number): LorcanaCard[] {
  const inks = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'] as const;
  const types = ['Character', 'Action', 'Item', 'Location'] as const;
  const keywords = [
    ['Shift 3'],
    ['Rush'],
    ['Evasive'],
    ['Ward'],
    ['Singer 4'],
    ['Challenger +2'],
    [],
    [],
  ];
  const abilities = [
    'When you play this character, you may draw a card.',
    'Whenever this character quests, each opponent chooses and discards a card.',
    "Return target character to their player's hand.",
    'This character gets +1 lore.',
    'Deal 2 damage to chosen character.',
    'Banish chosen character.',
    '',
    '',
  ];

  // Classification combos mirroring real Lorcana patterns
  const characterClassifications = [
    ['Storyborn', 'Hero', 'Prince'],
    ['Dreamborn', 'Villain', 'Sorcerer'],
    ['Storyborn', 'Princess', 'Hero'],
    ['Floodborn', 'Villain', 'King'],
    ['Dreamborn', 'Ally'],
    ['Storyborn', 'Pirate', 'Captain'],
    ['Floodborn', 'Hero', 'Knight'],
    ['Dreamborn', 'Fairy'],
  ];
  const nonCharacterClassifications = [[], ['Song'], [], ['Invention'], [], []];

  const cards: LorcanaCard[] = [];
  for (let i = 0; i < size; i++) {
    const ink = inks[i % inks.length];
    const type = types[i % types.length];
    const cost = (i % 8) + 1;
    const kw = keywords[i % keywords.length];
    const ability = abilities[i % abilities.length];
    const classifications =
      type === 'Character'
        ? characterClassifications[i % characterClassifications.length]
        : nonCharacterClassifications[i % nonCharacterClassifications.length];

    cards.push(
      createCard({
        id: `bench-${i}`,
        name: `Card ${i}`,
        fullName: `Card ${i} - Variant`,
        cost,
        ink,
        type,
        inkwell: i % 3 !== 0,
        keywords: kw,
        text: ability,
        classifications,
      }),
    );
  }
  return cards;
}

const engine = new SynergyEngine();
const pool500 = generateCardPool(500);
const pool1000 = generateCardPool(1000);
const pool1500 = generateCardPool(1500);

// Pick a card that will trigger multiple rules (character with Shift keyword)
const shiftCard = createCard({
  id: 'bench-shift',
  name: 'Card 0',
  fullName: 'Card 0 - Shifted',
  cost: 5,
  ink: 'Amethyst',
  type: 'Character',
  keywords: ['Shift 3'],
  text: 'When you play this character, each opponent chooses and discards a card.',
});

describe('SynergyEngine.findSynergies', () => {
  bench('500 cards', () => {
    engine.findSynergies(shiftCard, pool500);
  });

  bench('1000 cards', () => {
    engine.findSynergies(shiftCard, pool1000);
  });

  bench('1500 cards', () => {
    engine.findSynergies(shiftCard, pool1500);
  });
});

describe('SynergyEngine.checkSynergy', () => {
  const targetCard = pool500[42];

  bench('single pair check', () => {
    engine.checkSynergy(shiftCard, targetCard);
  });
});

describe('SynergyEngine.getPairSynergies', () => {
  const targetCard = pool500[42];

  bench('bidirectional pair detail', () => {
    engine.getPairSynergies(shiftCard, targetCard);
  });
});

describe('Rule initialization', () => {
  bench('getAllRules', () => {
    getAllRules();
  });
});
