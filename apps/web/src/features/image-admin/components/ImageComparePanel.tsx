import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';

interface ImageComparePanelProps {
  card: LorcanaCard | null;
  newImageUrl: string | null;
}

const captionStyle = {fontSize: FONT_SIZES.xs, color: COLORS.gray600, marginBottom: 4};

export function ImageComparePanel({card, newImageUrl}: ImageComparePanelProps) {
  if (!card) return null;
  return (
    <div style={{display: 'flex', gap: SPACING.lg}}>
      <figure style={{margin: 0}}>
        <figcaption style={captionStyle}>Current</figcaption>
        <img
          src={card.imageUrl}
          alt={`Current art for ${card.fullName}`}
          width={160}
          style={{borderRadius: RADIUS.sm}}
        />
      </figure>
      <figure style={{margin: 0}}>
        <figcaption style={captionStyle}>New</figcaption>
        {newImageUrl ? (
          <img src={newImageUrl} alt="New upload preview" width={160} style={{borderRadius: RADIUS.sm}} />
        ) : (
          <div
            style={{
              width: 160,
              height: 223,
              display: 'grid',
              placeItems: 'center',
              border: `1px dashed ${COLORS.surfaceHover}`,
              borderRadius: RADIUS.sm,
              color: COLORS.gray600,
              fontSize: FONT_SIZES.xs,
            }}>
            No image chosen
          </div>
        )}
      </figure>
    </div>
  );
}
