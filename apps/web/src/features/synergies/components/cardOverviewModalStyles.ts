import type {CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS, RADIUS, SHADOWS, SPACING, Z_INDEX} from '../../../shared/constants';
import {printingsOf} from '../../../shared/hooks/usePrintingSelection';

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
  padding: SPACING.xxl,
};

/** Shrink-wraps the modal shell so the sibling nav arrows can be positioned against its edges. */
const MODAL_FRAME_STYLE: CSSProperties = {
  position: 'relative',
  pointerEvents: 'none',
};

/**
 * The frame. On desktop it is a column as tall as the screen allows, so a card without art
 * controls can hold their room under its window (`RESERVED_ART_CONTROLS_STYLE`): every card's
 * frame is then one height, and paging from card to card moves neither the window's top nor
 * the arrows centred on the frame (owner, 2026-10-20).
 */
export function pickModalFrameStyle(isMobile: boolean): CSSProperties {
  if (isMobile) return MODAL_FRAME_STYLE;
  return {...MODAL_FRAME_STYLE, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 48px)'};
}

export function pickModalShellStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? '100%' : 1000,
    maxWidth: isMobile ? 580 : 'calc(100vw - 48px)',
    maxHeight: 'calc(100vh - 48px)',
    // In the desktop frame's column, the room held under it gives way first.
    flexShrink: 0,
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

/** The close (×) button's size. It sets the header row's height (see ModalCloseButton). */
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
  padding: `${SPACING.xl}px ${SPACING.xxl}px ${SPACING.xxl}px`,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.lg,
};

export const MODAL_HEADER_STYLE: CSSProperties = {
  padding: `${SPACING.xl}px ${SPACING.xxl}px 0`,
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.md,
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
 * The row of art controls under a desktop card, #625's printing pills (owner, 2026-10-08;
 * they sat in the header before): as tall as the pills, 34px from their padding and text.
 * #681's translation toggle went back to the header (owner, 2026-10-17).
 */
export const ART_CONTROLS_HEIGHT = 34;

/** The room the art controls take under a desktop card: the column's gap, then their row. */
const ART_CONTROLS_ROOM = SPACING.md + ART_CONTROLS_HEIGHT;

/** Whether a desktop card has art controls under its art: printings to switch between. */
export function hasArtControls(card: LorcanaCard): boolean {
  return printingsOf(card).length > 1;
}

/**
 * What a desktop window takes from the screen besides its card, for a card with art controls:
 * 24px of screen above and below it, the header with one row of chips (117px, measured), the
 * shell's 1px borders, the body's 20px and 24px padding, the 16px gap the comparison panel
 * keeps, and the controls' room. A 743px screen holds such a window at full size (695px).
 */
const DESKTOP_WINDOW_CHROME = 48 + 117 + 2 + 20 + 24 + 16 + ART_CONTROLS_ROOM;

/** The smallest a desktop card gets on a short screen; a shorter screen clips the window. */
const MIN_DESKTOP_CARD_HEIGHT = 300;

/**
 * The card's size in the modal. A desktop card is 337px wide, the full-size AVIF's intrinsic
 * width (see scripts/download-card-images.mjs), so it renders at native size: 337x470, since
 * the AVIF shares the card's 264:368 ratio, a clean 1:1 mapping for the LCP image.
 *
 * EVERY DESKTOP CARD IS ONE HEIGHT (owner, 2026-10-20). A card with art controls keeps its full
 * size, and the controls under it make its window taller than a card's without them. A screen
 * too short for that window shrinks every card alike, controls or not, until it fits.
 */
export function modalCardSize(
  isMobile: boolean,
  viewportHeight = Number.POSITIVE_INFINITY,
): {cardWidth: number; cardHeight: number} {
  // The width first, then the height in the Lorcana card's 264:368 ratio.
  const cardWidth = isMobile ? 240 : 337;
  const full = {cardWidth, cardHeight: Math.round((cardWidth * 368) / 264)};
  if (isMobile) return full;
  const fits = Math.max(MIN_DESKTOP_CARD_HEIGHT, viewportHeight - DESKTOP_WINDOW_CHROME);
  if (fits >= full.cardHeight) return full;
  return {cardWidth: Math.round((fits * 264) / 368), cardHeight: fits};
}

/** A desktop card's row: the card, with the art controls' room under it when it has them. */
export function desktopCardRowHeight({cardHeight, controlsBelow}: {cardHeight: number; controlsBelow: boolean}): number {
  return controlsBelow ? cardHeight + ART_CONTROLS_ROOM : cardHeight;
}

/**
 * The art controls' room, held under the window of a desktop card without them, in the frame
 * (`pickModalFrameStyle`). It gives way when the screen is too short to hold it.
 */
export const RESERVED_ART_CONTROLS_STYLE: CSSProperties = {height: ART_CONTROLS_ROOM, flexShrink: 1, minHeight: 0};

/** The pair connector's width, between card A and card B in a comparison. */
export const PAIR_CONNECTOR_WIDTH = 192;

/**
 * How far each card pulls inward in a comparison, so its inner edge meets the pair connector:
 * half of what the row's ~950px leaves after both cards and the connector, 42px at full size.
 * Tuned to the shell's 1000px width.
 */
export function comparisonCardInset(cardWidth: number): number {
  return Math.round((950 - 2 * cardWidth - PAIR_CONNECTOR_WIDTH) / 2);
}

/** The art controls' row, pinned to the bottom of the card's column and centred under the art. */
export const DESKTOP_ART_CONTROLS_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: ART_CONTROLS_HEIGHT,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: SPACING.sm,
};

interface PickCardsRowStyleInput {
  isMobile: boolean;
  cardWidth: number;
  /** The row's height on desktop (`desktopCardRowHeight`). */
  rowHeight: number;
}

export function pickCardsRowStyle({isMobile, cardWidth, rowHeight}: PickCardsRowStyleInput): CSSProperties {
  return {
    display: isMobile ? 'flex' : 'grid',
    flexDirection: isMobile ? 'column' : undefined,
    gridTemplateColumns: isMobile ? undefined : `${cardWidth}px 1fr`,
    gap: SPACING.xxxl,
    alignItems: 'stretch',
    height: isMobile ? undefined : rowHeight,
    flexShrink: 0,
    overflow: 'visible',
    position: 'relative',
  };
}

/**
 * The card column: a column, so mobile's printing pills and translation toggle (ModalCardArt.tsx)
 * sit under the card, which is centered on mobile. The modal adds its comparison styles.
 */
export function pickCardColumnLayout(isMobile: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isMobile ? 'center' : 'flex-start',
    gap: SPACING.md,
    flexShrink: 0,
    // Anchors desktop's art controls row (DESKTOP_ART_CONTROLS_STYLE) to the column's bottom.
    position: 'relative',
  };
}

/**
 * The synergy column beside (desktop) or under (mobile) the card, as tall as the card's row on
 * desktop (`desktopCardRowHeight`). The modal adds its fade.
 */
export function pickSynergyColumnLayout(isMobile: boolean, rowHeight: number): CSSProperties {
  return {
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.xl,
    maxHeight: isMobile ? undefined : rowHeight,
    overflowY: isMobile ? 'visible' : 'auto',
    padding: isMobile ? 0 : `0 ${SPACING.section}px`,
  };
}
