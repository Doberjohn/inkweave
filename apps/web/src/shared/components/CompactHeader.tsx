import {type ReactNode, useState} from 'react';
import {Link, NavLink} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, EASING, FONT_SIZES, FONTS, GOLD_GLOW, LAYOUT, RADIUS, SHADOWS, SPACING, Z_INDEX} from '../constants';
import {useAutocomplete} from '../hooks';
import {useRevealPhase} from '../../features/reveals';
import {AuthButton} from './AuthButton';
import {CTA_FILLED_STYLE} from './ctaStyles';
import {headerCarriesAuth, type ViewportConfig} from './headerChrome';
import {SignInDialog} from './SignInDialog';
import {SearchAutocomplete} from './SearchAutocomplete';

interface CompactHeaderProps {
  /** Optional side-effect callback fired before nav. Link handles the route push. */
  onLogoClick?: () => void;
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

/**
 * Accounts ship dark until there is something to do with one (#474, 2026-10-01).
 *
 * This gates the control, NOT the routes. `/account` and `/auth/callback` stay
 * mounted: the callback is an OAuth redirect TARGET, so unmounting it would turn a
 * provider round-trip into a 404 for anyone mid-flight, and leaving both reachable
 * by URL is what makes the feature testable in production without being findable.
 */
const SHOW_ACCOUNTS = import.meta.env.VITE_SHOW_ACCOUNTS === 'true';

// =====================================================================
// Domain types — encapsulate related flags so function signatures carry
// semantics, not bare primitives. Also prevents arg-order swaps between
// same-type booleans (e.g. `(isActive, isHovered)` vs `(isHovered, isActive)`).
// =====================================================================

/** The interactive state of a nav-style element. */
interface InteractionState {
  isActive: boolean;
  isHovered: boolean;
}

// ViewportConfig and headerCarriesAuth live in ./headerChrome, so other surfaces
// can read the same rule without importing a component.

/** All knobs needed to compute the search-input wrapper style. */
interface SearchInputStyleConfig {
  focused: boolean;
  height: number;
  padding: string;
}

// =====================================================================
// Style helpers — module-level so their branches don't roll up to JSX.
// =====================================================================

function getHeaderStyle(viewport: ViewportConfig): React.CSSProperties {
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
  if (viewport.isMobile) {
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

function getNavItemBackground(state: InteractionState): string {
  if (state.isActive) return COLORS.surfaceHover;
  if (state.isHovered) return GOLD_GLOW.hoverBg;
  return 'transparent';
}

function getNavItemColor(state: InteractionState): string {
  if (state.isActive) return COLORS.primary;
  if (state.isHovered) return COLORS.primary;
  return COLORS.textMuted;
}

function getNavItemBoxShadow(state: InteractionState): string {
  if (!state.isHovered) return 'none';
  if (state.isActive) return 'none';
  return GOLD_GLOW.shadow;
}

interface SearchSizing {
  iconSize: number;
  iconLeft: number;
  inputHeight: number;
  inputPadding: string;
  maxWidth: number | undefined;
}

function getSearchSizing(viewport: ViewportConfig): SearchSizing {
  if (viewport.isMobile) {
    return {iconSize: 14, iconLeft: 10, inputHeight: 34, inputPadding: '0 10px 0 32px', maxWidth: undefined};
  }
  return {iconSize: 16, iconLeft: 12, inputHeight: 36, inputPadding: '0 12px 0 36px', maxWidth: 320};
}

function getSearchInputStyle(config: SearchInputStyleConfig): React.CSSProperties {
  const borderColor = config.focused ? GOLD_GLOW.activeBorder : COLORS.searchBorder;
  const boxShadow = config.focused
    ? GOLD_GLOW.focusRing
    : 'none';
  return {
    width: '100%',
    height: config.height,
    padding: config.padding,
    borderRadius: `${RADIUS.lg}px`,
    border: `1px solid ${borderColor}`,
    background: COLORS.searchBg,
    color: COLORS.text,
    fontSize: `${FONT_SIZES.lg}px`,
    fontFamily: FONTS.body,
    boxSizing: 'border-box',
    outline: 'none',
    boxShadow,
    transition: `border-color 0.25s ${EASING.snappy}, box-shadow 0.25s ${EASING.snappy}`,
  };
}

function isPlainLeftClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

// =====================================================================
// Subcomponents — internal, not exported. Each owns a small concern.
// =====================================================================

interface HeaderLogoProps {
  showBackArrow?: boolean;
  viewport: ViewportConfig;
  onClick?: () => void;
}

function HeaderLogo({showBackArrow, viewport, onClick}: HeaderLogoProps) {
  // Side-effect only on regular click. Link handles the navigation + modifier-click semantics.
  const handleClick = (e: React.MouseEvent) => {
    if (!isPlainLeftClick(e)) return;
    onClick?.();
  };
  return (
    <Link
      to="/"
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
          height: viewport.isMobile ? 22 : 24,
          width: 'auto',
          userSelect: 'none',
        }}
      />
    </Link>
  );
}

interface HeaderSearchProps {
  cards: LorcanaCard[];
  query: string;
  onChange: (q: string) => void;
  onSubmit?: () => void;
  onCardSelect?: (card: LorcanaCard) => void;
  viewport: ViewportConfig;
}

function HeaderSearch({cards, query, onChange, onSubmit, onCardSelect, viewport}: HeaderSearchProps) {
  const sizing = getSearchSizing(viewport);

  const handleSelect = (card: LorcanaCard) => {
    if (onCardSelect) onCardSelect(card);
  };

  const autocomplete = useAutocomplete({
    cards,
    query,
    onQueryChange: onChange,
    onSelect: handleSelect,
  });
  // The hook's focus state carries the blur delay and cancels it on refocus and unmount.
  const focused = autocomplete.isFocused;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    autocomplete.inputProps.onKeyDown(e);
    if (e.defaultPrevented) return;
    if (e.key !== 'Enter') return;
    if (onSubmit) onSubmit();
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
        data-testid="browse-search"
        style={getSearchInputStyle({focused, height: sizing.inputHeight, padding: sizing.inputPadding})}
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
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function NavItemLink({path, label, isHovered, onMouseEnter, onMouseLeave}: NavItemLinkProps) {
  return (
    <NavLink
      to={path}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={({isActive}) => {
        const state: InteractionState = {isActive, isHovered};
        return {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px',
          height: '100%',
          background: getNavItemBackground(state),
          color: getNavItemColor(state),
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: isActive ? 600 : 500,
          textDecoration: 'none',
          transition: `background 0.2s ${EASING.snappy}, color 0.2s ${EASING.snappy}, box-shadow 0.2s ${EASING.snappy}`,
          boxShadow: getNavItemBoxShadow(state),
          cursor: 'pointer',
        };
      }}>
      {label}
    </NavLink>
  );
}

interface RevealsPillProps {
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/** The header Reveals promo wearing the CtaButton pill recipe, kept a crawlable NavLink (#509). */
function RevealsPill({isHovered, onMouseEnter, onMouseLeave}: RevealsPillProps) {
  return (
    <NavLink
      to={REVEALS_PATH}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label="Reveals"
      style={({isActive}) => ({
        ...CTA_FILLED_STYLE,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        height: 38,
        borderRadius: RADIUS.pill,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 600,
        textDecoration: 'none',
        transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: `transform 0.2s ${EASING.snappy}, box-shadow 0.2s ${EASING.snappy}`,
        cursor: 'pointer',
        ...(isActive || isHovered
          ? {boxShadow: `${COLORS.filterShadow}, ${SHADOWS.glowSm}`}
          : {}),
      })}>
      Reveals
      <span
        style={{
          fontSize: FONT_SIZES.xs,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: RADIUS.pill,
          background: COLORS.filterText,
          color: COLORS.primary,
          letterSpacing: 0.4,
          lineHeight: 1,
        }}>
        NEW
      </span>
    </NavLink>
  );
}

/**
 * The header's rightmost slot: the shared `AuthButton` plus the dialog it opens.
 *
 * The button rule (which label, and rendering nothing while `loading` or when auth
 * is unconfigured) lives in `AuthButton`. What stays here is placement: the
 * `marginLeft: 'auto'` that pins it right, and ownership of this header's dialog.
 *
 * `AuthButton` calls useSession() directly rather than taking props. CompactHeader
 * RENDERS auth, so depending on SessionProvider is honest: a throw outside one
 * reports a real mounting error. Call sites sit under AppLayout's provider;
 * stories get a decorator.
 */
function HeaderAuth() {
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <div style={{marginLeft: 'auto'}}>
      <AuthButton onSignIn={() => setSignInOpen(true)} />
      <SignInDialog isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}

interface DesktopNavProps {
  isRevealSeason: boolean;
}

function DesktopNav({isRevealSeason}: DesktopNavProps) {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

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
          background: COLORS.background,
          overflow: 'hidden',
        }}>
        {NAV_ITEMS.map(({path, label}) => (
          <NavItemLink
            key={path}
            path={path}
            label={label}
            isHovered={hoveredNav === path}
            onMouseEnter={() => setHoveredNav(path)}
            onMouseLeave={() => setHoveredNav(null)}
          />
        ))}
      </div>
      {isRevealSeason && (
        <RevealsPill
          isHovered={hoveredNav === REVEALS_PATH}
          onMouseEnter={() => setHoveredNav(REVEALS_PATH)}
          onMouseLeave={() => setHoveredNav(null)}
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
  // Hooks must run unconditionally — call before the early return below.
  const revealPhase = useRevealPhase();

  // Mobile chrome lives in MobileBottomNav + SearchBottomSheet (from AppLayout).
  // The top header is desktop-only; render nothing on mobile so callers don't
  // need per-viewport conditionals at every call site.
  if (!headerCarriesAuth({isMobile: isMobile === true})) return null;

  const isRevealSeason = revealPhase === 'pre-release' || revealPhase === 'pre-release-live';
  const viewport: ViewportConfig = {isMobile: false};
  const hasSearch = searchQuery !== undefined && onSearchChange !== undefined;

  return (
    <header data-testid="compact-header" style={getHeaderStyle(viewport)}>
      <HeaderLogo viewport={viewport} showBackArrow={showBackArrow} onClick={onLogoClick} />
      {hasSearch && (
        <HeaderSearch
          cards={cards}
          query={searchQuery}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
          onCardSelect={onCardSelect}
          viewport={viewport}
        />
      )}
      {!viewport.isMobile && <DesktopNav isRevealSeason={isRevealSeason} />}
      {headerActions}
      {SHOW_ACCOUNTS && <HeaderAuth />}
    </header>
  );
}
