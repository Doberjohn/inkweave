import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';

const STORAGE_KEY = 'inkweave:reveals-modal-dismissed';
const ANIMATE_IN_MS = 240;
const ANIMATE_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

interface RevealsPromoModalProps {
  /** Distance from the bottom of the viewport in CSS px (to clear mobile bottom nav). */
  bottomOffset?: number;
}

function todayLocalKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function isDismissedToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayLocalKey();
  } catch {
    return false;
  }
}

export function RevealsPromoModal({bottomOffset = 16}: RevealsPromoModalProps) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => isDismissedToday());
  const reduced = prefersReducedMotion();
  const [mounted, setMounted] = useState(reduced);

  useEffect(() => {
    if (hidden || reduced) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [hidden, reduced]);

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, todayLocalKey());
    } catch {
      /* localStorage may be disabled; hide for this session only */
    }
    setHidden(true);
  };

  return (
    <aside
      aria-label="Set 12 reveals"
      style={{
        position: 'fixed',
        right: SPACING.lg,
        bottom: bottomOffset,
        width: 280,
        maxWidth: 'calc(100vw - 32px)',
        borderRadius: RADIUS.xl,
        background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`,
        border: `1px solid ${COLORS.primary500}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${COLORS.primary}33`,
        color: COLORS.text,
        zIndex: 800,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateX(0)' : 'translateX(24px)',
        transition: reduced
          ? 'none'
          : `opacity ${ANIMATE_IN_MS}ms ${ANIMATE_EASING}, transform ${ANIMATE_IN_MS}ms ${ANIMATE_EASING}`,
      }}>
      <button
        type="button"
        onClick={() => navigate('/reveals')}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: `${SPACING.md}px ${SPACING.lg}px`,
          paddingRight: 44,
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
          borderRadius: RADIUS.xl,
        }}>
        <span
          style={{
            display: 'block',
            fontFamily: FONTS.body,
            fontSize: FONT_SIZES.xs,
            fontWeight: 700,
            color: COLORS.primary500,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
          NEW
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: FONTS.body,
            fontSize: FONT_SIZES.lg,
            fontWeight: 600,
            color: COLORS.text,
            marginBottom: 4,
          }}>
          Set 12 reveals
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: FONTS.body,
            fontSize: FONT_SIZES.base,
            color: COLORS.textMuted,
          }}>
          Explore The Wilds Unknown cards →
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss reveals notice"
        onClick={dismiss}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 28,
          height: 28,
          borderRadius: 14,
          border: 'none',
          background: 'transparent',
          color: COLORS.textMuted,
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
        }}>
        ×
      </button>
    </aside>
  );
}
