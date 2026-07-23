import {CtaButton} from './CtaButton';
import {FilterIcon} from './FilterIcon';
import {CountBadge} from './CountBadge';
import {COLORS, hexRgba} from '../constants';

interface FiltersButtonProps {
  onClick: () => void;
  activeCount: number;
  isMobile?: boolean;
}

/**
 * The toolbar "Filters" button (#509): a thin wrapper over the filled CtaButton
 * in its 34px toolbar size — this file no longer carries its own gradient
 * recipe. The soft warm glow replaces the previous near-identical orange
 * literals (converged to tokens per the shrink-only ledger).
 */
export function FiltersButton({onClick, activeCount, isMobile}: FiltersButtonProps) {
  return (
    <CtaButton
      onClick={onClick}
      aria-label="Filters"
      style={{
        height: 34,
        minHeight: 34,
        padding: isMobile ? '0 12px' : '0 14px',
        gap: 6,
        flexShrink: 0,
        boxShadow: isMobile
          ? `0px 6px 10px 0px ${hexRgba(COLORS.primary, 0.15)}`
          : `0px 8px 12px 0px ${hexRgba(COLORS.primary, 0.15)}, 0px 3px 5px 0px ${hexRgba(COLORS.primary, 0.15)}`,
      }}>
      <FilterIcon />
      Filters
      <CountBadge count={activeCount} />
    </CtaButton>
  );
}
