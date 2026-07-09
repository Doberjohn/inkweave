import type {CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';

/** Core copy limit — the + is disabled once a line reaches it. */
const MAX_COPIES = 4;

interface DeckCardRowProps {
  card: LorcanaCard;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

const STEP_BUTTON: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.surfaceBorder}`,
  background: COLORS.surfaceAlt,
  color: COLORS.text,
  fontSize: `${FONT_SIZES.base}px`,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const REMOVE_BUTTON: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: RADIUS.sm,
  border: 'none',
  background: 'transparent',
  color: COLORS.textDim,
  fontSize: `${FONT_SIZES.lg}px`,
  lineHeight: 1,
  cursor: 'pointer',
  flexShrink: 0,
};

/**
 * One line in the deck panel: cost badge, name, a [− qty +] stepper, and a
 * remove-all ×. The + disables at {@link MAX_COPIES} (UI-side enforcement of the
 * permissive state layer); − at 1 removes the line via the parent's setQuantity.
 */
export function DeckCardRow({card, quantity, onIncrement, onDecrement, onRemove}: DeckCardRowProps) {
  const atMax = quantity >= MAX_COPIES;
  const ink = INK_COLORS[card.ink];
  const name = card.fullName || card.name || 'Unknown card';

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm, padding: `4px ${SPACING.sm}px`}}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: RADIUS.sm,
          background: ink.bg,
          color: ink.text,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.xs}px`,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {card.cost}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          color: COLORS.text,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
        {name}
      </span>
      <div style={{display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0}}>
        <button type="button" onClick={onDecrement} aria-label={`Remove one copy of ${name}`} style={STEP_BUTTON}>
          −
        </button>
        <span
          style={{
            minWidth: 16,
            textAlign: 'center',
            color: COLORS.text,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
          }}>
          {quantity}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={atMax}
          aria-label={atMax ? `Maximum ${MAX_COPIES} copies of ${name}` : `Add one copy of ${name}`}
          style={{...STEP_BUTTON, opacity: atMax ? 0.4 : 1, cursor: atMax ? 'default' : 'pointer'}}>
          +
        </button>
      </div>
      <button type="button" onClick={onRemove} aria-label={`Remove ${name} from deck`} style={REMOVE_BUTTON}>
        ×
      </button>
    </div>
  );
}
