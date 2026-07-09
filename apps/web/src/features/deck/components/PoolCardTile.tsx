import {useState, type CSSProperties} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../../cards/components/CardTile';
import {getPoolTileState} from './poolTileState';
import {COLORS, FONTS, FONT_SIZES} from '../../../shared/constants';

const GOLD = COLORS.primary;
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

// Centered glyph/number cell. `line-height: 1` + flex-centering keeps the "−",
// "+" and digit optically centered in the pill regardless of their font metrics.
const cell: CSSProperties = {
  minWidth: 40,
  height: '100%',
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
    ...cell,
    minWidth: 0,
    width: shown ? 34 : 0,
    opacity: shown ? 1 : 0,
    padding: 0,
    color: disabled ? COLORS.textDim : color,
    fontSize: 20,
    cursor: disabled ? 'default' : 'pointer',
    overflow: 'hidden',
    transition: 'width 0.2s ease, opacity 0.18s ease, color 0.15s ease',
  };
}

// SVG glyphs (not font characters) so "−"/"+" center exactly in the pill on any
// font — the font-metric baseline was rendering the text glyphs low.
function MinusIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A card in the builder's pool. Clicking the card body ADDS a copy (up to 4;
 * off-ink / at-limit cards are dimmed and inert via {@link getPoolTileState}).
 * A small "i" opens the detail modal. Once in the deck, an overhanging count
 * pill shows the quantity and grows a red "−" / green "+" stepper on hover/focus.
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
  // Hover and focus are tracked separately so a phantom blur (from a control
  // unmounting) can't collapse the stepper while the mouse is still over the tile.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // The pop is driven by the ± handlers (not a key remount) so it fires on a real
  // change and stays silent when a tile scrolls back into view in the grid.
  const [popping, setPopping] = useState(false);

  const {offInk, addDisabled, reason} = getPoolTileState(card, deckInks, inDeckCount);
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
      style={{position: 'relative', paddingBottom: 18, opacity: offInk ? 0.4 : 1, transition: 'opacity 0.15s ease'}}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: 32,
              borderRadius: 16,
              border: `1px solid ${GOLD}80`,
              background: 'rgba(13, 13, 20, 0.94)',
              overflow: 'hidden',
            }}>
            <button type="button" style={sideBtn(showSides, false, RED)} onClick={remove} aria-label={`Remove one copy of ${name}`}>
              <MinusIcon />
            </button>
            <span
              onAnimationEnd={() => setPopping(false)}
              style={{...cell, color: COLORS.text, fontSize: FONT_SIZES.xl, animation: popping ? 'inkweave-qty-pop 0.22s ease-out' : undefined}}>
              {inDeckCount}
            </span>
            <button
              type="button"
              style={sideBtn(showSides, addDisabled, GREEN)}
              onClick={add}
              disabled={addDisabled}
              title={addDisabled ? reason : undefined}
              aria-label={addDisabled ? (reason ?? `Cannot add more ${name}`) : `Add one copy of ${name}`}>
              <PlusIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
