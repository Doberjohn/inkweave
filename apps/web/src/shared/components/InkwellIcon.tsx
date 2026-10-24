// Files of their own (`?no-inline`, #934), kept out of the JavaScript that shows them.
import inkableSvg from '../../assets/inkable.svg?no-inline';
import uninkableSvg from '../../assets/uninkable.svg?no-inline';

export type InkwellValue = 'inkable' | 'uninkable';

const ICONS: Record<InkwellValue, string> = {
  inkable: inkableSvg,
  uninkable: uninkableSvg,
};

const LABELS: Record<InkwellValue, string> = {
  inkable: 'Inkable',
  uninkable: 'Uninkable',
};

interface InkwellIconProps {
  value: InkwellValue;
  /** Icon size in pixels (default 20) */
  size?: number;
  /** Set to false when icon is used without adjacent text label */
  decorative?: boolean;
}

export function InkwellIcon({value, size = 20, decorative = true}: InkwellIconProps) {
  return (
    <img
      src={ICONS[value]}
      alt={decorative ? '' : LABELS[value]}
      aria-hidden={decorative}
      width={size}
      height={size}
      style={{display: 'block', flexShrink: 0}}
    />
  );
}
