import {describe, it, expect} from 'vitest';
import {buildSlugMap} from './generate-card-slug-map.mjs';

const slug = (card) => card.name.toLowerCase();

describe('buildSlugMap', () => {
  it('maps each id to its slug', () => {
    expect(
      buildSlugMap(
        [
          {id: 1, name: 'Sven'},
          {id: 2, name: 'Elsa'},
        ],
        slug,
      ),
    ).toEqual({
      1: 'sven',
      2: 'elsa',
    });
  });

  it('keeps the first card with an id, as the app keeps allCards.json over a preview card', () => {
    const allCards = [{id: 1, name: 'Sven'}];
    const previewCards = [{id: 1, name: 'Renamed'}];
    expect(buildSlugMap([...allCards, ...previewCards], slug)).toEqual({1: 'sven'});
  });
});
