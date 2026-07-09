import type {CSSProperties} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../../cards/components/CardTile';
import {getPoolTileState} from './poolTileState';
import {COLORS, FONTS, FONT_SIZES, RADIUS} from '../../../shared/constants';

interface PoolCardTileProps {
  card: LorcanaCard;
  /** The deck's current inks — drives the off-ink dim/disable. */
  deckInks: Ink[];
  /** How many copies of this card are already in the deck. */
  inDeckCount: number;
  onAdd: (card: LorcanaCard) => void;
  onViewDetails: (card: LorcanaCard) => void;
  priority?: boolean;
}

const PIP_STYLE: CSSProperties = {
  position: 'absolute',
  top: 6,
  left: 6,
  minWidth: 20,
  height: 20,
  padding: '0 5px',
  borderRadius: RADIUS.sm,
  background: COLORS.primary,
  color: COLORS.background,
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.xs,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};

function plusStyle(disabled: boolean): CSSProperties {
  return {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: 'none',
    background: disabled ? COLORS.surfaceAlt : COLORS.primary,
    color: disabled ? COLORS.textDim : COLORS.background,
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  };
}

/**
 * A card in the builder's pool: the base {@link CardTile} plus deck-aware chrome
 * — an in-deck quantity pip, and a + button that adds a copy (details still open
 * on tile-body click). Off-ink / at-max cards dim + disable via
 * {@link getPoolTileState}. The + is a sibling of CardTile's own <button>, never
 * a child (button-in-button is invalid), positioned over the tile.
 */
export function PoolCardTile({
  card,
  deckInks,
  inDeckCount,
  onAdd,
  onViewDetails,
  priority,
}: PoolCardTileProps) {
  const {offInk, addDisabled, reason} = getPoolTileState(card, deckInks, inDeckCount);
  const name = card.fullName || card.name || 'card';

  return (
    <div style={{position: 'relative', opacity: offInk ? 0.4 : 1, transition: 'opacity 0.15s ease'}}>
      <CardTile
        card={card}
        isSelected={inDeckCount > 0}
        onSelect={onViewDetails}
        variant="minimal"
        priority={priority}
        useSmallImage
      />
      {inDeckCount > 0 && (
        <span aria-hidden="true" style={PIP_STYLE}>
          {inDeckCount}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd(card);
        }}
        disabled={addDisabled}
        aria-label={addDisabled ? (reason ?? `Cannot add ${name}`) : `Add ${name} to deck`}
        title={addDisabled ? reason : undefined}
        style={plusStyle(addDisabled)}>
        +
      </button>
    </div>
  );
}
