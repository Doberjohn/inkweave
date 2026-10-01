import {type ReactNode, useState} from 'react';
import {Link, NavLink} from 'react-router-dom';
import {COLORS, DURATION, EASING, FONT_SIZES, FONTS, LAYOUT, RADIUS, SHADOWS, SPACING, Z_INDEX} from '../constants';
import {useRevealPhase} from '../../features/reveals';
import {useIsSignedIn} from '../contexts/SessionContext';
import {AuthButton} from './AuthButton';
import {CTA_FILLED_STYLE} from './ctaStyles';
import {headerCarriesAuth, type ViewportConfig} from './headerChrome';
import {SignInDialog} from './SignInDialog';

interface CompactHeaderProps {
  /** Optional side-effect callback fired before nav. Link handles the route push. */
  onLogoClick?: () => void;
  /** When true, renders "← INKWEAVE" as a back button instead of just "INKWEAVE" */
  showBackArrow?: boolean;
  /** Optional actions rendered after the nav (e.g. filters button on CardPage) */
  headerActions?: ReactNode;
  /** Responsive mobile flag */
  isMobile?: boolean;
}

interface NavItem {
  path: string;
  label: string;
  /** Hide unless signed in. No item uses this yet — Collection (#452) is the
   *  first, once /collection exists. Until then the filter is a no-op. */
  requiresAuth?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  {path: '/browse', label: 'Browse'},
  {path: '/playstyles', label: 'Playstyles'},
  {path: '/vote', label: 'Vote'},
  // Public, not personal: /decks shows community decks with a switch to your own.
  {path: '/decks', label: 'Decks'},
];

const REVEALS_PATH = '/reveals';

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

// ViewportConfig and headerCarriesAuth live in ./headerChrome, so /decks can read
// the same rule without importing a component.

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

function getNavItemColor(state: InteractionState): string {
  if (state.isActive) return COLORS.primary;
  if (state.isHovered) return COLORS.primary;
  return COLORS.textMuted;
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
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SPACING.xs}px 0`,
          color: getNavItemColor(state),
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.lg}px`,
          fontWeight: 600,
          textDecoration: 'none',
          // The active page's only structural cue now that the capsule is gone.
          // Colour alone would fail WCAG 1.4.1 and read as decoration.
          borderBottom: `2px solid ${isActive ? COLORS.primary : 'transparent'}`,
          transition: `color ${DURATION.base}ms ${EASING.snappy}, border-color ${DURATION.base}ms ${EASING.snappy}`,
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
        gap: SPACING.sm,
        padding: '0 14px',
        height: 38,
        borderRadius: RADIUS.pill,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        textDecoration: 'none',
        transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: `transform ${DURATION.base}ms ${EASING.snappy}, box-shadow ${DURATION.base}ms ${EASING.snappy}`,
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
 * is unconfigured) lives in `AuthButton`, because `/decks` needs the same rule on
 * mobile where this header does not render. What stays here is placement: the
 * `marginLeft: 'auto'` that pins it right, and ownership of this header's dialog.
 *
 * `AuthButton` calls useSession() directly rather than taking props. CompactHeader
 * RENDERS auth, so depending on SessionProvider is honest: a throw outside one
 * reports a real mounting error. (Contrast useIsSignedIn, added the same day for
 * DesktopNav, which only REACTS to auth and must not demand a provider.) All 18
 * CompactHeader call sites already sit under AppLayout's provider; stories get a
 * decorator.
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
  const isSignedIn = useIsSignedIn();
  const items = NAV_ITEMS.filter((item) => !item.requiresAuth || isSignedIn);

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
        gap: SPACING.md,
      }}>
      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.xxxl}}>
        {items.map(({path, label}) => (
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

export function CompactHeader({onLogoClick, showBackArrow, headerActions, isMobile}: CompactHeaderProps) {
  // Hooks must run unconditionally — call before the early return below.
  const revealPhase = useRevealPhase();

  // Mobile chrome lives in MobileBottomNav + SearchBottomSheet (from AppLayout).
  // The top header is desktop-only; render nothing on mobile so callers don't
  // need per-viewport conditionals at every call site.
  //
  // `isMobile` is OPTIONAL, so omitting it reads as desktop. That is not a
  // friendly default, it is a silent one: InkGalleryPage and InkHubPage both
  // omitted it and painted this 70px bar over the mobile bottom nav, with the
  // absolutely-centered nav overlapping the logo. Pass it explicitly.
  if (!headerCarriesAuth({isMobile: isMobile === true})) return null;

  const isRevealSeason = revealPhase === 'pre-release' || revealPhase === 'pre-release-live';
  const viewport: ViewportConfig = {isMobile: false};

  return (
    <header data-testid="compact-header" style={getHeaderStyle(viewport)}>
      <HeaderLogo viewport={viewport} showBackArrow={showBackArrow} onClick={onLogoClick} />
      <DesktopNav isRevealSeason={isRevealSeason} />
      <HeaderAuth />
      {headerActions}
    </header>
  );
}
