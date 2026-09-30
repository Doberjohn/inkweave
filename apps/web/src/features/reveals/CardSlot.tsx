import {useState, type CSSProperties, type ReactNode} from 'react';
import type {CardPrinting, Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {InkIcon} from '../../shared/components/InkIcon';
import {COLORS, EASING, RADIUS, blackRgba, hexRgba, whiteRgba} from '../../shared/constants';
import {smallImageUrl} from '../cards/loader';
import {inkRgba} from './inkTint';
import {isNarrowSlot} from './mosaicSizing';
import './reveals.css';

interface CardSlotProps {
  ink: Ink;
  /** The revealed card. Omit for an unrevealed (placeholder) slot. */
  card?: LorcanaCard;
  /** An Epic/Enchanted/Iconic printing of `card`: the slot shows its art and names it. */
  printing?: Pick<CardPrinting, 'id' | 'imageUrl' | 'imageHashSm' | 'rarity'>;
  /** Slot width in px: 58 on desktop; phones auto-fit it (see slotSize in mosaicSizing). */
  width?: number;
  /** Slot height in px: 80 on desktop; phones keep the card proportion. */
  height?: number;
  /** Called when a revealed slot is activated (opens the card modal). */
  onOpen?: (card: LorcanaCard) => void;
  /** When true, the slot plays the cellPop animation (a switch-in burst). */
  animate?: boolean;
  /** When true, the slot fades (a rarity highlight is active and this card is not it). */
  dimmed?: boolean;
  /** The unrevealed slot's symbol. Defaults to the ink's. */
  emblem?: ReactNode;
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
    borderRadius: RADIUS.md,
    position: 'relative',
    overflow: 'hidden',
    flex: '0 0 auto',
    border: `1.5px solid ${inkRgba(ink, revealed ? 0.85 : 0.3)}`,
    boxShadow: revealed
      ? `0 2px 7px ${blackRgba(0.45)}, 0 0 9px ${inkRgba(ink, 0.4)}`
      : `inset 0 2px 8px ${blackRgba(0.55)}`,
  };
}

/**
 * Opacity for a slot when a rarity highlight is active: any dimmed slot fades to
 * 0.22. Both non-matching revealed cards and empty placeholder slots can dim (see
 * isSlotDimmed), so the transition is always present and the fade animates smoothly
 * in either direction. Pulled out so its `dimmed` branch doesn't add to CardSlot.
 */
function slotDimStyle(dimmed: boolean): CSSProperties {
  return {opacity: dimmed ? 0.22 : 1, transition: `opacity 0.25s ${EASING.smooth}`};
}

/** The slot's accessible name: the card, plus the rarity for a special printing. */
function slotLabel(card: LorcanaCard, printing: CardSlotProps['printing']): string {
  return printing ? `View ${card.fullName}, ${printing.rarity} printing` : `View ${card.fullName}`;
}

interface SlotFaceProps {
  ink: Ink;
  revealed: boolean;
  imgUrl?: string;
  compact: boolean;
  emblem?: ReactNode;
  onImgError: () => void;
}

/** The tile contents: ink-art base, the real image (or placeholder symbol), and a top sheen. */
function SlotFace({ink, revealed, imgUrl, compact, emblem, onImgError}: SlotFaceProps) {
  const art = revealed
    ? `radial-gradient(120% 80% at 50% 18%, ${inkRgba(ink, 0.62)}, ${inkRgba(ink, 0.14)} 70%, ${hexRgba(COLORS.background, 0.9)})`
    : `radial-gradient(120% 80% at 50% 18%, ${inkRgba(ink, 0.26)}, ${inkRgba(ink, 0.06)} 70%, ${hexRgba(COLORS.background, 0.95)})`;
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
          {emblem ?? <InkIcon ink={ink} size={compact ? 27 : 34} />}
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
          background: `linear-gradient(180deg, ${whiteRgba(0.16)}, transparent)`,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

/**
 * One slot in an ink board. Every slot is an ink-art tile (radial gradient + ink
 * border + glow + top sheen). A revealed slot fills the tile with the real card
 * image, or with a special printing's art when given one, and opens the card
 * modal on click; an unrevealed slot shows the ink symbol, or `emblem`. No cost
 * or rarity pips: the slot stays clean.
 */
export function CardSlot({ink, card, printing, width = 58, height = 80, onOpen, animate = false, dimmed = false, emblem}: CardSlotProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const compact = isNarrowSlot(width);
  const revealed = !!card;
  const imgUrl = card && !imgFailed ? smallImageUrl(printing ?? card) : undefined;
  const popClass = animate ? 'reveal-cellpop' : undefined;
  const tileStyle = slotTileStyle(ink, revealed, width, height);
  const dimStyle = slotDimStyle(dimmed);
  const face = (
    <SlotFace ink={ink} revealed={revealed} imgUrl={imgUrl} compact={compact} emblem={emblem} onImgError={() => setImgFailed(true)} />
  );

  if (card && onOpen) {
    return (
      <button
        type="button"
        data-testid={printing ? 'reveal-printing-slot' : 'reveal-card-slot'}
        data-dimmed={dimmed || undefined}
        className={popClass}
        onClick={() => onOpen(card)}
        aria-label={slotLabel(card, printing)}
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
