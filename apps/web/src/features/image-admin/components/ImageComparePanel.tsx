import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {ImageUploadTile} from '../../../shared/components/ImageUploadTile';

interface ImageComparePanelProps {
  card: LorcanaCard | null;
  newImageUrl: string | null;
  onImageChange: (file: File | null) => void;
}

const captionStyle = {fontSize: FONT_SIZES.xs, color: COLORS.gray600, marginBottom: 4};

export function ImageComparePanel({card, newImageUrl, onImageChange}: ImageComparePanelProps) {
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
        <ImageUploadTile imageUrl={newImageUrl} onImageChange={onImageChange} />
      </figure>
    </div>
  );
}
