import type {CSSProperties, ReactNode} from 'react';
import {COLORS, FONT_SIZES} from '../constants';

interface PageTitleProps {
  children: ReactNode;
  /**
   * Layout only — margin/padding. Pages differ in spacing (some reset the UA
   * margin, some keep it, some add page padding), so the component owns the
   * TYPOGRAPHY and the caller owns where it sits.
   */
  style?: CSSProperties;
}

/**
 * The page-level heading. One source for title typography, which was previously
 * restated in every page: `xxl` / weight 700 / `COLORS.text`.
 *
 * Deliberately NOT uppercase (owner ruling): the caps-plus-tracking treatment was
 * applied inconsistently — two pages shouted, three did not — and title case reads
 * better against the app's serif headings.
 */
export function PageTitle({children, style}: PageTitleProps) {
  return (
    <h1
      style={{
        fontSize: `${FONT_SIZES.xxl}px`,
        fontWeight: 700,
        color: COLORS.text,
        ...style,
      }}>
      {children}
    </h1>
  );
}
