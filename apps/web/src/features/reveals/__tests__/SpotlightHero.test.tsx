import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {INK_COLORS} from '../../../shared/constants';
import {SpotlightHero, type SpotlightHeroData} from '../SpotlightHero';

const coco: SpotlightHeroData = {
  accent: INK_COLORS.Amethyst.border,
  isNew: true,
  count: 'New franchise',
  title: 'Coco',
  summary: 'A family of musicians.',
  heroImage: '/art/franchises/coco.webp',
  heroAlt: 'Coco',
  support: [
    {src: '/art/hector.webp', alt: 'Coco'},
    {src: '/art/pepita.webp', alt: 'Coco'},
  ],
};

/** Every visible word is in the name (WCAG 2.5.3), the art adds none, and no symbol is read. */
function expectNamedByItsText(tile: HTMLElement, cta: string) {
  expect(tile).not.toHaveAccessibleName(/[★→]/);
  expect(tile).not.toHaveAccessibleName(/Coco.*Coco/);
  expect(tile).toHaveAccessibleName(/New franchise Coco A family of musicians\./);
  expect(tile).toHaveAccessibleName(new RegExp(`${cta}$`));
}

describe('SpotlightHero', () => {
  it('names an action tile by its own text', () => {
    render(<SpotlightHero data={coco} onActivate={() => {}} />);
    expectNamedByItsText(screen.getByRole('button'), 'View cards');
  });

  it('names a link tile by its own text', () => {
    render(<SpotlightHero data={{...coco, href: '/playstyles/ink-drops'}} />);
    expectNamedByItsText(screen.getByRole('link'), 'View synergies');
  });

  it('keeps the art described when the tile is neither a link nor a button', () => {
    render(<SpotlightHero data={coco} />);
    expect(screen.getAllByRole('img', {name: 'Coco'})).toHaveLength(3);
  });
});
