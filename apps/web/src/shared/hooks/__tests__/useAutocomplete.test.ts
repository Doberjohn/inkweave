import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useAutocomplete} from '../useAutocomplete';
import type {LorcanaCard} from 'lorcana-synergy-engine';

// Minimal card fixtures
const makeCard = (id: string, name: string, fullName: string, cost = 3): LorcanaCard =>
  ({
    id,
    name,
    fullName,
    cost,
    ink: 'Amethyst',
    inkwell: true,
    type: 'Character',
  }) as LorcanaCard;

const cards: LorcanaCard[] = [
  makeCard('1', 'Elsa', 'Elsa - Snow Queen', 5),
  makeCard('2', 'Elsa', 'Elsa - Ice Surfer', 3),
  makeCard('3', 'Anna', 'Anna - Heir to Arendelle', 4),
  makeCard('4', 'Maui', 'Maui - Demigod', 7),
  makeCard('5', 'Stitch', 'Stitch - Rock Star', 6),
];

describe('useAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultOptions = () => ({
    cards,
    query: '',
    onQueryChange: vi.fn(),
    onSelect: vi.fn(),
    debounceMs: 100,
  });

  it('returns empty suggestions when query is under minChars', () => {
    const {result} = renderHook(() => useAutocomplete({...defaultOptions(), query: 'E'}));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.suggestions).toHaveLength(0);
    expect(result.current.isOpen).toBe(false);
  });

  it('returns matching suggestions after focus', () => {
    const {result} = renderHook(() => useAutocomplete({...defaultOptions(), query: 'Elsa'}));
    // Focus triggers setDebouncedQuery when query >= minChars
    act(() => {
      result.current.inputProps.onFocus();
    });
    expect(result.current.suggestions).toHaveLength(2);
    expect(result.current.suggestions[0].fullName).toBe('Elsa - Snow Queen');
  });

  it('limits results to maxResults', () => {
    const manyCards = Array.from({length: 20}, (_, i) =>
      makeCard(`c${i}`, 'Test', `Test - Version ${i}`),
    );
    const {result} = renderHook(() =>
      useAutocomplete({...defaultOptions(), cards: manyCards, query: 'Test', maxResults: 5}),
    );
    act(() => {
      result.current.inputProps.onFocus();
    });
    expect(result.current.suggestions).toHaveLength(5);
  });

  it('ArrowDown increments highlightedIndex', () => {
    const {result} = renderHook(() => useAutocomplete({...defaultOptions(), query: 'Elsa'}));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Simulate focus to open
    act(() => {
      result.current.inputProps.onFocus();
    });
    // ArrowDown
    act(() => {
      result.current.inputProps.onKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });
    expect(result.current.highlightedIndex).toBe(0);
    act(() => {
      result.current.inputProps.onKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });
    expect(result.current.highlightedIndex).toBe(1);
  });

  it('ArrowUp wraps to last item from -1', () => {
    const {result} = renderHook(() => useAutocomplete({...defaultOptions(), query: 'Elsa'}));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.inputProps.onFocus();
    });
    act(() => {
      result.current.inputProps.onKeyDown({
        key: 'ArrowUp',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });
    expect(result.current.highlightedIndex).toBe(1); // last index (2 results)
  });

  it('Enter on highlighted item calls onSelect', () => {
    const onSelect = vi.fn();
    const {result} = renderHook(() =>
      useAutocomplete({...defaultOptions(), query: 'Elsa', onSelect}),
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.inputProps.onFocus();
    });
    // Highlight first
    act(() => {
      result.current.inputProps.onKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });
    // Enter
    const preventDefault = vi.fn();
    act(() => {
      result.current.inputProps.onKeyDown({
        key: 'Enter',
        preventDefault,
        defaultPrevented: false,
      } as unknown as React.KeyboardEvent);
    });
    expect(onSelect).toHaveBeenCalledWith(cards[0]);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('Enter with no highlight does not call onSelect', () => {
    const onSelect = vi.fn();
    const {result} = renderHook(() =>
      useAutocomplete({...defaultOptions(), query: 'Elsa', onSelect}),
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.inputProps.onFocus();
    });
    act(() => {
      result.current.inputProps.onKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
        defaultPrevented: false,
      } as unknown as React.KeyboardEvent);
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Escape closes the dropdown', () => {
    const {result} = renderHook(() => useAutocomplete({...defaultOptions(), query: 'Elsa'}));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.inputProps.onFocus();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.inputProps.onKeyDown({
        key: 'Escape',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent);
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('debounces suggestions when typing via onChange', () => {
    const onQueryChange = vi.fn();
    const {result, rerender} = renderHook(
      ({query}) => useAutocomplete({...defaultOptions(), query, onQueryChange}),
      {initialProps: {query: ''}},
    );

    act(() => {
      result.current.inputProps.onFocus();
    });

    // Simulate typing "Els" via onChange
    act(() => {
      result.current.inputProps.onChange({
        target: {value: 'Els'},
      } as React.ChangeEvent<HTMLInputElement>);
    });
    rerender({query: 'Els'});

    // onQueryChange fires immediately
    expect(onQueryChange).toHaveBeenCalledWith('Els');
    // Suggestions should NOT appear yet (debounce pending)
    expect(result.current.suggestions).toHaveLength(0);

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.suggestions.length).toBeGreaterThan(0);
  });

  it('closes dropdown after blur timeout', () => {
    const {result} = renderHook(() => useAutocomplete({...defaultOptions(), query: 'Elsa'}));
    act(() => {
      result.current.inputProps.onFocus();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.inputProps.onBlur();
    });
    // Should still be open during the blur delay (allows click on suggestion)
    expect(result.current.isOpen).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('mouseEnter on option updates highlightedIndex', () => {
    const {result} = renderHook(() => useAutocomplete({...defaultOptions(), query: 'Elsa'}));
    act(() => {
      result.current.inputProps.onFocus();
    });
    expect(result.current.highlightedIndex).toBe(-1);
    act(() => {
      result.current.getOptionProps(1).onMouseEnter();
    });
    expect(result.current.highlightedIndex).toBe(1);
  });

  it('clears suggestions when query drops below minChars via onChange', () => {
    const onQueryChange = vi.fn();
    const {result, rerender} = renderHook(
      ({query}) => useAutocomplete({...defaultOptions(), query, onQueryChange}),
      {initialProps: {query: 'Elsa'}},
    );

    // Open with valid query
    act(() => {
      result.current.inputProps.onFocus();
    });
    expect(result.current.suggestions.length).toBeGreaterThan(0);

    // Simulate backspacing to a single character
    act(() => {
      result.current.inputProps.onChange({
        target: {value: 'E'},
      } as React.ChangeEvent<HTMLInputElement>);
    });
    rerender({query: 'E'});

    // Suggestions should clear immediately (no debounce needed)
    expect(result.current.suggestions).toHaveLength(0);
  });

  it('selection resets query and closes dropdown', () => {
    const onQueryChange = vi.fn();
    const onSelect = vi.fn();
    const {result} = renderHook(() =>
      useAutocomplete({...defaultOptions(), query: 'Elsa', onQueryChange, onSelect}),
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.inputProps.onFocus();
    });
    // Select via getOptionProps mousedown
    const preventDefault = vi.fn();
    act(() => {
      result.current.getOptionProps(0).onMouseDown({preventDefault} as unknown as React.MouseEvent);
    });
    expect(onSelect).toHaveBeenCalledWith(cards[0]);
    expect(onQueryChange).toHaveBeenCalledWith('');
  });
});
