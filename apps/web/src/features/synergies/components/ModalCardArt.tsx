import {useContext, useEffect, useRef, type CSSProperties, type ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  CardImage,
  CardTranslationToggle,
  PrintingCarousel,
  PrintingPills,
} from '../../../shared/components';
import {DURATION, EASING, RADIUS} from '../../../shared/constants';
import {usePrefersReducedMotion} from '../../../shared/utils/prefersReducedMotion';
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
import {DESKTOP_ART_CONTROLS_STYLE} from './cardOverviewModalStyles';

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

/**
 * The window's slot over the card's foot (#826), which a page fills through a portal: Browse's
 * copies stripe, as tall as the card's own black bar (owner, 2026-10-20). Over the art rather
 * than under it, so filling it moves nothing in the window.
 *
 * Keys pressed in it reach the window's own handling (the Tab trap, the arrows' paging) through
 * a native listener: a portal's React events bubble through the page that fills it, never
 * through the window.
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
  return <div ref={attach} data-testid="card-overview-copies-slot" />;
}

/**
 * Across the card's foot, its bottom corners rounded as the card's are. The art box sets a
 * line height of 0, so no line box sits under the art; the slot puts it back for its text.
 */
const SLOT_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  borderRadius: `0 0 ${RADIUS.xl}px ${RADIUS.xl}px`,
  overflow: 'hidden',
  lineHeight: 'normal',
};

/** The controls' fade as a comparison opens or closes, which reduced motion skips (#790). */
function controlsFade(reducedMotion: boolean): string | undefined {
  return reducedMotion ? undefined : `opacity ${DURATION.base}ms ${EASING.smooth}, visibility ${DURATION.base}ms`;
}

/**
 * Desktop's printing pills, in a row under the card (owner, 2026-10-08; they sat in the
 * header before). The card keeps its full size and its row grows to hold them
 * (`desktopCardRowHeight`), so every card is one height (owner, 2026-10-20).
 *
 * A comparison, which shows the base art, hides them at once and its row drops their room, so
 * card A's column, which carries its glow, is the card alone: faded out, they would sit over
 * the card's foot as the row shrinks. Leaving it, they fade back in.
 */
export function DesktopArtControls({hidden}: {hidden: boolean}) {
  const printing = useContext(CardPrintingContext);
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div
      style={{
        ...DESKTOP_ART_CONTROLS_STYLE,
        opacity: hidden ? 0 : 1,
        visibility: hidden ? 'hidden' : undefined,
        transition: hidden ? undefined : controlsFade(reducedMotion),
      }}>
      {printing && <PrintingPills printings={printing.printings} index={printing.index} onSelect={printing.pick} />}
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
 * mobile body scrolls). Mobile keeps them through comparison too, because its hidden default
 * body must not reflow under the comparison overlay.
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
    </>
  );
}
