import {Suspense, useState} from 'react';
import {NavLink, useLocation} from 'react-router-dom';
import {COLORS, FONTS, LAYOUT, REVEAL_SET_NUMBER} from '../constants';
import {useRevealPhase, type RevealPhase} from '../../features/reveals';
import {useSession} from '../contexts/SessionContext';
import {lazyWithRetry} from '../lib/lazyWithRetry';

/** Accounts ship behind this flag; while it is off the nav has no account tab. */
const SHOW_ACCOUNTS = import.meta.env.VITE_SHOW_ACCOUNTS === 'true';

// The nav sits in the entry chunk, so the dialog waits for the first Sign in tap. It comes from
// the header's chunk, which most pages with the nav have already loaded (a page drawn without the
// header, such as Not found, fetches it on the tap): importing its own module would split the
// dialog out of that chunk into a file of its own, about 600 B more startup JS.
const SignInDialog = lazyWithRetry(() => import('./CompactHeader'), 'SignInDialog');

/** Height of the nav bar in CSS px. Used for bottom padding on page content. */
export const MOBILE_NAV_HEIGHT = LAYOUT.mobileNavHeight;

interface MobileBottomNavProps {
  onSearchClick?: () => void;
  /** Attached to the Search tab's button; the search sheet returns focus there on close. */
  searchButtonRef?: React.Ref<HTMLButtonElement>;
  /** Bypass `useRevealPhase` (Storybook / tests). */
  phaseOverride?: RevealPhase;
  /** Bypass the session (Storybook): which account tab to draw. */
  accountOverride?: AccountTab;
}

/**
 * The account tab, the phone's counterpart of the desktop header's Sign in / Account button:
 * `none` while accounts are off or auth isn't configured, `sign-in` signed out, `account` signed
 * in.
 */
type AccountTab = 'none' | 'sign-in' | 'account';

type TabKind = 'browse' | 'search' | 'reveals' | 'playstyles' | 'vote' | 'account';

type TabAction = 'search' | 'sign-in';

interface TabDef {
  kind: TabKind;
  /** Accessible name — rendered as aria-label and shown in the active-tab label strip. */
  label: string;
  /** Navigation path. Mutually exclusive with `action`. */
  href?: string;
  /** Action tab (renders as a button). */
  action?: TabAction;
  hasNewDot?: boolean;
}

const TABS_REVEAL_SEASON: readonly TabDef[] = [
  {kind: 'browse', label: 'Browse collection', href: '/browse'},
  {kind: 'search', label: 'Search cards', action: 'search'},
  {kind: 'reveals', label: `Set ${REVEAL_SET_NUMBER} reveals`, href: '/reveals', hasNewDot: true},
  {kind: 'playstyles', label: 'Explore playstyles', href: '/playstyles'},
  {kind: 'vote', label: 'Rate synergies', href: '/vote'},
];

const TABS_OFF_SEASON: readonly TabDef[] = [
  {kind: 'browse', label: 'Browse collection', href: '/browse'},
  {kind: 'search', label: 'Search cards', action: 'search'},
  {kind: 'playstyles', label: 'Explore playstyles', href: '/playstyles'},
  {kind: 'vote', label: 'Rate synergies', href: '/vote'},
];

const ACCOUNT_TABS: Record<Exclude<AccountTab, 'none'>, TabDef> = {
  'sign-in': {kind: 'account', label: 'Sign in', action: 'sign-in'},
  account: {kind: 'account', label: 'Your account', href: '/account'},
};

/**
 * Per-tab position data. Both padding-top (icon arc) and dash-offset (underline
 * position) are derived from the border curve `M 0 22 Q 195 4 390 22`:
 * icons mirror the curve's y at their x, scaled 2x for a more visible arc;
 * the underline is a 12%-pathLength dash that slides along a parallel curve
 * offset down by 54px (same y as the inner divider — reads as a rail).
 */
const POS_5 = {
  paddingTop: [32, 23, 20, 23, 32],
  dashOffset: [-4, -24, -44, -64, -84],
} as const;

const POS_4 = {
  paddingTop: [29, 20, 20, 29],
  dashOffset: [-6.5, -31.5, -56.5, -81.5],
} as const;

/** Reveal season with the account tab. */
const POS_6 = {
  paddingTop: [32, 24, 20, 20, 24, 32],
  dashOffset: [-2.3, -19, -35.7, -52.3, -69, -85.7],
} as const;

interface PositionTable {
  paddingTop: readonly number[];
  dashOffset: readonly number[];
}

const POSITIONS_BY_COUNT: Record<number, PositionTable> = {4: POS_4, 5: POS_5, 6: POS_6};

// =====================================================================
// Domain types — aggregate related state so subcomponent signatures read
// semantically and the Primitive Obsession rule stays quiet.
// =====================================================================

/** Slide-rail underline state: visibility + where the dash sits. */
interface UnderlineState {
  hasActive: boolean;
  dashOffset: number;
}

interface TabsAndPositions {
  tabs: readonly TabDef[];
  positions: PositionTable;
}

interface PhaseInput {
  phase: RevealPhase;
}

interface TabsInput {
  isRevealSeason: boolean;
  account: AccountTab;
}

interface TabActiveInput {
  tab: TabDef;
  pathname: string;
}

// =====================================================================
// Helpers — pure, module-level.
// =====================================================================

/**
 * Three-guard form (not `phase === 'pre-release' || phase === 'pre-release-live'`)
 * keeps each conditional simple with 0 logical operators per expression —
 * avoids CodeScene's Complex Conditional rule on what would otherwise be a
 * compound boolean.
 */
function isRevealSeasonPhase({phase}: PhaseInput): boolean {
  if (phase === 'pre-release') return true;
  if (phase === 'pre-release-live') return true;
  return false;
}

function seasonTabs(isRevealSeason: boolean): readonly TabDef[] {
  return isRevealSeason ? TABS_REVEAL_SEASON : TABS_OFF_SEASON;
}

function pickTabsAndPositions({isRevealSeason, account}: TabsInput): TabsAndPositions {
  const season = seasonTabs(isRevealSeason);
  const tabs = account === 'none' ? season : [...season, ACCOUNT_TABS[account]];
  return {tabs, positions: POSITIONS_BY_COUNT[tabs.length]};
}

/**
 * Which account tab to draw. Whether there is one at all is fixed for the build (the flag, and
 * Supabase being configured), so it never pops in and moves the other tabs. A stored session
 * still being restored counts as signed in, since it almost always is. The two tabs share an
 * icon, and the label shows only on the tab's own page, so the swap between them (after a
 * restore that finds the session expired, or from the prerendered page, crawled signed out, to a
 * returning player's) changes what the tab does but not how it looks.
 */
function accountTabFor(
  session: Pick<ReturnType<typeof useSession>, 'user' | 'loading' | 'enabled'>,
): AccountTab {
  if (!SHOW_ACCOUNTS) return 'none';
  if (!session.enabled) return 'none';
  if (session.user) return 'account';
  if (session.loading) return 'account';
  return 'sign-in';
}

/**
 * Inject transition styles once. Keeps hover/active icon color changes and
 * underline slide declarative, without re-rendering on every frame.
 */
(function injectStyles() {
  const STYLE_ID = 'mobile-bottom-nav-styles';
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mbn-underline {
      transition: stroke-dashoffset 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
                  opacity 240ms ease;
    }
    .mbn-active-label { transition: opacity 240ms ease; }
    .mbn-icon { color: ${COLORS.textMuted}; transition: color 200ms ease; }
    .mbn-tab[aria-current="page"] .mbn-icon { color: ${COLORS.primary}; }
    @media (prefers-reduced-motion: reduce) {
      .mbn-underline, .mbn-active-label, .mbn-icon { transition: none; }
    }
  `;
  document.head.appendChild(style);
})();

const iconCommon = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function TabIcon({kind}: {kind: TabKind}) {
  switch (kind) {
    case 'browse':
      return (
        <svg width={24} height={24} viewBox="0 0 24 24" {...iconCommon}>
          <rect x="2" y="2" width="9" height="9" rx="1.5" />
          <rect x="13" y="2" width="9" height="9" rx="1.5" />
          <rect x="2" y="13" width="9" height="9" rx="1.5" />
          <rect x="13" y="13" width="9" height="9" rx="1.5" />
        </svg>
      );
    case 'search':
      return (
        <svg width={24} height={24} viewBox="0 0 24 24" {...iconCommon}>
          <circle cx="11" cy="11" r="9" />
          <line x1="22" y1="22" x2="17.36" y2="17.36" />
        </svg>
      );
    case 'reveals':
      return (
        <svg width={26} height={26} viewBox="0 0 24 24" {...iconCommon}>
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      );
    case 'playstyles':
      return (
        <svg width={24} height={24} viewBox="0 0 24 24" {...iconCommon}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 'account':
      return (
        <svg width={24} height={24} viewBox="0 0 24 24" {...iconCommon}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      );
    case 'vote':
      return (
        <svg width={24} height={24} viewBox="0 0 24 24" {...iconCommon}>
          <polygon points="12 2.49 15.09 8.75 22 9.76 17 14.63 18.18 21.51 12 18.26 5.82 21.51 7 14.63 2 9.76 8.91 8.75 12 2.49" />
        </svg>
      );
  }
}

// =====================================================================
// Subcomponents — internal, not exported.
// =====================================================================

interface NavCurveBackgroundProps {
  underline: UnderlineState;
}

function NavCurveBackground({underline}: NavCurveBackgroundProps) {
  const haloOpacity = underline.hasActive ? 0.55 : 0;
  const lineOpacity = underline.hasActive ? 1 : 0;
  return (
    <svg
      aria-hidden="true"
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      viewBox="0 0 390 110"
      preserveAspectRatio="none">
      <defs>
        <linearGradient id="mbn-bg-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.surface} />
          <stop offset="100%" stopColor={COLORS.surfaceAlt} />
        </linearGradient>
        <filter id="mbn-under-blur" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      {/* Fill with arched top edge */}
      <path d="M 0 22 Q 195 4 390 22 L 390 110 L 0 110 Z" fill="url(#mbn-bg-grad)" />
      {/* Outer curve line */}
      <path d="M 0 22 Q 195 4 390 22" stroke={COLORS.surfaceBorder} strokeWidth="1" fill="none" />
      {/* Inner curve — same y as underline so the underline reads as a bead on the rail. */}
      <path
        d="M 0 76 Q 195 58 390 76"
        stroke={COLORS.surfaceBorder}
        strokeWidth="1"
        fill="none"
        opacity="0.7"
      />
      {/* Underline — glow halo + sharp line on top. A 12% dash slides along the
          parallel curve as the active tab changes. */}
      <path
        className="mbn-underline"
        d="M 0 76 Q 195 58 390 76"
        stroke={COLORS.primary}
        strokeWidth="6"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="12 88"
        strokeDashoffset={underline.dashOffset}
        fill="none"
        opacity={haloOpacity}
        filter="url(#mbn-under-blur)"
      />
      <path
        className="mbn-underline"
        d="M 0 76 Q 195 58 390 76"
        stroke={COLORS.primary}
        strokeWidth="2"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="12 88"
        strokeDashoffset={underline.dashOffset}
        fill="none"
        opacity={lineOpacity}
      />
    </svg>
  );
}

interface NavTabProps {
  tab: TabDef;
  paddingTop: number;
  /** What each action tab does when pressed. */
  actions: Partial<Record<TabAction, () => void>>;
  searchButtonRef?: React.Ref<HTMLButtonElement>;
}

function NavTab({tab, paddingTop, actions, searchButtonRef}: NavTabProps) {
  const tabStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    pointerEvents: 'auto',
    textDecoration: 'none',
    position: 'relative',
  };

  const contents = (
    <>
      <span
        className="mbn-icon"
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <TabIcon kind={tab.kind} />
      </span>
      {tab.hasNewDot && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            // Centered on the icon's top-right corner (icon is 26px, slot center).
            top: 20,
            right: 'calc(50% - 16px)',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: COLORS.primary,
            boxShadow: `0 0 6px ${COLORS.primary}`,
          }}
        />
      )}
    </>
  );

  if (tab.action) {
    return (
      <button
        ref={tab.action === 'search' ? searchButtonRef : undefined}
        type="button"
        className="mbn-tab"
        aria-label={tab.label}
        onClick={actions[tab.action]}
        style={tabStyle}>
        {contents}
      </button>
    );
  }

  // NavLink (#511): the old hand-rolled <a> + unconditional preventDefault
  // defeated modifier-clicks (open-in-new-tab) and middle-click; react-router
  // handles those natively and supplies aria-current="page" itself.
  return (
    <NavLink
      to={tab.href ?? '/'}
      className="mbn-tab"
      aria-label={tab.label}
      style={tabStyle}>
      {contents}
    </NavLink>
  );
}

interface ActiveLabelStripProps {
  label: string;
  visible: boolean;
}

function ActiveLabelStrip({label, visible}: ActiveLabelStripProps) {
  return (
    <div
      className="mbn-active-label"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 13,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 500,
        color: COLORS.text,
        fontFamily: FONTS.body,
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
      }}>
      {label}
    </div>
  );
}

// =====================================================================
// Public component.
// =====================================================================

/** The sign-in dialog's state. `unloaded` until the first tap, so its chunk waits for one. */
type SignInState = 'unloaded' | 'open' | 'closed';

export function MobileBottomNav({
  onSearchClick,
  searchButtonRef,
  phaseOverride,
  accountOverride,
}: MobileBottomNavProps) {
  const {pathname} = useLocation();
  const hookPhase = useRevealPhase();
  const phase = phaseOverride ?? hookPhase;
  const session = useSession();
  const [signIn, setSignIn] = useState<SignInState>('unloaded');

  const {tabs, positions} = pickTabsAndPositions({
    isRevealSeason: isRevealSeasonPhase({phase}),
    account: accountOverride ?? accountTabFor(session),
  });
  const actions = {search: onSearchClick, 'sign-in': () => setSignIn('open')};

  // Active tab = first nav tab whose href is a prefix of the current path.
  // Action tabs (Search, Sign in) are never "active": they open a sheet or a dialog.
  const activeIdx = tabs.findIndex((tab) => isTabActive({tab, pathname}));
  const hasActive = activeIdx >= 0;
  const underline: UnderlineState = {
    hasActive,
    dashOffset: hasActive ? positions.dashOffset[activeIdx] : positions.dashOffset[0],
  };
  const activeLabel = hasActive ? tabs[activeIdx].label : '';

  return (
    <nav
      aria-label="Mobile navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: MOBILE_NAV_HEIGHT,
        zIndex: 900,
        // Absorb taps across the whole nav rectangle. Without this, gaps between
        // tabs + transparent parts of the SVG (default `visiblePainted` hit-testing)
        // let taps fall through to content behind the nav.
        pointerEvents: 'auto',
      }}>
      <NavCurveBackground underline={underline} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          alignItems: 'start',
          pointerEvents: 'none',
        }}>
        {tabs.map((tab, i) => (
          <NavTab
            key={tab.kind}
            tab={tab}
            paddingTop={positions.paddingTop[i]}
            actions={actions}
            searchButtonRef={searchButtonRef}
          />
        ))}
      </div>
      <ActiveLabelStrip label={activeLabel} visible={hasActive} />
      {/* DialogShell portals to <body>, so the nav's stacking context doesn't hold it. */}
      {signIn !== 'unloaded' && (
        <Suspense fallback={null}>
          <SignInDialog
            isOpen={signIn === 'open'}
            onClose={() => setSignIn('closed')}
            surface="bottom_nav"
          />
        </Suspense>
      )}
    </nav>
  );
}

/** Top-level helper so the findIndex arrow stays trivial (0 branches). */
function isTabActive({tab, pathname}: TabActiveInput): boolean {
  if (!tab.href) return false;
  return pathname.startsWith(tab.href);
}
