import {
  COLORS,
  DISABLED_STYLE,
  DURATION,
  EASING,
  FONT_SIZES,
  GOLD_GLOW,
  NEUTRAL_LADDER,
  RADIUS,
  SPACING,
} from '../tokens/theme';
import './SegmentedControl.css';

/** An option's height: admin's control height, which its pages line up with. */
const BUTTON_HEIGHT = 32;

/**
 * Every value SegmentedControl.css draws with, set on the group as custom properties: the
 * design-token gate counts a colour, radius, font size, shadow or duration typed into a
 * stylesheet, so each comes in from the tokens here (as INSET_FOCUS_RING feeds `.inset-focus-ring`).
 */
const SEGMENTED_LOOK = {
  '--segmented-fill': NEUTRAL_LADDER.card,
  '--segmented-edge': NEUTRAL_LADDER.border,
  '--segmented-hover': NEUTRAL_LADDER.navHover,
  '--segmented-text': COLORS.textMuted,
  '--segmented-text-hover': COLORS.text,
  '--segmented-accent': COLORS.primary,
  // 3.33:1 on the pressed fill (WCAG 1.4.11), where GOLD_GLOW.activeBorder gives 2.61:1.
  '--segmented-pressed-ring': `inset 0 0 0 1px ${GOLD_GLOW.strongBorder}`,
  '--segmented-held-opacity': String(DISABLED_STYLE.opacity),
  '--segmented-radius': `${RADIUS.md}px`,
  '--segmented-font-size': `${FONT_SIZES.md}px`,
  '--segmented-motion': `${DURATION.base}ms ${EASING.snappy}`,
  '--segmented-height': `${BUTTON_HEIGHT}px`,
  '--segmented-gap': `${SPACING.xxs}px`,
  '--segmented-pad': `${SPACING.md}px`,
  '--segmented-pair-pad': `${SPACING.xs}px`,
} as React.CSSProperties;

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<{value: T; label: string}>;
  /** The selected option. Null presses none, for a choice nobody has made yet. */
  value: T | null;
  onChange: (v: T) => void;
  /** Names the group for assistive tech: "Sort rules", "Score band". */
  ariaLabel: string;
  /**
   * Stretch the options across the width the control is given, padded 4px at the least. They
   * sit two by two (inPairs), so where one line can't hold them all a whole pair moves to the
   * next (`.segmented[data-fill='true']`, `.segmented-pair`). On a line they share, every button
   * takes the same width, an odd count's lone last one too; a lone button alone on the last line
   * fills that line. Default false: the control is as wide as its options.
   */
  fill?: boolean;
  /**
   * Every option is held: aria-disabled, so a focused one keeps the focus a native disabled
   * would drop to the page, and a press of one, which still arrives, does nothing (as
   * CtaButton's aria-disabled does). It dims as a disabled control does and takes no hover.
   * Default false.
   */
  held?: boolean;
}

/**
 * Fill's buttons, two to a pair: a row that wraps them goes two and two, never three and one. A
 * pair of one, an odd count's last, says so (data-lone): on a line it shares, it takes one
 * button's width, and alone on the last line it fills that line.
 */
function inPairs(buttons: React.ReactElement[]) {
  const pairs: React.ReactElement[] = [];
  for (let start = 0; start < buttons.length; start += 2) {
    const pair = buttons.slice(start, start + 2);
    pairs.push(
      <span key={start} className="segmented-pair" data-lone={pair.length === 1 || undefined}>
        {pair}
      </span>,
    );
  }
  return pairs;
}

/**
 * A row of mutually exclusive options: sort keys, score bands, a mode. Native buttons in a named
 * group, so each is a Tab stop that fires on Enter or Space; aria-pressed carries the selection,
 * and SegmentedControl.css draws it (`.segmented-btn[aria-pressed='true']`). Pressing the
 * selected option again does nothing, so onChange fires only for a real change: a mode switch
 * that pushes a URL adds no history entry for a stray click on the current mode. While nothing
 * is selected (a null value), every option is a real change. While the control is held, no
 * press fires it.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fill,
  held,
}: SegmentedControlProps<T>) {
  const choose = (next: T) => {
    if (!held && next !== value) onChange(next);
  };
  const buttons = options.map((option) => (
    <button
      key={option.value}
      type="button"
      className="segmented-btn"
      aria-pressed={option.value === value}
      aria-disabled={held || undefined}
      onClick={() => choose(option.value)}>
      {option.label}
    </button>
  ));
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="segmented"
      data-fill={fill || undefined}
      style={SEGMENTED_LOOK}>
      {fill ? inPairs(buttons) : buttons}
    </div>
  );
}
