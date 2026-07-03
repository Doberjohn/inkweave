import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {ImageComparePanel} from './ImageComparePanel';

interface UploadColumnProps {
  selectedCard: LorcanaCard | null;
  newImageUrl: string | null;
  imageName: string | null;
  canPublish: boolean;
  publishing: boolean;
  publishError: string | null;
  onImageChange: (file: File | null) => void;
  onPublish: () => void;
}

/** Right-hand column of the image-admin page: upload tile + publish action. */
export function UploadColumn({
  selectedCard,
  newImageUrl,
  imageName,
  canPublish,
  publishing,
  publishError,
  onImageChange,
  onPublish,
}: UploadColumnProps) {
  return (
    <aside style={{flex: '1 1 360px', minWidth: 320}}>
      <h2 style={{fontSize: FONT_SIZES.xl}}>2. Upload the new image</h2>
      {selectedCard ? (
        <>
          <p style={{color: COLORS.gray600, fontSize: FONT_SIZES.xs, margin: `0 0 ${SPACING.sm}px`}}>
            Click the New tile to choose a jpg, png, or webp.
          </p>
          <ImageComparePanel card={selectedCard} newImageUrl={newImageUrl} onImageChange={onImageChange} />
          {imageName && (
            <div style={{color: COLORS.gray600, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm}}>
              {imageName}
            </div>
          )}
        </>
      ) : (
        <p style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm}}>Pick a card to enable upload.</p>
      )}

      {publishError && (
        <div style={{color: COLORS.error, fontSize: FONT_SIZES.sm, marginTop: SPACING.sm}}>
          {publishError}
        </div>
      )}

      <button
        onClick={onPublish}
        disabled={!canPublish || publishing}
        style={{
          marginTop: SPACING.md,
          padding: '12px 20px',
          background: canPublish ? COLORS.primary500 : COLORS.surfaceHover,
          color: COLORS.white,
          border: 'none',
          borderRadius: RADIUS.sm,
          cursor: canPublish ? 'pointer' : 'not-allowed',
          fontWeight: 600,
        }}>
        {publishing ? 'Publishing…' : 'Publish to master'}
      </button>
    </aside>
  );
}
