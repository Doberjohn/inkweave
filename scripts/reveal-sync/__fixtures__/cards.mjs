/**
 * Test fixtures shaped like the real data this pipeline sees.
 *
 * `page()` builds the line array the browser flattener produces for a lorcanaplayer card
 * page: a header, the label/value table, then retailer and share links. The values come
 * from cards processed in the 2026-09-23 trial run. Flavour text is never included; the
 * one fixture that has a flavour line uses a placeholder to prove it is ignored.
 *
 * The reader objects are the JSON the vision agents returned in that trial, including
 * their real quirks (◆ for ◊, an illegible classification term).
 */

const HEADER = (title) => [
  title,
  'English',
  'Official card image - Not full quality',
  'TCGPlayer Check Price',
  'These are affiliate links we may earn commission from - Learn More',
];

const FOOTER = [
  'Zatu Games',
  'Card Information',
  'Corrections & Errata',
  'Found an error or omission? E-mail us or leave a comment below',
  'Share on X (Twitter) Share on Facebook Share on Pinterest Share on Reddit Share on Email',
];

/**
 * Flattened page lines for a card. `patch` replaces a label's value, or removes the label
 * entirely when the value is `undefined`, to model markup drift.
 */
export function page(card, patch = {}) {
  const lines = HEADER(card.title);
  for (const [label, original] of card.fields) {
    const value = label in patch ? patch[label] : original;
    if (label in patch && value === undefined) continue;
    lines.push(label, ...[].concat(value ?? []).filter((v) => v !== ''));
  }
  return [...lines, ...FOOTER];
}

const dates = [
  ['Release Date', 'October 16th, 2026'],
  ['Revealed', 'September 23rd, 2026'],
];

export const LIONHEART = {
  slug: 'lionheart-cleaning-up-the-city',
  imageFile: '147-204-EN-14-Lionheart-Cleaning-Up-the-City-LQ-Lorcana-Player.jpg',
  title: 'Lionheart – Cleaning Up the City',
  fields: [
    ['Name', 'Lionheart'],
    ['Card Type', 'Character'],
    ['Version', 'Cleaning Up the City'],
    ['Ink Cost', '4'],
    ['Inkwell', 'Yes'],
    ['Strength', '3'],
    ['Willpower', '5'],
    ['Lore', '1'],
    ['Ink Color', 'Sapphire'],
    ['Rarity', 'Uncommon'],
    ['Card ID', '147/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Alert Heal'],
    ['Classifications', 'Storyborn'],
    [
      'Card Text',
      [
        'Alert (This character can challenge as if they had Evasive.)',
        'CIVIC DUTY 6 ⬡ – Remove all damage from chosen character or location.',
      ],
    ],
    ['Flavor Text', 'A placeholder flavour line that must never be captured.'],
    ['Illustrator', 'Alice Pisoni'],
    ['Franchise', 'Zootopia'],
    ...dates,
  ],
};

export const ERNESTO = {
  slug: 'ernesto-de-la-cruz-idol-of-millions',
  imageFile: '118-204-EN-14-Ernesto-de-la-Cruz-Idol-of-Millions-LQ-Lorcana-Player.jpg',
  title: 'Ernesto de la Cruz – Idol of Millions',
  fields: [
    ['Name', 'Ernesto de la Cruz'],
    ['Card Type', 'Character'],
    ['Version', 'Idol of Millions'],
    ['Ink Cost', '3'],
    ['Inkwell', 'No'],
    ['Strength', '5'],
    ['Willpower', '3'],
    ['Lore', '1'],
    ['Ink Color', 'Ruby'],
    ['Rarity', 'Common'],
    ['Card ID', '118/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Gain Lore Singer'],
    ['Classifications', 'Storyborn • Villain'],
    [
      'Card Text',
      [
        'Singer 5 (This character counts as cost 5 to sing songs.)',
        'TOP THE CHARTS While an opponent has a song card in their discard, this character gets +1 ◊ .',
      ],
    ],
    ['Flavor Text', ''],
    ['Illustrator', 'Mariana Moreno'],
    ['Franchise', 'Coco'],
    ...dates,
  ],
};

export const HONEY_LEMON = {
  slug: 'honey-lemon-ingenious-researcher',
  imageFile: '144-204-EN-14-Honey-Lemon-Ingenious-Researcher-LQ-Lorcana-Player.jpg',
  title: 'Honey Lemon – Ingenious Researcher',
  fields: [
    ['Name', 'Honey Lemon'],
    ['Card Type', 'Character'],
    ['Version', 'Ingenious Researcher'],
    ['Ink Cost', '7'],
    ['Inkwell', 'Yes'],
    ['Strength', '4'],
    ['Willpower', '6'],
    ['Lore', '2'],
    ['Ink Color', 'Sapphire'],
    ['Rarity', 'Uncommon'],
    ['Card ID', '144/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Return From Discard Shift Gain Ink Drop'],
    ['Classifications', 'Dreamborn • Hero • Inventor • Super'],
    [
      'Card Text',
      [
        // lorcanaplayer drops the ⬡ after "Shift 5"; the card and the data print it.
        'Shift 5 (You may pay 5 ⬡ to play this on top of one of your characters named Honey Lemon.)',
        'SYNTHESIZE Whenever this character quests, you may return an item card from your discard to your hand. If you do, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡ .)',
      ],
    ],
    ['Flavor Text', ''],
    ['Illustrator', 'Fahed Alrajil'],
    ['Franchise', 'Big Hero 6'],
    ...dates,
  ],
};

export const CAPTAIN_HOOK = {
  slug: 'captain-hook-concerned-captain',
  imageFile: 'HC-EN-14-Captain-Hook-Concerned-Captain-LQ-Lorcana-Player.jpg',
  title: 'Captain Hook – Concerned Captain',
  fields: [
    ['Name', 'Captain Hook'],
    ['Card Type', 'Character'],
    ['Version', 'Concerned Captain'],
    ['Ink Cost', '8'],
    ['Inkwell', 'Yes'],
    ['Strength', '9'],
    ['Willpower', '9'],
    ['Lore', '2'],
    ['Ink Color', 'Emerald'],
    ['Rarity', 'Uncommon'],
    ['Card ID', ''],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'None'],
    ['Classifications', 'Dreamborn • Captain • Pirate • Villain'],
    ['Card Text', ''],
    ['Flavor Text', ''],
    ['Illustrator', 'Unknown'],
    ['Franchise', 'Peter Pan'],
    ...dates,
  ],
};

export const MULAN = {
  slug: 'mulan-martial-arts-master',
  imageFile: '127-204-EN-14-Mulan-Martial-Arts-Master-LQ-Lorcana-Player.jpg',
  title: 'Mulan – Martial Arts Master',
  fields: [
    ['Name', 'Mulan'],
    ['Card Type', 'Character'],
    ['Version', 'Martial Arts Master'],
    ['Ink Cost', '4'],
    ['Inkwell', 'Yes'],
    ['Strength', '2'],
    ['Willpower', '3'],
    ['Lore', '2'],
    ['Ink Color', 'Ruby'],
    ['Rarity', 'Legendary'],
    ['Card ID', '127/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Unknown'],
    ['Classifications', 'Dreamborn • Hero • Princess'],
    ['Card Text', ''],
    ['Flavor Text', ''],
    ['Illustrator', 'Arianna Rea'],
    ['Franchise', 'Mulan'],
    ...dates,
  ],
};

export const ON_THE_OPEN_ROAD = {
  slug: 'on-the-open-road',
  imageFile: '27-204-JA-14-On-the-Open-Road-Japanese-LQ-Lorcana-Player.jpg',
  title: 'On the Open Road',
  fields: [
    ['Name', 'On the Open Road'],
    ['Card Type', 'Action • Song'],
    ['Ink Cost', '5'],
    ['Inkwell', 'No'],
    ['Ink Color', 'Amber'],
    ['Rarity', 'Rare'],
    ['Card ID', '27/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Discard Reveal Hand'],
    ['Classifications', 'Action • Song'],
    [
      'Card Text',
      [
        '(A character with cost 5 or more can ⟳ to sing this song for free.)',
        'Chosen opponent reveals their hand and discards all non-character cards.',
      ],
    ],
    ['Flavor Text', ''],
    ['Illustrator', 'Alan Batson'],
    ['Franchise', 'A Goofy Movie'],
    ...dates,
  ],
};

export const HARBOR_LOCATION = {
  slug: 'test-harbor-dockside-warehouse',
  imageFile: '99-204-EN-14-Test-Harbor-Dockside-Warehouse-LQ-Lorcana-Player.jpg',
  title: 'Test Harbor – Dockside Warehouse',
  fields: [
    ['Name', 'Test Harbor'],
    ['Card Type', 'Location'],
    ['Version', 'Dockside Warehouse'],
    ['Ink Cost', '2'],
    ['Inkwell', 'Yes'],
    ['Willpower', '7'],
    ['Lore', '1'],
    ['Move Cost', '1'],
    ['Ink Color', 'Emerald'],
    ['Rarity', 'Common'],
    ['Card ID', '99/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Draw'],
    ['Classifications', 'Location'],
    ['Card Text', ['STORAGE Characters get +1 ¤ while here.']],
    ['Flavor Text', ''],
    ['Illustrator', 'Test Artist'],
    ['Franchise', 'Zootopia'],
    ...dates,
  ],
};

/** A clean reader: the JSON a vision agent returns when it reads the card correctly. */
export const readerFor = {
  ernesto: () => ({
    name: 'Ernesto de la Cruz',
    version: 'Idol of Millions',
    cost: 3,
    strength: 5,
    willpower: 3,
    lore: 1,
    inkColor: 'Ruby',
    type: 'Character',
    classifications: 'Storyborn • Villain',
    keywords: ['Singer 5'],
    cardText: [
      'Singer 5 (This character counts as cost 5 to sing songs.)',
      'TOP THE CHARTS While an opponent has a song card in their discard, this character gets +1 ◆.',
    ],
    collectorNumber: '118/204',
    illustrator: 'Mariana Moreno',
    // Both trial readers said inkable and guessed Uncommon; the card is neither.
    inkable: true,
    rarityGuess: 'a partly shaded circle, likely Uncommon',
    unreadable: [],
  }),
  honeyLemon: () => ({
    name: 'Honey Lemon',
    version: 'Ingenious Researcher',
    cost: 7,
    strength: 4,
    willpower: 6,
    lore: 2,
    inkColor: 'Sapphire',
    type: 'Character',
    classifications: 'Dreamborn • Super • Hero • [4th term illegible]',
    keywords: ['Shift 5'],
    cardText: [
      'Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of your characters named Honey Lemon.)',
      'SYNTHESIZE Whenever this character quests, you may return an item card from your discard to your hand. If you do, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)',
    ],
    collectorNumber: '144/204',
    illustrator: 'Fahed Alrajil',
    inkable: true,
    rarityGuess: 'open book icon',
    unreadable: ['classifications'],
  }),
  lionheart: () => ({
    name: 'LIONHEART',
    version: 'Cleaning Up the City',
    cost: 4,
    strength: 3,
    willpower: 5,
    lore: 1,
    inkColor: 'Sapphire',
    type: 'Character',
    classifications: 'Storyborn',
    keywords: ['Alert'],
    cardText: [
      'Alert (This character can challenge as if they had Evasive.)',
      'CIVIC DUTY 6 ⬡ – Remove all damage from chosen character or location.',
    ],
    collectorNumber: '147/204',
    illustrator: 'Alice Pisoni',
    inkable: true,
    rarityGuess: null,
    unreadable: [],
  }),
};

/** The reveal-season context the gates and adjudicator run against (Set 14). */
export const SET14 = {
  setName: 'Hyperia City',
  setNumber: 14,
  setTotal: 204,
  inkBlocks: {
    Amber: {first: 1, last: 34},
    Amethyst: {first: 35, last: 68},
    Emerald: {first: 69, last: 102},
    Ruby: {first: 103, last: 136},
    Sapphire: {first: 137, last: 170},
    Steel: {first: 171, last: 204},
  },
};
