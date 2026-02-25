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

  it('should render search button', () => {
    render(<HeroSection {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'Search'})).toBeInTheDocument();
  });

  it('should disable search button when query is empty', () => {
    render(<HeroSection {...defaultProps} searchQuery="" />);

    expect(screen.getByRole('button', {name: 'Search'})).toBeDisabled();
  });

  it('should enable search button when query has text', () => {
    render(<HeroSection {...defaultProps} searchQuery="Elsa" />);

    expect(screen.getByRole('button', {name: 'Search'})).not.toBeDisabled();
  });

  it('should call onSearchSubmit when search button is clicked', () => {
    const onSearchSubmit = vi.fn();
    render(<HeroSection {...defaultProps} searchQuery="Elsa" onSearchSubmit={onSearchSubmit} />);

    fireEvent.click(screen.getByRole('button', {name: 'Search'}));
    expect(onSearchSubmit).toHaveBeenCalledOnce();
  });

  it('should call onSearchSubmit on Enter key in input', () => {
    const onSearchSubmit = vi.fn();
    render(<HeroSection {...defaultProps} searchQuery="Elsa" onSearchSubmit={onSearchSubmit} />);

    fireEvent.keyDown(screen.getByTestId('hero-search'), {key: 'Enter'});
    expect(onSearchSubmit).toHaveBeenCalledOnce();
  });

  it('should render as a semantic section element', () => {
    render(<HeroSection {...defaultProps} />);

    const section = screen.getByTestId('hero-section');
    expect(section.tagName).toBe('SECTION');
  });
});
