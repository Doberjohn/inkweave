/**
 * Test fixtures shaped like the real data this pipeline sees.
 *
 * `page()` builds the line array the browser flattener produces for a lorcanaplayer card
 * page: a header, the label/value table, then retailer and share links. The values come
 * from cards processed in the 2026-09-23 trial run, except the cards named "Test ...",
 * which are invented. Two of the trial's cards turned out to be leaks, never officially
 * revealed; invented cards with the same quirks replace them, so no leaked card text lives
 * in the repo. Flavour text is never included; the one fixture that has a flavour line
 * uses a placeholder to prove it is ignored.
 *
 * The reader objects are the JSON the vision agents returned in that trial, including
 * their real quirks (◆ for ◊, an illegible classification term). Their `language` key was
 * added when the reader prompt gained it (issue #574); every trial card was English. The
 * readers of the other invented cards are invented too.
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

/** Invented. Keeps two rendering gaps the site really has: a Shift header without its ⬡, and a space before ".)". */
export const TEST_INVENTOR = {
  slug: 'test-inventor-gadget-tinkerer',
  imageFile: '150-204-EN-14-Test-Inventor-Gadget-Tinkerer-LQ-Lorcana-Player.jpg',
  title: 'Test Inventor – Gadget Tinkerer',
  fields: [
    ['Name', 'Test Inventor'],
    ['Card Type', 'Character'],
    ['Version', 'Gadget Tinkerer'],
    ['Ink Cost', '6'],
    ['Inkwell', 'Yes'],
    ['Strength', '3'],
    ['Willpower', '5'],
    ['Lore', '2'],
    ['Ink Color', 'Sapphire'],
    ['Rarity', 'Uncommon'],
    ['Card ID', '150/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Shift Gain Ink Drop'],
    ['Classifications', 'Storyborn • Hero • Inventor • Ally'],
    [
      'Card Text',
      [
        // lorcanaplayer drops the ⬡ after "Shift 5"; the card and the data print it.
        'Shift 5 (You may pay 5 ⬡ to play this on top of one of your characters named Test Inventor.)',
        'WORKSHOP HOURS When you play this character, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡ .)',
      ],
    ],
    ['Flavor Text', ''],
    ['Illustrator', 'Test Artist'],
    ['Franchise', 'Zootopia'],
    ...dates,
  ],
};

/** Invented. A vanilla card whose page shows no collector number. */
export const TEST_CAPTAIN = {
  slug: 'test-captain-harbor-watch',
  imageFile: 'HC-EN-14-Test-Captain-Harbor-Watch-LQ-Lorcana-Player.jpg',
  title: 'Test Captain – Harbor Watch',
  fields: [
    ['Name', 'Test Captain'],
    ['Card Type', 'Character'],
    ['Version', 'Harbor Watch'],
    ['Ink Cost', '7'],
    ['Inkwell', 'Yes'],
    ['Strength', '6'],
    ['Willpower', '7'],
    ['Lore', '2'],
    ['Ink Color', 'Emerald'],
    ['Rarity', 'Uncommon'],
    ['Card ID', ''],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'None'],
    ['Classifications', 'Dreamborn • Captain • Pirate'],
    ['Card Text', ''],
    ['Flavor Text', ''],
    ['Illustrator', 'Unknown'],
    ['Franchise', 'Peter Pan'],
    ...dates,
  ],
};

/** Invented. A Strength-0 character: the site leaves the Strength row out of its page (issue #582). */
export const TEST_PUP = {
  slug: 'test-pup-tiny-troublemaker',
  imageFile: '40-204-EN-14-Test-Pup-Tiny-Troublemaker-LQ-Lorcana-Player.jpg',
  title: 'Test Pup – Tiny Troublemaker',
  fields: [
    ['Name', 'Test Pup'],
    ['Card Type', 'Character'],
    ['Version', 'Tiny Troublemaker'],
    ['Ink Cost', '1'],
    ['Inkwell', 'Yes'],
    ['Willpower', '2'],
    ['Lore', '1'],
    ['Ink Color', 'Amethyst'],
    ['Rarity', 'Common'],
    ['Card ID', '40/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Evasive'],
    ['Classifications', 'Storyborn • Ally'],
    ['Card Text', ['Evasive (Only characters with Evasive can challenge this character.)']],
    ['Flavor Text', ''],
    ['Illustrator', 'Test Artist'],
    ['Franchise', 'Zootopia'],
    ...dates,
  ],
};

/** Invented. Its text is complete, but the site's ability tags read "Unknown" (issue #582). */
export const TEST_SLEUTH = {
  slug: 'test-sleuth-caught-snooping',
  imageFile: '190-204-EN-14-Test-Sleuth-Caught-Snooping-LQ-Lorcana-Player.jpg',
  title: 'Test Sleuth – Caught Snooping',
  fields: [
    ['Name', 'Test Sleuth'],
    ['Card Type', 'Character'],
    ['Version', 'Caught Snooping'],
    ['Ink Cost', '2'],
    ['Inkwell', 'Yes'],
    ['Strength', '2'],
    ['Willpower', '2'],
    ['Lore', '1'],
    ['Ink Color', 'Steel'],
    ['Rarity', 'Uncommon'],
    ['Card ID', '190/204'],
    ['Set', 'Hyperia City'],
    ['Keywords + Abilities', 'Unknown'],
    ['Classifications', 'Storyborn • Detective'],
    [
      'Card Text',
      [
        'KEEN EYE When you play this character, look at the top card of your deck. You may put it on the bottom of your deck.',
      ],
    ],
    ['Flavor Text', ''],
    ['Illustrator', 'Test Artist'],
    ['Franchise', 'Zootopia'],
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
    language: 'EN',
    illustrator: 'Mariana Moreno',
    // Both trial readers said inkable and guessed Uncommon; the card is neither.
    inkable: true,
    rarityGuess: 'a partly shaded circle, likely Uncommon',
    unreadable: [],
  }),
  // Printed order differs from the site's, and the last term was illegible in the trial.
  testInventor: () => ({
    name: 'Test Inventor',
    version: 'Gadget Tinkerer',
    cost: 6,
    strength: 3,
    willpower: 5,
    lore: 2,
    inkColor: 'Sapphire',
    type: 'Character',
    classifications: 'Storyborn • Ally • Hero • [4th term illegible]',
    keywords: ['Shift 5'],
    cardText: [
      'Shift 5 ⬡ (You may pay 5 ⬡ to play this on top of one of your characters named Test Inventor.)',
      'WORKSHOP HOURS When you play this character, get 1 ink drop. (You may remove an ink drop to pay 1 ⬡.)',
    ],
    collectorNumber: '150/204',
    language: 'EN',
    illustrator: 'Test Artist',
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
    language: 'EN',
    illustrator: 'Alice Pisoni',
    inkable: true,
    rarityGuess: null,
    unreadable: [],
  }),
  testPup: () => ({
    name: 'Test Pup',
    version: 'Tiny Troublemaker',
    cost: 1,
    strength: 0,
    willpower: 2,
    lore: 1,
    inkColor: 'Amethyst',
    type: 'Character',
    classifications: 'Storyborn • Ally',
    keywords: ['Evasive'],
    cardText: ['Evasive (Only characters with Evasive can challenge this character.)'],
    collectorNumber: '40/204',
    language: 'EN',
    illustrator: 'Test Artist',
    inkable: true,
    rarityGuess: 'a plain circle, likely Common',
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
