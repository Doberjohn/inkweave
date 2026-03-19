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
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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
    if (newValue.length < minChars) {
      setDebouncedQuery('');
      setHighlightedIndex(-1);
      return;
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(newValue);
      setHighlightedIndex(-1);
    }, debounceMs);
  };

  // Compute suggestions from debounced query, sorted by descending set code
  const suggestions = (() => {
    if (!debouncedQuery || debouncedQuery.length < minChars) return [];
    return searchCardsByName(cards, debouncedQuery)
      .sort((a, b) => parseSetOrder(b.setCode) - parseSetOrder(a.setCode))
      .slice(0, maxResults);
  })();

  const isOpen = isFocused && suggestions.length > 0 && query.length >= minChars;

  const close = () => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
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
    // Delay blur to allow mousedown on suggestion items to fire before dropdown closes
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
