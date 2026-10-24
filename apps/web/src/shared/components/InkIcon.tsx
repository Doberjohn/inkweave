import type {Ink} from '../../features/cards';

// Files of their own (`?no-inline`, #934): the card placeholders draw the same six symbols from
// index.css, so a page showing both downloads each once, and the JavaScript carries none of them.
import amberSvg from '../../assets/amber.svg?no-inline';
import amethystSvg from '../../assets/amethyst.svg?no-inline';
import emeraldSvg from '../../assets/emerald.svg?no-inline';
import rubySvg from '../../assets/ruby.svg?no-inline';
import sapphireSvg from '../../assets/sapphire.svg?no-inline';
import steelSvg from '../../assets/steel.svg?no-inline';

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
