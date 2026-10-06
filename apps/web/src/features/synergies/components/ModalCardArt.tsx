import {useContext} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  CardImage,
  CardTranslationToggle,
  PrintingCarousel,
  PrintingPills,
} from '../../../shared/components';
import {RADIUS} from '../../../shared/constants';
import {CardPrintingContext, CardTranslationContext} from './modalArtState';

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
 * Desktop's printing switcher (#625; mobile's is in MobileArtControls, under the card). Like
 * the translation toggle, it hides but keeps its place where the card image is gone.
 */
export function HeaderPrintingPills({hidden}: {hidden: boolean}) {
  const printing = useContext(CardPrintingContext);
  if (!printing) return null;
  return (
    <span style={{visibility: hidden ? 'hidden' : undefined}}>
      <PrintingPills
        printings={printing.printings}
        index={printing.index}
        onSelect={printing.pick}
      />
    </span>
  );
}

/**
 * Desktop's translation toggle (mobile's is in MobileArtControls, under the card). Where the
 * card image is gone (comparison, an expanded group), or shows a printing whose scan is
 * already English, it hides but keeps its place, so the header keeps its height and the modal
 * does not jump.
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
 * Mobile's printing pills and translation toggle, under the card. Desktop keeps both in the
 * header, since its body never scrolls and a short viewport would clip anything under the
 * card. Mobile keeps them through comparison too, because its hidden default body must not
 * reflow under the comparison overlay.
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
