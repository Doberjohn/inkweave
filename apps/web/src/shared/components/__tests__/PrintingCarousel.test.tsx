import {useState} from 'react';
import {describe, it, expect, vi, beforeEach, afterEach, type MockInstance} from 'vitest';
import {render, screen, fireEvent, act, waitFor, createEvent} from '@testing-library/react';
import {createCard, swipeCard} from '../../test-utils';
import type {Printing} from '../../hooks';
import {_resetPrerenderedArt} from '../../lib/prerenderedArt';
import {showPrerenderedArt} from '../../test-utils/loadedArt';
import {PrintingCarousel} from '../PrintingCarousel';

const card = createCard({id: '1938', fullName: 'Pongo - Determined Father'});
const PRINTINGS: Printing[] = [
  {key: 'standard', label: 'Standard', imageUrl: '/card-images/1938.avif'},
  {key: '2141', label: 'Enchanted', rarity: 'Enchanted', imageUrl: '/card-images/2141.avif'},
];
/** Three printings: the middle one has a printing on each side. */
const THREE: Printing[] = [
  ...PRINTINGS,
  {key: '2183', label: '5/P3', rarity: 'Special', number: 5, promoGrouping: 'P3', imageUrl: '/card-images/2183.avif'},
];
const WIDTH = 298;
const HEIGHT = 417;

type CarouselProps = Parameters<typeof PrintingCarousel>[0];

/** A carousel whose index follows its turns, as the hosts wire it (usePrintingSelection). */
function Turnable({
  onSettle,
  onEnlarge = () => {},
  printings = PRINTINGS,
}: {
  onSettle?: (index: number) => void;
  onEnlarge?: () => void;
  printings?: Printing[];
}) {
  const [index, setIndex] = useState(0);
  return (
    <PrintingCarousel
      card={card}
      printings={printings}
      index={index}
      onIndexChange={setIndex}
      onSettle={onSettle}
      onEnlarge={onEnlarge}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}

function renderCarousel(props: Partial<CarouselProps> = {}) {
  const onIndexChange = vi.fn();
  const onSettle = vi.fn();
  const onEnlarge = vi.fn();
  const utils = render(
    <PrintingCarousel
      card={card}
      printings={PRINTINGS}
      index={0}
      onIndexChange={onIndexChange}
      onSettle={onSettle}
      onEnlarge={onEnlarge}
      width={WIDTH}
      height={HEIGHT}
      {...props}
    />,
  );
  return {...utils, onIndexChange, onSettle, onEnlarge};
}

const stack = () => screen.getByRole('group', {name: 'Pongo - Determined Father printings'});
/**
 * A printing's slide, or with `copy` its second one: with two printings each has two, so the
 * other one sits behind both of the card's sides.
 */
const slide = (index: number, copy?: 'copy') =>
  stack().querySelector<HTMLElement>(`[data-slide="${index}"]${copy ? '[data-copy]' : ':not([data-copy])'}`)!;

/** Where a slide sits in the stack, read back from its transform. */
function poseOf(index: number, copy?: 'copy') {
  const {transform, zIndex, opacity} = slide(index, copy).style;
  const number = (pattern: RegExp) => Number(pattern.exec(transform)?.[1]);
  return {
    x: number(/translate3d\((-?[\d.]+)px/),
    rotate: number(/rotate\((-?[\d.]+)deg\)/),
    scale: number(/scale\(([\d.]+)\)/),
    z: Number(zIndex),
    opacity: Number(opacity),
  };
}

/** A screen whose pointer can hover, a mouse or a trackpad: the peeks wait for it near a side. */
function useFinePointerScreen() {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(hover: hover) and (pointer: fine)',
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}

describe('PrintingCarousel', () => {
  it("shows each printing's image, named for its printing", () => {
    renderCarousel({printings: THREE});

    expect(screen.getByRole('img', {name: 'Pongo - Determined Father'})).toBeInTheDocument();
    for (const name of ['Enchanted', '5/P3']) {
      expect(screen.getByRole('img', {name: `Pongo - Determined Father, ${name} printing`, hidden: true})).toBeInTheDocument();
    }
  });

  it('enlarges the printing whose slide is clicked', () => {
    const {onEnlarge} = renderCarousel({index: 1});

    fireEvent.click(screen.getByRole('button', {name: 'Enlarge Enchanted printing'}));

    expect(onEnlarge).toHaveBeenCalledWith(1);
  });

  it('keeps the printings behind the card out of reach of the keyboard and screen readers', () => {
    renderCarousel({index: 0});

    expect(screen.queryByRole('button', {name: 'Enlarge Enchanted printing'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Enlarge Standard printing'})).toBeInTheDocument();
  });

  // Prototype B (owner, 2026-10-22): the other printings sit behind the card, a little smaller,
  // fanned out past its sides from its foot. The turns loop, so with two printings the other one
  // is behind both sides.
  it('stacks the other printing behind both sides of the card, fanned out past them on touch', () => {
    renderCarousel();

    expect(poseOf(0)).toMatchObject({x: 0, rotate: 0, scale: 1, z: 3, opacity: 1});
    // Scaled from its foot, it would sit 9px in from each side: 12 more shows past the card.
    expect(poseOf(1)).toMatchObject({x: 20.94, rotate: 1.25, scale: 0.94, z: 2, opacity: 1});
    expect(poseOf(1, 'copy')).toMatchObject({x: -20.94, rotate: -1.25, scale: 0.94, z: 2, opacity: 1});
    // The Standard's own second slide waits out of sight.
    expect(poseOf(0, 'copy').opacity).toBe(0);
  });

  // The pills under the card went (owner, 2026-10-22): the printing behind it is a way there.
  it('turns to the printing a peek names, out of the Tab order, and records it', () => {
    const {onIndexChange, onSettle} = renderCarousel();
    const peek = screen.getByRole('button', {name: 'Next printing: Enchanted'});

    fireEvent.click(peek);

    expect(peek).toHaveAttribute('tabindex', '-1');
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(onSettle).toHaveBeenCalledWith(1);
  });

  // Owner, 2026-10-22: past the last printing comes the first, and before the first the last.
  it('turns round the loop, from the last printing on to the first and from the first back to the last', () => {
    const last = renderCarousel({index: 2, printings: THREE});
    fireEvent.click(screen.getByRole('button', {name: 'Next printing: Standard'}));
    expect(last.onIndexChange).toHaveBeenCalledExactlyOnceWith(0);
    last.unmount();

    const first = renderCarousel({printings: THREE});
    fireEvent.click(screen.getByRole('button', {name: /^Previous printing:/}));
    expect(first.onIndexChange).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('brings the other of two printings in from the side it was turned to, the Standard going behind the other', () => {
    render(<Turnable />);

    fireEvent.click(screen.getByRole('button', {name: 'Previous printing: Enchanted'}));

    expect(poseOf(1, 'copy')).toMatchObject({x: 0, scale: 1, z: 3});
    expect(poseOf(0)).toMatchObject({x: 20.94, z: 2});
    expect(poseOf(0, 'copy')).toMatchObject({x: -20.94, z: 2, opacity: 1});
    expect(poseOf(1).opacity).toBe(0);
    expect(screen.getByRole('status')).toHaveTextContent('Enchanted, 2 of 2');
  });

  it('turns with ← and →, and leaves Alt+← to the browser', () => {
    const {onIndexChange} = renderCarousel({onEnlarge: undefined});

    const altLeft = fireEvent.keyDown(stack(), {key: 'ArrowLeft', altKey: true});
    fireEvent.keyDown(stack(), {key: 'ArrowRight'});

    expect(altLeft).toBe(true);
    expect(onIndexChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  // The card window pages to the next card on → (CardOverviewModal), which would also fire at
  // the last printing, where the card turns to its first.
  it('keeps its arrow keys from the page around it, even at the last printing', () => {
    const outside = vi.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div onKeyDown={outside}>
        <PrintingCarousel card={card} printings={PRINTINGS} index={1} onIndexChange={() => {}} width={WIDTH} height={HEIGHT} />
      </div>,
    );

    fireEvent.keyDown(stack(), {key: 'ArrowRight'});

    expect(outside).not.toHaveBeenCalled();
  });

  it('names the printing a turn brings in for screen readers, never the one it opens on', () => {
    render(<Turnable />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('button', {name: 'Next printing: Enchanted'}));

    expect(screen.getByRole('status')).toHaveTextContent('Enchanted, 2 of 2');
  });

  // WCAG 2.1.1 (accessibility check, 2026-10-19): a card that turns must be reachable by
  // keyboard. Its Enlarge buttons are the stops where it has them.
  it('takes keyboard focus itself only when no slide is a button and it can turn', () => {
    const plain = renderCarousel({onEnlarge: undefined});
    expect(stack()).toHaveAttribute('tabindex', '0');
    plain.unmount();

    const buttons = renderCarousel();
    expect(stack()).not.toHaveAttribute('tabindex');
    buttons.unmount();

    renderCarousel({onEnlarge: undefined, locked: true});
    expect(stack()).not.toHaveAttribute('tabindex');
  });

  // A comparison shows the base art, so the card must not be turned off it.
  it('holds still while locked: nothing behind it, no peeks, no keys, no swipes', () => {
    const {onIndexChange} = renderCarousel({locked: true});

    fireEvent.keyDown(stack(), {key: 'ArrowRight'});
    swipeCard(stack());

    expect(poseOf(1).opacity).toBe(0);
    expect(screen.queryByRole('button', {name: /printing:/})).not.toBeInTheDocument();
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  // A turn inerts the slide it leaves; focus on that slide's Enlarge button would otherwise
  // fall to <body>.
  it('hands keyboard focus to the slide a turn brings in', () => {
    render(<Turnable />);
    const standard = screen.getByRole('button', {name: 'Enlarge Standard printing'});
    standard.focus();

    fireEvent.keyDown(standard, {key: 'ArrowRight'});

    expect(screen.getByRole('button', {name: 'Enlarge Enchanted printing'})).toHaveFocus();
  });

  it('hides the printing a turn sends back while it passes behind the one coming forward', () => {
    vi.useFakeTimers();
    try {
      render(<Turnable />);

      fireEvent.click(screen.getByRole('button', {name: 'Next printing: Enchanted'}));
      expect(poseOf(1)).toMatchObject({x: 0, scale: 1, z: 3});
      expect(poseOf(0)).toMatchObject({x: -20.94, z: 2, opacity: 0});

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(poseOf(0).opacity).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

// A finger throws the card aside, and so does a mouse (owner, 2026-10-22: a swipe, as on a phone).
describe('PrintingCarousel throw', () => {
  /**
   * A pointer event on the card at `dx` across and `dy` down from where it was pressed, `time` ms
   * in: a flick's speed reads both. React reads a zero timeStamp as none, so it starts a second in.
   */
  function point(
    type: 'pointerDown' | 'pointerMove' | 'pointerUp',
    {dx = 0, dy = 0, time = 0, pointerType = 'touch'}: {dx?: number; dy?: number; time?: number; pointerType?: string},
  ) {
    const event = createEvent[type](stack(), {pointerType, pointerId: 1, button: 0, clientX: 200 + dx, clientY: 200 + dy});
    Object.defineProperty(event, 'timeStamp', {value: 1000 + time});
    fireEvent(stack(), event);
  }

  /** Presses on the card, drags it `dx` across over `ms`, and lets go. */
  function drag(dx: number, ms: number, pointerType = 'touch') {
    point('pointerDown', {pointerType});
    point('pointerMove', {dx: dx / 2, time: ms / 2, pointerType});
    point('pointerMove', {dx, time: ms, pointerType});
    point('pointerUp', {dx, time: ms, pointerType});
  }

  /** Whether a finger's move on the card now is kept from the page's scroll (useTouchHold). */
  function touchMoveKept() {
    const move = new Event('touchmove', {bubbles: true, cancelable: true});
    stack().dispatchEvent(move);
    return move.defaultPrevented;
  }

  it('throws the card to the next printing on a swipe past a fifth of it, and records it', () => {
    const onSettle = vi.fn();
    render(<Turnable onSettle={onSettle} />);

    swipeCard(stack());

    expect(screen.getByRole('button', {name: 'Enlarge Enchanted printing'})).toBeInTheDocument();
    expect(onSettle).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('follows the drag, leaning with it, and the printing it reveals comes forward', () => {
    render(<Turnable />);

    point('pointerDown', {});
    point('pointerMove', {dx: -149, time: 300});

    expect(poseOf(0)).toMatchObject({x: -149, rotate: -3.5});
    expect(poseOf(1)).toMatchObject({x: 10.47, scale: 0.97});
  });

  // Owner, 2026-10-22: a drag one way, then back the other, showed the printing behind it twice.
  it('passes the printing a drag brings forward over the one on the side the card heads for, until it springs back', () => {
    vi.useFakeTimers();
    try {
      render(<Turnable />);

      point('pointerDown', {});
      point('pointerMove', {dx: -149, time: 300});
      expect(poseOf(1).z).toBeGreaterThan(poseOf(1, 'copy').z);
      point('pointerMove', {dx: 60, time: 900});
      expect(poseOf(1, 'copy').z).toBeGreaterThan(poseOf(1).z);

      point('pointerUp', {dx: 60, time: 1500});
      expect(poseOf(0).x).toBe(0);
      expect(poseOf(1, 'copy').z).toBeGreaterThan(poseOf(1).z);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(poseOf(1).z).toBe(poseOf(1, 'copy').z);
    } finally {
      vi.useRealTimers();
    }
  });

  it('springs back from a short, slow drag', () => {
    const onSettle = vi.fn();
    render(<Turnable onSettle={onSettle} />);

    drag(-40, 400);

    expect(poseOf(0).x).toBe(0);
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('turns on a quick flick, short as it is', () => {
    const onSettle = vi.fn();
    render(<Turnable onSettle={onSettle} />);

    drag(-40, 40);

    expect(onSettle).toHaveBeenCalledWith(1);
  });

  // The drag's speed is read up to its release (cubic, PR #902): its last moves alone would flick.
  it('springs back from a drag that rests before it is let go', () => {
    const onSettle = vi.fn();
    render(<Turnable onSettle={onSettle} />);

    point('pointerDown', {});
    point('pointerMove', {dx: -40, time: 20});
    point('pointerUp', {dx: -40, time: 500});

    expect(poseOf(0).x).toBe(0);
    expect(onSettle).not.toHaveBeenCalled();
  });

  // The turns loop (owner, 2026-10-22), so a throw either way turns the card.
  it('throws the card back from the first printing to the last', () => {
    const onSettle = vi.fn();
    render(<Turnable onSettle={onSettle} printings={THREE} />);

    point('pointerDown', {});
    point('pointerMove', {dx: 100, time: 40});
    expect(poseOf(0).x).toBe(100);
    point('pointerUp', {dx: 100, time: 40});

    expect(onSettle).toHaveBeenCalledExactlyOnceWith(2);
  });

  // touch-action: pan-y hands a swipe down to the page, which scrolls.
  it('leaves a touch that moves down first to the page', () => {
    render(<Turnable />);

    point('pointerDown', {});
    point('pointerMove', {dx: 5, dy: 20, time: 30});
    point('pointerMove', {dx: -150, dy: 40, time: 60});

    expect(poseOf(0).x).toBe(0);
    expect(touchMoveKept(), "the touch, the page's scroll's").toBe(false);
  });

  // An iPhone scrolls the page as a dragging finger drifts down, wherever the touch set out, and
  // the scroll's pointercancel dropped the card (owner, 2026-10-25).
  it("keeps a finger's touch from the page's scroll once the card follows it, until it lets go", () => {
    render(<Turnable />);

    point('pointerDown', {});
    point('pointerMove', {dx: -3, time: 10});
    expect(touchMoveKept(), 'before the card follows').toBe(false);
    point('pointerMove', {dx: -40, dy: 30, time: 40});
    expect(touchMoveKept(), 'as it follows, drifting down').toBe(true);
    point('pointerUp', {dx: -40, dy: 30, time: 40});
    expect(touchMoveKept(), 'once let go').toBe(false);
  });

  // A mouse never scrolls the page by dragging (cubic, PR #902).
  it('drags the card under a mouse that moves down first', () => {
    render(<Turnable />);

    point('pointerDown', {pointerType: 'mouse'});
    point('pointerMove', {dx: 5, dy: 20, time: 30, pointerType: 'mouse'});
    point('pointerMove', {dx: -150, dy: 40, time: 60, pointerType: 'mouse'});

    expect(poseOf(0).x).toBe(-150);
  });

  it('drags the card under a mouse too, and swallows the click the drag ends with, only that one', () => {
    const onEnlarge = vi.fn();
    render(<Turnable onEnlarge={onEnlarge} />);
    const enlarge = () => fireEvent.click(screen.getByRole('button', {name: 'Enlarge Standard printing'}));

    drag(-40, 400, 'mouse');
    enlarge();
    expect(onEnlarge).not.toHaveBeenCalled();

    enlarge();
    expect(onEnlarge).toHaveBeenCalledOnce();
  });

  it('turns once for each sideways swipe on a trackpad, and keeps it from the browser', () => {
    vi.useFakeTimers();
    try {
      const onSettle = vi.fn();
      render(<Turnable onSettle={onSettle} printings={THREE} />);

      const kept = !fireEvent.wheel(stack(), {deltaX: 30});
      fireEvent.wheel(stack(), {deltaX: 30});
      // The swipe's momentum, after the fingers lift.
      fireEvent.wheel(stack(), {deltaX: 60});
      expect(kept).toBe(true);
      expect(onSettle).toHaveBeenCalledExactlyOnceWith(1);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.wheel(stack(), {deltaX: 60});
      expect(onSettle).toHaveBeenLastCalledWith(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a scroll down the page alone', () => {
    const onSettle = vi.fn();
    render(<Turnable onSettle={onSettle} />);

    const passed = fireEvent.wheel(stack(), {deltaX: 50, deltaY: 120});

    expect(passed).toBe(true);
    expect(onSettle).not.toHaveBeenCalled();
  });
});

// Under a mouse or trackpad the printing behind the card leans out from it as the pointer rests
// near that side (owner, 2026-10-22).
describe('PrintingCarousel peeks', () => {
  useFinePointerScreen();

  const hoverAt = (x: number) => fireEvent.pointerMove(stack(), {pointerType: 'mouse', clientX: x, clientY: 200});

  // Owner, 2026-10-22: more of the printings behind the card showing at rest.
  it('fans the printings behind the card out a little at rest', () => {
    renderCarousel();

    expect(poseOf(1)).toMatchObject({x: 12.94, rotate: 1.25});
    expect(poseOf(1, 'copy')).toMatchObject({x: -12.94, rotate: -1.25});
  });

  // The tag naming the printing went (owner, 2026-10-22): the peek's button names it for screen readers.
  it('leans the printing further out from behind the card once the pointer rests near its side, unnamed', () => {
    vi.useFakeTimers();
    try {
      renderCarousel();

      hoverAt(280);
      act(() => {
        vi.advanceTimersByTime(70);
      });

      expect(poseOf(1)).toMatchObject({x: 24.94, rotate: 2.5});
      expect(poseOf(1, 'copy')).toMatchObject({x: -12.94, rotate: -1.25});
      expect(screen.queryByText('Enchanted')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens no peek for a pointer passing over the card', () => {
    vi.useFakeTimers();
    try {
      renderCarousel();

      hoverAt(280);
      act(() => {
        vi.advanceTimersByTime(40);
      });
      hoverAt(150);
      act(() => {
        vi.advanceTimersByTime(70);
      });

      expect(poseOf(1).rotate).toBe(1.25);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets its peek go when the card holds still under the mouse, as a comparison holds it', () => {
    vi.useFakeTimers();
    try {
      const props = {card, printings: PRINTINGS, index: 0, onIndexChange: vi.fn(), width: WIDTH, height: HEIGHT};
      const {rerender} = render(<PrintingCarousel {...props} />);
      hoverAt(280);
      act(() => {
        vi.advanceTimersByTime(70);
      });

      rerender(<PrintingCarousel {...props} locked />);
      hoverAt(281);
      rerender(<PrintingCarousel {...props} />);

      expect(poseOf(1).rotate).toBe(1.25);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens both peeks for keyboard focus on the card, leaning less where its frame is tight', () => {
    /** Tab onto the card: focus from the keyboard, as `:focus-visible` tells it. */
    const tabTo = () => {
      fireEvent.keyDown(document.body, {key: 'Tab'});
      act(() => stack().focus());
    };
    const {unmount} = renderCarousel({onEnlarge: undefined, index: 1, printings: THREE});
    tabTo();
    expect(poseOf(0).rotate).toBe(-2.5);
    expect(poseOf(2).rotate).toBe(2.5);
    unmount();

    renderCarousel({onEnlarge: undefined, room: 16});
    tabTo();
    expect(poseOf(1).rotate).toBe(1.21);
  });

  it('opens no peek when a click focuses the card', () => {
    renderCarousel({onEnlarge: undefined});

    fireEvent.mouseDown(stack());
    act(() => stack().focus());

    expect(poseOf(1).rotate).toBe(1.25);
  });
});

// Lazy loading can't hold back a printing behind the card (it sits in the viewport), so the
// variant's art would otherwise compete with the Standard art: the card page's LCP image.
describe('PrintingCarousel variant art', () => {
  let complete: MockInstance;
  beforeEach(() => {
    complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
  });
  afterEach(() => {
    complete.mockRestore();
  });
  /** The variant's art on both of its slides. */
  const variantArt = () =>
    screen.getAllByRole('img', {name: 'Pongo - Determined Father, Enchanted printing', hidden: true}).map((img) => img.getAttribute('src'));
  const loaded = ['/card-images/2141.avif', '/card-images/2141.avif'];

  it('holds the variant art back until the Standard art has loaded, and the Standard second slide too', async () => {
    renderCarousel();
    const standardCopy = slide(0, 'copy').querySelector('img');
    expect(variantArt()).toEqual([null, null]);
    expect(standardCopy).not.toHaveAttribute('src');

    fireEvent.load(screen.getByRole('img', {name: 'Pongo - Determined Father'}));

    await waitFor(() => expect(variantArt()).toEqual(loaded));
    expect(standardCopy).toHaveAttribute('src', '/card-images/1938.avif');
  });

  it('loads the variant art at once when a touch lands on the card, or a mouse comes over it', () => {
    const {unmount} = renderCarousel();
    fireEvent.pointerDown(stack(), {pointerType: 'touch'});
    expect(variantArt()).toEqual(loaded);
    unmount();

    renderCarousel();
    fireEvent.pointerEnter(stack(), {pointerType: 'mouse'});
    expect(variantArt()).toEqual(loaded);
  });

  it('loads the variant art at once when it turns to the variant', () => {
    const {rerender} = renderCarousel();

    rerender(<PrintingCarousel card={card} printings={PRINTINGS} index={1} onIndexChange={() => {}} width={WIDTH} height={HEIGHT} />);

    expect(variantArt()).toEqual(loaded);
  });

  describe('as the app takes over from a prerendered page (#915)', () => {
    /** The page showed `srcs`; the app's own images report nothing loaded, as in Chromium. */
    const prerenderedShowing = (...srcs: string[]) => {
      complete.mockRestore();
      showPrerenderedArt(...srcs);
      complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
    };
    afterEach(() => _resetPrerenderedArt());

    it('loads the variant art at once when the page showed it', () => {
      prerenderedShowing('/card-images/1938.avif', '/card-images/2141.avif');
      renderCarousel();

      expect(variantArt()).toEqual(loaded);
    });

    it('still holds the variant art back when the page showed only the Standard art', () => {
      prerenderedShowing('/card-images/1938.avif');
      renderCarousel();

      expect(variantArt()).toEqual([null, null]);
    });
  });
});
