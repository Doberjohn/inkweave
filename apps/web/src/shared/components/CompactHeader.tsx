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

// =====================================================================
// Style helpers — module-level so their branches don't roll up to JSX.
// =====================================================================

function getHeaderStyle(mobile: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: `linear-gradient(180deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
    borderBottom: `1px solid ${COLORS.surfaceBorder}`,
    boxSizing: 'border-box',
    position: 'sticky',
    top: 0,
    zIndex: Z_INDEX.autocomplete + 1,
  };
  if (mobile) {
    return {
      ...base,
      height: LAYOUT.compactHeaderHeightMobile,
      minHeight: LAYOUT.compactHeaderHeightMobile,
      padding: `0 ${SPACING.lg}px`,
      gap: SPACING.md,
    };
  }
  return {
    ...base,
    height: LAYOUT.compactHeaderHeight,
    minHeight: LAYOUT.compactHeaderHeight,
    padding: '0 32px',
    gap: SPACING.lg,
  };
}

function getNavItemBackground(isActive: boolean, isHovered: boolean): string {
  if (isActive) return COLORS.surfaceHover;
  if (isHovered) return 'rgba(255, 185, 0, 0.06)';
  return 'transparent';
}

function getNavItemColor(isActive: boolean, isHovered: boolean): string {
  if (isActive) return COLORS.primary;
  if (isHovered) return COLORS.primary;
  return COLORS.textMuted;
}

function getNavItemBoxShadow(isHovered: boolean, isActive: boolean): string {
  if (!isHovered) return 'none';
  if (isActive) return 'none';
  return '0 0 12px rgba(255, 185, 0, 0.15), inset 0 0 8px rgba(255, 185, 0, 0.05)';
}

function getRevealsPillBg(isActive: boolean): string {
  if (isActive) {
    return 'linear-gradient(180deg, rgba(255, 185, 0, 0.28) 0%, rgba(255, 185, 0, 0.14) 100%)';
  }
  return 'linear-gradient(180deg, rgba(255, 185, 0, 0.14) 0%, rgba(255, 185, 0, 0.06) 100%)';
}

function getRevealsPillShadow(isActive: boolean, isHovered: boolean): string {
  if (isActive) return '0 0 20px rgba(255, 185, 0, 0.35)';
  if (isHovered) return '0 0 20px rgba(255, 185, 0, 0.35)';
  return '0 0 12px rgba(255, 185, 0, 0.2)';
}

interface SearchSizing {
  iconSize: number;
  iconLeft: number;
  inputHeight: number;
  inputPadding: string;
  maxWidth: number | undefined;
}

function getSearchSizing(mobile: boolean): SearchSizing {
  if (mobile) {
    return {iconSize: 14, iconLeft: 10, inputHeight: 34, inputPadding: '0 10px 0 32px', maxWidth: undefined};
  }
  return {iconSize: 16, iconLeft: 12, inputHeight: 36, inputPadding: '0 12px 0 36px', maxWidth: 320};
}

function getSearchInputStyle(
  focused: boolean,
  height: number,
  padding: string,
): React.CSSProperties {
  const borderColor = focused ? 'rgba(212, 175, 55, 0.5)' : COLORS.searchBorder;
  const boxShadow = focused
    ? '0 0 0 2px rgba(212, 175, 55, 0.15), 0 0 12px rgba(212, 175, 55, 0.08)'
    : 'none';
  return {
    width: '100%',
    height,
    padding,
    borderRadius: `${RADIUS.lg}px`,
    border: `1px solid ${borderColor}`,
    background: COLORS.searchBg,
    color: COLORS.text,
    fontSize: `${FONT_SIZES.lg}px`,
    fontFamily: FONTS.body,
    boxSizing: 'border-box',
    outline: 'none',
    boxShadow,
    transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
  };
}

// =====================================================================
// Subcomponents — internal, not exported. Each owns a small concern.
// =====================================================================

interface HeaderLogoProps {
  showBackArrow?: boolean;
  mobile: boolean;
  onClick: () => void;
}

function HeaderLogo({showBackArrow, mobile, onClick}: HeaderLogoProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
  };
  return (
    <a
      href="/"
      onClick={handleClick}
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
        <span style={{fontSize: `${FONT_SIZES.base}px`, fontWeight: 500, color: COLORS.primary}}>
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
  );
}

interface HeaderSearchProps {
  cards: LorcanaCard[];
  query: string;
  onChange: (q: string) => void;
  onSubmit?: () => void;
  onCardSelect?: (card: LorcanaCard) => void;
  mobile: boolean;
}

function HeaderSearch({cards, query, onChange, onSubmit, onCardSelect, mobile}: HeaderSearchProps) {
  const [focused, setFocused] = useState(false);
  const sizing = getSearchSizing(mobile);

  const handleSelect = (card: LorcanaCard) => {
    if (onCardSelect) onCardSelect(card);
  };

  const autocomplete = useAutocomplete({
    cards,
    query,
    onQueryChange: onChange,
    onSelect: handleSelect,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    autocomplete.inputProps.onKeyDown(e);
    if (e.defaultPrevented) return;
    if (e.key !== 'Enter') return;
    if (onSubmit) onSubmit();
  };

  const handleFocus = () => {
    autocomplete.inputProps.onFocus();
    setFocused(true);
  };

  const handleBlur = () => {
    autocomplete.inputProps.onBlur();
    setTimeout(() => setFocused(false), 150);
  };

  return (
    <div
      style={{
        flex: 1,
        maxWidth: sizing.maxWidth,
        position: 'relative',
        zIndex: Z_INDEX.autocomplete,
      }}>
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: sizing.iconLeft,
          top: '50%',
          transform: 'translateY(-50%)',
          width: sizing.iconSize,
          height: sizing.iconSize,
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
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-testid="browse-search"
        style={getSearchInputStyle(focused, sizing.inputHeight, sizing.inputPadding)}
      />
      <SearchAutocomplete
        suggestions={autocomplete.suggestions}
        isOpen={autocomplete.isOpen}
        highlightedIndex={autocomplete.highlightedIndex}
        query={query}
        listboxProps={autocomplete.listboxProps}
        getOptionProps={autocomplete.getOptionProps}
      />
    </div>
  );
}

interface NavItemLinkProps {
  path: string;
  label: string;
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onNavigate: (path: string) => void;
}

function NavItemLink({
  path,
  label,
  isActive,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
}: NavItemLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(path);
  };
  return (
    <a
      href={path}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 20px',
        height: '100%',
        background: getNavItemBackground(isActive, isHovered),
        color: getNavItemColor(isActive, isHovered),
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: isActive ? 600 : 500,
        textDecoration: 'none',
        transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: getNavItemBoxShadow(isHovered, isActive),
        cursor: 'pointer',
      }}>
      {label}
    </a>
  );
}

interface RevealsPillProps {
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onNavigate: () => void;
}

function RevealsPill({isActive, isHovered, onMouseEnter, onMouseLeave, onNavigate}: RevealsPillProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate();
  };
  return (
    <a
      href={REVEALS_PATH}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-current={isActive ? 'page' : undefined}
      aria-label="Reveals"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        height: 38,
        borderRadius: 999,
        background: getRevealsPillBg(isActive),
        border: `1px solid ${COLORS.primary500}`,
        color: COLORS.primary,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 600,
        textDecoration: 'none',
        boxShadow: getRevealsPillShadow(isActive, isHovered),
        transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
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
  );
}

interface DesktopNavProps {
  isRevealSeason: boolean;
}

function DesktopNav({isRevealSeason}: DesktopNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const isRevealsActive = location.pathname.startsWith(REVEALS_PATH);
  const isRevealsHovered = hoveredNav === REVEALS_PATH;

  return (
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
        {NAV_ITEMS.map(({path, label}) => (
          <NavItemLink
            key={path}
            path={path}
            label={label}
            isActive={location.pathname.startsWith(path)}
            isHovered={hoveredNav === path}
            onMouseEnter={() => setHoveredNav(path)}
            onMouseLeave={() => setHoveredNav(null)}
            onNavigate={navigate}
          />
        ))}
      </div>
      {isRevealSeason && (
        <RevealsPill
          isActive={isRevealsActive}
          isHovered={isRevealsHovered}
          onMouseEnter={() => setHoveredNav(REVEALS_PATH)}
          onMouseLeave={() => setHoveredNav(null)}
          onNavigate={() => navigate(REVEALS_PATH)}
        />
      )}
    </nav>
  );
}

// =====================================================================
// Public component — layout shell that delegates to subcomponents above.
// =====================================================================

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
  const revealPhase = useRevealPhase();
  const isRevealSeason = revealPhase === 'pre-release' || revealPhase === 'pre-release-live';
  const mobile = !!isMobile;
  const hasSearch = searchQuery !== undefined && onSearchChange !== undefined;

  return (
    <header data-testid="compact-header" style={getHeaderStyle(mobile)}>
      <HeaderLogo mobile={mobile} showBackArrow={showBackArrow} onClick={onLogoClick} />
      {hasSearch && (
        <HeaderSearch
          cards={cards}
          query={searchQuery}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
          onCardSelect={onCardSelect}
          mobile={mobile}
        />
      )}
      {!mobile && <DesktopNav isRevealSeason={isRevealSeason} />}
      {headerActions}
    </header>
  );
}
