import {useEffect, useId, useRef, useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';

/**
 * The cards a term suggests, in the order the list shows them. The app passes its loader's
 * `suggestCardsByName` (#981).
 */
export type CardSearch = (cards: LorcanaCard[], term: string) => LorcanaCard[];

interface UseAutocompleteOptions {
  cards: LorcanaCard[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (card: LorcanaCard) => void;
  search: CardSearch;
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

/** The step each arrow key takes through the list. */
const ARROW_STEPS: Record<string, 1 | -1> = {ArrowDown: 1, ArrowUp: -1};

/**
 * The option one step from `from` in a list of `count` (at least one), wrapping at both ends.
 * From no highlight (-1), a step down lands on the first option and a step up on the last.
 */
function stepIndex(from: number, step: 1 | -1, count: number): number {
  if (step === 1) return (from + 1) % count;
  return from <= 0 ? count - 1 : from - 1;
}

export function useAutocomplete({
  cards,
  query,
  onQueryChange,
  onSelect,
  search,
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

  // Suggestions for a search term, in the search's order
  const suggestionsFor = (term: string) => {
    if (!term || term.length < minChars) return [];
    return search(cards, term).slice(0, maxResults);
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
   * Arrow keys step through the list for the text in the input, opening it if it is closed.
   * While a debounce is pending, the list on screen is still an earlier keystroke's, or there
   * is none yet, and the timer reset the highlight when it fired, so a quick Enter picked
   * nothing and submitted the search instead. Applying the typed text first, and cancelling
   * that timer, lands the step in the list Enter reads. Returns false, changing nothing, when
   * the typed text has no matches.
   */
  const moveHighlight = (step: 1 | -1) => {
    const count = suggestionsFor(query).length;
    if (count === 0) return false;
    clearTimeout(debounceTimeoutRef.current);
    setDebouncedQuery(query);
    setHighlightedIndex((prev) => stepIndex(prev, step, count));
    return true;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // An arrow claims the key only when the typed text has matches to step through.
    const step = ARROW_STEPS[e.key];
    if (step && moveHighlight(step)) e.preventDefault();
    // Escape runs close() whether or not the list is open: typing faster than the debounce
    // leaves it unopened, and close() still cancels the timer that would open it straight after.
    if (e.key === 'Escape') close();
    if (!isOpen) return;

    switch (e.key) {
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault();
          selectItem(suggestions[highlightedIndex]);
        }
        // If no highlight, let event propagate (e.g., HeroSection search submit)
        break;
      case 'Escape':
        // close() ran above. Only an open list claims the key; a closed one leaves it to
        // whatever else listens for it.
        e.preventDefault();
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
