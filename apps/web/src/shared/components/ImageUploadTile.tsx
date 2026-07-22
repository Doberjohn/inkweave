import {COLORS, EMPTY_BOX, FONT_SIZES, RADIUS} from '../constants';

interface ImageUploadTileProps {
  /** Preview URL for the chosen image (data URL), or null when none chosen. */
  imageUrl: string | null;
  onImageChange: (file: File | null) => void;
  /** File-input accept list. */
  accept?: string;
  width?: number;
  height?: number;
}

const ACCEPT_DEFAULT = 'image/jpeg,image/png,image/webp';

// Visually hidden but still focusable (so keyboard users can tab to it and open
// the picker with Space/Enter). display:none would drop it from the tab order and
// some browsers refuse to trigger a display:none file input via label click.
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

/**
 * A clickable image drop-tile: the whole box is a <label> wrapping a hidden file
 * input, so clicking (or keyboard-activating) it opens the native picker. Shows
 * the chosen image as a thumbnail, or a "click to choose" prompt when empty.
 */
export function ImageUploadTile({
  imageUrl,
  onImageChange,
  accept = ACCEPT_DEFAULT,
  width = 160,
  height = 223,
}: ImageUploadTileProps) {
  return (
    <label
      style={{
        ...EMPTY_BOX,
        position: 'relative',
        width,
        height,
        borderRadius: RADIUS.sm,
        background: COLORS.surfaceAlt,
        fontSize: FONT_SIZES.xs,
        cursor: 'pointer',
        overflow: 'hidden',
      }}>
      <input
        type="file"
        accept={accept}
        aria-label="Choose image"
        onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
        style={srOnlyInput}
      />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Selected upload preview"
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
      ) : (
        <span style={{padding: 8}}>Click to choose image</span>
      )}
    </label>
  );
}
