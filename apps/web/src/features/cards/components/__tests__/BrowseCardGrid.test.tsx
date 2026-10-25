import {afterEach, describe, it, expect, vi} from 'vitest';
import {Profiler} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {BrowseCardGrid} from '../BrowseCardGrid';
import {createCard} from '../../../../shared/test-utils';

const layout = vi.hoisted(() => ({isMobile: false}));

vi.mock('../../../../shared/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: layout.isMobile,
    isTablet: false,
    isDesktop: !layout.isMobile,
    windowWidth: 0,
  }),
}));

const cards = Array.from({length: 40}, (_, i) =>
  createCard({id: String(1000 + i), fullName: `Card ${i + 1} - Test`}),
);

// jsdom lays nothing out, so these tests give the grid and its scroller the size a browser
// measures before its first paint. A desktop grid 820px wide holds 4 columns of 180px tiles,
// 250px tall: rows 262px apart.
const ROW = 262;
const view = {width: 820, height: 600, top: 0};

/** The grid's ResizeObserver callback, which a test calls as a browser does on a resize. */
let resized = () => {};
/** The elements it observes. */
let observed: Element[] = [];

const MEASURED = ['clientWidth', 'clientHeight', 'scrollTop', 'getBoundingClientRect'] as const;

/** Gives every element the view's size; with no ResizeObserver, as an old browser has none. */
function measureScroller({observer = true} = {}) {
  if (observer) {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {}
      },
    );
  }
  const size = (read: () => unknown) => ({configurable: true, get: read});
  // A browser rounds clientWidth to whole pixels, and lays out auto-fill's columns in the
  // unrounded width that getBoundingClientRect reads.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', size(() => Math.round(view.width)));
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', size(() => view.height));
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', size(() => view.top));
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({width: view.width, height: view.height}),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  observed = [];
  for (const key of MEASURED) {
    delete (HTMLElement.prototype as never)[key];
  }
  Object.assign(view, {width: 820, height: 600, top: 0});
  layout.isMobile = false;
});

const tileNames = () => screen.getAllByRole('link').map((link) => link.getAttribute('aria-label'));
const grid = () => screen.getByTestId('browse-grid-scroller').firstElementChild as HTMLElement;

describe('BrowseCardGrid window', () => {
  it('draws the rows in view and one more, and holds the room of the rest', () => {
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    // 600px shows rows 1 to 3 under the 24px of glow room; row 4 is the one more.
    expect(tileNames()).toEqual(cards.slice(0, 16).map((card) => card.fullName));
    expect(grid().style.paddingBottom).toBe(`${24 + 6 * ROW}px`);
  });

  it('draws them in the commit that mounts it, as the app replaces a prerendered page', () => {
    // renderOverPrerenderedPage mounts the app inside flushSync and looks for the tiles' images
    // once it returns (#915). The grid measures its scroller in a layout effect, whose update
    // renders before then. Outside act, which would also flush a passive effect's update.
    measureScroller();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false);
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    try {
      flushSync(() =>
        root.render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />),
      );
      expect(tileNames()).toEqual(cards.slice(0, 16).map((card) => card.fullName));
    } finally {
      root.unmount();
      container.remove();
    }
  });

  it.each([
    {screen: 'a desktop', isMobile: false, first: 6, column: 180},
    {screen: 'a phone', isMobile: true, first: 9, column: 96},
  ])(
    'draws $screen its first $first tiles before it measures its scroller',
    ({isMobile, first, column}) => {
      // React creates their images in the render that mounts the grid, which can run well before
      // the commit that measures the scroller, so their art starts loading then (#931). A scroller
      // hidden at mount measures 0 wide: the tiles are laid out as auto-fill would, with no room
      // for rows not drawn.
      layout.isMobile = isMobile;
      view.width = 0;
      measureScroller();
      render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

      expect(tileNames()).toEqual(cards.slice(0, first).map((card) => card.fullName));
      expect(grid().style.gridTemplateColumns).toBe(`repeat(auto-fill, minmax(${column}px, 1fr))`);
      expect(grid().style.paddingBottom).toBe('24px');
    },
  );

  it.each([
    {screen: 'a desktop', isMobile: false, width: 820, eager: 6},
    {screen: 'a phone', isMobile: true, width: 390, eager: 9},
  ])(
    "loads the art of $screen's first $eager tiles at once, and the rest's as they near",
    ({isMobile, width, eager}) => {
      // The page's largest paint is one of them: a phone's first three rows, three across (#968),
      // and on a desktop the first six, as before.
      layout.isMobile = isMobile;
      view.width = width;
      measureScroller();
      const withArt = cards.map((card) => ({...card, imageUrl: `https://art.test/${card.id}.jpg`}));
      render(<BrowseCardGrid cards={withArt} isLoading={false} onCardSelect={vi.fn()} />);

      const loading = [...grid().querySelectorAll('img')].map((img) => img.getAttribute('loading'));
      expect(loading.slice(0, eager + 1)).toEqual([...Array<string>(eager).fill('eager'), 'lazy']);
    },
  );

  it("draws a phone's three columns inside its 16px gutters", () => {
    // 358px inside the gutters fits three 96px columns: tiles 111.33px wide, rows 166.63px apart.
    layout.isMobile = true;
    view.width = 390;
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    // Rows 1 to 4 in view, and row 5.
    expect(tileNames()).toEqual(cards.slice(0, 15).map((card) => card.fullName));
    expect(grid().style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(96px, 1fr))');
    expect(grid().style.paddingLeft).toBe('16px');
  });

  it("gives its loading grid a phone's three columns", () => {
    // The placeholders stand where the loaded tiles will (#914): 358px inside the gutters.
    layout.isMobile = true;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }
        observe() {
          this.callback([{contentRect: {width: 358}} as ResizeObserverEntry], this as never);
        }
        disconnect() {}
      },
    );
    render(<BrowseCardGrid cards={[]} isLoading onCardSelect={vi.fn()} />);

    const placeholders = screen.getByLabelText('Loading cards').firstElementChild as HTMLElement;
    expect(placeholders.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('keeps its rows while its scroller is hidden', () => {
    // The prerender crawl marks a phone page's #root before it reads it, and index.html's style
    // takes a marked root out of a phone's layout (#915): the scroller measures 0 wide meanwhile.
    layout.isMobile = true;
    view.width = 390;
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    Object.assign(view, {width: 0, height: 0});
    act(() => resized());

    expect(tileNames()).toEqual(cards.slice(0, 15).map((card) => card.fullName));
  });

  it("watches the grid's width as well as the scroller, since a scrollbar narrows only the grid", () => {
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(observed).toEqual([screen.getByTestId('browse-grid-scroller'), grid()]);
  });

  it('moves the window as the scroller scrolls', () => {
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    view.top = 24 + 5 * ROW;
    fireEvent.scroll(screen.getByTestId('browse-grid-scroller'));

    // Row 6 at the top: rows 5 to 9 are drawn, and rows 1 to 4 become padding.
    expect(tileNames()).toEqual(cards.slice(16, 36).map((card) => card.fullName));
    expect(grid().style.paddingTop).toBe(`${24 + 4 * ROW}px`);
  });

  it("draws a shorter list's last rows at once while scrolled past its end", () => {
    measureScroller();
    const {rerender} = render(
      <BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />,
    );
    view.top = 24 + 5 * ROW;
    fireEvent.scroll(screen.getByTestId('browse-grid-scroller'));

    rerender(
      <BrowseCardGrid cards={cards.slice(0, 20)} isLoading={false} onCardSelect={vi.fn()} />,
    );

    // Its five rows end above that offset, so the browser pulls it back to their end, 746px
    // down, which shows rows 3 to 5. They and row 2 are drawn in this very render, row 1 is
    // padding, and none is added below.
    expect(tileNames()).toEqual(cards.slice(4, 20).map((card) => card.fullName));
    expect(grid().style.paddingTop).toBe(`${24 + ROW}px`);
    expect(grid().style.paddingBottom).toBe('24px');
  });

  it('fits as many columns as auto-fill does, gaps included', () => {
    // 900px inside the gutters: five 180px tiles fit only without their four 12px gaps. Four
    // columns of 216px tiles draw three rows of four; five would draw four rows of five.
    view.width = 964;
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(tileNames()).toHaveLength(12);
  });

  it('counts columns in the unrounded width auto-fill lays them out in', () => {
    // Five columns need 948px inside the gutters: 1011.6px is 947.6 there, though it rounds up
    // to 1012. Four columns draw three rows of four; five would draw four rows of five.
    view.width = 1011.6;
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(tileNames()).toHaveLength(12);
  });

  it('lays its tiles out with auto-fill once measured, as a prerendered page is on any screen', () => {
    // A page prerendered at one width can be shown at another before the app takes it over
    // (#915): its tiles take that screen's columns, as the app's first render then counts them.
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(grid().style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(180px, 1fr))');
  });

  it('keeps the browser from anchoring its scroll on tiles it swaps for padding', () => {
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(screen.getByTestId('browse-grid-scroller').style.overflowAnchor).toBe('none');
  });

  it('renders nothing for a scroll that keeps the same rows in view', () => {
    measureScroller();
    const onRender = vi.fn();
    render(
      <Profiler id="grid" onRender={onRender}>
        <BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />
      </Profiler>,
    );
    const renders = onRender.mock.calls.length;
    const scroller = screen.getByTestId('browse-grid-scroller');

    view.top = 100;
    fireEvent.scroll(scroller);
    expect(onRender).toHaveBeenCalledTimes(renders);

    // Row 1 leaves the view's top and row 5 comes within one row of its bottom.
    view.top = 24 + ROW + 1;
    fireEvent.scroll(scroller);
    expect(onRender).toHaveBeenCalledTimes(renders + 1);
  });

  it('draws every tile where the scroller cannot be measured (jsdom)', () => {
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(screen.getAllByRole('link')).toHaveLength(40);
  });

  it('draws every tile without ResizeObserver, which would miss its resizes', () => {
    measureScroller({observer: false});
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(screen.getAllByRole('link')).toHaveLength(40);
  });
});
