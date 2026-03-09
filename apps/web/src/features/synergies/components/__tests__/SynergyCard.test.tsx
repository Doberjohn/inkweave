import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SynergyCard} from '../SynergyCard';
import type {LorcanaCard} from '../../../cards';

vi.mock('../../../shared/components', () => ({
  CardLightbox: () => null,
}));

vi.mock('../../../cards', () => ({
  useCardPreviewHandlers: () => ({
    handleMouseEnter: vi.fn(),
    handleMouseMove: vi.fn(),
    handleMouseLeave: vi.fn(),
    previewHandlers: {},
  }),
  smallImageUrl: (url: string | undefined) => (url ? url.replace(/\.(\w+)$/, '-sm.$1') : undefined),
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

  it('should include score in strength badge', () => {
    render(<SynergyCard card={mockCard} score={7} explanation="Test synergy" />);
    expect(screen.getByTestId('reason-tag')).toHaveTextContent('Strong 7');
  });

  it('should show abbreviated label on mobile', () => {
    render(<SynergyCard card={mockCard} score={5} explanation="Test synergy" isMobile />);
    expect(screen.getByTestId('reason-tag')).toHaveTextContent('Mod 5');
  });

  it('should show View details cue on hover (desktop)', () => {
    render(<SynergyCard card={mockCard} score={7} explanation="Test synergy" />);
    const button = screen.getByRole('button', {name: 'Elsa - Snow Queen'});
    fireEvent.mouseEnter(button);
    expect(screen.getByText('View details')).toBeTruthy();
  });

  it('should not render View details cue on mobile', () => {
    render(<SynergyCard card={mockCard} score={7} explanation="Test synergy" isMobile />);
    expect(screen.queryByText('View details')).toBeNull();
  });
});
