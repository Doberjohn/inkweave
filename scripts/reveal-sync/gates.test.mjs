import {describe, it, expect} from 'vitest';
import {existingVerdict, gateCard, scanLanguage} from './gates.mjs';
import {parseCardLines} from './extract-card.mjs';
import {
  ERNESTO,
  HARBOR_LOCATION,
  LIONHEART,
  MULAN,
  ON_THE_OPEN_ROAD,
  SET14,
  TEST_CAPTAIN,
  page,
} from './__fixtures__/cards.mjs';

const site = (card, patch = {}, imageFile = card.imageFile) =>
  parseCardLines(page(card, patch), {slug: card.slug, imageFile});
const gate = (...args) => gateCard(site(...args), SET14);

describe('scanLanguage', () => {
  it("reads the scan's language from the uploaded image's filename", () => {
    expect(scanLanguage(LIONHEART.imageFile, 14)).toBe('EN');
    expect(scanLanguage(ON_THE_OPEN_ROAD.imageFile, 14)).toBe('JA');
    expect(scanLanguage(TEST_CAPTAIN.imageFile, 14)).toBe('EN');
  });

  it('returns null when the filename carries no language marker', () => {
    expect(scanLanguage('lionheart.jpg', 14)).toBeNull();
  });
});

describe('gateCard', () => {
  it('passes a complete English card', () => {
    expect(gate(LIONHEART)).toEqual({status: 'pass'});
    expect(gate(ERNESTO)).toEqual({status: 'pass'});
  });

  it('skips a card from another set', () => {
    expect(gate(LIONHEART, {Set: 'Into the Inkdark'})).toMatchObject({
      status: 'skipped',
      reason: 'wrong-set',
    });
  });

  it('skips a rarity outside the five the dataset uses', () => {
    expect(gate(LIONHEART, {Rarity: 'Enchanted'})).toMatchObject({
      status: 'skipped',
      reason: 'rarity-excluded',
    });
  });

  it('defers a card whose only scan is not English, rather than translating it', () => {
    expect(gate(ON_THE_OPEN_ROAD)).toMatchObject({
      status: 'deferred',
      reason: 'scan-not-english',
      detail: 'JA',
    });
  });

  it('defers a card whose scan language cannot be determined', () => {
    expect(gate(LIONHEART, {}, 'lionheart.jpg')).toMatchObject({
      status: 'deferred',
      reason: 'language-unknown',
    });
  });

  it('defers a card the site lists with Unknown abilities', () => {
    expect(gate(MULAN)).toMatchObject({status: 'deferred', reason: 'site-record-incomplete'});
  });

  it('defers a card with no card text unless the site says it has no abilities', () => {
    expect(gate(LIONHEART, {'Card Text': ''})).toMatchObject({
      status: 'deferred',
      reason: 'site-record-incomplete',
    });
  });

  it('lets a genuinely vanilla card through the completeness gate', () => {
    // The card reads "None" with no text: vanilla, not incomplete. It stops at the next
    // gate, for its missing number, not here.
    expect(gate(TEST_CAPTAIN)).not.toMatchObject({reason: 'site-record-incomplete'});
  });

  it('defers a card whose inkable status the site does not know', () => {
    expect(gate(LIONHEART, {Inkwell: 'Unknown'})).toMatchObject({
      status: 'deferred',
      reason: 'site-record-incomplete',
    });
  });

  it('flags a card with no readable collector number for the reserved band', () => {
    expect(gate(TEST_CAPTAIN)).toMatchObject({status: 'conflict', reason: 'needs-reserved-band'});
  });

  it('skips a number past the end of the set', () => {
    expect(gate(LIONHEART, {'Card ID': '223/204'})).toMatchObject({
      status: 'skipped',
      reason: 'outside-set-numbering',
    });
  });

  it("flags an ink that disagrees with the collector number's block", () => {
    expect(gate(ERNESTO, {'Ink Color': 'Amber'})).toMatchObject({
      status: 'conflict',
      reason: 'ink-block-mismatch',
    });
  });

  it("checks a dual-ink card against its first ink's block", () => {
    expect(gate(ERNESTO, {'Ink Color': 'Ruby / Amber'})).toEqual({status: 'pass'});
    expect(gate(ERNESTO, {'Ink Color': 'Amber / Ruby'})).toMatchObject({
      reason: 'ink-block-mismatch',
    });
  });

  it('defers a character or location whose version is blank on the site', () => {
    expect(gate(LIONHEART, {Version: ''})).toMatchObject({
      status: 'deferred',
      reason: 'site-record-incomplete',
      detail: 'version missing',
    });
    expect(gate(HARBOR_LOCATION, {Version: ''})).toMatchObject({detail: 'version missing'});
  });

  it('defers a character with no classifications, including the site\'s "Unknown"', () => {
    for (const value of ['', 'Unknown']) {
      expect(gate(LIONHEART, {Classifications: value})).toMatchObject({
        status: 'deferred',
        detail: 'classifications missing',
      });
    }
  });
});

describe('existingVerdict', () => {
  const lionheart = () => site(LIONHEART);
  const card = (number, name, id = 14000 + (number ?? 901)) => ({id, number, name});

  it('knows a card already in Inkweave under the same number and name', () => {
    expect(existingVerdict(lionheart(), [card(147, 'Lionheart - Cleaning Up the City')])).toEqual({
      status: 'known',
    });
  });

  it('matches names without regard to accents or case', () => {
    expect(existingVerdict(lionheart(), [card(147, 'LIONHÉART - cleaning up the city')])).toEqual({
      status: 'known',
    });
  });

  it('treats a card as new when neither its number nor its name is in Inkweave', () => {
    expect(existingVerdict(lionheart(), [card(21, 'Miguel Rivera - Street Musician')])).toBeNull();
  });

  it('flags a number Inkweave already uses for a different card, rather than skipping it', () => {
    // Treating #147 as "already in" would hide the site's real #147 forever.
    expect(existingVerdict(lionheart(), [card(147, 'Bellwether - Super Capable')])).toMatchObject({
      status: 'conflict',
      reason: 'number-taken',
    });
  });

  it('flags a card added by hand in the reserved band instead of writing it a second time', () => {
    // The site now shows #147; Inkweave has the same card as 14901 with no number.
    const handAdded = card(null, 'Lionheart - Cleaning Up the City', 14901);
    expect(existingVerdict(lionheart(), [handAdded])).toMatchObject({
      status: 'conflict',
      reason: 'in-reserved-band',
    });
  });

  it('flags a card Inkweave holds under a different number', () => {
    expect(
      existingVerdict(lionheart(), [card(148, 'Lionheart - Cleaning Up the City')]),
    ).toMatchObject({status: 'conflict', reason: 'name-taken'});
  });

  it('recognises a numberless site card that is already in Inkweave by name', () => {
    const numberless = site(TEST_CAPTAIN);
    expect(
      existingVerdict(numberless, [card(null, 'Test Captain - Harbor Watch', 14901)]),
    ).toMatchObject({
      reason: 'in-reserved-band',
    });
  });
});
