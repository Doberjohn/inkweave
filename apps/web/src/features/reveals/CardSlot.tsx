import {useState, type CSSProperties} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {InkIcon} from '../../shared/components/InkIcon';
import {smallImageUrl} from '../cards/loader';
import {inkRgba} from './inkTint';
import './reveals.css';

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
  /** When true, the slot plays the cellPop animation (a switch-in burst). */
  animate?: boolean;
  /** When true, the slot fades (a rarity highlight is active and this card is not it). */
  dimmed?: boolean;
}

/**
 * Revealed tiles are bright with an ink glow so they stand out; unrevealed tiles
 * are dimmer (subtler border, recessed shadow) so the board visibly lights up as
 * cards drop. Pulled out so the `revealed` branches don't add to CardSlot.
 */
function slotTileStyle(ink: Ink, revealed: boolean, width: number, height: number): CSSProperties {
  return {
    width,
    height,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
    flex: '0 0 auto',
    border: `1.5px solid ${inkRgba(ink, revealed ? 0.85 : 0.3)}`,
    boxShadow: revealed
      ? `0 2px 7px rgba(0, 0, 0, 0.45), 0 0 9px ${inkRgba(ink, 0.4)}`
      : 'inset 0 2px 8px rgba(0, 0, 0, 0.55)',
  };
}

/**
 * Opacity for a slot when a rarity highlight is active: dimmed slots fade. Only
 * revealed slots ever change opacity (unrevealed slots are never dimmed), so the
 * transition lives only on them rather than on every placeholder div. Pulled out so
 * its `dimmed`/`revealed` branches don't add to CardSlot.
 */
function slotDimStyle(dimmed: boolean, revealed: boolean): CSSProperties {
  return {opacity: dimmed ? 0.22 : 1, transition: revealed ? 'opacity 0.25s ease' : undefined};
}

/** The tile contents: ink-art base, the real image (or ink-symbol fallback), and a top sheen. */
function SlotFace({ink, revealed, imgUrl, compact, onImgError}: {ink: Ink; revealed: boolean; imgUrl?: string; compact: boolean; onImgError: () => void}) {
  const art = revealed
    ? `radial-gradient(120% 80% at 50% 18%, ${inkRgba(ink, 0.62)}, ${inkRgba(ink, 0.14)} 70%, rgba(8, 8, 14, 0.9))`
    : `radial-gradient(120% 80% at 50% 18%, ${inkRgba(ink, 0.26)}, ${inkRgba(ink, 0.06)} 70%, rgba(8, 8, 14, 0.95))`;
  return (
    <>
      {/* Ink-art base (also the graceful fallback behind a revealed image). */}
      <span style={{position: 'absolute', inset: 0, background: art}} />
      {imgUrl ? (
        <img
          src={imgUrl}
          alt=""
          onError={onImgError}
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
}

/**
 * One slot in the diamond mosaic. Every slot is an ink-art tile (radial gradient
 * + ink border + glow + top sheen). A revealed slot fills the tile with the real
 * card image and opens the card modal on click; an unrevealed slot shows the ink
 * symbol. No cost or rarity pips — the slot stays clean.
 */
export function CardSlot({ink, card, width = 58, height = 80, onOpen, animate = false, dimmed = false}: CardSlotProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const compact = width < 54;
  const revealed = !!card;
  const imgUrl = card && !imgFailed ? smallImageUrl(card) : undefined;
  const popClass = animate ? 'reveal-cellpop' : undefined;
  const tileStyle = slotTileStyle(ink, revealed, width, height);
  const dimStyle = slotDimStyle(dimmed, revealed);
  const face = (
    <SlotFace ink={ink} revealed={revealed} imgUrl={imgUrl} compact={compact} onImgError={() => setImgFailed(true)} />
  );

  if (card && onOpen) {
    return (
      <button
        type="button"
        data-testid="reveal-card-slot"
        data-dimmed={dimmed || undefined}
        className={popClass}
        onClick={() => onOpen(card)}
        aria-label={`View ${card.fullName}`}
        style={{...tileStyle, ...dimStyle, padding: 0, font: 'inherit', cursor: 'pointer', background: 'none'}}
      >
        {face}
      </button>
    );
  }

  return (
    <div className={popClass} data-dimmed={dimmed || undefined} style={{...tileStyle, ...dimStyle}}>
      {face}
    </div>
  );
}
