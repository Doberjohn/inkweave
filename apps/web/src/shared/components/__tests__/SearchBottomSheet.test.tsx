import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {SearchBottomSheet} from '../SearchBottomSheet';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {...actual, useNavigate: () => mockNavigate};
});

// Mock card data context
vi.mock('../../contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: []}),
}));

// Mock card loader
vi.mock('../../../features/cards/loader', () => ({
  smallImageUrl: (id: string) => `/images/${id}.avif`,
  searchCardsByName: () => [],
  parseSetOrder: () => 0,
}));

describe('SearchBottomSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSheet = (isOpen = true) => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <SearchBottomSheet isOpen={isOpen} onClose={onClose} />
      </MemoryRouter>,
    );
    return {onClose};
  };

  it('should navigate to browse on Enter key with query', () => {
    const {onClose} = renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.change(input, {target: {value: 'Elsa'}});
    fireEvent.keyDown(input, {key: 'Enter'});

    expect(mockNavigate).toHaveBeenCalledWith('/browse?q=Elsa');
    expect(onClose).toHaveBeenCalled();
  });

  it('should not navigate on Enter with empty query', () => {
    renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.keyDown(input, {key: 'Enter'});

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate on Enter with whitespace-only query', () => {
    renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.change(input, {target: {value: '   '}});
    fireEvent.keyDown(input, {key: 'Enter'});

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    const {onClose} = renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.keyDown(input, {key: 'Escape'});

    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should encode special characters in search query', () => {
    const {onClose} = renderSheet();

    const input = screen.getByTestId('search-sheet-input');
    fireEvent.change(input, {target: {value: 'Mr. Smee'}});
    fireEvent.keyDown(input, {key: 'Enter'});

    expect(mockNavigate).toHaveBeenCalledWith('/browse?q=Mr.%20Smee');
    expect(onClose).toHaveBeenCalled();
  });
});
