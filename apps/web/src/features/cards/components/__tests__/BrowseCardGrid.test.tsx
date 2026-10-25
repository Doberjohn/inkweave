import {afterEach, describe, it, expect, vi} from 'vitest';
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

// jsdom lays nothing out, so these tests give the grid's scroller the size a browser measures
// before its first paint. A desktop scroller 820px wide holds 4 columns of 180px tiles, 250px
// tall: rows 262px apart.
const ROW = 262;
const view = {width: 820, height: 600, top: 0};

/** The grid's ResizeObserver callback, which a test calls as a browser does on a resize. */
let resized = () => {};

function measureScroller() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const size = (key: 'width' | 'height' | 'top') => ({configurable: true, get: () => view[key]});
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', size('width'));
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', size('height'));
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', size('top'));
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ['clientWidth', 'clientHeight', 'scrollTop']) {
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

  it('draws its first six tiles before it measures its scroller', () => {
    // React creates their images in the render that mounts the grid, which can run well before
    // the commit that measures the scroller, so their art starts loading then (#931). A scroller
    // hidden at mount measures 0 wide: the tiles are laid out as auto-fill would, with no room
    // for rows not drawn.
    view.width = 0;
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(tileNames()).toEqual(cards.slice(0, 6).map((card) => card.fullName));
    expect(grid().style.gridTemplateColumns).toBe('repeat(auto-fill, minmax(180px, 1fr))');
    expect(grid().style.paddingBottom).toBe('24px');
  });

  it("draws a phone's two columns inside its 16px gutters", () => {
    // 358px inside the gutters fits two 140px columns: tiles 173px wide, rows 252.28px apart.
    layout.isMobile = true;
    view.width = 390;
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(grid().style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    expect(grid().style.paddingLeft).toBe('16px');
    expect(tileNames()).toEqual(cards.slice(0, 8).map((card) => card.fullName));
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

    expect(tileNames()).toEqual(cards.slice(0, 8).map((card) => card.fullName));
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
    // 900px inside the gutters: five 180px tiles fit only without their four 12px gaps.
    view.width = 964;
    measureScroller();
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(grid().style.gridTemplateColumns).toBe('repeat(4, 1fr)');
  });

  it('draws every tile where the scroller cannot be measured (jsdom)', () => {
    render(<BrowseCardGrid cards={cards} isLoading={false} onCardSelect={vi.fn()} />);

    expect(screen.getAllByRole('link')).toHaveLength(40);
  });
});
