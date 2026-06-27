import commonSvg from '../../assets/common.svg';
import uncommonSvg from '../../assets/uncommon.svg';
import rareSvg from '../../assets/rare.svg';
import superRareSvg from '../../assets/super_rare.svg';
import legendarySvg from '../../assets/legendary.svg';

/** Real Lorcana rarity symbols, keyed by `card.rarity` (lowercased — see rarity.ts). */
const RARITY_SYMBOLS: Record<string, string> = {
  common: commonSvg,
  uncommon: uncommonSvg,
  rare: rareSvg,
  'super rare': superRareSvg,
  legendary: legendarySvg,
};

interface RaritySymbolProps {
  /** Rarity key (e.g. "super rare"). */
  rarity: string;
  /** Box size in px; the symbol is fit inside without distortion. */
  size: number;
}

/**
 * The official rarity glyph for a card. Renders the vendored SVG as-is
 * (monochrome for common/uncommon, the detailed gem artwork for the rest),
 * fit inside a square box so mixed aspect ratios share a footprint.
 */
export function RaritySymbol({rarity, size}: RaritySymbolProps) {
  const src = RARITY_SYMBOLS[rarity];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{display: 'block', flexShrink: 0, objectFit: 'contain'}}
    />
  );
}
