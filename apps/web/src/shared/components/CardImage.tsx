import {useState} from 'react';
import type {Ink} from '../../features/cards';
import {INK_COLORS, FONT_SIZES, RADIUS} from '../constants';

interface CardImageProps {
  src: string | undefined;
  alt: string;
  width: number;
  height: number;
  inkColor: Ink;
  cost: number;
  lazy?: boolean;
  borderRadius?: number;
  /** Set to true for LCP-candidate images to boost fetch priority. */
  priority?: boolean;
  /** Additional styles merged onto the root element (img or fallback div). */
  style?: React.CSSProperties;
}

/**
 * Shared card image component with lazy loading and error fallback.
 *
 * - Uses native loading="lazy" for deferred loading in scrollable lists
 * - Uses decoding="async" for non-blocking image decode
 * - Shows ink-colored fallback with cost on error or missing src
 */
export function CardImage({
  src,
  alt,
  width,
  height,
  inkColor,
  cost,
  lazy = true,
  borderRadius = RADIUS.sm,
  priority,
  style: styleProp,
}: CardImageProps) {
  const [imgError, setImgError] = useState(false);
  const colors = INK_COLORS[inkColor];

  // Determine font size based on image size
  const fontSize = height >= 80 ? FONT_SIZES.xxl : FONT_SIZES.lg;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={alt}
        loading={lazy ? 'lazy' : undefined}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : undefined}
        onError={() => setImgError(true)}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius}px`,
          objectFit: 'cover',
          flexShrink: 0,
          ...styleProp,
        }}
      />
    );
  }

  // Fallback: ink-colored div with cost
  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${borderRadius}px`,
        background: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...styleProp,
      }}>
      <span
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          color: colors.text,
        }}>
        {cost}
      </span>
    </div>
  );
}
