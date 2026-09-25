import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {insertCardIntoPreviewJson} from '../insertCardIntoPreviewJson';
import type {LorcanaJSONCard} from 'inkweave-synergy-engine';

// The shape previewCards.json is left in after a set graduates: no cards yet.
const EMPTY = `{
  "metadata": {"language": "en"},
  "sets": {"14": {"number": 14}},
  "cards": []
}
`;

const SAMPLE = `{
  "metadata": {"language": "en"},
  "sets": {"13": {"number": 13}},
  "cards": [
    {
      "id": 13001,
      "name": "First"
    }
  ]
}
`;

const NEW_CARD: LorcanaJSONCard = {
  id: 13099,
  name: 'Test',
  fullName: 'Test',
  cost: 1,
  color: 'Amber',
  inkwell: true,
  type: 'Action',
};

describe('insertCardIntoPreviewJson', () => {
  it('appends the card and keeps the file valid JSON', () => {
    const out = insertCardIntoPreviewJson(SAMPLE, NEW_CARD);
    const parsed = JSON.parse(out) as {cards: {id: number; name: string}[]};
    expect(parsed.cards).toHaveLength(2);
    expect(parsed.cards[0]).toEqual({id: 13001, name: 'First'});
    expect(parsed.cards[1].id).toBe(13099);
  });

  it('preserves the file prefix byte-for-byte', () => {
    const out = insertCardIntoPreviewJson(SAMPLE, NEW_CARD);
    expect(out.startsWith('{\n  "metadata": {"language": "en"},')).toBe(true);
  });

  // The season's first publish: reveal-admin commits this output straight to
  // master, so an empty array must not produce `"cards": [,`.
  it.each([
    ['compact', EMPTY],
    ['multi-line', EMPTY.replace('[]', '[\n  ]')],
  ])('inserts into an empty cards array (%s) and stays valid on the next insert', (_form, input) => {
    const once = insertCardIntoPreviewJson(input, NEW_CARD);
    expect((JSON.parse(once) as {cards: unknown[]}).cards).toEqual([NEW_CARD]);
    expect(once.startsWith(input.slice(0, input.lastIndexOf('[') + 1))).toBe(true);
    expect(once.endsWith('\n    }\n  ]\n}\n')).toBe(true);

    const twice = insertCardIntoPreviewJson(once, {...NEW_CARD, id: 13100});
    expect((JSON.parse(twice) as {cards: unknown[]}).cards).toHaveLength(2);
  });

  it('inserts into the real previewCards.json, whatever state it is in', () => {
    const real = fs.readFileSync(path.resolve(process.cwd(), 'public/data/previewCards.json'), 'utf8');
    const countBefore = (JSON.parse(real) as {cards: unknown[]}).cards.length;
    const out = insertCardIntoPreviewJson(real, NEW_CARD);
    expect((JSON.parse(out) as {cards: unknown[]}).cards).toHaveLength(countBefore + 1);
  });

  it.each([
    ['a later array steals the insert', '{\n  "cards": [],\n  "extra": [1]\n}\n'],
    ['the input is not JSON', 'not json ]'],
    ['cards is not an array', '{\n  "cards": {},\n  "extra": []\n}\n'],
  ])('throws rather than return a corrupt file when %s', (_reason, input) => {
    expect(() => insertCardIntoPreviewJson(input, NEW_CARD)).toThrow(/previewCards\.json/);
  });
});
