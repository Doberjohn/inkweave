import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../../cards/components/CardTile';
import {COLORS, EMPTY_BOX, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';

const ACCEPT = 'image/jpeg,image/png,image/webp';

// Visually hidden but focusable, so the overlay stays keyboard-activatable
// (display:none would drop it from the tab order and block label-click on some
// browsers).
const srOnlyInput = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

interface CardPreviewPanelProps {
  /** The transformed card, or null when required fields are missing. */
  card: LorcanaCard | null;
  /**
   * Choosing a file uploads the card art. The preview doubles as the upload
   * control: the whole image area is a click target for choosing/replacing art.
   */
  onImageChange: (file: File | null) => void;
}

export function CardPreviewPanel({card, onImageChange}: CardPreviewPanelProps) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm, maxWidth: 240}}>
      <div style={{position: 'relative'}}>
        {card ? (
          <CardTile card={card} isSelected={false} />
        ) : (
          <div
            style={{
              ...EMPTY_BOX,
              aspectRatio: '0.72',
              padding: SPACING.md,
              borderRadius: RADIUS.xl,
              background: COLORS.surfaceAlt,
              fontSize: FONT_SIZES.sm,
            }}>
            Click to upload card art
          </div>
        )}
        <label style={{position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: RADIUS.xl}}>
          <input
            type="file"
            accept={ACCEPT}
            aria-label="Upload card art"
            onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
            style={srOnlyInput}
          />
        </label>
      </div>
      {card ? (
        <div style={{color: COLORS.text, fontSize: FONT_SIZES.sm}}>
          <strong>{card.fullName}</strong>
          <div style={{color: COLORS.gray600}}>
            {card.ink}
            {card.ink2 ? `-${card.ink2}` : ''} · {card.type} · cost {card.cost}
          </div>
          <div style={{color: COLORS.gray600, fontSize: FONT_SIZES.xs, marginTop: 4}}>
            Click the image to change it.
          </div>
        </div>
      ) : (
        <div style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm}}>
          Fill in name, ink, and type to preview the card.
        </div>
      )}
    </div>
  );
}
