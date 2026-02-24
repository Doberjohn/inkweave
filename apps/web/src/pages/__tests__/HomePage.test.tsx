import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {HomePage} from '../HomePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {...actual, useNavigate: () => mockNavigate};
});

vi.mock('../../shared/hooks', () => ({
  useResponsive: () => ({isMobile: false, isTablet: false, isDesktop: true, windowWidth: 1280}),
}));

vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: []}),
}));

// Mock child components to isolate HomePage tests
vi.mock('../../shared/components', async () => {
  const actual = await vi.importActual('../../shared/components');
  return {
    ...actual,
    HeroSection: (props: {onSearchSubmit?: () => void}) => (
      <div data-testid="hero-section">
        <button data-testid="mock-search-submit" onClick={props.onSearchSubmit}>
          Search
        </button>
      </div>
    ),
    EtherealBackground: () => <div data-testid="ethereal-bg" />,
  };
});

vi.mock('../../features/cards', () => ({
  FeaturedCards: () => <div data-testid="featured-cards" />,
}));

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

  it('should render See all cards button', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('See all cards →')).toBeInTheDocument();
  });

  it('should navigate to /browse when See all cards is clicked', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('See all cards →'));
    expect(mockNavigate).toHaveBeenCalledWith('/browse');
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
});
