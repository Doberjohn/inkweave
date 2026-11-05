import {useHover} from 'inkweave-ui/hooks/useHover';
import {COLORS, EASING, FONT_SIZES, FONT_WEIGHT, SPACING} from '../constants';

/**
 * "Developed and designed by Recurssive", the studio credit at the foot of the Footer.
 *
 * Inkweave's own copy of Recurssive's shared footer credit (the plain variant), restyled with
 * Inkweave's tokens (owner, 2026-11-05) instead of Recurssive's purples, so it passes the
 * design-token rules with no exemption. It rests in textMuted like the footer's links and lifts
 * to text on hover, and the mark turns the brand gold. It is no longer generated from the
 * shared snippet, so a change there has to be carried over by hand.
 *
 * rel="nofollow": the same link repeats in the footer of every page, and Google lists
 * "widely distributed links in the footers or templates of various sites" under link spam.
 */

/** The Reflow mark, from Recurssive's own logo export (viewBox 0 0 120 80). Do not hand-edit. */
const MARK_PATHS = [
  'M58.06 78.07C51.22 65.68 44.39 52.96 37.58 41.08C37.07 40.22 37.07 39.07 37.58 38.21C44.37 26.32 51.22 13.6 58.06 1.22C58.96 -0.41 60.96 -0.41 61.85 1.22C68.7 13.61 75.53 26.34 82.34 38.21C82.85 39.07 82.85 40.22 82.34 41.08C75.55 52.97 68.7 65.69 61.85 78.07C60.96 79.7 58.96 79.7 58.06 78.07Z',
  'M32.33 69.35C28.48 68.83 24.64 68.2 20.83 67.48C19.9 67.3 19.15 66.16 19.15 64.97V14.29C19.15 13.09 19.9 11.97 20.83 11.78C24.64 11.05 28.48 10.43 32.33 9.91C33.28 9.79 34.03 10.74 34.05 12.06V67.2C34.05 68.52 33.28 69.47 32.33 69.35Z',
  'M7.45 21.38C11.58 20.45 14.97 28.69 14.97 39.63C14.97 50.57 11.58 58.81 7.45 57.87C3.32 56.92 0 48.68 0 39.63C0 30.58 3.32 22.34 7.45 21.38Z',
  'M87.6 9.91C91.46 10.43 95.3 11.05 99.1 11.78C100.04 11.95 100.79 13.09 100.79 14.29V64.99C100.79 66.18 100.04 67.3 99.1 67.49C95.3 68.22 91.46 68.85 87.6 69.36C86.66 69.49 85.89 68.53 85.89 67.22V12.06C85.89 10.74 86.66 9.79 87.6 9.91Z',
  'M119.94 39.63C119.94 48.68 116.62 56.92 112.49 57.87C108.35 58.81 104.97 50.57 104.97 39.63C104.97 28.69 108.35 20.45 112.49 21.38C116.62 22.34 119.94 30.58 119.94 39.63Z',
] as const;

export function RecurssiveCredit() {
  const {hovered, hoverProps} = useHover();
  return (
    <a
      href="https://recurssive.com"
      target="_blank"
      rel="noopener nofollow"
      {...hoverProps}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${SPACING.xs}px`,
        color: hovered ? COLORS.text : COLORS.textMuted,
        fontSize: `${FONT_SIZES.xs}px`,
        textDecoration: 'none',
        transition: `color 0.15s ${EASING.snappy}`,
      }}>
      <svg
        viewBox="0 0 120 80"
        aria-hidden="true"
        focusable="false"
        style={{
          height: '1em',
          width: 'auto',
          flexShrink: 0,
          overflow: 'visible',
          fill: hovered ? COLORS.primary : 'currentColor',
          transition: `fill 0.15s ${EASING.snappy}`,
        }}>
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      <span>
        Developed and designed by <span style={{fontWeight: FONT_WEIGHT.semibold}}>Recurssive</span>
      </span>
    </a>
  );
}
