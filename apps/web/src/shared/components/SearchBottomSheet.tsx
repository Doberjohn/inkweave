import {forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SET_ABBREVIATIONS, SPACING, Z_INDEX} from '../constants';
import {useCardDataContext} from '../contexts/CardDataContext';
import {smallImageUrl} from '../../features/cards/loader';
import {useAutocomplete, useScrollLock, useTransitionPresence} from '../hooks';

// --- Highlighted name (reused from SearchAutocomplete) ---

function HighlightedName({fullName, query}: {fullName: string; query: string}) {
  if (!query || query.length < 2) return <>{fullName}</>;

  const lowerName = fullName.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerName.indexOf(lowerQuery);

  if (matchIndex === -1) return <>{fullName}</>;

  const before = fullName.slice(0, matchIndex);
  const match = fullName.slice(matchIndex, matchIndex + query.length);
  const after = fullName.slice(matchIndex + query.length);

  return (
    <>
      {before}
      <mark style={{background: 'transparent', color: COLORS.primary, fontWeight: 600}}>
        {match}
      </mark>
      {after}
    </>
  );
}

// --- Ink color for thumbnail fallback ---

const INK_COLORS: Record<string, string> = {
  Amber: '#f59e0b',
  Amethyst: '#8b5cf6',
  Emerald: '#10b981',
  Ruby: '#ef4444',
  Sapphire: '#3b82f6',
  Steel: '#71717a',
};

function inkColor(card: LorcanaCard): string {
  const ink = Array.isArray(card.inkColor) ? card.inkColor[0] : card.inkColor;
  return INK_COLORS[ink ?? ''] ?? COLORS.surfaceBorder;
}

// --- Recent searches (localStorage) ---

const RECENT_KEY = 'inkweave-recent-searches';
const MAX_RECENT = 6;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const recent = getRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    recent.unshift(trimmed);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // Storage unavailable (private browsing, quota exceeded)
  }
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Storage unavailable
  }
}

// --- Component ---

export interface SearchBottomSheetHandle {
  /** Focus the proxy input synchronously — call from the tap handler to preserve iOS keyboard activation. */
  focusProxy: () => void;
}

interface SearchBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchBottomSheet = forwardRef<SearchBottomSheetHandle, SearchBottomSheetProps>(
  function SearchBottomSheet({isOpen, onClose}, ref) {
    const navigate = useNavigate();
    const {cards} = useCardDataContext();
    const inputRef = useRef<HTMLInputElement>(null);
    const proxyRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focusProxy: () => proxyRef.current?.focus(),
    }));

    const [query, setQuery] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);

    const handleSelect = useCallback(
      (card: LorcanaCard) => {
        addRecentSearch(card.fullName);
        onClose();
        // Small delay so close animation starts before navigation
        setTimeout(() => navigate(`/card/${card.id}`), 50);
      },
      [navigate, onClose],
    );

    const autocomplete = useAutocomplete({
      cards,
      query,
      onQueryChange: setQuery,
      onSelect: handleSelect,
    });

    // Track open/close state changes
    useEffect(() => {
      if (isOpen) {
        setRecentSearches(getRecentSearches());
      } else {
        setQuery('');
        autocomplete.close();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Focus the input once the sheet is visible (not just mounted).
    // The sheet starts with `visibility: hidden` during its enter transition,
    // and browsers silently ignore .focus() on hidden elements.
    useEffect(() => {
      if (visible) {
        inputRef.current?.focus();
      }
    }, [visible]);

    useScrollLock(isOpen);

    const handleRecentClick = useCallback(
      (term: string) => {
        autocomplete.searchImmediate(term);
        inputRef.current?.focus();
      },
      [autocomplete],
    );

    const handleClearRecent = useCallback(() => {
      clearRecentSearches();
      setRecentSearches([]);
    }, []);

    const handleBackdropClick = useCallback(() => {
      onClose();
    }, [onClose]);

    // Handle Escape key
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Proxy input: always in the DOM so iOS can focus it synchronously on tap,
    // keeping the keyboard activation "ticket" alive until the real input mounts.
    const proxyInput = (
      <input
        ref={proxyRef}
        aria-hidden="true"
        tabIndex={-1}
        style={{position: 'fixed', opacity: 0, pointerEvents: 'none', left: -9999}}
      />
    );

    if (!mounted) return proxyInput;

    const hasResults = autocomplete.suggestions.length > 0 && query.length >= 2;
    const sheetTop = hasResults ? 100 : 244;

    return (
      <>
        {proxyInput}
        {/* Backdrop */}
        <div
          className={`overlay-transition overlay-enter ${visible ? 'overlay-visible' : ''}`}
          onTransitionEnd={onTransitionEnd}
          onClick={handleBackdropClick}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: Z_INDEX.modalBackdrop,
          }}
        />

        {/* Sheet */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search cards"
          className={`overlay-transition overlay-slide-up overlay-enter ${visible ? 'overlay-visible' : ''}`}
          onTransitionEnd={onTransitionEnd}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            top: sheetTop,
            background: COLORS.surface,
            borderRadius: '24px 24px 0 0',
            boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.6)',
            zIndex: Z_INDEX.modal,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'top 0.25s ease, opacity 0.25s ease, transform 0.25s ease',
          }}>
          {/* Drag handle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: `${SPACING.md}px 0 ${SPACING.sm}px`,
              flexShrink: 0,
            }}>
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: '#444466',
              }}
            />
          </div>

          {/* Search input row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.md,
              padding: `0 ${SPACING.lg}px ${SPACING.md}px`,
              flexShrink: 0,
            }}>
            {/* Search icon */}
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              style={{flexShrink: 0}}>
              <circle cx="9" cy="9" r="6" stroke={COLORS.primary} strokeWidth="1.5" />
              <line
                x1="13.5"
                y1="13.5"
                x2="17"
                y2="17"
                stroke={COLORS.primary}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Input */}
            <div style={{flex: 1, position: 'relative'}}>
              <input
                ref={inputRef}
                type="text"
                aria-label="Search cards"
                placeholder="Search cards..."
                {...autocomplete.inputProps}
                onKeyDown={(e) => {
                  autocomplete.inputProps.onKeyDown(e);
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                  } else if (!e.defaultPrevented && e.key === 'Enter' && query.trim()) {
                    onClose();
                    navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
                  }
                }}
                data-testid="search-sheet-input"
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 36px 0 12px',
                  borderRadius: RADIUS.lg,
                  border: `1px solid ${COLORS.primary}`,
                  background: 'rgba(15, 23, 43, 0.8)',
                  color: COLORS.text,
                  fontSize: `${FONT_SIZES.lg}px`,
                  fontFamily: FONTS.body,
                  boxSizing: 'border-box',
                  outline: 'none',
                  boxShadow: '0 0 8px rgba(212, 175, 55, 0.2)',
                }}
              />
              {/* Clear button */}
              {query && (
                <button
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('');
                    autocomplete.close();
                    inputRef.current?.focus();
                  }}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    border: 'none',
                    background: COLORS.surfaceBorder,
                    color: COLORS.textMuted,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    lineHeight: 1,
                    padding: 0,
                  }}>
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{height: 1, background: COLORS.surfaceBorder, flexShrink: 0}} />

          {/* Content area */}
          <div style={{flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch'}}>
            {hasResults ? (
              /* Results list */
              <div>
                <div
                  style={{
                    padding: `${SPACING.sm}px ${SPACING.lg}px`,
                    fontSize: `${FONT_SIZES.sm}px`,
                    color: COLORS.textMuted,
                    fontFamily: FONTS.body,
                    fontWeight: 500,
                  }}>
                  {autocomplete.suggestions.length} result
                  {autocomplete.suggestions.length !== 1 ? 's' : ''}
                </div>
                {autocomplete.suggestions.map((card, index) => {
                  const optionProps = autocomplete.getOptionProps(index);
                  const isHighlighted = index === autocomplete.highlightedIndex;
                  const setAbbr =
                    SET_ABBREVIATIONS[card.setCode as keyof typeof SET_ABBREVIATIONS] ??
                    card.setCode ??
                    '';

                  return (
                    <div key={card.id}>
                      <div
                        {...optionProps}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACING.md,
                          padding: `${SPACING.sm}px ${SPACING.lg}px`,
                          minHeight: 60,
                          cursor: 'pointer',
                          background: isHighlighted ? COLORS.surfaceHover : 'transparent',
                          transition: 'background 0.1s ease',
                        }}>
                        {/* Card thumbnail */}
                        <div
                          style={{
                            width: 38,
                            height: 53,
                            borderRadius: 4,
                            background: inkColor(card),
                            flexShrink: 0,
                            overflow: 'hidden',
                          }}>
                          {card.imageUrl && (
                            <img
                              src={smallImageUrl(card.imageUrl) ?? card.imageUrl}
                              alt=""
                              loading="lazy"
                              style={{width: '100%', height: '100%', objectFit: 'cover'}}
                            />
                          )}
                        </div>

                        {/* Card info */}
                        <div style={{flex: 1, minWidth: 0}}>
                          <div
                            style={{
                              fontSize: `${FONT_SIZES.lg}px`,
                              fontWeight: 500,
                              color: COLORS.text,
                              fontFamily: FONTS.body,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                            <HighlightedName fullName={card.fullName} query={query} />
                          </div>
                          <div
                            style={{
                              fontSize: `${FONT_SIZES.sm}px`,
                              color: COLORS.textMuted,
                              fontFamily: FONTS.body,
                              marginTop: 2,
                            }}>
                            {setAbbr}
                            {card.inkColor
                              ? ` · ${Array.isArray(card.inkColor) ? card.inkColor.join('-') : card.inkColor}`
                              : ''}
                          </div>
                        </div>

                        {/* Chevron */}
                        <svg
                          aria-hidden="true"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          style={{flexShrink: 0}}>
                          <path
                            d="M9 18l6-6-6-6"
                            stroke="#444466"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      {/* Separator */}
                      {index < autocomplete.suggestions.length - 1 && (
                        <div
                          style={{
                            height: 1,
                            background: '#222244',
                            marginLeft: SPACING.lg,
                            marginRight: SPACING.lg,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty state: recent searches */
              <div style={{padding: `${SPACING.md}px ${SPACING.lg}px`}}>
                {recentSearches.length > 0 && (
                  <div style={{marginBottom: SPACING.xl}}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: SPACING.md,
                      }}>
                      <span
                        style={{
                          fontSize: `${FONT_SIZES.xs}px`,
                          fontWeight: 600,
                          color: COLORS.textMuted,
                          fontFamily: FONTS.body,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                        }}>
                        Recent
                      </span>
                      <button
                        onClick={handleClearRecent}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: COLORS.primary,
                          fontSize: `${FONT_SIZES.xs}px`,
                          fontWeight: 500,
                          fontFamily: FONTS.body,
                          cursor: 'pointer',
                          padding: 0,
                        }}>
                        Clear
                      </button>
                    </div>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: SPACING.sm}}>
                      {recentSearches.map((term) => (
                        <button
                          key={term}
                          onClick={() => handleRecentClick(term)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            height: 32,
                            padding: '0 12px',
                            borderRadius: 16,
                            border: `1px solid ${COLORS.surfaceBorder}`,
                            background: COLORS.surfaceAlt,
                            color: COLORS.text,
                            fontSize: `${FONT_SIZES.xs}px`,
                            fontWeight: 500,
                            fontFamily: FONTS.body,
                            cursor: 'pointer',
                          }}>
                          <svg
                            aria-hidden="true"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none">
                            <circle cx="12" cy="12" r="10" stroke="#444466" strokeWidth="2" />
                            <path
                              d="M12 6v6l4 2"
                              stroke="#444466"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prompt text when no recent searches */}
                {recentSearches.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: `${SPACING.xxl}px 0`,
                      color: COLORS.textMuted,
                      fontSize: `${FONT_SIZES.base}px`,
                      fontFamily: FONTS.body,
                    }}>
                    Search for a card to see its synergies
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  },
);
