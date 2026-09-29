import {useEffect, useLayoutEffect, useRef, type CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {RADIUS} from '../constants';
import {printingAlt, useScrollSnapIndex, type Printing} from '../hooks';
import {CardImage} from './CardImage';
import {CardImageButton} from './CardImageButton';

interface PrintingCarouselProps {
  card: LorcanaCard;
  /** Two or more printings, Standard first (usePrintingSelection). */
  printings: Printing[];
  /** The printing shown; the strip scrolls to it when it changes (e.g. from the pills). */
  index: number;
  /** A swipe landed on another printing. */
  onIndexChange: (index: number) => void;
  width: number;
  height: number;
  borderRadius?: number;
  /** The Standard slide is the page's hero image: load it first (LCP). */
  priority?: boolean;
  /** When set, each slide is an "Enlarge" button that opens the printing's lightbox. */
  onEnlarge?: (index: number) => void;
}

const SLIDE_STYLE: CSSProperties = {
  flex: '0 0 100%',
  scrollSnapAlign: 'start',
  scrollSnapStop: 'always',
};

/**
 * A card's printings as a swipeable strip (#625): one full-width, scroll-snapped slide per
 * printing, so a swipe on touch (or a trackpad) moves between them, and PrintingPills drives
 * it by index. Only the slide shown is reachable by keyboard and screen readers; the others
 * are inert until a swipe or the pills bring them in. Slides after the first are marked lazy,
 * but one slide's width is well inside the browsers' lazy-load distance, so the variant art
 * still downloads with the page; only the Standard art has `priority` (the LCP image).
 *
 * Callers render it only for a card with an alternate printing; a single-printing card keeps
 * its plain CardImage, untouched.
 */
export function PrintingCarousel({
  card,
  printings,
  index,
  onIndexChange,
  width,
  height,
  borderRadius = RADIUS.xl,
  priority,
  onEnlarge,
}: PrintingCarouselProps) {
  // Whether keyboard focus is inside the strip (an Enlarge button), and the slide a swipe
  // brought in while it was. The slide the swipe left goes inert, which would drop the focus
  // to <body>, so the focus follows the swipe instead.
  const focusWithinRef = useRef(false);
  const focusFollowsRef = useRef<number | null>(null);
  const {viewportRef, activeIndex, scrollToIndex} = useScrollSnapIndex((next) => {
    focusFollowsRef.current = focusWithinRef.current ? next : null;
    onIndexChange(next);
  }, index);

  useEffect(() => {
    if (index !== activeIndex) scrollToIndex(index);
  }, [index, activeIndex, scrollToIndex]);

  useLayoutEffect(() => {
    if (focusFollowsRef.current !== index) return;
    focusFollowsRef.current = null;
    viewportRef.current?.children[index]?.querySelector('button')?.focus({preventScroll: true});
  }, [index, viewportRef]);

  return (
    <div
      ref={viewportRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${card.fullName} printings`}
      onFocus={() => {
        focusWithinRef.current = true;
      }}
      onBlur={(e) => {
        focusWithinRef.current = e.currentTarget.contains(e.relatedTarget as Node | null);
      }}
      style={{
        display: 'flex',
        width,
        height,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        overscrollBehaviorX: 'contain',
        borderRadius,
      }}>
      {printings.map((printing, i) => {
        const shown = i === index;
        const image = (
          <CardImage
            src={printing.imageUrl}
            alt={printingAlt(card, printing)}
            width={width}
            height={height}
            inkColor={card.ink}
            cost={card.cost}
            lazy={i > 0}
            priority={i === 0 ? priority : undefined}
            borderRadius={borderRadius}
          />
        );
        return (
          <div key={printing.key} aria-hidden={!shown} inert={!shown} style={SLIDE_STYLE}>
            {onEnlarge ? (
              <CardImageButton
                ariaLabel={`Enlarge ${printing.label} printing`}
                onClick={() => onEnlarge(i)}
                borderRadius={borderRadius}>
                {image}
              </CardImageButton>
            ) : (
              image
            )}
          </div>
        );
      })}
    </div>
  );
}
