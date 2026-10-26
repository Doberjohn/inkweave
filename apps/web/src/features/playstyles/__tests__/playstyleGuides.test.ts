import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  isCoreSet,
  synergyEngine,
  transformCards,
  type LorcanaJSONCard,
  type PlaystyleId,
} from 'inkweave-synergy-engine';
import {getAllPlaystyles} from '../../synergies/engineCatalog';
import type {PlaystyleGuide} from '../playstyleGuides';

function readData<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data', file), 'utf8')) as T;
}

// At module scope: the card list is large, and a cold read can outlast a test's timeout (#712).
const guides = Object.entries(readData<Record<string, PlaystyleGuide>>('playstyleGuides.json'));
// The cards precompute hands the engine, so each playstyle's cards here are its _playstyles.json list.
const pool = transformCards(
  ['allCards.json', 'previewCards.json']
    .flatMap((file) => readData<{cards: LorcanaJSONCard[]}>(file).cards)
    .filter((c) => isCoreSet(c.setCode)),
);
const playstyleCardIds = (id: string) =>
  new Set(synergyEngine.getPlaystyleCards(id as PlaystyleId, pool).map((c) => c.id));

const wordCount = (text: string) => text.trim().split(/\s+/).length;

describe('playstyleGuides.json (#995)', () => {
  it('has a guide for every playstyle, and for nothing else', () => {
    const playstyleIds = getAllPlaystyles().map((p) => p.id);
    expect(guides.map(([id]) => id).sort()).toEqual(playstyleIds.sort());
  });

  it('gives each guide two paragraphs of 60 to 100 words', () => {
    const offenders = guides.flatMap(([id, {paragraphs}]) => {
      if (paragraphs.length !== 2) return [`${id}: ${paragraphs.length} paragraphs`];
      return paragraphs
        .map((text, i) => ({i, words: wordCount(text)}))
        .filter(({words}) => words < 60 || words > 100)
        .map(({i, words}) => `${id}: paragraph ${i + 1} has ${words} words`);
    });
    expect(offenders).toEqual([]);
  });

  // The page leaves out a key card its playstyle no longer holds, so a rule change that drops one
  // turns this red instead of quietly shortening the guide.
  it("lists 4 to 6 distinct key cards in each guide, each among its playstyle's cards", () => {
    const offenders = guides.flatMap(([id, {keyCards}]) => {
      const cards = playstyleCardIds(id);
      return [
        ...(keyCards.length < 4 || keyCards.length > 6
          ? [`${id}: ${keyCards.length} key cards`]
          : []),
        ...(new Set(keyCards).size < keyCards.length ? [`${id}: a key card listed twice`] : []),
        ...keyCards
          .filter((card) => !cards.has(card))
          .map((card) => `${id}: ${card} is not one of its cards`),
      ];
    });
    expect(offenders).toEqual([]);
  });
});
