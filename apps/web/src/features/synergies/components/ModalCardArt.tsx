import {useContext, useEffect, useRef, type CSSProperties, type Ref} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  CardImage,
  CardTranslationPanel,
  CardTranslationToggle,
  PrintingCarousel,
  PrintingPills,
} from '../../../shared/components';
import {COLORS, DURATION, EASING, RADIUS, hexRgba} from '../../../shared/constants';
import {usePrefersReducedMotion} from '../../../shared/utils/prefersReducedMotion';
import {
  CardPrintingContext,
  CardTranslationContext,
  CopiesSlotContext,
  useUnderArtHeight,
  type CopiesSlotState,
} from './modalArtState';
import {
  COMPARISON_CARD_INSET,
  DESKTOP_ART_CONTROLS_STYLE,
  DESKTOP_UNDER_ART_STYLE,
  FLIP_DURATION,
  FLIP_EASING,
  HOVER_FADES,
  artScaleTransform,
  pickCardColumnLayout,
} from './cardOverviewModalStyles';

/**
 * The card overview modal's card art: its scan, or for a card with an alternate printing
 * (#625) the swipeable printings strip. The strip stays mounted through a comparison (reset
 * to the Standard art) rather than swapping to a plain image, which would remount the <img>
 * mid-FLIP.
 */
export function ModalCardArt({
  card,
  cardWidth,
  cardHeight,
}: {
  card: LorcanaCard;
  cardWidth: number;
  cardHeight: number;
}) {
  const printing = useContext(CardPrintingContext);
  if (printing) {
    return (
      <PrintingCarousel
        key={card.id}
        card={card}
        printings={printing.printings}
        index={printing.index}
        onIndexChange={printing.select}
        onSettle={printing.settle}
        locked={printing.locked}
        width={cardWidth}
        height={cardHeight}
        borderRadius={RADIUS.xl}
        priority
      />
    );
  }
  return (
    <CardImage
      src={card.imageUrl}
      alt={card.fullName}
      width={cardWidth}
      height={cardHeight}
      inkColor={card.ink}
      cost={card.cost}
      borderRadius={RADIUS.xl}
      // No style override: CardImage's root container already sets
      // width/height in pixels, which reserves space before the image
      // loads. The previous `style={{height:'auto'}}` collapsed that
      // reservation and produced CLS=0.13 on /card/957, above Google's
      // 0.1 "good" CLS threshold (see commit 8fbe93c).
      priority
      lazy={false}
    />
  );
}

/** The controls' fade as a comparison opens or closes, which reduced motion skips (#790). */
function controlsFade(reducedMotion: boolean): string | undefined {
  return reducedMotion ? undefined : `opacity ${DURATION.base}ms ${EASING.smooth}, visibility ${DURATION.base}ms`;
}

/** Both of the slot's elements lay out as their content: an empty slot is no box at all. */
const SLOT_STYLE: CSSProperties = {display: 'contents'};

/**
 * The element a page fills under the card through a portal (#826): Browse's "Your copies".
 *
 * NO BOX OF ITS OWN (`display: contents`), so an empty slot opens no gap in the column and the
 * window looks as it did for anyone it is not filled for. What fills it lays out as the
 * column's own item.
 *
 * KEYS ARE HANDED ON BY HAND. React sends a portal's events up the tree that rendered it
 * (Browse), not up the DOM, so the window's `onKeyDown` never hears a key pressed in the slot:
 * Tab past its last control could leave the dialog. The DOM event still bubbles through the
 * slot's own wrapper, whose native listener hands it to the window's handler.
 */
export function CopiesSlot() {
  const slot = useContext(CopiesSlotContext);
  const keysRef = useRef<HTMLDivElement>(null);
  const onKeyDown = slot?.onKeyDown;
  useEffect(() => {
    const el = keysRef.current;
    if (!el || !onKeyDown) return;
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);
  if (slot === null) return null;
  return (
    <div ref={keysRef} style={SLOT_STYLE}>
      <SlotTarget attach={slot.attach} />
    </div>
  );
}

/** The element the host fills: its own component, so the host's callback is a plain prop until here. */
function SlotTarget({attach}: {attach: CopiesSlotState['attach']}) {
  return <div ref={attach} style={SLOT_STYLE} data-testid="card-overview-copies-slot" />;
}

/**
 * What sits under a desktop card: the printing pills, in a row (owner, 2026-10-08; they sat in
 * the header before), and the window's slot under them (#826). The art shrinks to make room
 * (`artScaleTransform`), so the column keeps its height and nothing under the card can be
 * clipped. In a comparison, which shows the base art, they fade out while the art grows back.
 */
export function DesktopArtControls({hidden, measureRef}: {hidden: boolean; measureRef: Ref<HTMLDivElement>}) {
  const printing = useContext(CardPrintingContext);
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div
      ref={measureRef}
      style={{
        ...DESKTOP_UNDER_ART_STYLE,
        opacity: hidden ? 0 : 1,
        visibility: hidden ? 'hidden' : undefined,
        transition: controlsFade(reducedMotion),
      }}>
      {printing && (
        <div style={DESKTOP_ART_CONTROLS_STYLE}>
          <PrintingPills printings={printing.printings} index={printing.index} onSelect={printing.pick} />
        </div>
      )}
      <CopiesSlot />
    </div>
  );
}

/**
 * Desktop's translation toggle, in the header before the close × (owner, 2026-10-17: back where
 * it sat before 2026-10-08, when it moved under the card with the pills). Mobile's is under the
 * card (`MobileArtControls`). Where the card image is gone (a comparison, an expanded group), or
 * shows a printing whose scan is already English, it hides but keeps its place, so the title
 * never moves.
 */
export function HeaderTranslationToggle({hidden}: {hidden: boolean}) {
  const translation = useContext(CardTranslationContext);
  if (!translation) return null;
  return (
    <span style={{visibility: hidden || !translation.language ? 'hidden' : undefined}}>
      <CardTranslationToggle shown={translation.shown} onToggle={translation.toggle} />
    </span>
  );
}

/**
 * Mobile's printing pills and translation toggle, under the card, in the column's flow (the
 * mobile body scrolls), then the window's slot (#826). Mobile keeps them through comparison
 * too, because its hidden default body must not reflow under the comparison overlay.
 */
export function MobileArtControls() {
  const translation = useContext(CardTranslationContext);
  const printing = useContext(CardPrintingContext);
  return (
    <>
      {printing && (
        <PrintingPills
          printings={printing.printings}
          index={printing.index}
          onSelect={printing.pick}
          isMobile
        />
      )}
      {translation && (
        <span style={{visibility: translation.language ? undefined : 'hidden'}}>
          <CardTranslationToggle shown={translation.shown} onToggle={translation.toggle} />
        </span>
      )}
      <CopiesSlot />
    </>
  );
}

interface CardImageDisplayProps {
  card: LorcanaCard;
  cardWidth: number;
  cardHeight: number;
  isMobile: boolean;
  highlightedCard: 'a' | 'b' | null;
  inComparison: boolean;
  /** A comparison is open or closing (its exit window): the art's scale animates only then. */
  comparing: boolean;
}

/**
 * The modal's card A: its art, the translation laid over it and the controls under it, sliding
 * and glowing into a comparison. Kept here, beside the art it shows, rather than in
 * `CardOverviewModal`, which stays under CodeScene's 1000 lines of code (#826).
 */
export function CardImageDisplay({
  card,
  cardWidth,
  cardHeight,
  isMobile,
  highlightedCard,
  inComparison,
  comparing,
}: CardImageDisplayProps) {
  // In comparison mode the wrapper takes the ambient `focused-card-glow` className
  // (#332 #6 idea D). The animation cycles `box-shadow` between a low and high gold-tinted
  // aura around the card. Setting borderRadius=14 on the wrapper makes the shadow follow
  // the card's rounded corners instead of drawing against a rectangular bounding box.
  const useGlow = !isMobile && inComparison;
  const translation = useContext(CardTranslationContext);
  const reducedMotion = usePrefersReducedMotion();
  // Desktop's art controls sit under the card, the art shrunk to make room (owner, 2026-10-08),
  // and so does what a page puts in the window's slot (#826): measured, as only the page knows it.
  const {underArtRef, below} = useUnderArtHeight(card, isMobile);
  return (
    <div
      className={useGlow ? 'focused-card-glow' : undefined}
      style={pickCardWrapperStyle({isMobile, highlightedCard, inComparison, reducedMotion})}>
      {/* Shrink-wrap span carrying the `data-comparison-card-a` marker: its rect is exactly
          the card image (not the full-width flex wrapper), so the click handler captures the
          correct FLIP origin for Card A's mobile comparison transition (#332 #5). */}
      <span
        data-comparison-card-a
        style={pickArtBoxStyle({below, inComparison, animate: comparing, reducedMotion, cardHeight})}>
        <ModalCardArt card={card} cardWidth={cardWidth} cardHeight={cardHeight} />
        {translation?.shown && !inComparison && (
          <CardTranslationPanel
            card={card}
            language={translation.language}
            size={isMobile ? 'compact' : 'regular'}
            style={OVER_MODAL_SCAN}
          />
        )}
      </span>
      {/* Outside the span, whose rect is the FLIP origin above. */}
      <ArtControls isMobile={isMobile} inComparison={inComparison} underArtRef={underArtRef} />
    </div>
  );
}

/** The art's controls: in the column's flow on mobile, pinned under the shrunk art on desktop. */
function ArtControls({
  isMobile,
  inComparison,
  underArtRef,
}: {
  isMobile: boolean;
  inComparison: boolean;
  underArtRef: Ref<HTMLDivElement>;
}) {
  if (isMobile) return <MobileArtControls />;
  return <DesktopArtControls hidden={inComparison} measureRef={underArtRef} />;
}

interface ArtBoxStyleInput {
  /** The height kept free under the art for what sits there, or 0 for none. */
  below: number;
  /** A comparison shows the art at full size, whatever sits under it. */
  inComparison: boolean;
  /** A comparison is open or closing: the only motion the scale animates with. */
  animate: boolean;
  reducedMotion: boolean;
  cardHeight: number;
}

/**
 * The art's own box. On desktop it shrinks while controls sit under it, and grows back for a
 * comparison (card B is drawn at full size). The scale animates only with a comparison's own
 * motion: paging between a card with controls and one without resizes it at once. Under
 * reduced motion it never animates (#790).
 */
function pickArtBoxStyle({
  below,
  inComparison,
  animate,
  reducedMotion,
  cardHeight,
}: ArtBoxStyleInput): CSSProperties {
  const shrinkFor = inComparison ? 0 : below;
  return {
    display: 'inline-block',
    lineHeight: 0,
    position: 'relative',
    transform: shrinkFor > 0 ? artScaleTransform(cardHeight, shrinkFor) : undefined,
    transformOrigin: 'top center',
    transition: animate && !reducedMotion ? `transform ${FLIP_DURATION}ms ${FLIP_EASING}` : undefined,
  };
}

/** The translation covers the scan exactly, rounded like CardImage. */
const OVER_MODAL_SCAN: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: `${RADIUS.xl}px`,
};

/**
 * Card A's transition: its hover fades, and its slide into a comparison unless reduced motion
 * skips it (#790).
 */
function cardWrapperTransition(reducedMotion: boolean): string {
  return reducedMotion ? HOVER_FADES : `${HOVER_FADES}, transform ${FLIP_DURATION}ms ${FLIP_EASING}`;
}

interface CardWrapperStyleInput {
  isMobile: boolean;
  highlightedCard: 'a' | 'b' | null;
  inComparison: boolean;
  reducedMotion: boolean;
}

function pickCardWrapperStyle({
  isMobile,
  highlightedCard,
  inComparison,
  reducedMotion,
}: CardWrapperStyleInput): CSSProperties {
  // In comparison mode, pull Card A inward so its right edge touches the
  // PairConnector's left edge. Match the FLIP timing on Card B so both
  // cards slide into position together.
  const inset = !isMobile && inComparison ? COMPARISON_CARD_INSET : 0;
  return {
    ...pickCardColumnLayout(isMobile),
    transform: inset ? `translateX(${inset}px)` : undefined,
    transition: cardWrapperTransition(reducedMotion),
    opacity: highlightedCard === 'b' ? 0.4 : 1,
    filter:
      highlightedCard === 'a' ? `drop-shadow(0 0 8px ${hexRgba(COLORS.primary500, 0.6)})` : undefined,
    // borderRadius matches CardImage's so the ambient glow's box-shadow follows the rounded
    // card silhouette instead of a rectangular bounding box. Only applied in comparison mode
    // (when the glow class is also active); default state stays as-is.
    borderRadius: inset ? 14 : undefined,
  };
}
