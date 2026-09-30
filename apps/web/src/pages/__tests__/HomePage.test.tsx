import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {HomePage} from '../HomePage';
import {trackCardSelected} from '../../features/cards/lib/cardAnalytics';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {...actual, useNavigate: () => mockNavigate};
});

vi.mock('../../shared/hooks', () => ({
  useResponsive: () => ({isMobile: false, isTablet: false, isDesktop: true, windowWidth: 1280}),
}));

vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: [], getCardById: () => undefined}),
}));

vi.mock('../../shared/contexts/CardModalContext', () => ({
  useCardModal: () => ({selectedCardId: null, openCardModal: vi.fn(), closeCardModal: vi.fn()}),
}));

// Mock child components to isolate HomePage tests
vi.mock('../../shared/components', async () => {
  const actual = await vi.importActual('../../shared/components');
  return {
    ...actual,
    HeroSection: (props: {
      onSearchSubmit?: () => void;
      onBrowse?: () => void;
      onPlaystyles?: () => void;
    }) => (
      <div data-testid="hero-section">
        <button data-testid="mock-search-submit" onClick={props.onSearchSubmit}>
          Search
        </button>
        <button data-testid="mock-browse" onClick={props.onBrowse}>
          Browse
        </button>
        <button data-testid="mock-playstyles" onClick={props.onPlaystyles}>
          Playstyles
        </button>
      </div>
    ),
    EtherealBackground: () => <div data-testid="ethereal-bg" />,
  };
});

// A featured card the full card list doesn't hold yet (#641): the context mock has no cards.
const FEATURED_CARD = vi.hoisted(() => ({id: '2999', fullName: 'Woody & Buzz Lightyear - Best Buddies'}));

vi.mock('../../features/cards', () => ({
  FeaturedCards: (props: {onCardSelect: (card: typeof FEATURED_CARD) => void}) => (
    <button data-testid="featured-cards" onClick={() => props.onCardSelect(FEATURED_CARD)}>
      Featured card
    </button>
  ),
}));

vi.mock('../../features/cards/lib/cardAnalytics', () => ({trackCardSelected: vi.fn()}));

describe('HomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should render hero section and featured cards', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('featured-cards')).toBeInTheDocument();
    expect(screen.getByTestId('ethereal-bg')).toBeInTheDocument();
  });

  it('should navigate to /browse when search is submitted with empty query', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mock-search-submit'));
    expect(mockNavigate).toHaveBeenCalledWith('/browse');
  });

  it('should navigate to /browse when Browse CTA is clicked', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mock-browse'));
    expect(mockNavigate).toHaveBeenCalledWith('/browse');
  });

  it('should navigate to /browse when Playstyles CTA is clicked', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('mock-playstyles'));
    expect(mockNavigate).toHaveBeenCalledWith('/playstyles');
  });

  it('tracks a featured card pressed before the full card list has it (#641)', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('featured-cards'));
    expect(trackCardSelected).toHaveBeenCalledWith(FEATURED_CARD, 'home');
  });
});
