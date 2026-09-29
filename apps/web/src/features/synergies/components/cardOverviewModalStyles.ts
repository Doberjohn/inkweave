import type {CSSProperties} from 'react';
import {COLORS, FONTS, RADIUS, SHADOWS, Z_INDEX} from '../../../shared/constants';

/*
 * The card modal's chrome, shared by CardOverviewModal and CardOverviewModalFallback (#640). The
 * fallback stands in while the modal's chunk downloads and hands over to it without a visible
 * change, so both must read the same scrim, frame, panel, header and card geometry from here.
 */

export const MODAL_BACKDROP_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  // Solid scrim only — NO backdrop-filter. The comparison view animates continuously behind
  // this backdrop (the 1s PairConnector reveal + the infinite focused-card glow), and on
  // WebKit a blurred backdrop over animating content re-rasterizes every frame, wedging the
  // compositor so BACK/switch clicks and the overlay-visibility flip never settle (#444).
  // The deeper 0.72-alpha black preserves the "page recedes" separation the blur provided.
  background: COLORS.scrim,
  zIndex: Z_INDEX.modalBackdrop,
  cursor: 'pointer',
};

export const CENTERING_WRAPPER_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: Z_INDEX.modal,
  pointerEvents: 'none',
  padding: '24px',
};

/** Shrink-wraps the modal shell so the sibling nav arrows can be positioned against its edges. */
export const MODAL_FRAME_STYLE: CSSProperties = {
  position: 'relative',
  pointerEvents: 'none',
};

export function pickModalShellStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? '100%' : 1000,
    maxWidth: isMobile ? 580 : 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 48px)',
    background: COLORS.surface,
    borderRadius: `${RADIUS.card}px`,
    border: `1px solid ${COLORS.surfaceBorder}`,
    boxShadow: `${SHADOWS.overlay}, ${SHADOWS.goldRing}`,
    position: 'relative',
    pointerEvents: 'auto',
    fontFamily: FONTS.body,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };
}

/** The close (×) button's size. It sets the header row's height, so the fallback reserves it. */
export const CLOSE_BUTTON_SIZE = 28;

/**
 * The default view's scroll area; the modal adds its overflow and exit-reveal styles. Its second
 * child, the comparison panel, collapses to zero height outside comparison but still takes the
 * 16px gap, so the fallback reserves that gap too.
 */
export const DEFAULT_BODY_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: 'relative',
  padding: '20px 24px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

export const MODAL_HEADER_STYLE: CSSProperties = {
  padding: '20px 24px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};

export function pickModalTitleStyle(isMobile: boolean): CSSProperties {
  return {
    margin: 0,
    fontFamily: FONTS.body,
    fontSize: isMobile ? 18 : 22,
    fontWeight: 700,
    color: COLORS.text,
    lineHeight: 1.2,
    flex: 1,
    minWidth: 0,
  };
}

/**
 * The card's size in the modal. 337px matches the full-size AVIF's intrinsic width (see
 * scripts/download-card-images.mjs): rendering at native size avoids browser upscaling. The
 * Lorcana card aspect ratio 264:368 is the same as the AVIF's 337:470, so the height resolves
 * to 470, a clean 1:1 mapping for the LCP image.
 */
export function modalCardSize(isMobile: boolean): {cardWidth: number; cardHeight: number} {
  const cardWidth = isMobile ? 240 : 337;
  return {cardWidth, cardHeight: Math.round((cardWidth * 368) / 264)};
}

interface PickCardsRowStyleInput {
  isMobile: boolean;
  cardWidth: number;
  cardHeight: number;
}

export function pickCardsRowStyle({isMobile, cardWidth, cardHeight}: PickCardsRowStyleInput): CSSProperties {
  return {
    display: isMobile ? 'flex' : 'grid',
    flexDirection: isMobile ? 'column' : undefined,
    gridTemplateColumns: isMobile ? undefined : `${cardWidth}px 1fr`,
    gap: 28,
    alignItems: 'stretch',
    height: isMobile ? undefined : cardHeight,
    flexShrink: 0,
    overflow: 'visible',
    position: 'relative',
  };
}
