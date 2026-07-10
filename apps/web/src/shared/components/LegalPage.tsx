import type {ReactNode} from 'react';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../constants';
import {useResponsive} from '../hooks';
import {CompactHeader} from './CompactHeader';
import {Footer} from './Footer';

/**
 * Shared shell for the static legal/product pages (Privacy, Terms, Disclaimer,
 * About) from issue #219: the app-wide CompactHeader, a centered readable prose
 * column, and the site Footer. Keeps the four pages DRY and consistent, and
 * carries the Footer so the pages satisfy the "reachable from a footer"
 * acceptance criterion without a globally-mounted footer (which would collide
 * with the height:100vh tool pages).
 *
 * All text uses FONTS.body (Plus Jakarta Sans); headings lean on weight, not a
 * serif face, to establish hierarchy.
 */

const CONTENT_MAX_WIDTH = 720;

/** Section heading style for legal-page `<h2>`s. */
export const legalH2Style: React.CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.xl}px`,
  fontWeight: 700,
  color: COLORS.text,
  margin: `${SPACING.xl}px 0 ${SPACING.sm}px`,
};

/** Inline-link style for legal-page copy (gold, no underline). */
export const legalLinkStyle: React.CSSProperties = {
  color: COLORS.primary,
  textDecoration: 'none',
};

interface LegalPageProps {
  /** Page title, rendered as the single <h1>. */
  title: string;
  children: ReactNode;
}

export function LegalPage({title, children}: LegalPageProps) {
  const {isMobile} = useResponsive();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.background,
        fontFamily: FONTS.body,
      }}>
      <CompactHeader isMobile={isMobile} />

      <article
        style={{
          flex: 1,
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          margin: '0 auto',
          padding: `${SPACING.xxl}px ${SPACING.lg}px`,
          boxSizing: 'border-box',
          color: COLORS.descriptionText,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.xl}px`,
          lineHeight: 1.7,
        }}>
        <h1
          style={{
            margin: `0 0 ${SPACING.xl}px`,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.xxl}px`,
            fontWeight: 700,
            color: COLORS.text,
          }}>
          {title}
        </h1>
        {children}
      </article>

      <Footer />
    </main>
  );
}
