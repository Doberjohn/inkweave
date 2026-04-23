import {useLocation, useNavigate} from 'react-router-dom';
import {COLORS, FONTS} from '../constants';
import {useRevealPhase, type RevealPhase} from '../../features/reveals';

/** Height of the nav bar in CSS px. Used for bottom padding on page content. */
export const MOBILE_NAV_HEIGHT = 110;

interface MobileBottomNavProps {
  onSearchClick?: () => void;
  /** Bypass `useRevealPhase` (Storybook / tests). */
  phaseOverride?: RevealPhase;
}

type TabKind = 'browse' | 'search' | 'reveals' | 'playstyles' | 'vote';

interface TabDef {
  kind: TabKind;
  /** Accessible name — rendered as aria-label and shown in the active-tab label strip. */
  label: string;
  /** Navigation path. Mutually exclusive with `action`. */
  href?: string;
  /** Action tab (renders as a button). */
  action?: 'search';
  hasNewDot?: boolean;
}

const TABS_REVEAL_SEASON: readonly TabDef[] = [
  {kind: 'browse', label: 'Browse collection', href: '/browse'},
  {kind: 'search', label: 'Search cards', action: 'search'},
  {kind: 'reveals', label: 'Set 12 reveals', href: '/reveals', hasNewDot: true},
  {kind: 'playstyles', label: 'Explore playstyles', href: '/playstyles'},
  {kind: 'vote', label: 'Rate synergies', href: '/vote'},
];

const TABS_OFF_SEASON: readonly TabDef[] = [
  {kind: 'browse', label: 'Browse collection', href: '/browse'},
  {kind: 'search', label: 'Search cards', action: 'search'},
  {kind: 'playstyles', label: 'Explore playstyles', href: '/playstyles'},
  {kind: 'vote', label: 'Rate synergies', href: '/vote'},
];

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

/**
 * Inject transition styles once. Keeps hover/active icon color changes and
 * underline slide declarative, without re-rendering on every frame.
 */
(function injectStyles() {
  const STYLE_ID = 'mobile-bottom-nav-styles';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
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
    case 'vote':
      return (
        <svg width={24} height={24} viewBox="0 0 24 24" {...iconCommon}>
          <polygon points="12 2.49 15.09 8.75 22 9.76 17 14.63 18.18 21.51 12 18.26 5.82 21.51 7 14.63 2 9.76 8.91 8.75 12 2.49" />
        </svg>
      );
  }
}

export function MobileBottomNav({onSearchClick, phaseOverride}: MobileBottomNavProps) {
  const navigate = useNavigate();
  const {pathname} = useLocation();
  const hookPhase = useRevealPhase();
  const phase = phaseOverride ?? hookPhase;
  const isRevealSeason = phase === 'pre-release' || phase === 'pre-release-live';

  const tabs = isRevealSeason ? TABS_REVEAL_SEASON : TABS_OFF_SEASON;
  const pos = isRevealSeason ? POS_5 : POS_4;

  // Active tab = first nav tab whose href is a prefix of the current path.
  // Action tabs (Search) are never "active" — they open a sheet, not a route.
  const activeIdx = tabs.findIndex((t) => t.href && pathname.startsWith(t.href));
  const hasActive = activeIdx >= 0;
  const dashOffset = hasActive ? pos.dashOffset[activeIdx] : pos.dashOffset[0];
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
        <path
          d="M 0 22 Q 195 4 390 22"
          stroke={COLORS.surfaceBorder}
          strokeWidth="1"
          fill="none"
        />
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
          strokeDashoffset={dashOffset}
          fill="none"
          opacity={hasActive ? 0.55 : 0}
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
          strokeDashoffset={dashOffset}
          fill="none"
          opacity={hasActive ? 1 : 0}
        />
      </svg>

      {/* Icon tabs */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          alignItems: 'start',
          pointerEvents: 'none',
        }}>
        {tabs.map((tab, i) => {
          const isActive = i === activeIdx;
          const tabStyle: React.CSSProperties = {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: pos.paddingTop[i],
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
          if (tab.action === 'search') {
            return (
              <button
                key={tab.kind}
                type="button"
                className="mbn-tab"
                aria-label={tab.label}
                onClick={onSearchClick}
                style={tabStyle}>
                {contents}
              </button>
            );
          }
          return (
            <a
              key={tab.kind}
              href={tab.href}
              className="mbn-tab"
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                if (tab.href) navigate(tab.href);
              }}
              style={tabStyle}>
              {contents}
            </a>
          );
        })}
      </div>

      {/* Active screen label */}
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
          opacity: hasActive ? 1 : 0,
          pointerEvents: 'none',
        }}>
        {activeLabel}
      </div>
    </nav>
  );
}
