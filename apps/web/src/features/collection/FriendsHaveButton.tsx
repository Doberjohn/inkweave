import type {CSSProperties} from 'react';
import {LinkButton} from '../../shared/components';
import {COLORS, FOIL_SHEEN, FONT_SIZES, GOLD_GLOW, RADIUS, SPACING} from '../../shared/constants';
import {useHover} from '../../shared/hooks';
import {ChevronIcon, PeopleIcon} from '../friends/icons';

interface FriendsHaveButtonProps {
  isMobile: boolean;
  label: string;
  gold: boolean;
  onPress: () => void;
}

/**
 * The card window's count of the friends who have the card, which opens Friends who have it: a
 * chip beside the set's logo on a computer ("11 friends have it ›"), a line under the copies on a
 * phone ("12 friends have it · See who ›"). In brushed gold when every copy on offer is a foil, as
 * the copies stripe marks a foil.
 */
export function FriendsHaveButton({isMobile, label, gold, onPress}: FriendsHaveButtonProps) {
  const {hovered, hoverProps} = useHover();
  const ground = gold
    ? {...FOIL_SHEEN.surface(COLORS.background, false), borderColor: GOLD_GLOW.activeBorder}
    : {background: COLORS.background, borderColor: hovered ? GOLD_GLOW.activeBorder : COLORS.surfaceBorder};
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onPress}
      {...hoverProps}
      style={{...(isMobile ? LINE_STYLE : CHIP_STYLE), ...ground}}>
      <PeopleIcon />
      <span>{label}</span>
      {isMobile && (
        <span aria-hidden style={{color: COLORS.primary, marginLeft: 'auto'}}>
          See who
        </span>
      )}
      <ChevronIcon />
    </button>
  );
}

const BUTTON_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: SPACING.sm,
  border: '1px solid',
  color: COLORS.text,
  fontSize: `${FONT_SIZES.lg}px`,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** As tall as the set's logo beside it (`LOGO_HEIGHT`), so the header keeps its height. */
const CHIP_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  height: 34,
  padding: `0 ${SPACING.md}px`,
  borderRadius: RADIUS.pill,
  flexShrink: 0,
};

/** The card's width under its copies, a touch target tall. */
const LINE_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  alignSelf: 'stretch',
  minHeight: 44,
  padding: `0 ${SPACING.lg}px`,
  borderRadius: RADIUS.card,
};

/** A read of friends' copies that failed, on a card the reader lacks: what happened and a way to try again. */
export function FriendsHaveFailed({isMobile, onRetry}: {isMobile: boolean; onRetry: () => void}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACING.sm,
        fontSize: `${FONT_SIZES.base}px`,
        color: COLORS.textMuted,
        ...(isMobile && {alignSelf: 'stretch', justifyContent: 'space-between'}),
      }}>
      Couldn&rsquo;t load friends&rsquo; copies
      <LinkButton type="button" size="sm" onClick={onRetry}>
        Retry
      </LinkButton>
    </span>
  );
}
