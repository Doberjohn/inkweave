import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../../cards/components/CardTile';
import {COLORS, SPACING, FONT_SIZES} from '../../../shared/constants';

interface CardPreviewPanelProps {
  /** The transformed card, or null when required fields are missing. */
  card: LorcanaCard | null;
}

export function CardPreviewPanel({card}: CardPreviewPanelProps) {
  if (!card) {
    return (
      <div style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm, padding: SPACING.md}}>
        Fill in name, ink, and type to preview the card.
      </div>
    );
  }
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm, maxWidth: 240}}>
      <CardTile card={card} isSelected={false} />
      <div style={{color: COLORS.text, fontSize: FONT_SIZES.sm}}>
        <strong>{card.fullName}</strong>
        <div style={{color: COLORS.gray600}}>
          {card.ink}
          {card.ink2 ? `-${card.ink2}` : ''} · {card.type} · cost {card.cost}
        </div>
      </div>
    </div>
  );
}
