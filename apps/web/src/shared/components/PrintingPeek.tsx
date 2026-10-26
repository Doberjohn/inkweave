import {useEffect, useState, type CSSProperties} from 'react';
import {printingSpokenName} from '../hooks/usePrintingSelection';
import {
  COLORS,
  DURATION,
  EASING,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  RADIUS,
  SHADOWS,
  SPACING,
  VISUALLY_HIDDEN,
  hexRgba,
} from '../constants';
import {usePrefersReducedMotion} from 'inkweave-ui/utils/prefersReducedMotion';
import {PrintingName, type NamedPrinting} from './PrintingName';

/** Which side of the card a printing behind it sits on. */
export type PeekSide = 'prev' | 'next';

/** How long the notice naming the printing a turn brought in stays (owner, 2026-10-22). */
const NOTICE_MS = 1400;

/**
 * The stack's layers above its printings, which take 1 to 3 (printingStack): the peeks'
 * buttons, under the focus ring index.css draws at 4, then the turn's notice over the art.
 */
const PEEK_LAYER = 4;
const LABEL_LAYER = 5;

/** The dark pill the turn's notice sits in, over the art. */
const LABEL_STYLE: CSSProperties = {
  position: 'absolute',
  zIndex: LABEL_LAYER,
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.xs,
  padding: `${SPACING.xs}px ${SPACING.md}px`,
  borderRadius: RADIUS.pill,
  background: hexRgba(COLORS.background, 0.9),
  border: `1px solid ${GOLD_GLOW.activeBorder}`,
  boxShadow: SHADOWS.float,
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.md,
  fontWeight: 600,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};

function fade(reducedMotion: boolean): string | undefined {
  return reducedMotion ? undefined : `opacity ${DURATION.fast}ms ${EASING.snappy}, transform ${DURATION.fast}ms ${EASING.snappy}`;
}

interface PeekButtonProps {
  side: PeekSide;
  /** The printing it turns to. */
  printing: NamedPrinting;
  /** How far past the card's side it reaches, over the printing's edge there. */
  outside: number;
  /** How far into the card it reaches: a pointer's peek zone, or a finger's edge alone. */
  inside: number;
  /** A drag under way: the card's box takes the pointer, for its cursor. */
  dragging?: boolean;
  onTurn: () => void;
}

/**
 * The way to the printing behind the card on one side: its edge past the card, and under a
 * pointer the card's side too, where the peek opens (owner, 2026-10-22). Out of the Tab order:
 * the keyboard turns the card with ← and →, and a screen reader finds the button by its name.
 */
export function PeekButton({side, printing, outside, inside, dragging = false, onTurn}: PeekButtonProps) {
  const place = side === 'prev' ? {left: -outside} : {right: -outside};
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`${side === 'prev' ? 'Previous' : 'Next'} printing: ${printingSpokenName(printing)}`}
      onClick={onTurn}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        ...place,
        width: outside + inside,
        zIndex: PEEK_LAYER,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        pointerEvents: dragging ? 'none' : undefined,
      }}
    />
  );
}

interface TurnNoticeProps {
  printing: NamedPrinting;
  /** Its place among the card's printings, from 1, and how many there are. */
  position: number;
  count: number;
  /** Counts the turns the visitor made: each new one shows the notice again. */
  turns: number;
}

/**
 * Names the printing a turn brought in (owner, 2026-10-22): the pills that said it are gone, and
 * a phone's window shows no number in its header. A notice across the card's top for a moment,
 * and the same words, once, for a screen reader. Never for the printing a card arrives on.
 */
export function TurnNotice({printing, position, count, turns}: TurnNoticeProps) {
  const reducedMotion = usePrefersReducedMotion();
  // The last turn whose notice has had its moment.
  const [doneTurn, setDoneTurn] = useState(0);
  useEffect(() => {
    if (turns === 0) return;
    const timer = setTimeout(() => setDoneTurn(turns), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [turns]);
  const shown = turns > 0 && doneTurn !== turns;
  const spoken = `${printingSpokenName(printing)}, ${position} of ${count}`;
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          ...LABEL_STYLE,
          top: SPACING.md,
          left: '50%',
          color: COLORS.text,
          opacity: shown ? 1 : 0,
          transform: `translate(-50%, ${shown ? 0 : -SPACING.xs}px)`,
          transition: fade(reducedMotion),
        }}>
        <PrintingName printing={printing} />
        <span style={{color: COLORS.textMuted, fontWeight: 500}}>
          {position} of {count}
        </span>
      </div>
      <div role="status" style={VISUALLY_HIDDEN}>
        {turns > 0 ? spoken : ''}
      </div>
    </>
  );
}
