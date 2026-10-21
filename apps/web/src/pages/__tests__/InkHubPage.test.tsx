import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {InkHubPage} from '../InkHubPage';
import {trackCardSelected} from '../../features/cards/lib/cardAnalytics';
import {createCard} from '../../shared/test-utils';

const {mockOpenCardModal} = vi.hoisted(() => ({mockOpenCardModal: vi.fn()}));

const ELSA = createCard({id: '13001', fullName: 'Elsa - Snow Queen', ink: 'Amethyst'});
const MICKEY = createCard({
  id: '13002',
  fullName: 'Mickey Mouse - Wayward Sorcerer',
  ink: 'Amethyst',
});

vi.mock('../../shared/hooks', () => ({
  useResponsive: () => ({isMobile: false, isTablet: false, isDesktop: true, windowWidth: 1280}),
}));

vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: [ELSA, MICKEY], isLoading: false}),
}));

vi.mock('../../shared/contexts/CardModalContext', () => ({
  useCardModal: () => ({openCardModal: mockOpenCardModal}),
}));

vi.mock('../../shared/components', () => ({
  CompactHeader: () => <header />,
  EtherealBackground: () => null,
  Seo: () => null,
}));

// The real grid renders card tiles; one button per card is enough to choose one.
vi.mock('../../features/cards', async () => {
  const actual = await vi.importActual('../../features/cards');
  return {
    ...actual,
    CardGrid: (props: {cards: LorcanaCard[]; onSelect: (card: LorcanaCard) => void}) => (
      <div>
        {props.cards.map((card) => (
          <button key={card.id} onClick={() => props.onSelect(card)}>
            {card.fullName}
          </button>
        ))}
      </div>
    ),
  };
});

vi.mock('../../features/cards/lib/cardAnalytics', () => ({trackCardSelected: vi.fn()}));

describe('InkHubPage', () => {
  it('tracks a card chosen from the grid as card_selected from the ink hub, then opens it', () => {
    render(
      <MemoryRouter initialEntries={['/ink/amethyst']}>
        <Routes>
          <Route path="/ink/:inkSlug" element={<InkHubPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', {name: 'Mickey Mouse - Wayward Sorcerer'}));

    expect(trackCardSelected).toHaveBeenCalledWith(MICKEY, 'ink_hub');
    expect(mockOpenCardModal).toHaveBeenCalledWith('13002', ['13001', '13002']);
  });
});
