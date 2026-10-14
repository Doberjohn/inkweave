import {describe, it, expect} from 'vitest';
import {fillChipNames} from '../chipNames';
import {createCard} from '../../../../shared/test-utils';

const ariel = createCard({id: 'ariel', name: 'Ariel', fullName: 'Ariel - Sonic Warrior'});
const song = createCard({id: 'song', name: "A Pirate's Life", fullName: "A Pirate's Life"});

describe('fillChipNames', () => {
  it('writes {A} as the first card and {B} as its partner, by name', () => {
    expect(fillChipNames('{A} can sing {B} (cost 6) for free with Singer 7.', ariel, song)).toBe(
      "Ariel can sing A Pirate's Life (cost 6) for free with Singer 7.",
    );
    expect(fillChipNames('{B} can sing {A} (cost 6) for free with Singer 7.', song, ariel)).toBe(
      "Ariel can sing A Pirate's Life (cost 6) for free with Singer 7.",
    );
  });

  it('uses full names when both cards share a name', () => {
    const base = createCard({id: 'elsa-1', name: 'Elsa', fullName: 'Elsa - Snow Queen'});
    const shift = createCard({id: 'elsa-2', name: 'Elsa', fullName: 'Elsa - Ice Artisan'});
    expect(fillChipNames('{A} shifts onto {B} the turn after.', shift, base)).toBe(
      'Elsa - Ice Artisan shifts onto Elsa - Snow Queen the turn after.',
    );
  });

  it('leaves a line without tokens as it is', () => {
    expect(fillChipNames('Test synergy', ariel, song)).toBe('Test synergy');
  });
});
