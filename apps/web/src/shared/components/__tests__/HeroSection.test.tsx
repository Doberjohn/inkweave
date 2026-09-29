import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {HeroSection} from '../HeroSection';

// Mock SearchAutocomplete to avoid complex autocomplete setup
vi.mock('../SearchAutocomplete', () => ({
  SearchAutocomplete: () => <div data-testid="search-autocomplete" />,
}));

describe('HeroSection', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
  };

  it('should render the hero section with logo heading and subtitle', () => {
    render(<HeroSection {...defaultProps} />);

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    // h1 = logo (alt "Inkweave") + an sr-only keyword head-term (#496); the heading's
    // accessible name is the two concatenated, which is the SEO signal we lock in here.
    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Inkweave Disney Lorcana Card Synergy Finder for Core format',
    });
    expect(heading).toBeInTheDocument();
    expect(heading.querySelector('img')).toHaveAttribute('src', '/brand/logo-animated.svg');
    expect(
      screen.getByText('Select any Lorcana card and instantly discover powerful synergies.'),
    ).toBeInTheDocument();
  });

  it('should request the logo at high fetch priority', () => {
    render(<HeroSection {...defaultProps} />);

    expect(screen.getByAltText('Inkweave')).toHaveAttribute('fetchpriority', 'high');
  });

  it("should reserve the logo's space before the image loads", () => {
    render(<HeroSection {...defaultProps} />);

    const logo = screen.getByAltText('Inkweave');
    expect(logo).toHaveAttribute('width', '977');
    expect(logo).toHaveAttribute('height', '313');
  });

  it('should render search input', () => {
    render(<HeroSection {...defaultProps} />);

    expect(screen.getByTestId('hero-search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for a card...')).toBeInTheDocument();
  });

  it('should call onSearchSubmit on Enter key in input', () => {
    const onSearchSubmit = vi.fn();
    render(<HeroSection {...defaultProps} searchQuery="Elsa" onSearchSubmit={onSearchSubmit} />);

    fireEvent.keyDown(screen.getByTestId('hero-search'), {key: 'Enter'});
    expect(onSearchSubmit).toHaveBeenCalledOnce();
  });

  it('should render CTA buttons', () => {
    render(<HeroSection {...defaultProps} />);

    expect(screen.getByTestId('cta-browse')).toBeInTheDocument();
    expect(screen.getByText('Browse all cards')).toBeInTheDocument();
    expect(screen.getByTestId('cta-playstyles')).toBeInTheDocument();
    expect(screen.getByText('Explore playstyles')).toBeInTheDocument();
  });

  it('should call onBrowse when Browse CTA is clicked', () => {
    const onBrowse = vi.fn();
    render(<HeroSection {...defaultProps} onBrowse={onBrowse} />);

    fireEvent.click(screen.getByTestId('cta-browse'));
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it('should call onPlaystyles when Playstyles CTA is clicked', () => {
    const onPlaystyles = vi.fn();
    render(<HeroSection {...defaultProps} onPlaystyles={onPlaystyles} />);

    fireEvent.click(screen.getByTestId('cta-playstyles'));
    expect(onPlaystyles).toHaveBeenCalledOnce();
  });

  it('should render as a semantic section element', () => {
    render(<HeroSection {...defaultProps} />);

    const section = screen.getByTestId('hero-section');
    expect(section.tagName).toBe('SECTION');
  });

  it('cancels the search blur timer on unmount (no leaked timer)', () => {
    vi.useFakeTimers();
    try {
      const {unmount} = render(<HeroSection {...defaultProps} />);
      const input = screen.getByTestId('hero-search');
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(vi.getTimerCount()).toBe(1); // only the hook's 150ms blur timer is pending
      unmount();
      // A leaked timer firing setState into a torn-down tree crashed CI's coverage run
      // with "window is not defined"; the cleanup must cancel it on unmount.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
