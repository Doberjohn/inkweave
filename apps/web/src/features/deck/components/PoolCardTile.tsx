import {useState, type CSSProperties} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../../cards/components/CardTile';
import {getPoolTileState} from './poolTileState';
import {COLORS, FONTS, FONT_SIZES} from '../../../shared/constants';

const GOLD = COLORS.primary; //  add + morph
const RED = COLORS.error; //     decrement
const GREEN = COLORS.success; //  increment
const GLOW = `0 0 10px ${GOLD}99, 0 4px 12px rgba(0,0,0,0.55)`;

interface PoolCardTileProps {
  card: LorcanaCard;
  /** The deck's current inks — drives the off-ink dim/disable. */
  deckInks: Ink[];
  /** How many copies of this card are already in the deck. */
  inDeckCount: number;
  onIncrement: (card: LorcanaCard) => void;
  onDecrement: (card: LorcanaCard) => void;
  onViewDetails: (card: LorcanaCard) => void;
  priority?: boolean;
}

const centerBase: CSSProperties = {
  minWidth: 40,
  padding: '0 8px',
  border: 'none',
  background: 'transparent',
  fontFamily: FONTS.body,
  fontWeight: 800,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// The − / + side buttons collapse to width 0 at rest; the width transition grows
// the count pill into a stepper when the tile is hovered or focused.
function sideBtn(shown: boolean, disabled: boolean, color: string): CSSProperties {
  return {
    width: shown ? 34 : 0,
    opacity: shown ? 1 : 0,
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: disabled ? COLORS.textDim : color,
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1,
    cursor: disabled ? 'default' : 'pointer',
    overflow: 'hidden',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'width 0.2s ease, opacity 0.18s ease, color 0.15s ease',
  };
}

/**
 * A card in the builder's pool: the base {@link CardTile} (details on body-click)
 * plus an overhanging hybrid control — a gold "+" to add that morphs into a
 * persistent count pill, which grows a red "−" / green "+" stepper on hover or
 * keyboard focus. The Core hard rules are enforced HERE (the state layer stays
 * permissive) via {@link getPoolTileState}: off-ink / at-4 cards dim + disable
 * the add.
 */
export function PoolCardTile({
  card,
  deckInks,
  inDeckCount,
  onIncrement,
  onDecrement,
  onViewDetails,
  priority,
}: PoolCardTileProps) {
  // Hover and focus are tracked separately: after an add, the focused +
  // button unmounts and fires a phantom blur (relatedTarget === null); keeping
  // `hovered` independent stops that from collapsing the just-revealed stepper.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // The quantity pop is driven by the ± handlers (not a key remount), so it
  // fires on a real change and stays silent when a tile scrolls back into view.
  const [popping, setPopping] = useState(false);

  const {offInk, addDisabled, reason} = getPoolTileState(card, deckInks, inDeckCount);
  const name = card.fullName || card.name || 'card';
  const isEmpty = inDeckCount === 0;
  const showSides = !isEmpty && (hovered || focused);

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
      style={{position: 'relative', paddingBottom: 18, opacity: offInk ? 0.4 : 1, transition: 'opacity 0.15s ease'}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Keep the stepper open while focus stays within the tile.
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}>
      <CardTile
        card={card}
        isSelected={inDeckCount > 0}
        onSelect={onViewDetails}
        variant="minimal"
        priority={priority}
        useSmallImage
      />
      <div style={{position: 'absolute', left: '50%', bottom: 2, transform: 'translateX(-50%)', display: 'inline-flex', borderRadius: 16, boxShadow: GLOW}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            height: 32,
            borderRadius: 16,
            border: `1px solid ${isEmpty ? GOLD : `${GOLD}80`}`,
            background: isEmpty ? GOLD : 'rgba(13, 13, 20, 0.94)',
            overflow: 'hidden',
            transition: 'background 0.22s ease, border-color 0.22s ease',
          }}>
          {!isEmpty && (
            <button type="button" style={sideBtn(showSides, false, RED)} onClick={remove} aria-label={`Remove one copy of ${name}`}>
              −
            </button>
          )}
          {isEmpty ? (
            <button
              type="button"
              onClick={add}
              disabled={addDisabled}
              title={addDisabled ? reason : undefined}
              aria-label={addDisabled ? (reason ?? `Cannot add ${name}`) : `Add ${name} to deck`}
              style={{...centerBase, color: COLORS.background, fontSize: 22, cursor: addDisabled ? 'default' : 'pointer', opacity: addDisabled ? 0.55 : 1}}>
              +
            </button>
          ) : (
            <span
              onAnimationEnd={() => setPopping(false)}
              style={{...centerBase, color: COLORS.text, fontSize: FONT_SIZES.base, animation: popping ? 'inkweave-qty-pop 0.22s ease-out' : undefined}}>
              {inDeckCount}
            </span>
          )}
          {!isEmpty && (
            <button
              type="button"
              style={sideBtn(showSides, addDisabled, GREEN)}
              onClick={add}
              disabled={addDisabled}
              title={addDisabled ? reason : undefined}
              aria-label={addDisabled ? (reason ?? `Cannot add more ${name}`) : `Add one copy of ${name}`}>
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
