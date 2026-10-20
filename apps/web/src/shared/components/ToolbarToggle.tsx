import {CtaButton} from './CtaButton';
import {GOLD_GLOW} from '../constants';

type CtaButtonProps = React.ComponentProps<typeof CtaButton>;

interface ToolbarToggleProps extends Omit<CtaButtonProps, 'variant'> {
  /** Its area is open: the filled gold look with a warm glow. Closed, the ghost outline. */
  active: boolean;
  isMobile?: boolean;
}

/** The filled look's warm glow, softer on phones. */
function glow(isMobile: boolean | undefined): string {
  const tint = GOLD_GLOW.activeBg;
  return isMobile ? `0px 6px 10px 0px ${tint}` : `0px 8px 12px 0px ${tint}, 0px 3px 5px 0px ${tint}`;
}

/**
 * A toolbar toggle in its 34px toolbar size, Browse's Filters and Collection (owner,
 * 2026-10-08): it shows whether its area is open. Open, the filled gold CTA with a warm glow;
 * closed, the ghost outline. One recipe, so the two buttons can never drift apart.
 */
export function ToolbarToggle({active, isMobile, style, ...rest}: ToolbarToggleProps) {
  return (
    <CtaButton
      {...rest}
      variant={active ? 'filled' : 'ghost'}
      style={{
        height: 34,
        minHeight: 34,
        padding: isMobile ? '0 12px' : '0 14px',
        gap: 6,
        flexShrink: 0,
        boxShadow: active ? glow(isMobile) : undefined,
        // The ghost outline's 1px border, clear, so both states are one size and toggling
        // never nudges what sits beside the button. The gradient paints under it.
        ...(active && {border: '1px solid transparent'}),
        ...style,
      }}
    />
  );
}
