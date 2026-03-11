import {FONT_SIZES} from '../constants';

interface CountBadgeProps {
  count: number;
}

/** Small circular badge showing a count (e.g. active filter count on the Filters button). */
export function CountBadge({count}: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'rgba(0, 0, 0, 0.3)',
        color: '#ffffff',
        fontSize: `${FONT_SIZES.xs}px`,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {count}
    </span>
  );
}
