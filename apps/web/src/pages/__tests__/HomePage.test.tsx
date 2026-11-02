import {afterEach, describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {HomePage} from '../HomePage';
import {HomePageSkeleton} from '../HomePageSkeleton';
import {trackCardSelected} from '../../features/cards/lib/cardAnalytics';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {...actual, useNavigate: () => mockNavigate};
});

vi.mock('../../shared/hooks', () => ({
  useResponsive: () => ({isMobile: false, isTablet: false, isDesktop: true, windowWidth: 1280}),
}));

const mockRequestLoad = vi.fn();
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: [], getCardById: () => undefined, requestLoad: mockRequestLoad}),
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

// The notice's build flag is a module constant, so the mock serves it through a getter each case sets.
const frame = vi.hoisted(() => ({betaNotice: false}));
vi.mock('../homeFrame', async () => {
  const actual = await vi.importActual<typeof import('../homeFrame')>('../homeFrame');
  return {
    ...actual,
    get SHOW_BETA_NOTICE() {
      return frame.betaNotice;
    },
  };
});

afterEach(() => {
  frame.betaNotice = false;
});

describe('HomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRequestLoad.mockClear();
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

  it('starts loading the card list when the page is pressed (#641)', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    fireEvent.pointerDown(screen.getByTestId('featured-cards'));
    expect(mockRequestLoad).toHaveBeenCalledOnce();
  });
});

// The page and its skeleton both draw the notice above <main>, so the hero sits in the same place
// before and after the page's code arrives.
describe.each([
  ['HomePage', () => <HomePage />],
  ['HomePageSkeleton', () => <HomePageSkeleton />],
])('%s', (_name, page) => {
  it('shows the beta notice above <main> in a build that turns it on', () => {
    frame.betaNotice = true;
    render(<MemoryRouter>{page()}</MemoryRouter>);
    const notice = screen.getByRole('complementary', {name: 'Beta notice'});
    expect(notice.nextElementSibling?.tagName).toBe('MAIN');
  });

  it('shows no beta notice in a build that turns it off', () => {
    render(<MemoryRouter>{page()}</MemoryRouter>);
    expect(screen.queryByRole('complementary', {name: 'Beta notice'})).not.toBeInTheDocument();
  });
});
