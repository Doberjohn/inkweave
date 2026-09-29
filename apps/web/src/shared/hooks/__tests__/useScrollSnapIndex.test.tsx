import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, act, fireEvent, screen} from '@testing-library/react';
import {useScrollSnapIndex} from '../useScrollSnapIndex';

/** A four-slide strip, the shape PrintingCarousel renders, exposing the hook through the DOM. */
function Strip({
  onIndexChange,
  initialIndex,
}: {
  onIndexChange?: (index: number) => void;
  initialIndex?: number;
}) {
  const {viewportRef, activeIndex, scrollToIndex} = useScrollSnapIndex(onIndexChange, initialIndex);
  return (
    <>
      <output data-testid="active">{activeIndex}</output>
      {[0, 1, 2, 3].map((i) => (
        <button key={i} onClick={() => scrollToIndex(i)}>
          Go to slide {i + 1}
        </button>
      ))}
      <div ref={viewportRef} data-testid="viewport">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} data-slide-index={i} />
        ))}
      </div>
    </>
  );
}

const activeIndex = () => Number(screen.getByTestId('active').textContent);

/** jsdom lays nothing out, so give the viewport a width and a scroll offset. */
function scrollTo(scrollLeft: number, clientWidth = 300) {
  const viewport = screen.getByTestId('viewport');
  Object.defineProperty(viewport, 'clientWidth', {value: clientWidth, configurable: true});
  viewport.scrollLeft = scrollLeft;
  act(() => {
    fireEvent.scroll(viewport);
  });
}

let stripScrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stripScrollTo = vi.fn();
  Element.prototype.scrollTo = stripScrollTo as unknown as Element['scrollTo'];
});

/** Click the control that selects a slide of a 300px-wide strip. */
function goToSlide(slide: number) {
  const viewport = screen.getByTestId('viewport');
  Object.defineProperty(viewport, 'clientWidth', {value: 300, configurable: true});
  fireEvent.click(screen.getByRole('button', {name: `Go to slide ${slide}`}));
  return viewport;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useScrollSnapIndex', () => {
  it('starts on the first slide', () => {
    render(<Strip />);
    expect(activeIndex()).toBe(0);
  });

  it('follows a swipe once it crosses the middle of the next slide, and reports it', () => {
    const onIndexChange = vi.fn();
    render(<Strip onIndexChange={onIndexChange} />);

    scrollTo(160);

    expect(activeIndex()).toBe(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('stays put while a swipe has not crossed the middle', () => {
    const onIndexChange = vi.fn();
    render(<Strip onIndexChange={onIndexChange} />);

    scrollTo(100);

    expect(activeIndex()).toBe(0);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('ignores scroll events while the viewport has no width yet', () => {
    render(<Strip />);

    scrollTo(500, 0);

    expect(activeIndex()).toBe(0);
  });

  it('moves to a slide at once and scrolls the strip to it smoothly', () => {
    render(<Strip />);

    goToSlide(2);

    expect(activeIndex()).toBe(1);
    expect(stripScrollTo).toHaveBeenCalledWith({left: 300, behavior: 'smooth'});
  });

  // scrollIntoView would also scroll every scrollable ancestor, so a page that overflows
  // sideways would jump when a pill is tapped.
  it('scrolls only the strip, never the page around it', () => {
    render(<Strip />);

    const viewport = goToSlide(2);

    expect(stripScrollTo.mock.contexts).toEqual([viewport]);
  });

  it('jumps without animating when the user prefers reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({matches: true})),
    );
    render(<Strip />);

    goToSlide(2);

    expect(stripScrollTo).toHaveBeenCalledWith({left: 300, behavior: 'auto'});
  });

  // Callers record the printing on both paths, so reporting its own scroll would count one
  // pill click twice, and a jump across slides would flick the pills through each on the way.
  it('does not report its own scroll: neither the slides it passes nor the one it lands on', () => {
    const onIndexChange = vi.fn();
    render(<Strip onIndexChange={onIndexChange} />);

    goToSlide(4);
    scrollTo(160);
    scrollTo(460);
    scrollTo(900);

    expect(onIndexChange).not.toHaveBeenCalled();
    expect(activeIndex()).toBe(3);
  });

  it('hands the strip back to a swipe that interrupts its scroll', () => {
    const onIndexChange = vi.fn();
    render(<Strip onIndexChange={onIndexChange} />);
    const viewport = goToSlide(4);
    scrollTo(460);

    fireEvent.touchStart(viewport);
    scrollTo(160);

    expect(activeIndex()).toBe(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('mounts on its initial slide at once, without animating there', () => {
    const clientWidth = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300);
    render(<Strip initialIndex={2} />);

    expect(activeIndex()).toBe(2);
    expect(screen.getByTestId('viewport').scrollLeft).toBe(600);
    expect(stripScrollTo).not.toHaveBeenCalled();
    clientWidth.mockRestore();
  });

  it('reports swipes again once its scroll has landed', () => {
    const onIndexChange = vi.fn();
    render(<Strip onIndexChange={onIndexChange} />);
    goToSlide(2);
    scrollTo(300);

    scrollTo(0);

    expect(activeIndex()).toBe(0);
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });
});
