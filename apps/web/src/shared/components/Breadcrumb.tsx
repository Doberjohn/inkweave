import {Fragment} from 'react';
import {Link} from 'react-router-dom';
import {COLORS, FONTS, FONT_SIZES, SPACING, TOUCH_TARGET} from '../constants';

export interface Crumb {
  label: string;
  /** Omit on the LAST crumb — you are already there, so it is text, not a link. */
  to?: string;
}

interface BreadcrumbProps {
  /** Ancestors first, current page last. */
  crumbs: readonly Crumb[];
  style?: React.CSSProperties;
}

/**
 * Where you are, as a trail.
 *
 * Distinct from `BackLink` on purpose, and the distinction is what each one answers.
 * A breadcrumb answers "where am I" — it states hierarchy and names every level, so
 * it is only worth its space on a page nested deep enough to be disorienting. A back
 * link answers "how do I leave", names one destination, and belongs anywhere the
 * reader arrived from somewhere specific.
 *
 * Collapsing the two would have been the tidier-looking call and the wrong one: the
 * app's one breadcrumb sits two levels down, and replacing it with "← Back to
 * playstyles" would delete its only hierarchy cue to save a component.
 *
 * Real `<Link>`s, not intercepted anchors. The site this was extracted from called
 * `preventDefault()` and then routed by hand, which quietly cost middle-click and
 * open-in-new-tab on a URL that has neither reason nor need to lose them.
 */
export function Breadcrumb({crumbs, style}: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        color: COLORS.textMuted,
        ...style,
      }}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <Fragment key={crumb.label}>
            {crumb.to && !isLast ? (
              <Link
                to={crumb.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  // A tap target: a breadcrumb is small text and often the only way
                  // up on a phone.
                  minHeight: TOUCH_TARGET,
                  color: COLORS.textMuted,
                  textDecoration: 'none',
                }}>
                {crumb.label}
              </Link>
            ) : (
              // `aria-current` so a screen reader knows which crumb is this page,
              // rather than reading the trail as a list of equal links.
              <span aria-current={isLast ? 'page' : undefined} style={{color: COLORS.text, fontWeight: 500}}>
                {crumb.label}
              </span>
            )}
            {!isLast && (
              <span aria-hidden style={{fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim}}>
                /
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
