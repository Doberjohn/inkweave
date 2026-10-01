import {useState} from 'react';
import {QuantityStepper} from '../../shared/components';
import type {CollectionEntry, Finish} from './collectionParser';
import {IconButton} from '../../shared/components';
import {COLORS, DURATION, EASING, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../shared/constants';

/**
 * Per-finish quantity editing on a binder slot (#555 follow-on, design spike).
 *
 * TWO STEPPERS REPLACE THE FINISH TOGGLE (owner, 2026-08-14). One number per
 * finish is visible at once, so "what do I hold of this card" needs no mode, and
 * the gold duplicate badge goes with it — two numbers say "2 normal, 1 foil"
 * where one badge could only say "3".
 *
 * THE OPEN QUESTION THIS FILE EXISTS TO ANSWER: how does someone add the FIRST
 * copy of a card they do not own? The deck pool dodges it — its stepper only
 * appears once the count is ≥ 1, and clicking the card body adds the first copy.
 * That will not transfer, because clicking a binder slot opens the card modal.
 *
 * Two variants, switched by `?steppers=`:
 *
 *   zeros  — both counts always shown, `0` included, styled quiet. The zero IS
 *            the affordance, one visual language on every tile, works on touch.
 *            Risk: 48 zeros on a sparse set.
 *   plus   — an unowned slot shows a single `+`, expanding to both steppers.
 *            One glyph instead of two zeros. Risk: two visual languages, and a
 *            `+` competing with the steppers' own `+`.
 *
 * HOVER IS THE SLOT'S, NOT THIS COMPONENT'S. It arrives as a prop because this
 * component only occupies the bottom ~20px strip of a tile: owning its own
 * `onMouseEnter` made the steppers reachable only by landing the pointer on the
 * badges themselves, so moving the mouse onto a card did nothing. Focus stays
 * internal — the focusable controls are all in here.
 *
 * ONE ROW, BOTH FINISHES (owner, 2026-08-14). Stacked steppers were far too tall
 * for a card slot. Side by side they only fit at the new `xs` size — measured, the
 * narrowest slot the app produces is 114px and two `sm` pills are 176px. The
 * resting badges use the same row and the same order, so nothing jumps position
 * when the steppers open.
 *
 * THE FINISH IS THE BACKGROUND, NOT A LETTER (owner, 2026-08-14, Dreamborn as the
 * reference). An `N`/`F` beside each number was tried and rejected: at this size
 * it doubled the glyph count on every tile to label something a surface says at a
 * glance. Normal keeps the flat dark ground; foil takes `FOIL_SHEEN`'s brushed
 * gold. The words survive ONLY in the aria-labels — where a screen reader needs
 * them and where they cost no pixels.
 *
 * REST IS THE SAME PILL, COLLAPSED (owner, 2026-08-14). Earlier revisions drew a
 * bespoke badge for the resting state — first a tinted chip, then a flat gold one
 * — and every version needed its own surface, its own radius, its own type scale
 * and its own contrast argument. Using `QuantityStepper`'s own `collapsed` mode
 * instead means rest and hover cannot drift, the − and + grow out of the number
 * rather than replacing it, and the width transition is free.
 *
 * It also removes the transparency: `xs` grounds on an opaque `COLORS.background`
 * where the larger sizes use 94%. On a deck surface 6% passthrough is a hint of
 * the tile below; on card art it is somebody's face behind a number.
 *
 * ONLY THE HOVERED PILL SWEEPS. A spread is 24 slots, so 24 simultaneous light
 * bands compete with each other and with the art, where animating the one control
 * the pointer is already on is a highlight.
 */

export type StepperVariant = 'zeros' | 'plus';

interface CollectionSlotSteppersProps {
  /** The parser's own type, not a parallel one — a third finish must land once. */
  counts: CollectionEntry;
  variant: StepperVariant;
  /** True while the pointer is anywhere on the slot. Owned by the slot, not here. */
  hovered: boolean;
  /** Card name, for the steppers' aria-labels. */
  label: string;
  onChange: (finish: Finish, next: number) => void;
}

const FINISHES: Finish[] = ['normal', 'foil'];

export function CollectionSlotSteppers({
  counts,
  variant,
  hovered,
  label,
  onChange,
}: CollectionSlotSteppersProps) {
  const [focused, setFocused] = useState(false);
  // Hover alone is not enough: the deck pool learned that a control which
  // vanishes mid-interaction takes the interaction with it, and hover does not
  // exist on touch at all.
  const open = hovered || focused;
  const empty = counts.normal === 0 && counts.foil === 0;

  // `plus` at rest on an empty slot: one glyph, no numbers. Everything else —
  // including `plus` once anything is owned — shows the per-finish counts.
  const showPlusOnly = variant === 'plus' && empty && !open;

  return (
    <div
      onFocus={() => setFocused(true)}
      // Tabbing from − to + fires focusout before focusin. Without the
      // containment check the steppers would unmount between the two events and
      // eat the focus they were about to receive.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: SPACING.xxs,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // xxs, not xs: the two `xs` steppers need 110 of the 114px the narrowest
        // slot gives them, and the 2px this saves went into the count cell.
        gap: SPACING.xxs,
        zIndex: 3,
        transition: `opacity ${DURATION.fast}ms ${EASING.snappy}`,
      }}>
      {showPlusOnly ? (
        <IconButton
          aria-label={`Add a copy of ${label}`}
          size={22}
          onClick={() => onChange('normal', 1)}
          style={{
            background: COLORS.background,
            color: COLORS.text,
            borderRadius: `${RADIUS.pill}px`,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.sm}px`,
            fontWeight: 700,
          }}>
          +
        </IconButton>
      ) : (
        FINISHES.map((finish) => (
          // The wrapper carries the finish for a screen reader. Collapsed, the
          // − and + are `aria-hidden` and their labels go with them, leaving a
          // bare number with nothing to say which finish it counts.
          <span key={finish} aria-label={`${counts[finish]} ${finish}`}>
            <QuantityStepper
              value={counts[finish]}
              size="xs"
              collapsed={!open}
              tone={finish === 'foil' ? 'foil' : 'default'}
              shimmer={open}
              label={`${finish} ${label}`}
              onIncrement={() => onChange(finish, counts[finish] + 1)}
              onDecrement={() => onChange(finish, Math.max(0, counts[finish] - 1))}
            />
          </span>
        ))
      )}
    </div>
  );
}
