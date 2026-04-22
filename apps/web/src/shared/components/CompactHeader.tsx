import {useState, type ReactNode} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, LAYOUT, RADIUS, SPACING, Z_INDEX} from '../constants';
import {useAutocomplete} from '../hooks';
import {useRevealPhase} from '../../features/reveals';
import {SearchAutocomplete} from './SearchAutocomplete';

interface CompactHeaderProps {
  onLogoClick: () => void;
  /** When true, renders "← INKWEAVE" as a back button instead of just "INKWEAVE" */
  showBackArrow?: boolean;
  /** Search bar props. When provided, renders an inline search bar in the header. */
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

interface NavItem {
  path: string;
  label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  {path: '/browse', label: 'Browse'},
  {path: '/playstyles', label: 'Playstyles'},
  {path: '/vote', label: 'Vote'},
];

const REVEALS_PATH = '/reveals';

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
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const revealPhase = useRevealPhase();
  const isRevealSeason = revealPhase === 'pre-release' || revealPhase === 'pre-release-live';
  const isRevealsActive = location.pathname.startsWith(REVEALS_PATH);
  const isRevealsHovered = hoveredNav === REVEALS_PATH;
  const hasSearch = searchQuery !== undefined && onSearchChange !== undefined;
  const mobile = !!isMobile;

  const headerHeight = mobile ? LAYOUT.compactHeaderHeightMobile : LAYOUT.compactHeaderHeight;
  const iconSize = mobile ? 14 : 16;
  const inputHeight = mobile ? 34 : 36;
  const inputPadding = mobile ? '0 10px 0 32px' : '0 12px 0 36px';

  const handleAutoSelect = (card: LorcanaCard) => onCardSelect?.(card);

  const autocomplete = useAutocomplete({
    cards,
    query: searchQuery ?? '',
    onQueryChange: onSearchChange ?? (() => {}),
    onSelect: handleAutoSelect,
  });

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onLogoClick();
  };

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
        <img
          src="/brand/logo.svg"
          alt="Inkweave"
          draggable={false}
          style={{
            display: 'block',
            height: mobile ? 22 : 24,
            width: 'auto',
            userSelect: 'none',
          }}
        />
      </a>

      {/* Center: Search bar */}
      {hasSearch && (
        <div
          style={{
            flex: 1,
            maxWidth: mobile ? undefined : 320,
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

      {/* Nav (desktop only, centered across full header).
          During reveal season, Reveals breaks out of the strip as a standalone
          gold-outlined pill that visually reads as a promotion, not a menu item. */}
      {!mobile && (
        <nav
          aria-label="Main navigation"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 38,
              borderRadius: RADIUS.lg,
              border: `1px solid ${COLORS.surfaceBorder}`,
              background: '#10101c',
              overflow: 'hidden',
            }}>
            {NAV_ITEMS.map(({path, label}) => {
              const isActive = location.pathname.startsWith(path);
              const isHovered = hoveredNav === path;
              return (
                <a
                  key={path}
                  href={path}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(path);
                  }}
                  onMouseEnter={() => setHoveredNav(path)}
                  onMouseLeave={() => setHoveredNav(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 20px',
                    height: '100%',
                    background: isActive
                      ? COLORS.surfaceHover
                      : isHovered
                        ? 'rgba(255, 185, 0, 0.06)'
                        : 'transparent',
                    color: isActive || isHovered ? COLORS.primary : COLORS.textMuted,
                    fontFamily: FONTS.body,
                    fontSize: `${FONT_SIZES.base}px`,
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                    transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                    boxShadow:
                      isHovered && !isActive
                        ? '0 0 12px rgba(255, 185, 0, 0.15), inset 0 0 8px rgba(255, 185, 0, 0.05)'
                        : 'none',
                    cursor: 'pointer',
                  }}>
                  {label}
                </a>
              );
            })}
          </div>
          {isRevealSeason && (
            <a
              href={REVEALS_PATH}
              onClick={(e) => {
                e.preventDefault();
                navigate(REVEALS_PATH);
              }}
              onMouseEnter={() => setHoveredNav(REVEALS_PATH)}
              onMouseLeave={() => setHoveredNav(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 14px',
                height: 38,
                borderRadius: 999,
                background: isRevealsActive
                  ? 'linear-gradient(180deg, rgba(255, 185, 0, 0.28) 0%, rgba(255, 185, 0, 0.14) 100%)'
                  : 'linear-gradient(180deg, rgba(255, 185, 0, 0.14) 0%, rgba(255, 185, 0, 0.06) 100%)',
                border: `1px solid ${COLORS.primary500}`,
                color: COLORS.primary,
                fontFamily: FONTS.body,
                fontSize: `${FONT_SIZES.base}px`,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow:
                  isRevealsHovered || isRevealsActive
                    ? '0 0 20px rgba(255, 185, 0, 0.35)'
                    : '0 0 12px rgba(255, 185, 0, 0.2)',
                transform: isRevealsHovered ? 'translateY(-1px)' : 'translateY(0)',
                transition:
                  'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 200ms cubic-bezier(0.2, 0.8, 0.2, 1), background 200ms ease',
                cursor: 'pointer',
              }}>
              Reveals
              <span
                style={{
                  fontSize: FONT_SIZES.xs,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: COLORS.primary500,
                  color: COLORS.background,
                  letterSpacing: 0.4,
                  lineHeight: 1,
                }}>
                NEW
              </span>
            </a>
          )}
        </nav>
      )}

      {/* Optional header actions (e.g. filters button on CardPage) */}
      {headerActions}
    </header>
  );
}
