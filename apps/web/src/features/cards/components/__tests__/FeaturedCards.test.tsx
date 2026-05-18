import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {FeaturedCards} from '../FeaturedCards';
import type {LorcanaCard} from '../../types';

// Mock CardTile to avoid complex rendering
vi.mock('../CardTile', () => ({
  CardTile: ({card}: {card: LorcanaCard}) => (
    <div data-testid={`card-tile-${card.id}`}>{card.name}</div>
  ),
}));

function makeCard(ink: string, id: string, name: string): LorcanaCard {
  return {
    id,
    fullName: name,
    name,
    type: 'Character',
    ink: ink as LorcanaCard['ink'],
    cost: 3,
    inkwell: true,
    imageUrl: `https://example.com/${id}.png`,
    set: {code: '5', name: 'Shimmering Skies', number: 5},
    rarity: 'Common',
    number: 1,
    classifications: [],
  } as LorcanaCard;
}

// IDs must match DEFAULT_FEATURED_IDS in FeaturedCards.tsx (also overridable via
// VITE_FEATURED_CARD_IDS — tests rely on the unset/default path).
const mockCards: LorcanaCard[] = [
  makeCard('Amber', '2730', 'Woody'),
  makeCard('Amethyst', '2752', 'Snow White'),
  makeCard('Emerald', '2806', 'Buzz Lightyear'),
  makeCard('Ruby', '2841', 'Sid Phillips'),
  makeCard('Sapphire', '2878', 'What Else Can I Do?'),
  makeCard('Steel', '2906', 'Merida'),
];

describe('FeaturedCards', () => {
  it('should render featured cards section', () => {
    render(<FeaturedCards cards={mockCards} onCardSelect={vi.fn()} />);

    expect(screen.getByTestId('featured-cards')).toBeInTheDocument();
    expect(screen.getByText('Popular Synergy Starters')).toBeInTheDocument();
  });

  it('should render one card per ink color', () => {
    render(<FeaturedCards cards={mockCards} onCardSelect={vi.fn()} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(6);
  });

  it('should return null when no cards have images', () => {
    const cardsWithoutImages = mockCards.map((c) => ({
      ...c,
      imageUrl: undefined,
    }));
    const {container} = render(<FeaturedCards cards={cardsWithoutImages} onCardSelect={vi.fn()} />);

    expect(container.innerHTML).toBe('');
  });

  it('should return null for empty card array', () => {
    const {container} = render(<FeaturedCards cards={[]} onCardSelect={vi.fn()} />);

    expect(container.innerHTML).toBe('');
  });

  it('should preserve curated display order regardless of input order', () => {
    const shuffled = [...mockCards].reverse();
    render(<FeaturedCards cards={shuffled} onCardSelect={vi.fn()} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).toHaveTextContent('Woody');
    expect(listItems[5]).toHaveTextContent('Merida');
  });

  it('should gracefully handle missing featured cards', () => {
    // Only provide 3 of the 6 curated cards
    const partial = mockCards.slice(0, 3);
    render(<FeaturedCards cards={partial} onCardSelect={vi.fn()} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
  });

  it('should render as a semantic section element', () => {
    render(<FeaturedCards cards={mockCards} onCardSelect={vi.fn()} />);

    const section = screen.getByTestId('featured-cards');
    expect(section.tagName).toBe('SECTION');
  });
});
