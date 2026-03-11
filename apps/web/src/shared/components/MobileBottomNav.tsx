import {useLocation, useNavigate} from 'react-router-dom';
import {COLORS, FONTS} from '../constants';

/** Height of the curved bar background (CSS px). Used for bottom padding on page content. */
export const MOBILE_NAV_HEIGHT = 100;

const SEARCH_BUTTON_SIZE = 64;

interface MobileBottomNavProps {
  onSearchClick?: () => void;
}

export function MobileBottomNav({onSearchClick}: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isBrowseActive = location.pathname.startsWith('/browse');
  const isPlaystylesActive = location.pathname.startsWith('/playstyles');

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
      {/* Curved background */}
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
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="100%" stopColor="#151525" />
          </linearGradient>
          <radialGradient id="nav-glow" cx="50%" cy="0%" r="60%">
            <stop offset="0%" stopColor="#fe9a00" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#fe9a00" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#fe9a00" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Curved bar fill */}
        <path d="M 0 55 Q 195 0 390 55 L 390 100 L 0 100 Z" fill="url(#nav-bg-grad)" />
        {/* Top border stroke */}
        <path d="M 0 55 Q 195 0 390 55" stroke={COLORS.surfaceBorder} strokeWidth="1" fill="none" />
      </svg>

      {/* Search button (center, elevated) */}
      <button
        aria-label="Search cards"
        onClick={() => onSearchClick?.()}
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          transform: 'translateX(-50%)',
          width: SEARCH_BUTTON_SIZE,
          height: SEARCH_BUTTON_SIZE,
          borderRadius: SEARCH_BUTTON_SIZE / 2,
          border: 'none',
          background: 'linear-gradient(180deg, #fe9a00 0%, #e17100 100%)',
          boxShadow: '0 6px 24px rgba(254, 154, 0, 0.38), 0 0 40px 4px rgba(254, 154, 0, 0.09)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
        }}>
        <svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="6" stroke="#0f172b" strokeWidth="2" />
          <line
            x1="13.5"
            y1="13.5"
            x2="17"
            y2="17"
            stroke="#0f172b"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Browse tab (left) */}
      <a
        href="/browse"
        onClick={(e) => {
          e.preventDefault();
          navigate('/browse');
        }}
        aria-current={isBrowseActive ? 'page' : undefined}
        style={{
          position: 'absolute',
          left: 76,
          bottom: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          textDecoration: 'none',
          pointerEvents: 'auto',
        }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1.5"
            stroke={isBrowseActive ? COLORS.primary : COLORS.textMuted}
            strokeWidth="1.8"
          />
          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1.5"
            stroke={isBrowseActive ? COLORS.primary : COLORS.textMuted}
            strokeWidth="1.8"
          />
          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1.5"
            stroke={isBrowseActive ? COLORS.primary : COLORS.textMuted}
            strokeWidth="1.8"
          />
          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1.5"
            stroke={isBrowseActive ? COLORS.primary : COLORS.textMuted}
            strokeWidth="1.8"
          />
        </svg>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: '10px',
            fontWeight: isBrowseActive ? 600 : 500,
            color: isBrowseActive ? COLORS.primary : COLORS.textMuted,
          }}>
          Browse
        </span>
      </a>

      {/* Playstyles tab (right) */}
      <a
        href="/playstyles"
        onClick={(e) => {
          e.preventDefault();
          navigate('/playstyles');
        }}
        aria-current={isPlaystylesActive ? 'page' : undefined}
        style={{
          position: 'absolute',
          right: 76,
          bottom: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          textDecoration: 'none',
          pointerEvents: 'auto',
        }}>
        {/* Compass icon (matches landing page) */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isPlaystylesActive ? COLORS.primary : COLORS.textMuted}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: '10px',
            fontWeight: isPlaystylesActive ? 600 : 500,
            color: isPlaystylesActive ? COLORS.primary : COLORS.textMuted,
          }}>
          Playstyles
        </span>
      </a>
    </nav>
  );
}
