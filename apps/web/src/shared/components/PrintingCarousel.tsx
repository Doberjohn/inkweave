import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
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

/** Where `requestIdleCallback` is missing (Safari), wait this long instead. */
const IDLE_FALLBACK_MS = 200;
/** Upper bound on the idle wait, so a page that never goes idle still gets there. */
const IDLE_TIMEOUT_MS = 2000;

/** Runs `callback` once the main thread is idle. Returns a function that cancels it. */
function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, {timeout: IDLE_TIMEOUT_MS});
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(callback, IDLE_FALLBACK_MS);
  return () => clearTimeout(id);
}

/**
 * Whether the variant slides may load their art yet: not until the Standard art has loaded
 * and the main thread is idle. `loading="lazy"` can't hold back a slide one width away (it
 * sits inside the browsers' lazy-load distance), and Chrome even raises that fetch to High,
 * so on a card page the variant art would compete with the LCP image. Reaching for another
 * printing loads it at once: `reach` (a touch, a wheel or keyboard focus on the strip), or
 * the pills picking one.
 */
function useVariantArt(viewportRef: RefObject<HTMLDivElement | null>, index: number) {
  const [wanted, setWanted] = useState(index > 0);
  if (index > 0 && !wanted) setWanted(true);

  useEffect(() => {
    const standard = viewportRef.current?.querySelector('img');
    if (wanted || !standard) return;
    let cancelIdle = () => {};
    const afterStandard = () => {
      cancelIdle = whenIdle(() => setWanted(true));
    };
    if (standard.complete) afterStandard();
    else for (const type of ['load', 'error']) standard.addEventListener(type, afterStandard);
    return () => {
      for (const type of ['load', 'error']) standard.removeEventListener(type, afterStandard);
      cancelIdle();
    };
  }, [wanted, viewportRef]);

  return {wanted, reach: () => setWanted(true)};
}

/**
 * A card's printings as a swipeable strip (#625): one full-width, scroll-snapped slide per
 * printing, so a swipe on touch (or a trackpad) moves between them, and PrintingPills drives
 * it by index. Only the slide shown is reachable by keyboard and screen readers; the others
 * are inert until a swipe or the pills bring them in. The variant slides' art waits for the
 * Standard art (see useVariantArt), which alone has `priority`: the page's LCP image.
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

  const variantArt = useVariantArt(viewportRef, index);

  return (
    <div
      ref={viewportRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${card.fullName} printings`}
      onTouchStart={variantArt.reach}
      onWheel={variantArt.reach}
      onFocus={() => {
        focusWithinRef.current = true;
        variantArt.reach();
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
      {printings.map((printing, i) => (
        <PrintingSlide
          key={printing.key}
          card={card}
          printing={printing}
          slideIndex={i}
          shown={i === index}
          artWanted={variantArt.wanted}
          width={width}
          height={height}
          borderRadius={borderRadius}
          priority={priority}
          onEnlarge={onEnlarge}
        />
      ))}
    </div>
  );
}

/**
 * One printing's slide. The first (the Standard art) loads eagerly with the carousel's
 * `priority`; a variant's art waits until `artWanted` (useVariantArt).
 */
function PrintingSlide({
  card,
  printing,
  slideIndex,
  shown,
  artWanted,
  width,
  height,
  borderRadius,
  priority,
  onEnlarge,
}: {
  card: LorcanaCard;
  printing: Printing;
  slideIndex: number;
  shown: boolean;
  artWanted: boolean;
  width: number;
  height: number;
  borderRadius: number;
  priority?: boolean;
  onEnlarge?: (index: number) => void;
}) {
  const first = slideIndex === 0;
  const image = (
    <CardImage
      src={first || artWanted ? printing.imageUrl : undefined}
      alt={printingAlt(card, printing)}
      width={width}
      height={height}
      inkColor={card.ink}
      cost={card.cost}
      lazy={!first}
      priority={first ? priority : undefined}
      borderRadius={borderRadius}
    />
  );
  return (
    <div aria-hidden={!shown} inert={!shown} style={SLIDE_STYLE}>
      {onEnlarge ? (
        <CardImageButton
          ariaLabel={`Enlarge ${printing.label} printing`}
          onClick={() => onEnlarge(slideIndex)}
          borderRadius={borderRadius}>
          {image}
        </CardImageButton>
      ) : (
        image
      )}
    </div>
  );
}
