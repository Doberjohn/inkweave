import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, EASING, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';
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
  /** Fired when the thumbnail/name is hovered; the panel shows a floating preview anchored to `anchor`. */
  onPreviewEnter?: (card: LorcanaCard, anchor: DOMRect) => void;
  /** Fired when the pointer leaves the thumbnail/name; the panel hides the preview. */
  onPreviewLeave?: () => void;
  /** Fired when the thumbnail/name is clicked; opens the card's synergy detail modal. */
  onOpenDetails?: (card: LorcanaCard) => void;
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
      <div style={{width: 46, height: 21, borderRadius: RADIUS.sm, overflow: 'hidden', flexShrink: 0, border: `1px solid ${ink.border}`}}>
        <img src={smallImageUrl(card)} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '58% 4%'}} />
      </div>
      <span style={{flex: 1, minWidth: 0, color: COLORS.text, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.lg}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
        {name}
      </span>
    </div>
  );
}

/**
 * One line in the deck panel: cost-in-inkwell glyph, thumbnail + name (the hover
 * preview target), and an always-open [− qty +] stepper. The + disables at
 * MAX_COPIES; the row glows in the card's ink on hover. Removal is the stepper's −
 * at one copy (setCardQuantity drops the line at 0) — there is no separate delete
 * affordance, and no core-anchor star (removed by owner ruling 2026-07-30; the
 * `isCore` data model survives for a future guided-mode surface).
 */
export function DeckCardRow({card, quantity, onIncrement, onDecrement, onPreviewEnter, onPreviewLeave, onOpenDetails}: DeckCardRowProps) {
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
      {/* Card identity is scoped to the thumbnail + name so the stepper (its sibling
          below) neither previews nor opens the detail modal. */}
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
    </div>
  );
}
