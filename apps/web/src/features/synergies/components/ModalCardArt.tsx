import {useContext} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  CardImage,
  CardTranslationToggle,
  PrintingCarousel,
  PrintingPills,
} from '../../../shared/components';
import {EASING, RADIUS} from '../../../shared/constants';
import {CardPrintingContext, CardTranslationContext} from './modalArtState';
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
 * Desktop's printing pills and translation toggle, in a row under the card (owner,
 * 2026-10-08; they sat in the header before). The art shrinks to make room
 * (`artScaleTransform`), so the column keeps its height and nothing under the card can be
 * clipped. In a comparison, which shows the base art, they fade out while the art grows back.
 * The toggle hides but keeps its place while the scan on show is English, so the pills never
 * move under the pointer.
 */
export function DesktopArtControls({hidden}: {hidden: boolean}) {
  const translation = useContext(CardTranslationContext);
  const printing = useContext(CardPrintingContext);
  return (
    <div
      style={{
        ...DESKTOP_ART_CONTROLS_STYLE,
        opacity: hidden ? 0 : 1,
        visibility: hidden ? 'hidden' : undefined,
        transition: `opacity 0.2s ${EASING.smooth}, visibility 0.2s`,
      }}>
      {printing && <PrintingPills printings={printing.printings} index={printing.index} onSelect={printing.pick} />}
      {translation && (
        <span style={{visibility: translation.language ? undefined : 'hidden'}}>
          <CardTranslationToggle shown={translation.shown} onToggle={translation.toggle} />
        </span>
      )}
    </div>
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
