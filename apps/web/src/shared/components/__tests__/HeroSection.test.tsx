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

  it('should render the hero section with title and subtitles', () => {
    render(<HeroSection {...defaultProps} />);

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByText('✦ INKWEAVE ✦')).toBeInTheDocument();
    expect(screen.getByText('LORCANA SYNERGIES')).toBeInTheDocument();
    expect(
      screen.getByText('Select any Lorcana card and instantly discover powerful combinations.'),
    ).toBeInTheDocument();
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
});
