import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {RaritySymbol} from '../RaritySymbol';

/** The file an asset url names, without its folder or query. */
const fileOf = (src: string | null | undefined) => src?.split('?')[0].split('/').pop();

const FILES: Record<string, string> = {
  common: 'common.svg',
  uncommon: 'uncommon.svg',
  rare: 'rare.svg',
  'super rare': 'super_rare.svg',
  legendary: 'legendary.svg',
  epic: 'epic.webp',
  enchanted: 'enchanted.webp',
  iconic: 'iconic.webp',
  special: 'promo.webp',
};

describe('RaritySymbol', () => {
  it('draws each rarity key from its own file', () => {
    for (const [key, file] of Object.entries(FILES)) {
      const {container, unmount} = render(<RaritySymbol rarity={key} size={24} />);
      expect(fileOf(container.querySelector('img')?.getAttribute('src')), key).toBe(file);
      unmount();
    }
  });

  it('draws nothing for a rarity without a symbol', () => {
    const {container} = render(<RaritySymbol rarity="foil" size={24} />);
    expect(container).toBeEmptyDOMElement();
  });
});
