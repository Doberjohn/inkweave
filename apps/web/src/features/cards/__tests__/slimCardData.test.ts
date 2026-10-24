import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {slimRawCard, transformCard} from 'inkweave-synergy-engine/card';
import type {LorcanaJSONCard} from 'inkweave-synergy-engine';

// The web build ships the card data slimmed (#929), so slimming must lose nothing the app reads.
const DATA = path.resolve(process.cwd(), 'public/data');

function readCards(file: string): LorcanaJSONCard[] {
  const data = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')) as LorcanaJSONCard[] | {cards: LorcanaJSONCard[]};
  return Array.isArray(data) ? data : data.cards;
}

const FILES = [
  'allCards.json',
  'previewCards.json',
  // The set chunks. promos.json holds printings of other cards, which carry no card text.
  ...fs.readdirSync(path.join(DATA, 'collection')).filter((f) => /^\d+\.json$/.test(f)).map((f) => `collection/${f}`),
];

describe('slimmed card data', () => {
  it.each(FILES)('%s: every card transforms the same once slimmed', (file) => {
    const changed = readCards(file).filter(
      (card) => JSON.stringify(transformCard(slimRawCard(card))) !== JSON.stringify(transformCard(card)),
    );
    expect(changed.map((card) => `${card.id} ${card.fullName}`)).toEqual([]);
  });
});
