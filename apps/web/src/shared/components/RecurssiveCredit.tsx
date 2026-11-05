import {useState} from 'react';
import {useHover} from 'inkweave-ui/hooks/useHover';
import {COLORS, DURATION, EASING, FONT_SIZES, FONT_WEIGHT, SPACING, TOUCH_TARGET} from '../constants';

/**
 * "Developed and designed by Recurssive", the studio credit at the foot of the Footer.
 *
 * A hand-kept copy of the plain variant of Recurssive's shared footer credit, so a change to the
 * shared snippet has to be carried over by hand. It is styled with Inkweave's tokens (owner,
 * 2026-11-05) so it passes the design-token rules with no exemption: it rests in textMuted like
 * the footer's links, lifts to text on hover or keyboard focus, and the mark turns the brand gold.
 *
 * minHeight TOUCH_TARGET: it stands alone on the footer's last row, not inside a sentence, so its
 * 10px line would otherwise be its whole tap area (WCAG 2.5.8).
 *
 * rel="nofollow": the same link repeats in the footer of every page, and Google lists
 * "widely distributed links in the footers or templates of various sites" under link spam.
 */

/**
 * The Reflow mark, from Recurssive's own logo export (viewBox 0 0 120 80), its coordinates
 * rounded to one decimal by script: at the footer's 10px a tenth of a unit is about 0.01px,
 * and it keeps "User-facing JS" inside its budget. Do not hand-edit.
 */
const MARK_PATHS = [
  'M58.1 78.1C51.2 65.7 44.4 53 37.6 41.1C37.1 40.2 37.1 39.1 37.6 38.2C44.4 26.3 51.2 13.6 58.1 1.2C59 -0.4 61 -0.4 61.9 1.2C68.7 13.6 75.5 26.3 82.3 38.2C82.9 39.1 82.9 40.2 82.3 41.1C75.6 53 68.7 65.7 61.9 78.1C61 79.7 59 79.7 58.1 78.1Z',
  'M32.3 69.4C28.5 68.8 24.6 68.2 20.8 67.5C19.9 67.3 19.2 66.2 19.2 65V14.3C19.2 13.1 19.9 12 20.8 11.8C24.6 11.1 28.5 10.4 32.3 9.9C33.3 9.8 34 10.7 34.1 12.1V67.2C34.1 68.5 33.3 69.5 32.3 69.4Z',
  'M7.5 21.4C11.6 20.5 15 28.7 15 39.6C15 50.6 11.6 58.8 7.5 57.9C3.3 56.9 0 48.7 0 39.6C0 30.6 3.3 22.3 7.5 21.4Z',
  'M87.6 9.9C91.5 10.4 95.3 11.1 99.1 11.8C100 12 100.8 13.1 100.8 14.3V65C100.8 66.2 100 67.3 99.1 67.5C95.3 68.2 91.5 68.9 87.6 69.4C86.7 69.5 85.9 68.5 85.9 67.2V12.1C85.9 10.7 86.7 9.8 87.6 9.9Z',
  'M119.9 39.6C119.9 48.7 116.6 56.9 112.5 57.9C108.4 58.8 105 50.6 105 39.6C105 28.7 108.4 20.5 112.5 21.4C116.6 22.3 119.9 30.6 119.9 39.6Z',
] as const;

export function RecurssiveCredit() {
  const {hovered, hoverProps} = useHover();
  const [focused, setFocused] = useState(false);
  const lit = hovered || focused;
  return (
    <a
      href="https://recurssive.com"
      target="_blank"
      rel="noopener nofollow"
      {...hoverProps}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: TOUCH_TARGET,
        gap: `${SPACING.xs}px`,
        color: lit ? COLORS.text : COLORS.textMuted,
        fontSize: `${FONT_SIZES.xs}px`,
        textDecoration: 'none',
        transition: `color ${DURATION.fast}ms ${EASING.snappy}`,
      }}>
      <svg
        viewBox="0 0 120 80"
        aria-hidden="true"
        focusable="false"
        style={{
          // Both sides set from the viewBox's 3:2: WebKit can size an inline SVG flex item
          // with `width: auto` at its 300px default instead of from the ratio.
          height: '1em',
          width: '1.5em',
          flexShrink: 0,
          overflow: 'visible',
          fill: lit ? COLORS.primary : 'currentColor',
          transition: `fill ${DURATION.fast}ms ${EASING.snappy}`,
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
