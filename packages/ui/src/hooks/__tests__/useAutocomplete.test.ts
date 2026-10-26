import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useAutocomplete, type CardSearch} from '../useAutocomplete';
import type {LorcanaCard} from 'inkweave-synergy-engine';

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

/** A stand-in for the app's search: each word of the term begins a word of the full name. */
const nameSearch: CardSearch = (list, term) => {
  const words = term.toLowerCase().split(' ').filter(Boolean);
  return list.filter((card) => {
    const nameWords = card.fullName.toLowerCase().split(/[\s-]+/);
    return words.every((word) => nameWords.some((nameWord) => nameWord.startsWith(word)));
  });
};

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
    search: nameSearch,
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

  it("lists the search's results in the search's order", () => {
    const newestLast: CardSearch = (list, term) => nameSearch(list, term).reverse();
    const {result} = renderHook(() =>
      useAutocomplete({...defaultOptions(), query: 'Elsa', search: newestLast}),
    );
    act(() => {
      result.current.inputProps.onFocus();
    });
    expect(result.current.suggestions.map((card) => card.fullName)).toEqual([
      'Elsa - Ice Surfer',
      'Elsa - Snow Queen',
    ]);
  });

  it('keeps its defaults: two characters, 150 ms and ten results', () => {
    const {result, rerender} = renderHook(
      ({query, list}) =>
        useAutocomplete({cards: list, query, onQueryChange: vi.fn(), onSelect: vi.fn(), search: nameSearch}),
      {initialProps: {query: '', list: cards}},
    );
    act(() => {
      result.current.inputProps.onFocus();
    });
    const typeAndWait = (value: string, ms: number) => {
      act(() => {
        result.current.inputProps.onChange({target: {value}} as React.ChangeEvent<HTMLInputElement>);
      });
      rerender({query: value, list: cards});
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };

    typeAndWait('E', 150);
    expect(result.current.suggestions).toHaveLength(0);
    typeAndWait('El', 149);
    expect(result.current.suggestions).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.suggestions.map((card) => card.fullName)).toEqual([
      'Elsa - Snow Queen',
      'Elsa - Ice Surfer',
    ]);

    const elsas = Array.from({length: 12}, (_, i) => makeCard(`e${i}`, 'Elsa', `Elsa - Copy ${i}`));
    rerender({query: 'El', list: elsas});
    expect(result.current.suggestions).toHaveLength(10);
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

  /** The hook focused, with `query` held by the caller as the search fields hold it. */
  const renderFocused = () => {
    const onSelect = vi.fn();
    const {result, rerender} = renderHook(
      ({query}) => useAutocomplete({...defaultOptions(), query, onSelect}),
      {initialProps: {query: ''}},
    );
    const type = (value: string) => {
      act(() => {
        result.current.inputProps.onChange({
          target: {value},
        } as React.ChangeEvent<HTMLInputElement>);
      });
      rerender({query: value});
    };
    /** Presses a key in the input and returns the event's `preventDefault` spy. */
    const press = (key: string) => {
      const preventDefault = vi.fn();
      act(() => {
        result.current.inputProps.onKeyDown({
          key,
          preventDefault,
        } as unknown as React.KeyboardEvent);
      });
      return preventDefault;
    };
    act(() => {
      result.current.inputProps.onFocus();
    });
    return {result, onSelect, type, press};
  };

  it('stays closed when a debounce timer was pending at Escape', () => {
    // Escape within debounceMs of a keystroke closed the list, then that keystroke's timer
    // set debouncedQuery straight back and reopened it (#746).
    const {result, type, press} = renderFocused();
    type('El');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.isOpen).toBe(true);

    // The list stays open on "El" while the debounce for "Els" runs.
    type('Els');
    act(() => {
      vi.advanceTimersByTime(50);
    });
    press('Escape');
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('stays closed when Escape lands before the list first opens', () => {
    // Typing faster than the debounce never opens the list, so Escape found nothing to close
    // and the last keystroke's timer opened it straight after.
    const {result, type, press} = renderFocused();
    type('Elsa');
    const preventDefault = press('Escape');
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isOpen).toBe(false);
    // With no list to close, the key stays free for a surrounding dialog's own Escape.
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ArrowDown before the list first opens highlights the first match', () => {
    // Typing faster than the debounce never opened the list, so the arrow did nothing and a
    // quick Enter submitted the search instead of picking a card.
    const {result, onSelect, type, press} = renderFocused();
    type('Elsa');
    press('ArrowDown');
    expect(result.current.isOpen).toBe(true);
    press('Enter');

    expect(onSelect).toHaveBeenCalledWith(cards[0]);
  });

  it.each([
    {key: 'ArrowDown', picks: 0},
    {key: 'ArrowUp', picks: 1},
  ])('$key during a pending debounce highlights a match for the typed text', ({key, picks}) => {
    // The list on screen was still the one for "El", and the pending timer for "Elsa" reset
    // the highlight when it fired, so Enter selected nothing and the search submitted instead.
    const {result, onSelect, type, press} = renderFocused();
    type('El');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.isOpen).toBe(true);

    type('Elsa');
    press(key);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    press('Enter');

    expect(onSelect).toHaveBeenCalledWith(cards[picks]);
  });

  it('drops the highlight on typing, so Enter no longer picks from the old list', () => {
    // The highlight sat in the list for "El" until the debounce fired, so Enter straight
    // after a keystroke picked a card the text had moved on from.
    const {result, onSelect, type, press} = renderFocused();
    type('El');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    press('ArrowDown');
    expect(result.current.highlightedIndex).toBe(0);

    type('Els');
    expect(result.current.highlightedIndex).toBe(-1);
    press('Enter');

    expect(onSelect).not.toHaveBeenCalled();
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

  it('keeps isFocused through a refocus within the blur delay', () => {
    const {result} = renderHook(() => useAutocomplete(defaultOptions()));
    act(() => {
      result.current.inputProps.onFocus();
    });
    act(() => {
      result.current.inputProps.onBlur();
    });
    act(() => {
      result.current.inputProps.onFocus();
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // The refocus cancelled the pending blur, so focus styling must not drop out.
    expect(result.current.isFocused).toBe(true);
  });

  it('does not leak a blur timer when blurred twice before unmount', () => {
    const {result, unmount} = renderHook(() => useAutocomplete(defaultOptions()));
    act(() => {
      result.current.inputProps.onBlur();
    });
    act(() => {
      result.current.inputProps.onBlur();
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
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
