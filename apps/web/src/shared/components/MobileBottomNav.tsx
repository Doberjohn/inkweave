import {useLocation, useNavigate} from 'react-router-dom';
import {COLORS, FONTS} from '../constants';
import {useRevealPhase, type RevealPhase} from '../../features/reveals';

/** Height of the bar background (CSS px). Used for bottom padding on page content. */
export const MOBILE_NAV_HEIGHT = 100;
const REVEALS_BUTTON_SIZE = 64;

interface MobileBottomNavProps {
  onSearchClick?: () => void;
  /** Bypass `useRevealPhase` (Storybook / tests). */
  phaseOverride?: RevealPhase;
}

type TabKind = 'browse' | 'search' | 'playstyles' | 'vote';

function useActiveMap() {
  const {pathname} = useLocation();
  return {
    browse: pathname.startsWith('/browse'),
    playstyles: pathname.startsWith('/playstyles'),
    vote: pathname.startsWith('/vote'),
    reveals: pathname.startsWith('/reveals'),
  };
}

function TabIcon({kind, active}: {kind: TabKind; active: boolean}) {
  const stroke = active ? COLORS.primary : COLORS.textMuted;
  const sw = 1.8;
  const size = 24;
  switch (kind) {
    case 'browse':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={stroke} strokeWidth={sw} />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={stroke} strokeWidth={sw} />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={stroke} strokeWidth={sw} />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    case 'search':
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="6" stroke={stroke} strokeWidth={sw} />
          <line x1="13.5" y1="13.5" x2="17" y2="17" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'playstyles':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 'vote':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true">
          <path d="M7 10v10" />
          <path d="M17 20V10" />
          <path d="M7 10l5-6 5 6" />
        </svg>
      );
  }
}

function RevealsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l2.09 5.91L20 11l-5.91 2.09L12 19l-2.09-5.91L4 11l5.91-2.09L12 3z"
        fill="#0f172b"
      />
    </svg>
  );
}

interface FlatTabBaseProps {
  active: boolean;
  leftPercent: number;
  icon: React.ReactNode;
  label: string;
  ariaLabel?: string;
}

const flatTabStyle = (leftPercent: number): React.CSSProperties => ({
  position: 'absolute',
  left: `${leftPercent}%`,
  transform: 'translateX(-50%)',
  bottom: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  pointerEvents: 'auto',
  textDecoration: 'none',
});

function FlatLabel({active, label}: {active: boolean; label: string}) {
  return (
    <span
      style={{
        fontFamily: FONTS.body,
        fontSize: '10px',
        fontWeight: active ? 600 : 500,
        color: active ? COLORS.primary : COLORS.textMuted,
      }}>
      {label}
    </span>
  );
}

/** Navigation tab — renders an anchor so it counts as a link for assistive tech + tests. */
function FlatNavTab(
  props: FlatTabBaseProps & {href: string; onNavigate: (href: string) => void},
) {
  const {href, onNavigate, active, leftPercent, icon, label, ariaLabel} = props;
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel}
      style={flatTabStyle(leftPercent)}>
      {icon}
      <FlatLabel active={active} label={label} />
    </a>
  );
}

/** Action tab — a real button for non-navigation actions like opening search. */
function FlatActionTab(props: FlatTabBaseProps & {onClick: () => void}) {
  const {onClick, active, leftPercent, icon, label, ariaLabel} = props;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      style={flatTabStyle(leftPercent)}>
      {icon}
      <FlatLabel active={active} label={label} />
    </button>
  );
}

export function MobileBottomNav({onSearchClick, phaseOverride}: MobileBottomNavProps) {
  const navigate = useNavigate();
  const active = useActiveMap();
  const hookPhase = useRevealPhase();
  const phase = phaseOverride ?? hookPhase;
  const isRevealSeason = phase === 'pre-release' || phase === 'pre-release-live';

  const openSearch = () => onSearchClick?.();

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
        pointerEvents: 'none',
      }}>
      {/* Background: curved during reveal season (for elevated Reveals button),
          flat otherwise. */}
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: MOBILE_NAV_HEIGHT,
        }}
        viewBox="0 0 390 100"
        preserveAspectRatio="none"
        fill="none">
        <defs>
          <linearGradient id="nav-bg-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.surface} />
            <stop offset="100%" stopColor={COLORS.surfaceAlt} />
          </linearGradient>
        </defs>
        {isRevealSeason ? (
          <>
            <path d="M 0 55 Q 195 0 390 55 L 390 100 L 0 100 Z" fill="url(#nav-bg-grad)" />
            <path d="M 0 55 Q 195 0 390 55" stroke={COLORS.surfaceBorder} strokeWidth="1" fill="none" />
          </>
        ) : (
          <>
            <path d="M 0 40 L 390 40 L 390 100 L 0 100 Z" fill="url(#nav-bg-grad)" />
            <line x1="0" y1="40" x2="390" y2="40" stroke={COLORS.surfaceBorder} strokeWidth="1" />
          </>
        )}
      </svg>

      {isRevealSeason ? (
        <>
          <FlatNavTab
            href="/browse"
            onNavigate={navigate}
            active={active.browse}
            leftPercent={10}
            icon={<TabIcon kind="browse" active={active.browse} />}
            label="Browse"
          />
          <FlatActionTab
            onClick={openSearch}
            active={false}
            leftPercent={30}
            icon={<TabIcon kind="search" active={false} />}
            label="Search"
            ariaLabel="Search cards"
          />
          {/* Elevated Reveals link */}
          <a
            href="/reveals"
            onClick={(e) => {
              e.preventDefault();
              navigate('/reveals');
            }}
            aria-current={active.reveals ? 'page' : undefined}
            aria-label="Reveals"
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              width: REVEALS_BUTTON_SIZE,
              height: REVEALS_BUTTON_SIZE,
              borderRadius: REVEALS_BUTTON_SIZE / 2,
              background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryMuted} 100%)`,
              boxShadow: `0 6px 24px ${COLORS.primary}61, 0 0 40px 4px ${COLORS.primary}17`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
              textDecoration: 'none',
            }}>
            <RevealsIcon />
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -10,
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: 999,
                background: COLORS.primary500,
                color: COLORS.background,
                letterSpacing: 0.4,
                lineHeight: 1,
                border: `1px solid ${COLORS.background}`,
              }}>
              NEW
            </span>
          </a>
          <FlatNavTab
            href="/playstyles"
            onNavigate={navigate}
            active={active.playstyles}
            leftPercent={70}
            icon={<TabIcon kind="playstyles" active={active.playstyles} />}
            label="Playstyles"
          />
          <FlatNavTab
            href="/vote"
            onNavigate={navigate}
            active={active.vote}
            leftPercent={90}
            icon={<TabIcon kind="vote" active={active.vote} />}
            label="Vote"
          />
        </>
      ) : (
        <>
          <FlatNavTab
            href="/browse"
            onNavigate={navigate}
            active={active.browse}
            leftPercent={12.5}
            icon={<TabIcon kind="browse" active={active.browse} />}
            label="Browse"
          />
          <FlatActionTab
            onClick={openSearch}
            active={false}
            leftPercent={37.5}
            icon={<TabIcon kind="search" active={false} />}
            label="Search"
            ariaLabel="Search cards"
          />
          <FlatNavTab
            href="/playstyles"
            onNavigate={navigate}
            active={active.playstyles}
            leftPercent={62.5}
            icon={<TabIcon kind="playstyles" active={active.playstyles} />}
            label="Playstyles"
          />
          <FlatNavTab
            href="/vote"
            onNavigate={navigate}
            active={active.vote}
            leftPercent={87.5}
            icon={<TabIcon kind="vote" active={active.vote} />}
            label="Vote"
          />
        </>
      )}
    </nav>
  );
}

