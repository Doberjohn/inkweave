import {COLORS, FONT_SIZES} from '../constants';

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
        fontWeight: 600,
        color: COLORS.textMuted,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}>
      <strong style={{color: COLORS.text, fontWeight: 700}}>{resultCount}</strong>{' '}
      {resultCount === totalCount ? 'cards' : `of ${totalCount} cards`}
    </span>
  );
}
