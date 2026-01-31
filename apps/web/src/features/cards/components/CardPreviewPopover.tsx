import {useMemo, useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {useCardPreview} from './useCardPreview';
import {useResponsive} from '../../../shared/hooks';
import {INK_COLORS, RADIUS, Z_INDEX, COLORS} from '../../../shared/constants';
import type {LorcanaCard} from '../types';

const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 390;
const OFFSET_X = 20;
const OFFSET_Y = 10;

// Mobile preview dimensions (slightly smaller)
const MOBILE_PREVIEW_WIDTH = 260;
const MOBILE_PREVIEW_HEIGHT = 364;

// Extracted component for location card rotation (DRY)
function LocationCardImage({
  imageUrl,
  alt,
  width,
  height,
  onError,
}: {
  imageUrl: string;
  alt: string;
  width: number;
  height: number;
  onError: () => void;
}) {
  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: 'rotate(90deg)',
        transformOrigin: 'top left',
        position: 'absolute',
        top: 0,
        // Position is height because of rotation
        left: `${height}px`,
      }}>
      <img
        src={imageUrl}
        alt={alt}
        decoding="async"
        onError={onError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}

// Card image or fallback placeholder with error handling
function PreviewCardImage({
  card,
  isLocation,
  previewWidth,
  previewHeight,
}: {
  card: LorcanaCard;
  isLocation: boolean;
  previewWidth: number;
  previewHeight: number;
}) {
  const [imgError, setImgError] = useState(false);
  const colors = INK_COLORS[card.ink];

  const handleError = () => setImgError(true);

  if (card.imageUrl && !imgError) {
    if (isLocation) {
      return (
        <LocationCardImage
          imageUrl={card.imageUrl}
          alt={card.fullName}
          width={previewWidth}
          height={previewHeight}
          onError={handleError}
        />
      );
    }
    return (
      <img
        src={card.imageUrl}
        alt={card.fullName}
        decoding="async"
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  }

  // Fallback placeholder
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.border}40 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <span style={{fontSize: '48px', fontWeight: 700, color: colors.text}}>{card.cost}</span>
    </div>
  );
}

export function CardPreviewPopover() {
  const {previewState, hidePreview} = useCardPreview();
  const {card, position, isTouchMode} = previewState;
  const {windowWidth} = useResponsive();

  // Memoize viewport height to avoid reading on every render
  // We use windowWidth from the hook, and compute height similarly
  const viewportDimensions = useMemo(() => {
    if (typeof window === 'undefined') {
      return {width: 1024, height: 768};
    }
    return {width: windowWidth, height: window.innerHeight};
  }, [windowWidth]);

  const isLocation = card?.type === 'Location';

  // Use smaller dimensions on mobile touch mode
  const previewWidth = isTouchMode ? MOBILE_PREVIEW_WIDTH : PREVIEW_WIDTH;
  const previewHeight = isTouchMode ? MOBILE_PREVIEW_HEIGHT : PREVIEW_HEIGHT;

  // Locations are displayed rotated (landscape)
  const containerWidth = isLocation ? previewHeight : previewWidth;
  const containerHeight = isLocation ? previewWidth : previewHeight;

  // On touch mode, show centered modal with backdrop
  if (isTouchMode) {
    return (
      <AnimatePresence>
        {card && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.2}}
              onClick={hidePreview}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: Z_INDEX.popoverBackdrop,
              }}
            />
            {/* Centered card */}
            <motion.div
              initial={{opacity: 0, scale: 0.8}}
              animate={{opacity: 1, scale: 1}}
              exit={{opacity: 0, scale: 0.8}}
              transition={{type: 'spring', stiffness: 400, damping: 25}}
              onClick={hidePreview}
              style={{
                position: 'fixed',
                left: '50%',
                top: '50%',
                x: '-50%',
                y: '-50%',
                width: `${containerWidth}px`,
                height: `${containerHeight}px`,
                borderRadius: `${RADIUS.xl}px`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                zIndex: Z_INDEX.popover,
                overflow: 'hidden',
              }}>
              <PreviewCardImage
                card={card}
                isLocation={isLocation}
                previewWidth={previewWidth}
                previewHeight={previewHeight}
              />
            </motion.div>
            {/* Tap to dismiss hint - accessible */}
            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0}}
              transition={{delay: 0.1}}
              role="status"
              aria-live="polite"
              style={{
                position: 'fixed',
                bottom: '20%',
                left: '50%',
                x: '-50%',
                background: COLORS.gray800,
                color: COLORS.white,
                padding: '8px 16px',
                borderRadius: `${RADIUS.lg}px`,
                fontSize: '14px',
                zIndex: Z_INDEX.popover,
                pointerEvents: 'none',
              }}>
              Tap anywhere to dismiss
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop hover mode - position relative to cursor
  // Use cached viewport dimensions instead of reading window on every render
  const {width: viewportWidth, height: viewportHeight} = viewportDimensions;

  let left = position.x + OFFSET_X;
  let top = position.y + OFFSET_Y;

  // Flip to left side if too close to right edge
  if (left + containerWidth > viewportWidth - 20) {
    left = position.x - containerWidth - OFFSET_X;
  }

  // Adjust vertical position if too close to bottom
  if (top + containerHeight > viewportHeight - 20) {
    top = viewportHeight - containerHeight - 20;
  }

  // Ensure not above viewport
  if (top < 20) {
    top = 20;
  }

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          initial={{opacity: 0, scale: 0.95}}
          animate={{opacity: 1, scale: 1}}
          exit={{opacity: 0, scale: 0.95}}
          transition={{duration: 0.15}}
          style={{
            position: 'fixed',
            left: `${left}px`,
            top: `${top}px`,
            width: `${containerWidth}px`,
            height: `${containerHeight}px`,
            borderRadius: `${RADIUS.xl}px`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
            zIndex: Z_INDEX.popover,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}>
          <PreviewCardImage
            card={card}
            isLocation={isLocation}
            previewWidth={previewWidth}
            previewHeight={previewHeight}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
