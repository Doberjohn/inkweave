import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {canonicalizeCardLine, findGlyphWords} from 'inkweave-synergy-engine';

// Card text must already be in house style (#635): the engine's text patterns match glyphs
// only, so "pay 1 Ink less" silently cost Honey Lemon 14151 its Ramp group. reveal-admin and
// /fetch-reveals canonicalize before they commit, through the engine's cardTextStyle; this is
// the net behind them, and each failure names the card id, field and line.
//
// Every field is split into lines first: released fullTextSections hold line-wrap newlines
// inside a section, and a line is the unit house style is defined on.

interface CardAbility {
  fullText?: string;
  reminderText?: string;
  effect?: string;
}

interface Card {
  id: number;
  fullText?: string;
  fullTextSections?: string[];
  abilities?: CardAbility[];
}

interface TextLine {
  label: string;
  line: string;
}

function readCards(file: string): Card[] {
  const filePath = path.resolve(process.cwd(), 'public/data', file);
  return (JSON.parse(fs.readFileSync(filePath, 'utf8')) as {cards: Card[]}).cards;
}

/** Every text field of a card, as [field, value]. */
function textFields(card: Card): [string, string | undefined][] {
  return [
    ['fullText', card.fullText],
    ...(card.fullTextSections ?? []).map((s, i): [string, string] => [`fullTextSections[${i}]`, s]),
    ...(card.abilities ?? []).flatMap((a, i): [string, string | undefined][] => [
      [`abilities[${i}].fullText`, a.fullText],
      [`abilities[${i}].reminderText`, a.reminderText],
      [`abilities[${i}].effect`, a.effect],
    ]),
  ];
}

/** Every non-blank line of a card's text, labelled "<id> [<field>] <line>" for the failure list. */
function textLines(card: Card): TextLine[] {
  return textFields(card).flatMap(([field, value]) =>
    (value ?? '')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({label: `${card.id} [${field}] ${line}`, line})),
  );
}

const released = readCards('allCards.json').flatMap(textLines);
const preview = readCards('previewCards.json').flatMap(textLines);

// Released data only: previewCards.json is empty off season (cards: []), by design.
it('finds released card text to check, so a renamed field cannot pass vacuously', () => {
  expect(released.length).toBeGreaterThan(100);
});

describe.each([
  {file: 'allCards.json', lines: released},
  {file: 'previewCards.json', lines: preview},
])('$file card text', ({lines}) => {
  it('is a fixed point of house style', () => {
    const changed = lines.filter(({line}) => canonicalizeCardLine(line) !== line.trim());
    expect(changed.map(({label}) => label)).toEqual([]);
  });

  it('has no spelled-out Ink, Strength, Willpower or Lore outside a card name', () => {
    const leftover = lines.filter(({line}) => findGlyphWords(line).length > 0);
    expect(leftover.map(({label}) => label)).toEqual([]);
  });
});
