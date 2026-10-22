import type {CSSProperties} from 'react';
import {CARD_BAR_SHARE, COLORS, FONTS, RADIUS, SHADOWS, SPACING, Z_INDEX} from '../../../shared/constants';

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

/**
 * Shrink-wraps the modal shell so the sibling nav arrows can be positioned against its edges.
 * Every card's window is one height (owner, 2026-10-20), so paging from card to card moves
 * neither the window's top nor the arrows centred on it: no card has a row under it that
 * another lacks (`desktopCardRowHeight`).
 */
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

/** The close (×) button's size. It sets the header row's height (see ModalCloseButton). */
export const CLOSE_BUTTON_SIZE = 28;

/**
 * The default view's padding at its sides, between the window's edge and the card: the room the
 * printings behind the card show in (ModalCardArt), as the view clips at its edge.
 */
export const BODY_SIDE_PADDING = SPACING.xxl;

/**
 * The default view's scroll area; the modal adds its overflow and exit-reveal styles. Its second
 * child, the comparison panel, collapses to zero height outside comparison but still takes the
 * 16px gap, so the fallback reserves that gap too.
 */
export const DEFAULT_BODY_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: 'relative',
  padding: `${SPACING.xl}px ${BODY_SIDE_PADDING}px ${SPACING.xxl}px`,
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

/** A desktop card's width: the full-size AVIF's intrinsic width (see `modalCardSize`). */
const DESKTOP_CARD_WIDTH = 337;

/**
 * The copies row's height under a card `cardWidth` wide: the row a page fills under the card
 * (#826), which took the copies stripe off the card's foot so the full card shows (owner,
 * 2026-10-22). As tall as the card's own black bar, as the stripe in it is (CopiesStripe's
 * `fit="bar"`): 32px under a full-size desktop card, 23px under a phone's.
 */
export function copiesRowHeight(cardWidth: number): number {
  return Math.round(cardWidth * CARD_BAR_SHARE);
}

/** The room the copies row takes under a card: the column's gap, then the row. */
function copiesRoom(cardWidth: number): number {
  return SPACING.md + copiesRowHeight(cardWidth);
}

/**
 * What a desktop window takes from the screen besides its card: 24px of screen above and below
 * it, the header with one row of chips (117px, measured), the shell's 1px borders, the body's
 * 20px and 24px padding, and the 16px gap the comparison panel keeps. A 697px screen holds the
 * window at full size (649px), and a 741px one with the copies row under its card.
 */
const DESKTOP_WINDOW_CHROME = 48 + 117 + 2 + 20 + 24 + 16;

/** The smallest a desktop card gets on a short screen; a shorter screen clips the window. */
const MIN_DESKTOP_CARD_HEIGHT = 300;

/** The screen the card's size is for: its height, and whether the window holds the copies row. */
interface ModalScreen {
  viewportHeight?: number;
  copiesRow?: boolean;
}

/**
 * The card's size in the modal. A desktop card is 337px wide, the full-size AVIF's intrinsic
 * width (see scripts/download-card-images.mjs), so it renders at native size: 337x470, since
 * the AVIF shares the card's 264:368 ratio, a clean 1:1 mapping for the LCP image.
 *
 * EVERY DESKTOP CARD IS ONE HEIGHT (owner, 2026-10-20). A screen too short for the window
 * shrinks every card alike until it fits, the copies row under it counted where the window
 * holds one.
 */
export function modalCardSize(
  isMobile: boolean,
  {viewportHeight = Number.POSITIVE_INFINITY, copiesRow = false}: ModalScreen = {},
): {cardWidth: number; cardHeight: number} {
  // The width first, then the height in the Lorcana card's 264:368 ratio.
  const cardWidth = isMobile ? 240 : DESKTOP_CARD_WIDTH;
  const full = {cardWidth, cardHeight: Math.round((cardWidth * 368) / 264)};
  if (isMobile) return full;
  const chrome = DESKTOP_WINDOW_CHROME + (copiesRow ? copiesRoom(DESKTOP_CARD_WIDTH) : 0);
  const fits = Math.max(MIN_DESKTOP_CARD_HEIGHT, viewportHeight - chrome);
  if (fits >= full.cardHeight) return full;
  return {cardWidth: Math.round((fits * 264) / 368), cardHeight: fits};
}

interface DesktopCardRow {
  cardWidth: number;
  cardHeight: number;
  /** Whether the copies row shows under the card: a page holds it, and no comparison hides it. */
  copiesRow: boolean;
}

/** A desktop card's row: the card, with the copies row's room under it where it shows. */
export function desktopCardRowHeight({cardWidth, cardHeight, copiesRow}: DesktopCardRow): number {
  return copiesRow ? cardHeight + copiesRoom(cardWidth) : cardHeight;
}

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
 * The card column: a column, so the copies row and mobile's translation toggle
 * (ModalCardArt.tsx) sit under the card, which is centered on mobile. The modal adds its
 * comparison styles.
 */
export function pickCardColumnLayout(isMobile: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isMobile ? 'center' : 'flex-start',
    gap: SPACING.md,
    flexShrink: 0,
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
