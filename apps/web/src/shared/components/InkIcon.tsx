import type {Ink} from '../../features/cards';

import amberSvg from '../../assets/amber.svg';
import amethystSvg from '../../assets/amethyst.svg';
import emeraldSvg from '../../assets/emerald.svg';
import rubySvg from '../../assets/ruby.svg';
import sapphireSvg from '../../assets/sapphire.svg';
import steelSvg from '../../assets/steel.svg';

const INK_ICONS: Record<Ink, string> = {
  Amber: amberSvg,
  Amethyst: amethystSvg,
  Emerald: emeraldSvg,
  Ruby: rubySvg,
  Sapphire: sapphireSvg,
  Steel: steelSvg,
};

interface InkIconProps {
  ink: Ink;
  /** Icon size in pixels (default 20) */
  size?: number;
  /** Set to false when icon is used without adjacent text label */
  decorative?: boolean;
  /**
   * Native hover tooltip. Off by default, because most icons here sit beside the
   * ink's name already and a tooltip repeating it is noise.
   *
   * Turn it on where the symbol is the ONLY thing naming the ink, as on the deck
   * tiles: `alt` is announced by a screen reader but produces no tooltip in any
   * current browser, so a sighted reader who does not recognise the hexagon has
   * nothing to hover.
   */
  showTooltip?: boolean;
  /**
   * Escape hatch from the pixel `size` prop, for a caller that must size the symbol
   * relative to its container rather than absolutely. The deck card needs it: its
   * symbols are `cqw` of the card so they scale with the grid, and they overlap by a
   * negative margin so two hexagons touch.
   */
  style?: React.CSSProperties;
}

export function InkIcon({ink, size = 20, decorative = true, showTooltip = false, style}: InkIconProps) {
  return (
    <img
      src={INK_ICONS[ink]}
      alt={decorative ? '' : ink}
      aria-hidden={decorative}
      title={showTooltip ? ink : undefined}
      width={size}
      height={size}
      style={{display: 'block', flexShrink: 0, ...style}}
    />
  );
}
