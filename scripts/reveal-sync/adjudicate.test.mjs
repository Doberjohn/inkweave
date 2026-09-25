import {describe, it, expect} from 'vitest';
import {RulingError, adjudicate, parseReaderResult, toRevealForm} from './adjudicate.mjs';
import {parseCardLines} from './extract-card.mjs';
import {
  ERNESTO,
  LIONHEART,
  ON_THE_OPEN_ROAD,
  TEST_INVENTOR,
  TEST_PUP,
  page,
  readerFor,
} from './__fixtures__/cards.mjs';

const site = (card, patch) =>
  parseCardLines(page(card, patch), {slug: card.slug, imageFile: card.imageFile});
const withReader = (make, change = {}) => ({...make(), ...change});

describe('adjudicate: one reader', () => {
  it('writes a card when the reader agrees with the site on every checked field', () => {
    const result = adjudicate(site(ERNESTO), [readerFor.ernesto()]);
    expect(result.decision).toBe('write');
    expect(result.conflicts).toEqual([]);
  });

  it('takes inkable and rarity from the site even when the reader disagrees (the Ernesto case)', () => {
    // Both trial readers said inkable and guessed Uncommon. The card is uninkable and Common.
    const {card} = adjudicate(site(ERNESTO), [readerFor.ernesto()]);
    expect(card.inkwell).toBe(false);
    expect(card.rarity).toBe('Common');
  });

  it('writes the card text in house style with the glyph the data uses', () => {
    const {card} = adjudicate(site(ERNESTO), [readerFor.ernesto()]);
    expect(card.text[1]).toBe(
      'TOP THE CHARTS While an opponent has a song card in their discard, this character gets +1 ◊.',
    );
    expect(card.keywords).toEqual(['Singer 5']);
  });

  it("agrees on a Shift line once the site's missing glyph is restored", () => {
    const {decision, card} = adjudicate(site(TEST_INVENTOR), [readerFor.testInventor()]);
    expect(decision).toBe('write');
    expect(card.text[0]).toMatch(/^Shift 5 ⬡ \(/);
    expect(card.keywords).toEqual(['Shift 5']);
  });

  it('keeps the printed subtype order and lets the site fill a term the image could not read', () => {
    const result = adjudicate(site(TEST_INVENTOR), [readerFor.testInventor()]);
    expect(result.card.subtypes).toEqual(['Storyborn', 'Ally', 'Hero', 'Inventor']);
    expect(result.notes.join(' ')).toMatch(/subtypes/);
  });

  it("uses the site's spelling for names a reader transcribed in capitals", () => {
    expect(adjudicate(site(LIONHEART), [readerFor.lionheart()]).card.name).toBe('Lionheart');
  });

  it('asks for two more readers when the reader disagrees on a checked field', () => {
    const reader = withReader(readerFor.lionheart, {version: 'Tidying Up the Town'});
    expect(adjudicate(site(LIONHEART), [reader])).toMatchObject({
      decision: 'escalate',
      needReaders: 2,
    });
  });

  it('checks the 0 a missing Strength row reads as against the scan', () => {
    // A reader who sees 0 confirms it; one who sees anything else asks for two more readers.
    expect(adjudicate(site(TEST_PUP), [readerFor.testPup()]).decision).toBe('write');
    const reader = withReader(readerFor.testPup, {strength: 2});
    expect(adjudicate(site(TEST_PUP), [reader])).toMatchObject({
      decision: 'escalate',
      needReaders: 2,
    });
  });

  it('asks for more readers when the reader could not read the card text', () => {
    const reader = withReader(readerFor.lionheart, {cardText: null, unreadable: ['cardText']});
    expect(adjudicate(site(LIONHEART), [reader]).decision).toBe('escalate');
  });
});

describe('adjudicate: after escalation', () => {
  it('writes when the site and two of three readers agree, noting the dissent', () => {
    const dissent = withReader(readerFor.lionheart, {version: 'Tidying Up the Town'});
    const result = adjudicate(site(LIONHEART), [
      dissent,
      readerFor.lionheart(),
      readerFor.lionheart(),
    ]);
    expect(result.decision).toBe('write');
    expect(result.card.version).toBe('Cleaning Up the City');
    expect(result.notes.join(' ')).toMatch(/version: 1 of 3 readers disagreed/);
  });

  it('never lets readers overrule the site on an identity field: a conflict instead', () => {
    const renamed = () => withReader(readerFor.lionheart, {version: 'Tidying Up the Town'});
    const result = adjudicate(site(LIONHEART), [renamed(), renamed(), renamed()]);
    expect(result.decision).toBe('conflict');
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({field: 'version', site: 'Cleaning Up the City'}),
    );
    expect(result.card).toBeNull();
  });

  it('lets a majority of readers overrule the site on a printed stat', () => {
    const stronger = () => withReader(readerFor.lionheart, {strength: 4});
    const result = adjudicate(site(LIONHEART), [stronger(), stronger(), readerFor.lionheart()]);
    expect(result.decision).toBe('write');
    expect(result.card.strength).toBe(4);
    expect(result.notes.join(' ')).toMatch(/strength: readers overrode the site/);
  });

  it('reports a conflict when the readers split with no majority', () => {
    const readers = [4, 6, 7].map((strength) => withReader(readerFor.lionheart, {strength}));
    expect(adjudicate(site(LIONHEART), readers)).toMatchObject({decision: 'conflict'});
  });

  it('waits for a third reader rather than calling a conflict on two that split', () => {
    const readers = [withReader(readerFor.lionheart, {strength: 4}), readerFor.lionheart()];
    expect(adjudicate(site(LIONHEART), readers)).toMatchObject({
      decision: 'escalate',
      needReaders: 1,
    });
  });

  it("applies the owner's ruling to settle a conflict", () => {
    const renamed = () => withReader(readerFor.lionheart, {version: 'Tidying Up the Town'});
    const result = adjudicate(site(LIONHEART), [renamed(), renamed(), renamed()], {
      overrides: {version: 'site'},
    });
    expect(result.decision).toBe('write');
    expect(result.card.version).toBe('Cleaning Up the City');
    expect(result.notes.join(' ')).toMatch(/version: resolved by the owner/);
  });
});

describe('adjudicate: readings that must never count as agreement', () => {
  it('treats a missing classification line as no reading, even when the reader did not flag it', () => {
    const reader = withReader(readerFor.lionheart, {classifications: null, unreadable: []});
    const result = adjudicate(site(LIONHEART), [reader]);
    expect(result.decision).toBe('conflict');
    expect(result.card).toBeNull();
  });

  it('treats a line of placeholders as no reading, not as "no subtypes"', () => {
    const reader = withReader(readerFor.ernesto, {classifications: '[illegible]', unreadable: []});
    expect(adjudicate(site(ERNESTO), [reader]).decision).toBe('conflict');
  });

  it('does not let a repeated term pass for a different line of the same length', () => {
    // "Storyborn, Storyborn" has two terms, both on the site's two-term list, but it is not
    // the site's "Storyborn • Villain".
    const reader = withReader(readerFor.ernesto, {classifications: 'Storyborn, Storyborn'});
    expect(adjudicate(site(ERNESTO), [reader]).decision).toBe('escalate');
  });

  it('never writes a subtype twice', () => {
    const repeated = withReader(readerFor.ernesto, {
      classifications: 'Storyborn, Villain, Storyborn',
    });
    expect(adjudicate(site(ERNESTO), [repeated]).card.subtypes).toEqual(['Storyborn', 'Villain']);
  });

  it("never lets empty subtype readings strip the site's subtypes", () => {
    const blank = () =>
      withReader(readerFor.ernesto, {classifications: '[illegible]', unreadable: []});
    const result = adjudicate(site(ERNESTO), [blank(), blank(), blank()]);
    expect(result.decision).toBe('conflict');
    expect(result.card).toBeNull();
  });

  it('never lets readers who saw no text turn a card into a vanilla one', () => {
    const blank = () => withReader(readerFor.ernesto, {cardText: []});
    expect(adjudicate(site(ERNESTO), [blank(), blank(), blank()])).toMatchObject({
      decision: 'conflict',
      card: null,
    });
  });

  it('does not match an unreadable version to a card that has one', () => {
    const reader = withReader(readerFor.lionheart, {version: null, unreadable: ['version']});
    expect(adjudicate(site(LIONHEART), [reader]).decision).toBe('escalate');
  });

  it('accepts an action without a version, whatever the reader says about one', () => {
    const reader = {
      name: 'On the Open Road',
      version: null,
      cost: 5,
      inkColor: 'Amber',
      type: 'Action',
      classifications: 'Action • Song',
      keywords: [],
      cardText: [
        '(A character with cost 5 or more can ⟳ to sing this song for free.)',
        'Chosen opponent reveals their hand and discards all non-character cards.',
      ],
      collectorNumber: '27/204',
      language: 'EN',
      unreadable: [],
    };
    const result = adjudicate(site(ON_THE_OPEN_ROAD), [reader]);
    expect(result.decision).toBe('write');
    expect(result.card).toMatchObject({version: null, subtypes: ['Song']});
  });

  it('writes a majority text only when the majority agrees on its line structure', () => {
    // The site's text has a typo, so no reader agrees with it. One reader merged the two
    // abilities into a single line; the two that kept them apart must be the ones written,
    // or the Singer keyword on the merged line would be lost.
    const lines = readerFor.ernesto().cardText;
    const merged = withReader(readerFor.ernesto, {cardText: [lines.join(' ')]});
    const typo = {'Card Text': [lines[0], lines[1].replace('opponent', 'oponent')]};
    const result = adjudicate(site(ERNESTO, typo), [
      merged,
      readerFor.ernesto(),
      readerFor.ernesto(),
    ]);
    expect(result.decision).toBe('write');
    expect(result.card.text).toHaveLength(2);
    expect(result.card.keywords).toEqual(['Singer 5']);
  });
});

describe('adjudicate: fields no reader could read', () => {
  it('sends unreadable classifications straight to the owner, with the site value shown', () => {
    const reader = withReader(readerFor.testInventor, {
      classifications: null,
      unreadable: ['classifications'],
    });
    const result = adjudicate(site(TEST_INVENTOR), [reader]);
    expect(result).toMatchObject({decision: 'conflict', needReaders: 0});
    expect(result.conflicts).toEqual([
      {field: 'subtypes', site: ['Storyborn', 'Hero', 'Inventor', 'Ally'], readers: [null]},
    ]);
  });

  it('sends an unreadable stat straight to the owner', () => {
    const reader = withReader(readerFor.lionheart, {lore: null, unreadable: ['lore']});
    expect(adjudicate(site(LIONHEART), [reader])).toMatchObject({
      decision: 'conflict',
      conflicts: [{field: 'lore', site: 1, readers: [null]}],
    });
  });

  it('still asks two more readers when a stat is read differently, not unreadable', () => {
    const reader = withReader(readerFor.lionheart, {lore: 2});
    expect(adjudicate(site(LIONHEART), [reader])).toMatchObject({
      decision: 'escalate',
      needReaders: 2,
    });
  });

  it('still asks two more readers when card text or an identity field is unreadable', () => {
    const noText = withReader(readerFor.lionheart, {cardText: null, unreadable: ['cardText']});
    const noNumber = withReader(readerFor.lionheart, {collectorNumber: null});
    expect(adjudicate(site(LIONHEART), [noText]).decision).toBe('escalate');
    expect(adjudicate(site(LIONHEART), [noNumber]).decision).toBe('escalate');
  });

  it("settles an unreadable field with the owner's ruling for the site's value", () => {
    const reader = withReader(readerFor.lionheart, {lore: null, unreadable: ['lore']});
    const result = adjudicate(site(LIONHEART), [reader], {overrides: {lore: 'site'}});
    expect(result.decision).toBe('write');
    expect(result.card.lore).toBe(1);
  });
});

describe("adjudicate: the owner's rulings", () => {
  const renamed = () => withReader(readerFor.lionheart, {strength: 4});
  const split = () => [
    renamed(),
    withReader(readerFor.lionheart, {strength: 6}),
    withReader(readerFor.lionheart, {strength: 7}),
  ];

  it('refuses a ruling that does not parse, rather than writing the field blank', () => {
    const rule = () => adjudicate(site(LIONHEART), split(), {overrides: {strength: 'seven'}});
    expect(rule).toThrow(/cannot read the ruling "seven" as a strength/);
    // A RulingError is the owner's to fix; the command line prints it as a message.
    expect(rule).toThrow(RulingError);
  });

  it('records the parsed value in the note', () => {
    const result = adjudicate(site(LIONHEART), split(), {overrides: {strength: '6'}});
    expect(result.card.strength).toBe(6);
    expect(result.notes.join(' ')).toContain('strength: resolved by the owner (6)');
  });

  it('reads a typed "\\n" in a text ruling as a line break', () => {
    const split3 = [1, 2, 3].map((n) =>
      withReader(readerFor.lionheart, {cardText: [`reading ${n}`]}),
    );
    const result = adjudicate(site(LIONHEART), split3, {
      overrides: {text: 'Alert (reminder.)\\nCIVIC DUTY 6 ⬡ – Remove all damage.'},
    });
    expect(result.card.text).toEqual(['Alert (reminder.)', 'CIVIC DUTY 6 ⬡ — Remove all damage.']);
    expect(result.card.keywords).toEqual(['Alert']);
  });
});

describe('adjudicate: the printed language', () => {
  it('defers a card a reader reads as not English, before comparing anything', () => {
    const reader = withReader(readerFor.lionheart, {language: 'FR'});
    expect(adjudicate(site(LIONHEART), [reader])).toMatchObject({
      decision: 'defer',
      reason: 'scan-not-english',
      detail: 'printed language FR',
      card: null,
    });
  });

  it('defers on any other language, however the reader wrote it', () => {
    for (const [language, printed] of [
      ['French', 'FRENCH'],
      ['fr-FR', 'FR-FR'],
      ['ja', 'JA'],
    ]) {
      const reader = withReader(readerFor.lionheart, {language});
      expect(adjudicate(site(LIONHEART), [reader])).toMatchObject({
        decision: 'defer',
        detail: `printed language ${printed}`,
      });
    }
  });

  it('reads English in any spelling', () => {
    for (const language of ['en', 'EN', 'en-US', 'English', 'eng']) {
      const reader = withReader(readerFor.lionheart, {language});
      expect(adjudicate(site(LIONHEART), [reader]).decision).toBe('write');
    }
  });

  it('asks two more readers when the reader could not read the language', () => {
    for (const language of [null, undefined, '']) {
      const reader = withReader(readerFor.lionheart, {language});
      expect(adjudicate(site(LIONHEART), [reader])).toMatchObject({
        decision: 'escalate',
        needReaders: 2,
      });
    }
  });

  it('leaves a language no reader could read to the owner, who can rule the card English', () => {
    const unread = () => withReader(readerFor.lionheart, {language: null});
    const readers = [unread(), unread(), unread()];
    const result = adjudicate(site(LIONHEART), readers);
    expect(result.decision).toBe('conflict');
    expect(result.conflicts).toEqual([
      {field: 'language', site: 'EN', readers: [null, null, null]},
    ]);
    const ruled = adjudicate(site(LIONHEART), readers, {overrides: {language: 'site'}});
    expect(ruled.decision).toBe('write');
  });
});

describe('adjudicate: the official list as a second source for the version', () => {
  // lorcanaplayer prints "Great Stomper"; the official list and the card say "Big Stomper".
  const fred = () =>
    site(LIONHEART, {
      'Card ID': '91/204',
      Name: 'Fred',
      Version: 'Great Stomper',
      'Ink Color': 'Emerald',
    });
  const official = {name: 'Fred', version: 'Big Stomper', number: 91};
  const reading = (version) =>
    withReader(readerFor.lionheart, {
      name: 'Fred',
      version,
      inkColor: 'Emerald',
      collectorNumber: '91/204',
    });

  it('asks for three readers when the two sites disagree, even if the first agrees with one', () => {
    expect(adjudicate(fred(), [reading('Great Stomper')], {official})).toMatchObject({
      decision: 'escalate',
      needReaders: 2,
    });
  });

  it('writes the version two of three readers read, noting what lorcanaplayer had', () => {
    const result = adjudicate(
      fred(),
      [reading('Big Stomper'), reading('Big Stomper'), reading('Great Stomper')],
      {official},
    );
    expect(result.decision).toBe('write');
    expect(result.card.version).toBe('Big Stomper');
    expect(result.notes).toContain(
      'version: from the official list and the card; lorcanaplayer had "Great Stomper"',
    );
  });

  it("keeps lorcanaplayer's version when two of three readers read that, noting the official one", () => {
    const result = adjudicate(
      fred(),
      [reading('Great Stomper'), reading('Great Stomper'), reading('Great Stomper')],
      {official},
    );
    expect(result.card.version).toBe('Great Stomper');
    expect(result.notes).toContain(
      'version: the card and lorcanaplayer agree on "Great Stomper"; the official list has "Big Stomper"',
    );
  });

  it('leaves the version to the owner when the readers split, showing both sites', () => {
    const result = adjudicate(
      fred(),
      [reading('Big Stomper'), reading('Great Stomper'), reading('Mighty Stomper')],
      {official},
    );
    expect(result.decision).toBe('conflict');
    expect(result.conflicts).toContainEqual({
      field: 'version',
      site: 'Great Stomper',
      official: 'Big Stomper',
      readers: ['Big Stomper', 'Great Stomper', 'Mighty Stomper'],
    });
  });

  it('takes a ruling of "official" for the official value', () => {
    const result = adjudicate(
      fred(),
      [reading('Big Stomper'), reading('Great Stomper'), reading('Mighty Stomper')],
      {official, overrides: {version: 'official'}},
    );
    expect(result.card.version).toBe('Big Stomper');
    expect(result.notes.join(' ')).toContain(
      "version: resolved by the owner (the official list's value)",
    );
  });

  it('refuses a ruling of "official" on a field the official list does not carry', () => {
    const split = [4, 6, 7].map((strength) => withReader(readerFor.lionheart, {strength}));
    expect(() =>
      adjudicate(site(LIONHEART), split, {official, overrides: {strength: 'official'}}),
    ).toThrow(/the official list has no strength/);
  });

  it('takes a ruling of "official" for the ink and type it carries', () => {
    const inks = ['Amber', 'Ruby', 'Steel'].map((inkColor) =>
      withReader(readerFor.lionheart, {inkColor}),
    );
    const withInk = {
      name: 'Lionheart',
      version: 'Cleaning Up the City',
      number: 147,
      ink: ['Sapphire'],
      type: 'Character',
    };
    const result = adjudicate(site(LIONHEART), inks, {
      official: withInk,
      overrides: {ink: 'official'},
    });
    expect(result.card.inks).toEqual(['Sapphire']);
  });

  it('keeps the one-reader rule when the two sites agree', () => {
    const agreeing = {name: 'Lionheart', version: 'Cleaning Up the City', number: 147};
    expect(
      adjudicate(site(LIONHEART), [readerFor.lionheart()], {official: agreeing}).decision,
    ).toBe('write');
  });
});

describe('parseReaderResult', () => {
  it('reads a JSON object, with or without a code fence around it', () => {
    expect(parseReaderResult('{"name":"Mulan"}')).toEqual({name: 'Mulan'});
    expect(parseReaderResult('```json\n{"name":"Mulan"}\n```')).toEqual({name: 'Mulan'});
  });

  it('rejects anything that is not a plain object', () => {
    for (const text of ['null', '[1, 2]', '"{\\"name\\":\\"Mulan\\"}"', 'not json']) {
      expect(() => parseReaderResult(text)).toThrow();
    }
  });
});

describe('toRevealForm', () => {
  it("fills the reveal form's fields the way the admin form would", () => {
    const {card} = adjudicate(site(ERNESTO), [readerFor.ernesto()]);
    expect(toRevealForm(card)).toEqual({
      collectorNumber: '118',
      name: 'Ernesto de la Cruz',
      version: 'Idol of Millions',
      rarity: 'Common',
      franchise: 'Coco',
      cost: '3',
      ink: 'Ruby',
      ink2: '',
      inkwell: false,
      type: 'Character',
      strength: '5',
      willpower: '3',
      lore: '1',
      moveCost: '',
      subtypes: 'Storyborn, Villain',
      keywords: 'Singer 5',
      fullText:
        'Singer 5 (This character counts as cost 5 to sing songs.)\nTOP THE CHARTS While an opponent has a song card in their discard, this character gets +1 ◊.',
    });
  });
});
