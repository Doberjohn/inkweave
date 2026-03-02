import {useCallback, useState, type ReactNode} from 'react';
import type {LorcanaCard} from 'lorcana-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING, Z_INDEX} from '../constants';
import {useAutocomplete} from '../hooks';
import {SearchAutocomplete} from './SearchAutocomplete';

interface CompactHeaderProps {
  onLogoClick: () => void;
  /** When true, renders "← INKWEAVE" as a back button instead of just "INKWEAVE" */
  showBackArrow?: boolean;
  /** Search bar props — when provided, renders an inline search bar in the header */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchSubmit?: () => void;
  /** Cards for autocomplete suggestions */
  cards?: LorcanaCard[];
  onCardSelect?: (card: LorcanaCard) => void;
  /** Optional actions rendered after the search bar (e.g. filters button on CardPage) */
  headerActions?: ReactNode;
  /** Responsive mobile flag */
  isMobile?: boolean;
}

export function CompactHeader({
  onLogoClick,
  showBackArrow,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  cards = [],
  onCardSelect,
  headerActions,
  isMobile,
}: CompactHeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const hasSearch = searchQuery !== undefined && onSearchChange !== undefined;
  const mobile = !!isMobile;

  const headerHeight = mobile ? LAYOUT.compactHeaderHeightMobile : LAYOUT.compactHeaderHeight;
  const iconSize = mobile ? 14 : 16;
  const inputHeight = mobile ? 34 : 36;
  const inputPadding = mobile ? '0 10px 0 32px' : '0 12px 0 36px';

  const handleAutoSelect = useCallback((card: LorcanaCard) => onCardSelect?.(card), [onCardSelect]);

  const autocomplete = useAutocomplete({
    cards,
    query: searchQuery ?? '',
    onQueryChange: onSearchChange ?? (() => {}),
    onSelect: handleAutoSelect,
  });

  const handleLogoClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onLogoClick();
    },
    [onLogoClick],
  );

  return (
    <header
      data-testid="compact-header"
      style={{
        height: headerHeight,
        minHeight: headerHeight,
        padding: mobile ? `0 ${SPACING.lg}px` : '0 32px',
        display: 'flex',
        alignItems: 'center',
        gap: mobile ? SPACING.md : SPACING.lg,
        background: `linear-gradient(180deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
        borderBottom: `1px solid ${COLORS.surfaceBorder}`,
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        zIndex: Z_INDEX.autocomplete + 1,
      }}>
      {/* Logo / Back link */}
      <a
        href="/"
        onClick={handleLogoClick}
        aria-label="Go to home page"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
          textDecoration: 'none',
        }}>
        {showBackArrow && (
          <span
            style={{
              fontSize: `${FONT_SIZES.base}px`,
              fontWeight: 500,
              color: COLORS.primary,
            }}>
            ←
          </span>
        )}
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 700,
            color: COLORS.primary,
            letterSpacing: '0.18em',
          }}>
          INKWEAVE
        </span>
      </a>

      {/* Center: Search bar */}
      {hasSearch && (
        <div
          style={{
            flex: 1,
            maxWidth: mobile ? undefined : 480,
            position: 'relative',
            zIndex: Z_INDEX.autocomplete,
          }}>
          {/* Search icon */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: mobile ? 10 : 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: iconSize,
              height: iconSize,
              pointerEvents: 'none',
              zIndex: 1,
            }}
            viewBox="0 0 20 20"
            fill="none">
            <circle cx="9" cy="9" r="6" stroke={COLORS.searchPlaceholder} strokeWidth="1.5" />
            <line
              x1="13.5"
              y1="13.5"
              x2="17"
              y2="17"
              stroke={COLORS.searchPlaceholder}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            aria-label="Search cards"
            placeholder="Search cards..."
            {...autocomplete.inputProps}
            onKeyDown={(e) => {
              autocomplete.inputProps.onKeyDown(e);
              if (!e.defaultPrevented && e.key === 'Enter') {
                onSearchSubmit?.();
              }
            }}
            onFocus={() => {
              autocomplete.inputProps.onFocus();
              setIsSearchFocused(true);
            }}
            onBlur={() => {
              autocomplete.inputProps.onBlur();
              setTimeout(() => setIsSearchFocused(false), 150);
            }}
            data-testid="browse-search"
            style={{
              width: '100%',
              height: inputHeight,
              padding: inputPadding,
              borderRadius: `${RADIUS.lg}px`,
              border: `1px solid ${isSearchFocused ? 'rgba(212, 175, 55, 0.5)' : COLORS.searchBorder}`,
              background: COLORS.searchBg,
              color: COLORS.text,
              fontSize: `${FONT_SIZES.lg}px`,
              fontFamily: FONTS.body,
              boxSizing: 'border-box',
              outline: 'none',
              boxShadow: isSearchFocused
                ? '0 0 0 2px rgba(212, 175, 55, 0.15), 0 0 12px rgba(212, 175, 55, 0.08)'
                : 'none',
              transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
            }}
          />
          <SearchAutocomplete
            suggestions={autocomplete.suggestions}
            isOpen={autocomplete.isOpen}
            highlightedIndex={autocomplete.highlightedIndex}
            query={searchQuery ?? ''}
            listboxProps={autocomplete.listboxProps}
            getOptionProps={autocomplete.getOptionProps}
          />
        </div>
      )}

      {/* Optional header actions (e.g. filters button on CardPage) */}
      {headerActions}
    </header>
  );
}
