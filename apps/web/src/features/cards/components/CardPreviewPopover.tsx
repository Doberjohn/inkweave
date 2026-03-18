import {useMemo, useState} from 'react';
import {useCardPreview} from './useCardPreview';
import {useResponsive, useTransitionPresence} from '../../../shared/hooks';
import {INK_COLORS, RADIUS, Z_INDEX, COLORS} from '../../../shared/constants';
import type {LorcanaCard} from '../types';

const PREVIEW_WIDTH = 337;
const PREVIEW_HEIGHT = 470;
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

  const isOpen = !!card;
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);

  // Memoize viewport height to avoid reading on every render
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

  if (!mounted || !card) return null;

  // On touch mode, show centered modal with backdrop
  if (isTouchMode) {
    return (
      <>
        {/* Touch-only dismiss overlay; no keyboard interaction expected on touch devices */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className="overlay-transition overlay-enter"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: Z_INDEX.popoverBackdrop,
            ...(visible ? {opacity: 1} : {}),
          }}
          onClick={hidePreview}
          onTransitionEnd={onTransitionEnd}
        />
        {/* Touch-only tap-to-dismiss; this branch only renders on touch devices */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className={`overlay-transition overlay-fast overlay-scale overlay-enter ${visible ? 'overlay-visible' : ''}`}
          onClick={hidePreview}
          onTransitionEnd={onTransitionEnd}
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: visible
              ? 'translate(-50%, -50%) scale(1)'
              : 'translate(-50%, -50%) scale(0.8)',
            width: `${containerWidth}px`,
            height: `${containerHeight}px`,
            borderRadius: `${RADIUS.xl}px`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            zIndex: Z_INDEX.popover,
            overflow: 'hidden',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}>
          <PreviewCardImage
            card={card}
            isLocation={isLocation}
            previewWidth={previewWidth}
            previewHeight={previewHeight}
          />
        </div>
        {/* Tap to dismiss hint */}
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '20%',
            left: '50%',
            transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, 10px)',
            background: COLORS.gray800,
            color: COLORS.white,
            padding: '8px 16px',
            borderRadius: `${RADIUS.lg}px`,
            fontSize: '14px',
            zIndex: Z_INDEX.popover,
            pointerEvents: 'none',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.2s ease 0.1s, transform 0.2s ease 0.1s',
          }}>
          Tap anywhere to dismiss
        </div>
      </>
    );
  }

  // Desktop hover mode - position relative to cursor
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
    <div
      className={`overlay-transition overlay-fast overlay-scale overlay-enter ${visible ? 'overlay-visible' : ''}`}
      onTransitionEnd={onTransitionEnd}
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
    </div>
  );
}
