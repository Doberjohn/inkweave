import {useEffect, useId, useRef, useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {searchCardsByName, parseSetOrder} from '../../features/cards/loader';

interface UseAutocompleteOptions {
  cards: LorcanaCard[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (card: LorcanaCard) => void;
  minChars?: number;
  maxResults?: number;
  debounceMs?: number;
}

export interface UseAutocompleteReturn {
  suggestions: LorcanaCard[];
  isOpen: boolean;
  /**
   * True while the input has focus (searchImmediate also sets it) and for the blur delay after;
   * a refocus cancels that delay.
   */
  isFocused: boolean;
  highlightedIndex: number;
  inputProps: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onFocus: () => void;
    onBlur: () => void;
    role: 'combobox';
    'aria-expanded': boolean;
    'aria-autocomplete': 'list';
    'aria-controls': string;
    'aria-activedescendant': string | undefined;
  };
  listboxProps: {
    id: string;
    role: 'listbox';
  };
  getOptionProps: (index: number) => {
    id: string;
    role: 'option';
    'aria-selected': boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
  };
  close: () => void;
  searchImmediate: (term: string) => void;
}

/**
 * The option one step from `from` in a list of `count`, wrapping at both ends. From no
 * highlight (-1), a step down lands on the first option and a step up on the last.
 */
function stepIndex(from: number, step: 1 | -1, count: number): number {
  if (count === 0) return -1;
  if (step === 1) return (from + 1) % count;
  return from <= 0 ? count - 1 : from - 1;
}

export function useAutocomplete({
  cards,
  query,
  onQueryChange,
  onSelect,
  minChars = 2,
  maxResults = 10,
  debounceMs = 150,
}: UseAutocompleteOptions): UseAutocompleteReturn {
  const instanceId = useId();
  const listboxId = `autocomplete-listbox-${instanceId}`;
  const optionIdPrefix = `autocomplete-option-${instanceId}`;

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-reset internal state when query is externally cleared (e.g., bottom sheet close).
  // Uses prev-prop tracking so the reset fires exactly once per transition, not on every render.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    if (query === '' && debouncedQuery !== '') {
      setDebouncedQuery('');
      setHighlightedIndex(-1);
    }
  }

  // Debounce query updates via the onChange handler instead of an effect
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onQueryChange(newValue);

    clearTimeout(debounceTimeoutRef.current);
    // The highlight was in the list for the old text, so typing drops it.
    setHighlightedIndex(-1);
    if (newValue.length < minChars) {
      setDebouncedQuery('');
      return;
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(newValue);
      setHighlightedIndex(-1);
    }, debounceMs);
  };

  // Suggestions for a search term, sorted by descending set code
  const suggestionsFor = (term: string) => {
    if (!term || term.length < minChars) return [];
    return searchCardsByName(cards, term)
      .sort((a, b) => parseSetOrder(b.setCode) - parseSetOrder(a.setCode))
      .slice(0, maxResults);
  };
  const suggestions = suggestionsFor(debouncedQuery);

  const isOpen = isFocused && suggestions.length > 0 && query.length >= minChars;

  const close = () => {
    // A debounce timer scheduled by the last keystroke would otherwise fire after
    // this and set `debouncedQuery` straight back, reopening the listbox. Escape
    // leaves `query` and `isFocused` intact, so nothing else would stop it.
    clearTimeout(debounceTimeoutRef.current);
    setHighlightedIndex(-1);
    setDebouncedQuery('');
  };

  /** Immediately search for a term, bypassing the debounce delay. */
  const searchImmediate = (term: string) => {
    onQueryChange(term);
    setDebouncedQuery(term.length >= minChars ? term : '');
    setHighlightedIndex(-1);
    setIsFocused(true);
  };

  const selectItem = (card: LorcanaCard | undefined) => {
    if (!card) return; // Guard against stale closure race
    onSelect(card);
    onQueryChange('');
    close();
  };

  /**
   * Arrow keys step through the list for the text in the input. While a debounce is pending,
   * the list on screen is still an earlier keystroke's, and the timer reset the highlight when
   * it fired, so a quick Enter picked nothing and submitted the search instead. Applying the
   * typed text first, and cancelling that timer, lands the step in the list Enter reads.
   */
  const moveHighlight = (step: 1 | -1) => {
    clearTimeout(debounceTimeoutRef.current);
    setDebouncedQuery(query);
    const count = suggestionsFor(query).length;
    setHighlightedIndex((prev) => stepIndex(prev, step, count));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      // Typing faster than the debounce leaves the list unopened, so Escape has nothing to
      // close, but close() still cancels the timer that would open the list straight after.
      if (e.key === 'Escape') close();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveHighlight(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveHighlight(-1);
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault();
          selectItem(suggestions[highlightedIndex]);
        }
        // If no highlight, let event propagate (e.g., HeroSection search submit)
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  };

  const handleFocus = () => {
    clearTimeout(blurTimeoutRef.current);
    setIsFocused(true);
    // Restore suggestions immediately if query is already valid (e.g., re-focusing after blur)
    if (query.length >= minChars) {
      setDebouncedQuery(query);
    }
  };

  const handleBlur = () => {
    // Delay blur to allow mousedown on suggestion items to fire before dropdown closes.
    // Clear first: an orphaned timer would escape the unmount cleanup, which only sees the ref.
    clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      setIsFocused(false);
      setHighlightedIndex(-1);
    }, 150);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearTimeout(blurTimeoutRef.current);
      clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  const getOptionProps = (index: number) => ({
    id: `${optionIdPrefix}-${index}`,
    role: 'option' as const,
    'aria-selected': index === highlightedIndex,
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent input blur
      selectItem(suggestions[index]);
    },
    onMouseEnter: () => setHighlightedIndex(index),
  });

  return {
    suggestions,
    isOpen,
    isFocused,
    highlightedIndex,
    inputProps: {
      value: query,
      onChange: handleChange,
      onKeyDown: handleKeyDown,
      onFocus: handleFocus,
      onBlur: handleBlur,
      role: 'combobox',
      'aria-expanded': isOpen,
      'aria-autocomplete': 'list',
      'aria-controls': listboxId,
      'aria-activedescendant':
        isOpen && highlightedIndex >= 0 ? `${optionIdPrefix}-${highlightedIndex}` : undefined,
    },
    listboxProps: {
      id: listboxId,
      role: 'listbox',
    },
    getOptionProps,
    close,
    searchImmediate,
  };
}
