import {useState, type CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../../cards/components/CardTile';
import {QuantityStepper} from './QuantityStepper';
import {getPoolTileState} from './poolTileState';
import {COLORS, FONTS} from '../../../shared/constants';

const GOLD = COLORS.primary;
const GLOW = `0 0 10px ${GOLD}99, 0 4px 12px rgba(0,0,0,0.55)`;

interface PoolCardTileProps {
  card: LorcanaCard;
  /** How many copies of this card are already in the deck. */
  inDeckCount: number;
  onIncrement: (card: LorcanaCard) => void;
  onDecrement: (card: LorcanaCard) => void;
  onViewDetails: (card: LorcanaCard) => void;
  priority?: boolean;
}

const infoBtn: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: `1px solid ${COLORS.surfaceBorder}`,
  background: 'rgba(13, 13, 20, 0.72)',
  color: COLORS.text,
  fontFamily: FONTS.hero,
  fontStyle: 'italic',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
};

/**
 * A card in the builder's pool. Clicking the card body ADDS a copy (up to the
 * 4-copy limit, after which the + goes inert via {@link getPoolTileState}). A
 * small "i" opens the detail modal. Once in the deck, an overhanging count pill
 * shows the quantity and grows a red "−" / green "+" stepper on hover/focus. Ink
 * legality is not blocked here — going over two inks is flagged as a deck error.
 */
export function PoolCardTile({
  card,
  inDeckCount,
  onIncrement,
  onDecrement,
  onViewDetails,
  priority,
}: PoolCardTileProps) {
  // Hover and focus are tracked separately so a phantom blur (from a control
  // unmounting) can't collapse the stepper while the mouse is still over the tile.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // The pop is driven by the ± handlers (not a key remount) so it fires on a real
  // change and stays silent when a tile scrolls back into view in the grid.
  const [popping, setPopping] = useState(false);

  const {addDisabled, reason} = getPoolTileState(inDeckCount);
  const name = card.fullName || card.name || 'card';
  const inDeck = inDeckCount > 0;
  const showSides = inDeck && (hovered || focused);

  const add = () => {
    if (addDisabled) return;
    onIncrement(card);
    setPopping(true);
  };
  const remove = () => {
    onDecrement(card);
    setPopping(true);
  };

  return (
    <div
      style={{position: 'relative', paddingBottom: 18}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}>
      {/* Card body: a click adds a copy. */}
      <CardTile card={card} isSelected={inDeck} onSelect={add} variant="minimal" priority={priority} useSmallImage />

      {/* Details affordance, distinct from the add-on-click body. */}
      <button type="button" onClick={() => onViewDetails(card)} aria-label={`View ${name} details`} style={infoBtn}>
        i
      </button>

      {inDeck && (
        <div style={{position: 'absolute', left: '50%', bottom: 15, transform: 'translateX(-50%)', display: 'inline-flex', borderRadius: 16, boxShadow: GLOW}}>
          <QuantityStepper
            value={inDeckCount}
            collapsed={!showSides}
            onIncrement={add}
            onDecrement={remove}
            incrementDisabled={addDisabled}
            disabledReason={reason}
            label={name}
            popping={popping}
            onPopEnd={() => setPopping(false)}
          />
        </div>
      )}
    </div>
  );
}
