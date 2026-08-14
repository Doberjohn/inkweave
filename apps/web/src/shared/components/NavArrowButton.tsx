import type {CSSProperties} from 'react';
import {COLORS, DISABLED_STYLE} from '../constants';

/**
 * The round gold arrow that flanks a thing you page through: the card-overview
 * modal's sibling-card nav, and the binder's spread pager.
 *
 * EXTRACTED FROM `CardOverviewModal` (2026-08-14), where it was a local
 * `SIBLING_BTN_BASE` const plus two inline `<button>`s. The binder needed the
 * same control, and `inkweave/no-adhoc-buttons` blocks a styled `<button>` in
 * feature code — correctly, since a second hand-rolled copy is exactly how the
 * back-link census ended up with eleven affordances in five shapes.
 *
 * POSITIONING IS ENTIRELY THE CONSUMER'S — the base sets no `position` at all.
 * The modal hangs it half outside its panel and needs `absolute`; the binder lays
 * it out beside the spread as a flex sibling, because overlaying it there put the
 * arrow on top of the cards at every window size where the spread is wide. Baking
 * `absolute` in would force the binder to unset four properties to escape it.
 */

const BASE: CSSProperties = {
  flexShrink: 0,
  width: 44,
  height: 44,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  // Matches the landing page's "Browse all cards" CTA (gold gradient, dark glyph).
  background: COLORS.filterGradient,
  border: 'none',
  color: COLORS.filterText,
  boxShadow: COLORS.filterShadow,
  cursor: 'pointer',
  // The modal mounts these inside a `pointerEvents: none` overlay.
  pointerEvents: 'auto',
};

const PATH = {
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 6l6 6-6 6',
} as const;

interface NavArrowButtonProps {
  direction: 'prev' | 'next';
  /** The accessible name — "Previous card", "Previous spread", etc. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Horizontal placement, and anything else the consumer needs to override. */
  style?: CSSProperties;
}

export function NavArrowButton({
  direction,
  label,
  onClick,
  disabled = false,
  style,
}: NavArrowButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{...BASE, ...(disabled ? DISABLED_STYLE : {}), ...style}}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={PATH[direction]}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
