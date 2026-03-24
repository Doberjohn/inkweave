import {useState} from 'react';
import Skeleton from 'react-loading-skeleton';
import type {Ink} from '../../features/cards';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS} from '../constants';

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
 * - Shows skeleton shimmer while image loads
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const colors = INK_COLORS[inkColor];

  // Determine font size based on image size
  const fontSize = height >= 80 ? FONT_SIZES.xxl : FONT_SIZES.lg;

  if (src && !imgError) {
    return (
      <div
        style={{
          position: 'relative',
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius}px`,
          overflow: 'hidden',
          flexShrink: 0,
          ...styleProp,
        }}>
        {!imgLoaded && (
          <Skeleton
            width="100%"
            height="100%"
            borderRadius={0}
            baseColor={COLORS.surfaceAlt}
            highlightColor={COLORS.surfaceHover}
            style={{position: 'absolute', inset: 0, display: 'block'}}
          />
        )}
        <img
          src={src}
          alt={alt}
          loading={lazy ? 'lazy' : undefined}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        />
      </div>
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
