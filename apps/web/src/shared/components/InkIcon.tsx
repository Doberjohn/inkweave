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
}

export function InkIcon({ink, size = 20, decorative = true}: InkIconProps) {
  return (
    <img
      src={INK_ICONS[ink]}
      alt={decorative ? '' : ink}
      aria-hidden={decorative}
      width={size}
      height={size}
      style={{display: 'block', flexShrink: 0}}
    />
  );
}
