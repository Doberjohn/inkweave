import {useContext, useEffect, useRef, type CSSProperties, type ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardImage, CardTranslationToggle, PrintingCarousel} from '../../../shared/components';
import {RADIUS, SPACING} from '../../../shared/constants';
import {BODY_SIDE_PADDING, CARD_WITH_COPIES_STYLE, copiesRowHeight} from './cardOverviewModalStyles';
import {
  CardPrintingContext,
  CardTranslationContext,
  CopiesSlotContext,
  type CardPrintingState,
  type CardTranslationState,
  type CopiesSlotState,
} from './modalArtState';

/**
 * The art's state for the header and the card image, which both read it (modalArtState.ts): the
 * translation (#623), the printing on show (#625), and the slot a page may fill (#826).
 */
export function ModalArtState({
  translation,
  printing,
  copiesSlot,
  children,
}: {
  translation: CardTranslationState | null;
  printing: CardPrintingState | null;
  copiesSlot: CopiesSlotState | null;
  children: ReactNode;
}) {
  return (
    <CardTranslationContext.Provider value={translation}>
      <CardPrintingContext.Provider value={printing}>
        <CopiesSlotContext.Provider value={copiesSlot}>{children}</CopiesSlotContext.Provider>
      </CardPrintingContext.Provider>
    </CardTranslationContext.Provider>
  );
}

/**
 * The card overview modal's card art: its scan, or for a card with an alternate printing
 * (#625) the card in front of its other printings (PrintingCarousel). The stack stays mounted
 * through a comparison (reset to the Standard art) rather than swapping to a plain image, which
 * would remount the <img> mid-FLIP.
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
        // The printings behind the card show in the view's padding, clear of the window's frame.
        room={BODY_SIDE_PADDING - SPACING.xs}
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
      inkColor2={card.ink2}
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

/**
 * The window's row under its card (#826), which a page fills through a portal: Browse's copies
 * stripe, as tall as the card's own black bar (owner, 2026-10-20). It sat over the card's foot
 * until the owner asked for the full card to show (2026-10-22). There only while a page holds it
 * (`useHoldCopiesRow`), and as tall as the stripe from the start, so filling it moves nothing.
 *
 * Keys pressed in it reach the window's own handling (the Tab trap, the arrows' paging) through
 * a native listener: a portal's React events bubble through the page that fills it, never
 * through the window.
 */
function CopiesSlot({cardWidth}: {cardWidth: number}) {
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
    <div ref={keysRef} style={{...SLOT_STYLE, width: cardWidth, height: copiesRowHeight(cardWidth)}}>
      <SlotTarget attach={slot.attach} />
    </div>
  );
}

/** The element the host fills: its own component, so the host's callback is a plain prop until here. */
function SlotTarget({attach}: {attach: CopiesSlotState['attach']}) {
  return <div ref={attach} data-testid="card-overview-copies-slot" />;
}

/** As wide as the card, its corners rounded; it clips the stripe to them. */
const SLOT_STYLE: CSSProperties = {
  flexShrink: 0,
  borderRadius: RADIUS.lg,
  overflow: 'hidden',
};

/**
 * Desktop's translation toggle, in the header before the close × (owner, 2026-10-17: back where
 * it sat before 2026-10-08, when it moved under the card with the pills). Mobile's is under the
 * card (`MobileTranslationToggle`). Where the card image is gone (a comparison, an expanded
 * group), or shows a printing whose scan is already English, it hides but keeps its place, so
 * the title never moves.
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
 * Mobile's translation toggle, under the card, in the column's flow (the mobile body scrolls).
 * Mobile keeps it through comparison too, because its hidden default body must not reflow under
 * the comparison overlay. While the printing on show has an English scan, it hides but keeps its
 * place.
 */
export function MobileTranslationToggle() {
  const translation = useContext(CardTranslationContext);
  if (!translation) return null;
  return (
    <span style={{visibility: translation.language ? undefined : 'hidden'}}>
      <CardTranslationToggle shown={translation.shown} onToggle={translation.toggle} />
    </span>
  );
}

interface CardWithCopiesProps {
  cardWidth: number;
  isMobile: boolean;
  inComparison: boolean;
  /** The card. */
  children: ReactNode;
}

/**
 * The card with its copies under it, which a page fills (`CopiesSlot`), 12px apart (owner,
 * 2026-10-22). A desktop comparison shows the base art alone, and a phone's keeps its hidden
 * default body as it was.
 */
export function CardWithCopies({cardWidth, isMobile, inComparison, children}: CardWithCopiesProps) {
  return (
    <div style={CARD_WITH_COPIES_STYLE}>
      {children}
      {(isMobile || !inComparison) && <CopiesSlot cardWidth={cardWidth} />}
    </div>
  );
}
