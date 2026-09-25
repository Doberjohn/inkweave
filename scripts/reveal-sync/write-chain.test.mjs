/**
 * The skill writes through the same chain /admin/reveal uses. These tests run adjudicated
 * cards through the write step's own form (writtenForm) and the real TypeScript modules, so
 * a change to the reveal form's shape or its validation breaks here rather than silently
 * producing bad records.
 */
import {describe, it, expect} from 'vitest';
import {validateRevealCardForm} from '../../apps/web/src/features/reveal-admin/validateForm.ts';
import {buildPreviewCard} from '../../apps/web/src/features/reveal-admin/buildPreviewCard.ts';
import {insertCardIntoPreviewJson} from '../../apps/web/src/features/reveal-admin/insertCardIntoPreviewJson.ts';
import {adjudicate} from './adjudicate.mjs';
import {parseCardLines} from './extract-card.mjs';
import {writtenForm} from './write.mjs';
import {
  ERNESTO,
  LIONHEART,
  TEST_CHLOE,
  TEST_INVENTOR,
  TEST_PUP,
  page,
  readerFor,
} from './__fixtures__/cards.mjs';

const formFor = (card, reader) => {
  const site = parseCardLines(page(card), {slug: card.slug, imageFile: card.imageFile});
  return writtenForm(adjudicate(site, [reader]).card);
};

describe('the reveal write chain accepts adjudicated cards', () => {
  it('validates each adjudicated form', () => {
    for (const [card, reader] of [
      [ERNESTO, readerFor.ernesto()],
      [TEST_INVENTOR, readerFor.testInventor()],
      [LIONHEART, readerFor.lionheart()],
    ]) {
      expect(validateRevealCardForm(formFor(card, reader), new Set(), 'card.jpg')).toEqual({
        ok: true,
        errors: {},
      });
    }
  });

  it('builds the preview card the site and the image agreed on', () => {
    expect(buildPreviewCard(formFor(ERNESTO, readerFor.ernesto()))).toMatchObject({
      id: 14118,
      fullName: 'Ernesto de la Cruz - Idol of Millions',
      color: 'Ruby',
      inkwell: false,
      rarity: 'Common',
      franchise: 'Coco',
      subtypes: ['Storyborn', 'Villain'],
      abilities: [{type: 'keyword', keyword: 'Singer', keywordValue: '5', fullText: 'Singer 5'}],
      strength: 5,
      willpower: 3,
      lore: 1,
    });
  });

  it('writes a character whose page had no Strength row with Strength 0', () => {
    const form = formFor(TEST_PUP, readerFor.testPup());
    expect(validateRevealCardForm(form, new Set(), 'card.jpg').ok).toBe(true);
    expect(buildPreviewCard(form)).toMatchObject({id: 14040, strength: 0, willpower: 2, lore: 1});
  });

  it('writes names, and the names its text refers to, without accents', () => {
    expect(buildPreviewCard(formFor(TEST_CHLOE, readerFor.testChloe()))).toMatchObject({
      name: 'Test Chloe',
      version: 'Cafe Owner',
      fullName: 'Test Chloe - Cafe Owner',
      fullTextSections: [
        'Shift 4 ⬡ (You may pay 4 ⬡ to play this on top of one of your characters named Test Chloe.)',
        '¡OLÉ! Whenever you play a character named Test Chloe or Test Zoe, gain 1 lore.',
      ],
      abilities: [{type: 'keyword', keyword: 'Shift', keywordValue: '4', fullText: 'Shift 4'}],
    });
  });

  it('refuses a card whose id is already in the preview data', () => {
    const {errors} = validateRevealCardForm(
      formFor(ERNESTO, readerFor.ernesto()),
      new Set([14118]),
      'card.jpg',
    );
    expect(errors.collectorNumber).toMatch(/already exists/);
  });

  it('appends the built card to a previewCards.json text', () => {
    const before = `{\n  "sets": {},\n  "cards": []\n}\n`;
    const after = JSON.parse(
      insertCardIntoPreviewJson(
        before,
        buildPreviewCard(formFor(TEST_INVENTOR, readerFor.testInventor())),
      ),
    );
    expect(after.cards).toHaveLength(1);
    expect(after.cards[0]).toMatchObject({
      id: 14150,
      subtypes: ['Storyborn', 'Ally', 'Hero', 'Inventor'],
    });
  });
});
