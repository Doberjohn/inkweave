import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {SynergyCard} from '../SynergyCard';
import type {LorcanaCard} from '../../../cards';

// Mock framer-motion to avoid animation complexity
vi.mock('framer-motion', () => ({
  motion: {
    button: ({children, ...props}: React.ComponentProps<'button'>) => (
      <button {...props}>{children}</button>
    ),
  },
}));

vi.mock('../../../shared/components', () => ({
  CardLightbox: () => null,
}));

vi.mock('../../../cards', () => ({
  useCardPreviewHandlers: () => ({previewHandlers: {}}),
}));

vi.mock('../../../shared/hooks', () => ({
  useResponsive: () => ({isMobile: false}),
}));

const mockCard: LorcanaCard = {
  id: '1',
  fullName: 'Elsa - Snow Queen',
  name: 'Elsa',
  version: 'Snow Queen',
  type: 'Character',
  ink: 'Amethyst',
  cost: 4,
  inkwell: true,
  imageUrl: 'https://example.com/elsa.png',
  set: {code: '5', name: 'Shimmering Skies', number: 5},
  rarity: 'Rare',
  number: 42,
  classifications: ['Hero', 'Queen'],
} as LorcanaCard;

describe('SynergyCard', () => {
  it('should render card image with descriptive alt text', () => {
    render(<SynergyCard card={mockCard} score={7} explanation="Test synergy" />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Elsa - Snow Queen');
  });
});
