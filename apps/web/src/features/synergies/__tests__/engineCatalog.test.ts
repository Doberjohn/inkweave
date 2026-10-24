import {describe, it, expect} from 'vitest';
import {getDisplayCatalog} from 'inkweave-synergy-engine';
import catalogData from 'inkweave-synergy-engine/catalog.json';
import {getPlaystyleById, mechanicDescription, mechanicLabel} from '../engineCatalog';

describe('engineCatalog', () => {
  it('is the catalog of the engine it was built with', () => {
    expect(catalogData).toEqual(getDisplayCatalog());
  });

  it('finds a playstyle by id', () => {
    expect(getPlaystyleById('discard')?.name).toBe('Discard');
  });

  it("labels a mechanic, and shows an id the catalog doesn't know as itself", () => {
    expect(mechanicLabel('lore-burn')).toBe('Lore Burn');
    expect(mechanicLabel('not-a-mechanic')).toBe('not-a-mechanic');
  });

  it("describes a mechanic in a tribe's words on that tribe's page only", () => {
    expect(mechanicDescription('in-play-check', 'madrigal')).toBe(
      'Get benefits tied to a Madrigal character, such as having one in play',
    );
    expect(mechanicDescription('in-play-check', 'location-control')).toBe(
      'Get benefits when you have locations in play',
    );
  });
});
