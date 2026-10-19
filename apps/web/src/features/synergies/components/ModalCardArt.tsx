import {useContext, useEffect, useRef, type CSSProperties, type Ref} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  CardImage,
  CardTranslationToggle,
  PrintingCarousel,
  PrintingPills,
} from '../../../shared/components';
import {DURATION, EASING, RADIUS} from '../../../shared/constants';
import {usePrefersReducedMotion} from '../../../shared/utils/prefersReducedMotion';
import {CardPrintingContext, CardTranslationContext, CopiesSlotContext, type CopiesSlotState} from './modalArtState';
import {DESKTOP_ART_CONTROLS_STYLE, DESKTOP_UNDER_ART_STYLE} from './cardOverviewModalStyles';

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
