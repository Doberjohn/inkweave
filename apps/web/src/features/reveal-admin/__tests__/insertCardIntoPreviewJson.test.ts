import {describe, it, expect} from 'vitest';
import {insertCardIntoPreviewJson} from '../insertCardIntoPreviewJson';
import type {LorcanaJSONCard} from 'inkweave-synergy-engine';

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
});
