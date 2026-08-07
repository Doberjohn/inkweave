import {Link} from 'react-router-dom';
import {COLORS, DURATION, EASING, FONTS, FONT_SIZES, SPACING, TOUCH_TARGET} from '../constants';
import {useHover} from '../hooks/useHover';

interface BackLinkBase {
  /** What the reader is going back TO, e.g. "decks". Rendered as "← Back to decks". */
  label: string;
  /** Merged last — outer spacing belongs to the call site, not the component (#509). */
  style?: React.CSSProperties;
}

/**
 * A destination XOR a handler, never both.
 *
 * The union is the whole point of the rebuild. The old component was a `<button
 * onClick>` and nothing else, so every back-navigation that went to a REAL URL had to
 * hand-roll an anchor to keep middle-click, open-in-new-tab and crawlability — which
 * is exactly what DeckViewPage and PlaystyleDetailPage did. The component could not
 * do their job, so they stopped using it, and the pattern forked five ways.
 */
type BackLinkProps = BackLinkBase &
  ({to: string; onClick?: never} | {onClick: () => void; to?: never});

/**
 * The one way back.
 *
 * `← Back to X`, quiet until hovered, sitting above the content it returns from.
 * Enforced by `inkweave/no-adhoc-back-links`: a "Back to …" label in a file that does
 * not import this is an error, because a prose ruling with no mechanism is a
 * suggestion — which is how eleven sites became five shapes.
 *
 * NOT for a terminal screen's one remaining action. "Back to Home" after a completed
 * vote is a primary CTA that happens to say back; it stays a `CtaButton`, and those
 * three sites are named in the rule.
 *
 * NOT for hierarchy either: `Playstyles / Lore Denial` answers "where am I", not "how
 * do I leave". That is `Breadcrumb`.
 */
export function BackLink({label, style, ...nav}: BackLinkProps) {
  const {hovered, hoverProps} = useHover();

  const content = (
    <>
      <span aria-hidden>&larr;</span>
      {label}
    </>
  );

  const shared: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: SPACING.xs,
    // A tap target, not just text. It sits alone above the content, so there is
    // nothing adjacent to absorb a near miss.
    minHeight: TOUCH_TARGET,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'none',
    // THE brand gold, not the legacy accent. The old component used
    // `COLORS.primary500` and sat in the grandfather ledger twice — the standard was
    // itself a rule-breaker, which is a poor argument for following it.
    color: hovered ? COLORS.primary : COLORS.textMuted,
    fontFamily: FONTS.body,
    fontSize: `${FONT_SIZES.base}px`,
    fontWeight: 500,
    transition: `color ${DURATION.fast}ms ${EASING.snappy}`,
    ...style,
  };

  if (nav.to !== undefined) {
    return (
      <Link to={nav.to} {...hoverProps} style={shared}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={nav.onClick} {...hoverProps} style={shared}>
      {content}
    </button>
  );
}
