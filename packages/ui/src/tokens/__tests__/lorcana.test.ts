import {expect, test} from 'vitest';
import {INK_CHIP_COLORS} from '../lorcana';

/** WCAG's relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

test.each(Object.entries(INK_CHIP_COLORS))("%s's chip text meets 4.5:1 on its ink", (_ink, {bg, text}) => {
  // The chips' letters are 11px bold, small text by WCAG's measure.
  expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
});
