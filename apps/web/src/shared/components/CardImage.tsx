import {useState} from 'react';
import type {Ink} from '../../features/cards';
import {INK_COLORS, FONT_SIZES, RADIUS} from '../constants';
import {useArtLoad, type ArtProps} from '../hooks/useArtLoad';
import {InkCardPlaceholder} from './InkCardPlaceholder';

interface CardImageProps {
  src: string | undefined;
  alt: string;
  width: number;
  height: number;
  inkColor: Ink;
  /** A dual-ink card's second ink, which its loading placeholder shows beside the first. */
  inkColor2?: Ink;
  cost: number;
  lazy?: boolean;
  borderRadius?: number;
  /** Set to true for LCP-candidate images to boost fetch priority. */
  priority?: boolean;
  /** Additional styles merged onto the root element (img or fallback div). */
  style?: React.CSSProperties;
}

function CostFallback({inkColor, cost, height}: {inkColor: Ink; cost: number; height: number}) {
  const colors = INK_COLORS[inkColor];
  const fontSize = height >= 80 ? FONT_SIZES.xxl : FONT_SIZES.lg;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        background: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <span style={{fontSize: `${fontSize}px`, fontWeight: 600, color: colors.text}}>{cost}</span>
    </div>
  );
}

interface CardImgProps {
  src: string | undefined;
  alt: string;
  lazy: boolean;
  priority: boolean | undefined;
  visible: boolean;
  /** The fade in, or none for art the browser already had. */
  transition: string | undefined;
  artProps: ArtProps;
  onError: () => void;
}

function CardImg({src, alt, lazy, priority, visible, transition, artProps, onError}: CardImgProps) {
  return (
    <img
      {...(src ? {src} : {})}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      decoding={priority ? 'sync' : 'async'}
      // fetchpriority is a real browser hint for LCP candidates — boosts the
      // image into the high-priority fetch queue ahead of other resources.
      // React 19 lowercases the attribute; the DOM property name is fetchPriority.
      fetchPriority={priority ? 'high' : undefined}
      {...artProps}
      onError={onError}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        opacity: visible ? 1 : 0,
        transition,
      }}
    />
  );
}

/**
 * Shared card image component with lazy loading and error fallback.
 *
 * Always renders an <img alt={alt}> element so DOM-level selectors and
 * accessibility tooling have a stable handle even when the image can't
 * load. The ink-colored fallback (with cost number) is shown as an overlay
 * when src is missing or the fetch errors.
 */
export function CardImage({
  src,
  alt,
  width,
  height,
  inkColor,
  inkColor2,
  cost,
  lazy = true,
  borderRadius = RADIUS.sm,
  priority,
  style: styleProp,
}: CardImageProps) {
  const [imgError, setImgError] = useState(false);
  const {loaded: imgLoaded, transition, artProps} = useArtLoad(src);
  const showImg = Boolean(src) && !imgError;

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
      {showImg && !imgLoaded && <InkCardPlaceholder ink={inkColor} ink2={inkColor2} />}
      <CardImg
        src={src}
        alt={alt}
        lazy={lazy}
        priority={priority}
        visible={showImg && imgLoaded}
        transition={transition}
        artProps={artProps}
        onError={() => setImgError(true)}
      />
      {!showImg && <CostFallback inkColor={inkColor} cost={cost} height={height} />}
    </div>
  );
}
