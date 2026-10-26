import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {DURATION, INSET_FOCUS_RING, RADIUS, SPACING} from '../constants';
import {printingAlt, type Printing} from '../hooks';
import {useCardThrow} from '../hooks/useCardThrow';
import {useFinePointer} from 'inkweave-ui/hooks/useFinePointer';
import {useWheelTurn} from 'inkweave-ui/hooks/useWheelTurn';
import {prerenderedArtShown} from '../lib/prerenderedArt';
import {whenIdle} from '../lib/whenLoadedAndIdle';
import {focusedByKeyboard} from 'inkweave-ui/utils/focusedByKeyboard';
import {usePrefersReducedMotion} from 'inkweave-ui/utils/prefersReducedMotion';
import {CardImage} from './CardImage';
import {CardImageButton} from './CardImageButton';
import {PeekButton, TurnNotice, type PeekSide} from './PrintingPeek';
import {placeOf, round, slideCount, useFrontSlide, type Step} from './printingLoop';
import {STACK_EDGE, slideStyle, stackPose} from './printingStack';
import {PEEK_ZONE, usePeekHover} from './usePeekHover';

interface PrintingCarouselProps {
  card: LorcanaCard;
  /** Two or more printings, Standard first (usePrintingSelection). */
  printings: Printing[];
  /** The printing in front. */
  index: number;
  /**
   * The visitor turned the card to another printing: a throw, a swipe, a peek or an arrow key.
   * The turns loop: after the last printing comes the first, and before the first the last.
   */
  onIndexChange: (index: number) => void;
  /** The same turn, as a printing the visitor stopped to look at (the views it records). */
  onSettle?: (index: number) => void;
  /** Hold the card still: a comparison shows the base art, so it can't be turned. */
  locked?: boolean;
  width: number;
  height: number;
  borderRadius?: number;
  /** The Standard slide is the page's hero image: load it first (LCP). */
  priority?: boolean;
  /** When set, each slide is an "Enlarge" button that opens the printing's lightbox. */
  onEnlarge?: (index: number) => void;
  /**
   * How far past the card's sides the printings behind it may show, inside the frame around it
   * that clips them: the card page's panel gives its 16px of padding, the window 20 of its 24.
   * An open peek slides out and leans less to fit.
   */
  room?: number;
}

/**
 * How long the stack takes to settle once a turn or a drag ends, its slides easing into place
 * (`slideStyle`): the printing a turn sends back stays hidden that long as it passes behind the
 * one coming forward, and a drag's heading holds as long.
 */
const SETTLE_MS = DURATION.slow;
const STEP: Record<PeekSide, Step> = {prev: -1, next: 1};
const SIDES: readonly PeekSide[] = ['prev', 'next'];
const NOOP = () => {};

/**
 * The card turns, so the keyboard must reach it (WCAG 2.1.1): where its slides are Enlarge
 * buttons they are the stops, else the card takes focus itself and ← → turn it. A locked card
 * doesn't turn.
 */
function stackTabIndex({onEnlarge, locked}: Pick<PrintingCarouselProps, 'onEnlarge' | 'locked'>): 0 | undefined {
  return onEnlarge || locked ? undefined : 0;
}

/** Whether a carousel's first render loads its variants' art: turned to one, or one already shown. */
function variantArtFirstWanted(index: number, printings: Printing[]): boolean {
  return index > 0 || printings.slice(1).some((printing) => prerenderedArtShown(printing.imageUrl));
}

/**
 * Whether variant slides may load their art yet: not until the Standard art has loaded
 * and the main thread is idle. `loading="lazy"` can't hold back a printing behind the card
 * (it sits in the viewport), and Chrome even raises that fetch to High, so on a card page the
 * variant art would compete with the LCP image. Reaching for another printing loads it at once:
 * `reach` (a touch, a wheel, a mouse over the card or keyboard focus on it), or a turn to one.
 * So does a prerendered page that showed a variant's art (#915): the browser has it already, and
 * holding it back would blink it out as the app takes over.
 */
function useVariantArt(rootRef: RefObject<HTMLDivElement | null>, index: number, printings: Printing[]) {
  const [wanted, setWanted] = useState(() => variantArtFirstWanted(index, printings));
  if (index > 0 && !wanted) setWanted(true);

  useEffect(() => {
    const standard = rootRef.current?.querySelector('img');
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
  }, [wanted, rootRef]);

  return {wanted, reach: () => setWanted(true)};
}

/**
 * The printing a turn sent back, for a moment: it fades as it passes behind the one coming
 * forward, then its edge comes back beside the card (prototype B). With reduced motion the
 * card turns at once, with nothing to hide.
 */
function useTucked(index: number, reducedMotion: boolean): number | null {
  const [front, setFront] = useState(index);
  const [tucked, setTucked] = useState<number | null>(null);
  if (index !== front) {
    setFront(index);
    setTucked(reducedMotion ? null : front);
  }
  useEffect(() => {
    if (tucked === null) return;
    const timer = setTimeout(() => setTucked(null), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [tucked]);
  return tucked;
}

/**
 * Which way the card is dragged, 1 to the right and -1 to the left, 0 at rest: the printing
 * behind the side it heads for goes under the one the drag brings forward (stackPose). It holds
 * for a moment after the drag ends, while the card springs back or lands, so that printing
 * doesn't flash through as the card passes back over it.
 */
function useHeading(dx: number | null): -1 | 0 | 1 {
  const live = Math.sign(dx ?? 0) as -1 | 0 | 1;
  const [held, setHeld] = useState(live);
  if (live && live !== held) setHeld(live);
  useEffect(() => {
    if (live || !held) return;
    const timer = setTimeout(() => setHeld(0), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [live, held]);
  return live || held;
}

/** The arrow key's turn: -1, 1, or 0 for any other key, and for Alt+← (the browser's Back) and its kin. */
function arrowStep(e: KeyboardEvent): -1 | 0 | 1 {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return 0;
  if (e.key === 'ArrowLeft') return -1;
  return e.key === 'ArrowRight' ? 1 : 0;
}

interface BoxLook {
  width: number;
  height: number;
  borderRadius: number;
  turnable: boolean;
  /** Under a mouse: a hand to grab the card, a pointer near a side, a fist while dragging. */
  cursor: CSSProperties['cursor'];
}

/**
 * The card's box, the stack's own layer: the printings behind it reach past it, and a touch
 * that moves across it turns the card, so the page only scrolls (and zooms) by touch here.
 */
function boxStyle({width, height, borderRadius, turnable, cursor}: BoxLook): CSSProperties {
  return {
    ...INSET_FOCUS_RING,
    position: 'relative',
    isolation: 'isolate',
    width,
    height,
    borderRadius,
    flexShrink: 0,
    touchAction: turnable ? 'pan-y pinch-zoom' : undefined,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor,
  };
}

function boxCursor({fine, turnable, dragging, nearSide}: {fine: boolean; turnable: boolean; dragging: boolean; nearSide: boolean}): CSSProperties['cursor'] {
  if (!fine || !turnable) return undefined;
  if (dragging) return 'grabbing';
  return nearSide ? 'pointer' : 'grab';
}

/** Focus on the printing in front: its Enlarge button, or else the card. */
function focusFront(root: HTMLElement | null) {
  if (!root) return;
  const slideButton = root.querySelector<HTMLElement>('[data-slide]:not([inert]) button');
  (slideButton ?? root).focus({preventScroll: true});
}

interface TurnInput {
  index: number;
  count: number;
  /** Whether the card turns at all: two printings or more, and not held still. */
  turnable: boolean;
  onIndexChange: (index: number) => void;
  onSettle?: (index: number) => void;
  /** Hears of each turn first: the open peek closes. */
  onTurn: () => void;
}

/**
 * The turns the visitor asks for, a printing at a time, round the loop: each is shown and
 * recorded at once, and counted for its notice. The slide a turn leaves goes inert, which would
 * drop focus on its Enlarge button to <body>, so focus on the card follows the turn to the slide
 * it brought in.
 */
function useTurns(rootRef: RefObject<HTMLDivElement | null>, {index, count, turnable, onIndexChange, onSettle = NOOP, onTurn}: TurnInput) {
  const front = useFrontSlide(index, count);
  const [turns, setTurns] = useState(0);
  const focusFollowsRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (focusFollowsRef.current !== front.slide) return;
    focusFollowsRef.current = null;
    focusFront(rootRef.current);
  }, [front.slide, rootRef]);

  const turn = (step: Step) => {
    if (!turnable) return;
    const to = round(index, step, count);
    const slide = front.turn(step);
    focusFollowsRef.current = rootRef.current?.contains(document.activeElement) ? slide : null;
    onTurn();
    onIndexChange(to);
    onSettle(to);
    setTurns((n) => n + 1);
  };
  return {front: front.slide, turns, turn};
}

/**
 * The keyboard on the card: ← → turn it, and its focus opens both peeks, as a pointer near a side
 * opens one; a click's focus opens none. A key pressed on the card is the keyboard's, whatever
 * focused it. Focus also loads the printings' art (`reach`).
 */
function useStackKeys({locked, turn, reach}: {locked: boolean; turn: (step: Step) => void; reach: () => void}) {
  const [focused, setFocused] = useState(false);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    setFocused(true);
    const step = arrowStep(e);
    if (step === 0 || locked) return;
    // The window around the card would page to another card, even at the last printing.
    e.preventDefault();
    e.stopPropagation();
    turn(step);
  };
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    setFocused(focusedByKeyboard(e.target));
    reach();
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };
  return {focused, handlers: {onKeyDown, onFocus, onBlur}};
}

interface PeekInput {
  /** The side a mouse rests near. */
  hover: PeekSide | null;
  dragging: boolean;
  /** Keyboard focus on the card, where both peeks open. */
  focused: boolean;
}

/**
 * The peeks open: the side a mouse rests near, or both while keyboard focus is on the card. None
 * opens mid-drag: the drag itself brings the printing forward.
 */
function openPeeks({hover, dragging, focused}: PeekInput): Record<PeekSide, boolean> {
  if (dragging) return {prev: false, next: false};
  return {prev: focused || hover === 'prev', next: focused || hover === 'next'};
}

/**
 * How far the printings' edges show past the card, and the peeks' buttons over them: each
 * covers its printing's edge, within the frame, and on a mouse the card's outer share too.
 */
function peekGeometry({fine, width, room}: {fine: boolean; width: number; room: number}) {
  const {fine: mouse, touch} = STACK_EDGE;
  if (!fine) return {edge: touch, outside: Math.min(room, touch.rest + SPACING.sm), inside: SPACING.sm};
  return {edge: mouse, outside: Math.min(room, mouse.peek), inside: Math.round(width * PEEK_ZONE)};
}

interface StackPeeksProps {
  printings: Printing[];
  index: number;
  geometry: {outside: number; inside: number};
  dragging: boolean;
  onTurn: (step: Step) => void;
}

/** The peeks' buttons, one at each side of the card, each named for the printing behind it there. */
function StackPeeks({printings, index, geometry, dragging, onTurn}: StackPeeksProps) {
  return (
    <>
      {SIDES.map((side) => (
        <PeekButton
          key={side}
          side={side}
          printing={printings[round(index, STEP[side], printings.length)]}
          outside={geometry.outside}
          inside={geometry.inside}
          dragging={dragging}
          onTurn={() => onTurn(STEP[side])}
        />
      ))}
    </>
  );
}

/**
 * A card's printings, stacked behind it (#625; owner, 2026-10-22, prototype B: the printing pills
 * under the card went). The printing before the card and the one after it sit behind it, fanned
 * out past its sides: a little under a mouse, and further as the pointer rests near a side, where
 * a click turns to that printing; on touch more, and a tap there turns to it. The card itself is
 * thrown aside by a finger or a mouse (`useCardThrow`), turned by a trackpad's swipe
 * (`useWheelTurn`), or by ← → with it focused. The turns loop (owner, 2026-10-22): after the last
 * printing comes the first, so with two printings the other one sits behind both sides. Each turn
 * the visitor makes is named on the card for a moment (`TurnNotice`).
 *
 * Only the printing in front is reachable by keyboard and screen readers; the others are inert
 * until a turn brings them in, and the peeks are buttons named for the printing they turn to.
 * The variant slides' art waits for the Standard art (see useVariantArt), which alone has
 * `priority`: the page's LCP image.
 *
 * Callers render it only for a card with an alternate printing; a single-printing card keeps
 * its plain CardImage, untouched.
 */
export function PrintingCarousel({
  card,
  printings,
  index,
  onIndexChange,
  onSettle,
  locked = false,
  width,
  height,
  borderRadius = RADIUS.xl,
  priority,
  onEnlarge,
  room = Infinity,
}: PrintingCarouselProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();
  const count = printings.length;
  const turnable = !locked && count > 1;
  const variantArt = useVariantArt(rootRef, index, printings);
  const mouse = usePeekHover({size: {width, height}, turnable, fine, reach: variantArt.reach});
  const {front, turns, turn} = useTurns(rootRef, {index, count, turnable, onIndexChange, onSettle, onTurn: mouse.clear});
  const tucked = useTucked(front, reducedMotion);
  const keys = useStackKeys({locked, turn, reach: variantArt.reach});
  const drag = useCardThrow(rootRef, {width, enabled: turnable, onThrow: turn});
  const heading = useHeading(drag.dx);
  useWheelTurn(rootRef, {enabled: turnable, onTurn: turn});

  const dragging = drag.dx !== null;
  const peeking = openPeeks({hover: mouse.hover, dragging, focused: keys.focused});
  const geometry = peekGeometry({fine, width, room});
  const stack = {width, height, dx: drag.dx ?? 0, heading, peeking, edge: geometry.edge, room, locked};
  const slides = slideCount(count);

  return (
    // A carousel (WAI-ARIA APG) whose ← → turn it. The pointer handlers are the card's throw and
    // its peeks, which the peeks' buttons reach without them.
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${card.fullName} printings`}
      tabIndex={stackTabIndex({onEnlarge, locked})}
      className="printing-stack"
      style={boxStyle({
        width,
        height,
        borderRadius,
        turnable,
        cursor: boxCursor({fine, turnable, dragging, nearSide: mouse.hover !== null}),
      })}
      {...drag.handlers}
      {...mouse.handlers}
      {...keys.handlers}
      onPointerDown={(e) => {
        variantArt.reach();
        drag.handlers.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        drag.handlers.onPointerMove(e);
        mouse.follow(e);
      }}
      onWheel={variantArt.reach}
      onDragStart={(e) => e.preventDefault()}>
      {Array.from({length: slides}, (_, slide) => (
        <PrintingSlide
          key={slide}
          card={card}
          printing={printings[slide % count]}
          place={{index: slide % count, copy: slide >= count}}
          shown={slide === front}
          artWanted={variantArt.wanted}
          size={{width, height}}
          borderRadius={borderRadius}
          style={slideStyle(stackPose(placeOf(slide, front, slides), stack), {borderRadius, dragging, tucked: slide === tucked, reducedMotion})}
          priority={priority}
          onEnlarge={onEnlarge}
        />
      ))}
      {turnable && <StackPeeks printings={printings} index={index} geometry={geometry} dragging={dragging} onTurn={turn} />}
      <TurnNotice printing={printings[index]} position={index + 1} count={count} turns={turns} />
    </div>
  );
}

interface PrintingSlideProps {
  card: LorcanaCard;
  printing: Printing;
  /** Which printing it shows, the Standard first, and whether it is that printing's second slide (`slideCount`). */
  place: {index: number; copy: boolean};
  shown: boolean;
  artWanted: boolean;
  size: {width: number; height: number};
  borderRadius: number;
  /** Its place in the stack (slideStyle). */
  style: CSSProperties;
  priority?: boolean;
  onEnlarge?: (index: number) => void;
}

/**
 * One printing's slide. The Standard's own (the Standard art) loads eagerly with the carousel's
 * `priority`; a variant's art, and a second slide's, waits until `artWanted` (useVariantArt).
 */
function PrintingSlide({
  card,
  printing,
  place,
  shown,
  artWanted,
  size,
  borderRadius,
  style,
  priority,
  onEnlarge,
}: PrintingSlideProps) {
  const first = place.index === 0 && !place.copy;
  const image = (
    <CardImage
      src={first || artWanted ? printing.imageUrl : undefined}
      alt={printingAlt(card, printing)}
      width={size.width}
      height={size.height}
      inkColor={card.ink}
      inkColor2={card.ink2}
      cost={card.cost}
      lazy={!first}
      priority={first ? priority : undefined}
      borderRadius={borderRadius}
    />
  );
  return (
    <div data-slide={place.index} data-copy={place.copy || undefined} aria-hidden={!shown} inert={!shown} style={style}>
      {onEnlarge ? (
        <CardImageButton
          ariaLabel={`Enlarge ${printing.label} printing`}
          onClick={() => onEnlarge(place.index)}
          borderRadius={borderRadius}>
          {image}
        </CardImageButton>
      ) : (
        image
      )}
    </div>
  );
}
