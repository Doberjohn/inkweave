import {COLORS, FONT_SIZES, INK_CHIP_COLORS, RADIUS} from '../../shared/constants';
import {initialsOf, inkOfHandle} from './friendInitials';

const NO_INK = {bg: COLORS.surfaceHover, text: COLORS.text};
const SIZES = {md: 28, lg: 36} as const;

/**
 * A friend's initials on a round chip in the ink their handle starts with, from the game's
 * own ink-symbol colours; the neutral surface for a handle with no ink (#1045). Decoration
 * beside the friend's name, so hidden from screen readers, and out of PostHog (#827).
 */
export function FriendChip({name, handle, size = 'md'}: {name: string; handle: string | null; size?: 'md' | 'lg'}) {
  const ink = inkOfHandle(handle);
  const colors = ink ? INK_CHIP_COLORS[ink] : NO_INK;
  const px = SIZES[size];
  return (
    <span
      aria-hidden
      className="ph-no-capture"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: px,
        height: px,
        borderRadius: `${RADIUS.pill}px`,
        background: colors.bg,
        color: colors.text,
        fontSize: `${size === 'lg' ? FONT_SIZES.base : FONT_SIZES.sm}px`,
        fontWeight: 700,
        lineHeight: 1,
      }}>
      {initialsOf(name)}
    </span>
  );
}
