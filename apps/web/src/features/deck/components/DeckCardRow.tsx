import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, EASING, FONTS, FONT_SIZES, GOLD_GLOW, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';
import {IconButton} from '../../../shared/components';
import {smallImageUrl} from '../../cards/loader';
import {CostGlyph} from './CostGlyph';
import {QuantityStepper} from './QuantityStepper';

/** Core copy limit — the + is disabled once a line reaches it. */
const MAX_COPIES = 4;

interface DeckCardRowProps {
  card: LorcanaCard;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  /** Whether this line is flagged a deck-core anchor (weights suggestions ×2). */
  isCore?: boolean;
  /** Toggles the core flag; the star affordance is hidden until hover unless already core. */
  onSetCore?: () => void;
  /** Fired when the thumbnail/name is hovered; the panel shows a floating preview anchored to `anchor`. */
  onPreviewEnter?: (card: LorcanaCard, anchor: DOMRect) => void;
  /** Fired when the pointer leaves the thumbnail/name; the panel hides the preview. */
  onPreviewLeave?: () => void;
  /** Fired when the thumbnail/name is clicked; opens the card's synergy detail modal. */
  onOpenDetails?: (card: LorcanaCard) => void;
}

function TrashIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1zM6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Filled when the card is a core anchor, outline otherwise. */
function StarIcon({filled}: {filled: boolean}) {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** The row's display name: fullName, then name, then a stable placeholder. */
function resolveCardName(card: LorcanaCard): string {
  return card.fullName || card.name || 'Unknown card';
}

/** True for the keys that activate the card-identity button: Enter or Space. */
function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

/** Thumbnail + name: hovering floats the preview, clicking opens the detail modal. */
function CardIdentity({
  card,
  name,
  onOpenDetails,
  onPreviewEnter,
  onPreviewLeave,
}: {
  card: LorcanaCard;
  name: string;
  onOpenDetails?: (card: LorcanaCard) => void;
  onPreviewEnter?: (card: LorcanaCard, anchor: DOMRect) => void;
  onPreviewLeave?: () => void;
}) {
  const ink = INK_COLORS[card.ink];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${name} synergies`}
      onClick={() => onOpenDetails?.(card)}
      onKeyDown={(e) => {
        if (isActivationKey(e.key)) {
          e.preventDefault();
          onOpenDetails?.(card);
        }
      }}
      onMouseEnter={(e) => onPreviewEnter?.(card, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onPreviewLeave}
      style={{display: 'flex', alignItems: 'center', gap: SPACING.md, flex: 1, minWidth: 0, cursor: 'pointer'}}>
      <div style={{width: 46, height: 34, borderRadius: RADIUS.sm, overflow: 'hidden', flexShrink: 0, border: `1px solid ${ink.border}`}}>
        <img src={smallImageUrl(card)} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%'}} />
      </div>
      <span style={{flex: 1, minWidth: 0, color: COLORS.text, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.lg}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
        {name}
      </span>
    </div>
  );
}

/** Core-anchor toggle: hidden until row hover unless the card is already core. */
function CoreStar({isCore, name, hovered, onToggle}: {isCore: boolean; name: string; hovered: boolean; onToggle: () => void}) {
  const visible = hovered || isCore;
  return (
    <IconButton
      onClick={onToggle}
      aria-label={isCore ? `Unmark ${name} as a core card` : `Mark ${name} as a core card`}
      aria-pressed={isCore}
      title={isCore ? 'Core card' : 'Mark as core'}
      size={26}
      tabIndex={visible ? 0 : -1}
      style={{
        flexShrink: 0,
        color: isCore ? COLORS.primary : COLORS.textDim,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        boxShadow: isCore ? GOLD_GLOW.shadow : 'none',
        transition: `opacity 0.15s ${EASING.snappy}, color 0.15s ${EASING.snappy}, box-shadow 0.15s ${EASING.snappy}`,
      }}>
      <StarIcon filled={isCore} />
    </IconButton>
  );
}

/**
 * One line in the deck panel: cost-in-inkwell glyph, thumbnail + name (the hover
 * preview target), an always-open [− qty +] stepper, a core-anchor star, and a
 * trash remove. The + disables at MAX_COPIES; the row glows in the card's ink on hover.
 */
export function DeckCardRow({card, quantity, onIncrement, onDecrement, onRemove, isCore = false, onSetCore, onPreviewEnter, onPreviewLeave, onOpenDetails}: DeckCardRowProps) {
  const [hovered, setHovered] = useState(false);
  const ink = INK_COLORS[card.ink];
  const name = resolveCardName(card);
  const atMax = quantity >= MAX_COPIES;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        borderRadius: RADIUS.md,
        // Hover glow uses the card's own ink colour (INK_COLORS[ink].border) with
        // hex-alpha suffixes, matching the filter-button convention.
        background: hovered ? `${ink.border}14` : 'transparent',
        boxShadow: hovered ? `0 0 14px ${ink.border}40, inset 0 0 0 1px ${ink.border}66` : 'inset 0 0 0 1px transparent',
        transition: `background 0.15s ${EASING.snappy}, box-shadow 0.15s ${EASING.snappy}`,
        animation: `inkweave-row-enter 0.28s ${EASING.smooth}`,
      }}>
      <CostGlyph cost={card.cost} inkwell={card.inkwell} size={28} />
      {/* Card identity is scoped to the thumbnail + name so the stepper, star, and
          trash (siblings below) neither preview nor open the detail modal. */}
      <CardIdentity
        card={card}
        name={name}
        onOpenDetails={onOpenDetails}
        onPreviewEnter={onPreviewEnter}
        onPreviewLeave={onPreviewLeave}
      />
      <QuantityStepper
        value={quantity}
        size="sm"
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        incrementDisabled={atMax}
        disabledReason={`Maximum ${MAX_COPIES} copies of ${name}`}
        label={name}
      />
      {onSetCore && <CoreStar isCore={isCore} name={name} hovered={hovered} onToggle={onSetCore} />}
      <IconButton
        onClick={onRemove}
        aria-label={`Remove ${name} from deck`}
        size={26}
        style={{flexShrink: 0, color: hovered ? COLORS.textMuted : COLORS.textDim}}>
        <TrashIcon />
      </IconButton>
    </div>
  );
}
