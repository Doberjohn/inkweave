import {useId, type CSSProperties, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {COLORS, FONTS, FONT_SIZES, FONT_WEIGHT, LINE_HEIGHT, SPACING} from '../constants';

/** The reading column the playstyle guides and legal pages use. */
const ABOUT_MAX_WIDTH = 720;

const HEADING: CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.xl,
  fontWeight: FONT_WEIGHT.bold,
  color: COLORS.text,
  margin: 0,
};

const BODY: CSSProperties = {
  fontSize: FONT_SIZES.lg,
  lineHeight: LINE_HEIGHT.relaxed,
  color: COLORS.descriptionText,
};

/** Gold and underlined, since gold alone sits too close to the text around it (WCAG 1.4.1). */
const LINK: CSSProperties = {
  color: COLORS.primary,
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};

/** A link inside a PageAbout's prose. */
export function PageAboutLink({to, children}: {to: string; children: ReactNode}) {
  return (
    <Link to={to} style={LINK}>
      {children}
    </Link>
  );
}

export interface PageAboutProps {
  heading: string;
  /** The section's paragraphs. */
  children: ReactNode;
  /** Lines the section up with the page's content above it. */
  padding?: string;
}

/**
 * A few paragraphs about a hub page, under its grid or vote screen, so the page has words of its
 * own for search without moving anything on its first screen. They sit closed under their
 * heading (index.css's `.text-disclosure`) until a visitor opens them.
 */
export function PageAbout({heading, children, padding}: PageAboutProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} style={{padding, position: 'relative', zIndex: 1}}>
      <div
        style={{
          ...BODY,
          maxWidth: ABOUT_MAX_WIDTH,
          borderTop: `1px solid ${COLORS.surfaceBorder}`,
          paddingTop: SPACING.xxl,
        }}>
        <details className="text-disclosure">
          <summary>
            <h2 id={headingId} style={HEADING}>
              {heading}
            </h2>
          </summary>
          <div style={{paddingTop: SPACING.md}}>{children}</div>
        </details>
      </div>
    </section>
  );
}
