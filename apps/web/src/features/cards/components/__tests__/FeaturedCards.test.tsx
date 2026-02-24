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

// Mock CardPreviewContext to avoid provider requirement
vi.mock('../CardPreviewContext', () => ({
  useCardPreview: () => ({previewState: {card: null, position: {x: 0, y: 0}}, hidePreview: vi.fn()}),
  useCardPreviewHandlers: () => ({previewHandlers: {}}),
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

const mockCards: LorcanaCard[] = [
  makeCard('Amber', 'amber-1', 'Amber Card'),
  makeCard('Amethyst', 'amethyst-1', 'Amethyst Card'),
  makeCard('Emerald', 'emerald-1', 'Emerald Card'),
  makeCard('Ruby', 'ruby-1', 'Ruby Card'),
  makeCard('Sapphire', 'sapphire-1', 'Sapphire Card'),
  makeCard('Steel', 'steel-1', 'Steel Card'),
];

describe('FeaturedCards', () => {
  it('should render featured cards section', () => {
    render(<FeaturedCards cards={mockCards} onCardSelect={vi.fn()} />);

    expect(screen.getByTestId('featured-cards')).toBeInTheDocument();
    expect(screen.getByText('Featured Cards')).toBeInTheDocument();
  });

  it('should render one card per ink color', () => {
    render(<FeaturedCards cards={mockCards} onCardSelect={vi.fn()} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(6);
  });

  it('should return null when no cards have images', () => {
    const cardsWithoutImages = mockCards.map((c) => ({...c, imageUrl: undefined, thumbnailUrl: undefined}));
    const {container} = render(
      <FeaturedCards cards={cardsWithoutImages} onCardSelect={vi.fn()} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('should return null for empty card array', () => {
    const {container} = render(<FeaturedCards cards={[]} onCardSelect={vi.fn()} />);

    expect(container.innerHTML).toBe('');
  });

  it('should exclude Location cards from featured selection', () => {
    const locationCards = mockCards.map((c) => ({...c, type: 'Location' as const}));
    const {container} = render(
      <FeaturedCards cards={locationCards} onCardSelect={vi.fn()} />,
    );

    expect(container.innerHTML).toBe('');
  });
});
