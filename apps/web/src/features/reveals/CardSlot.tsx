import {useState} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {InkIcon} from '../../shared/components/InkIcon';
import {smallImageUrl} from '../cards/loader';
import {inkRgba} from './inkTint';

interface CardSlotProps {
  ink: Ink;
  /** The revealed card. Omit for an unrevealed (placeholder) slot. */
  card?: LorcanaCard;
  /** Slot width in px — 58 on desktop, 46 on mobile. */
  width?: number;
  /** Slot height in px — 80 on desktop, 64 on mobile. */
  height?: number;
  /** Called when a revealed slot is activated (opens the card modal). */
  onOpen?: (card: LorcanaCard) => void;
}

/**
 * One slot in the diamond mosaic. Every slot is an ink-art tile (radial gradient
 * + ink border + glow + top sheen). A revealed slot fills the tile with the real
 * card image and opens the card modal on click; an unrevealed slot shows the ink
 * symbol. No cost or rarity pips — the slot stays clean (matches the offline
 * design tile minus the pips).
 */
export function CardSlot({ink, card, width = 58, height = 80, onOpen}: CardSlotProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const compact = width < 54;
  const revealed = !!card;
  const imgUrl = card && !imgFailed ? smallImageUrl(card) : undefined;

  // Revealed tiles are bright with an ink glow so they stand out; unrevealed
  // tiles are dimmer (subtler border, recessed shadow, darker art) so the board
  // visibly lights up as cards drop.
  const tileStyle = {
    width,
    height,
    borderRadius: 6,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    flex: '0 0 auto',
    border: `1.5px solid ${inkRgba(ink, revealed ? 0.85 : 0.3)}`,
    boxShadow: revealed
      ? `0 2px 7px rgba(0, 0, 0, 0.45), 0 0 9px ${inkRgba(ink, 0.4)}`
      : 'inset 0 2px 8px rgba(0, 0, 0, 0.55)',
  };

  const art = revealed
    ? `radial-gradient(120% 80% at 50% 18%, ${inkRgba(ink, 0.62)}, ${inkRgba(ink, 0.14)} 70%, rgba(8, 8, 14, 0.9))`
    : `radial-gradient(120% 80% at 50% 18%, ${inkRgba(ink, 0.26)}, ${inkRgba(ink, 0.06)} 70%, rgba(8, 8, 14, 0.95))`;

  const inner = (
    <>
      {/* Ink-art base (also the graceful fallback behind a revealed image). */}
      <span style={{position: 'absolute', inset: 0, background: art}} />
      {imgUrl ? (
        <img
          src={imgUrl}
          alt=""
          onError={() => setImgFailed(true)}
          style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}
        />
      ) : (
        <span
          style={{
            position: 'absolute',
            top: '44%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.5,
            filter: `drop-shadow(0 1px 4px ${inkRgba(ink, 0.8)})`,
          }}
        >
          <InkIcon ink={ink} size={compact ? 27 : 34} />
        </span>
      )}
      {/* Top sheen. */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '46%',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent)',
          pointerEvents: 'none',
        }}
      />
    </>
  );

  if (card && onOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(card)}
        aria-label={`View ${card.fullName}`}
        style={{...tileStyle, padding: 0, font: 'inherit', cursor: 'pointer', background: 'none'}}
      >
        {inner}
      </button>
    );
  }

  return <div style={tileStyle}>{inner}</div>;
}
