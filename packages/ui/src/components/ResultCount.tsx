import {COLORS, FONT_SIZES, FONT_WEIGHT} from '../tokens/theme';

interface ResultCountProps {
  resultCount: number;
  totalCount: number;
  'data-testid'?: string;
}

/** Displays "N cards" or "N of M cards" with styled count. */
export function ResultCount({resultCount, totalCount, ...rest}: ResultCountProps) {
  return (
    <span
      data-testid={rest['data-testid']}
      style={{
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.textMuted,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}>
      <strong style={{color: COLORS.text, fontWeight: FONT_WEIGHT.bold}}>{resultCount}</strong>{' '}
      {resultCount === totalCount ? 'cards' : `of ${totalCount} cards`}
    </span>
  );
}
