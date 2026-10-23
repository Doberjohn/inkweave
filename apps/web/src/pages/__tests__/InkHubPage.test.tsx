import {afterEach, describe, it, expect, vi} from 'vitest';
import {cleanup, render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {InkHubPage} from '../InkHubPage';
import {trackCardSelected} from '../../features/cards/lib/cardAnalytics';
import {createCard} from '../../shared/test-utils';

const {mockOpenCardModal, cardList} = vi.hoisted(() => ({
  mockOpenCardModal: vi.fn(),
  cardList: {loading: false},
}));

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
  useCardDataContext: () =>
    cardList.loading ? {cards: [], isLoading: true} : {cards: [ELSA, MICKEY], isLoading: false},
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

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/ink/amethyst']}>
      <Routes>
        <Route path="/ink/:inkSlug" element={<InkHubPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InkHubPage', () => {
  afterEach(() => {
    cardList.loading = false;
  });

  // #913: the count waits for the list, on a line that keeps its height, never a false "0 cards".
  it('holds the count line blank while the card list loads, then counts the ink cards', () => {
    cardList.loading = true;
    renderPage();
    // The count line comes after the heading and its blurb.
    const countLine = screen.getByRole('heading', {level: 1}).nextElementSibling?.nextElementSibling;
    expect(countLine?.textContent).toBe('\u00a0');
    expect(screen.queryByText(/^\d+ cards?$/)).toBeNull();

    cleanup();
    cardList.loading = false;
    renderPage();
    expect(screen.getByText('2 cards')).toBeInTheDocument();
  });

  it('tracks a card chosen from the grid as card_selected from the ink hub, then opens it', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', {name: 'Mickey Mouse - Wayward Sorcerer'}));

    expect(trackCardSelected).toHaveBeenCalledWith(MICKEY, 'ink_hub');
    expect(mockOpenCardModal).toHaveBeenCalledWith('13002', ['13001', '13002']);
  });
});
