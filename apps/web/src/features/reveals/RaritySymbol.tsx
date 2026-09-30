import commonSvg from '../../assets/common.svg';
import uncommonSvg from '../../assets/uncommon.svg';
import rareSvg from '../../assets/rare.svg';
import superRareSvg from '../../assets/super_rare.svg';
import legendarySvg from '../../assets/legendary.svg';
// The special printings' symbols are the same files the printing switcher uses (PrintingPills).
import enchantedSymbol from '../../assets/enchanted.webp?no-inline';
import epicSymbol from '../../assets/epic.webp?no-inline';
import iconicSymbol from '../../assets/iconic.webp?no-inline';

/** Real Lorcana rarity symbols, keyed by rarity key (lowercased, see rarity.ts). */
const RARITY_SYMBOLS: Record<string, string> = {
  common: commonSvg,
  uncommon: uncommonSvg,
  rare: rareSvg,
  'super rare': superRareSvg,
  legendary: legendarySvg,
  epic: epicSymbol,
  enchanted: enchantedSymbol,
  iconic: iconicSymbol,
};

interface RaritySymbolProps {
  /** Rarity key (e.g. "super rare"). */
  rarity: string;
  /** Box size in px; the symbol is fit inside without distortion. */
  size: number;
}

/**
 * The official rarity glyph for a card or special printing. Renders the vendored
 * file as-is (monochrome for common/uncommon, the detailed gem artwork for the
 * rest), fit inside a square box so mixed aspect ratios share a footprint.
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
