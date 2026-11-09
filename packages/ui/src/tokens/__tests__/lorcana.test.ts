import {expect, test} from 'vitest';
import {INK_CHIP_COLORS} from '../lorcana';
import {contrast} from './contrast';

test.each(Object.entries(INK_CHIP_COLORS))("%s's chip text meets 4.5:1 on its ink", (_ink, {bg, text}) => {
  // The chips' letters are 11px bold, small text by WCAG's measure.
  expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
});
