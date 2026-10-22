import {useState} from 'react';
import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {act, render, screen, fireEvent} from '@testing-library/react';
import {BinderSpreadMap, type Pocket} from '../BinderSpreadMap';

/** The pockets that fill `spreads` spreads, the first holding twelve beside the front cover. */
const filling = (spreads: number) => spreads * 24 - 12;

/** Forty spreads, every pocket held. */
const POCKETS: Pocket[] = Array.from({length: filling(40)}, (): Pocket => ({owned: true, inks: ['Amber']}));

/** The map as the binder drives it: it turns to whatever spread the map asks for. */
function Live() {
  const [current, setCurrent] = useState(0);
  return <BinderSpreadMap pockets={POCKETS} current={current} onGo={setCurrent} />;
}

/** The spreads in view, by their names. */
const spreads = () => screen.getAllByRole('button', {name: /spread \d+ of \d+/i}).map((b) => b.getAttribute('aria-label'));

describe('BinderSpreadMap, for a long binder', () => {
  it('shows eleven spreads at a time', () => {
    render(<Live />);
    expect(spreads()).toHaveLength(11);
    expect(spreads()[10]).toMatch(/^Spread 11 of 40/);
  });

  it('moves the window on once its last spread is reached, that spread now its first', () => {
    render(<Live />);
    fireEvent.click(screen.getByRole('button', {name: /^Spread 11 of 40/}));
    expect(spreads()[0]).toMatch(/^Spread 11 of 40/);
    expect(spreads()[10]).toMatch(/^Spread 21 of 40/);
  });

  it('moves it back when a step goes back past its first spread, that spread now its last', () => {
    // From the third window, spreads 21 to 31: one back from the second, the binder's
    // start would clamp the move and hide where it lands (#790). The step back is the
    // spread's own arrow's, on its edge (owner, 2026-10-22), so here the binder takes it.
    const map = (current: number) => <BinderSpreadMap pockets={POCKETS} current={current} onGo={() => {}} />;
    const view = render(map(0));
    view.rerender(map(10));
    view.rerender(map(20));
    view.rerender(map(19));
    expect(spreads()[0]).toMatch(/^Spread 10 of 40/);
    expect(spreads()[10]).toMatch(/^Spread 20 of 40/);
    expect(screen.getByRole('button', {name: /^Spread 20 of 40/})).toHaveAttribute('aria-current', 'true');
  });

  it('keeps a short binder whole, with no window to move', () => {
    render(<BinderSpreadMap pockets={POCKETS.slice(0, filling(9))} current={8} onGo={() => {}} />);
    expect(spreads()).toHaveLength(9);
  });
});

/**
 * jsdom lays nothing out, so the row gets a width: `row.nav` px. Every way of reading a
 * width agrees, so these tests don't depend on which one the map reads.
 */
function layOut(row: {nav: number}) {
  const widthOf = (el: Element) => (el.tagName === 'NAV' ? row.nav : 0);
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return widthOf(this);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return widthOf(this);
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return DOMRect.fromRect({width: widthOf(this)});
  });
}

/** The observers jsdom lacks, and a way to tell them all their rows resized. */
const resized: Array<() => void> = [];
class FakeResizeObserver {
  constructor(callback: () => void) {
    resized.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('BinderSpreadMap, fitted to its row', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', FakeResizeObserver));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resized.length = 0;
  });

  // The row is the spreads' alone (owner, 2026-10-22: its Previous and Next moved to the
  // spread's edges). Each spread needs 66px and 4px after it: (row + 4) / 70, rounded
  // down, from 1 to 11.
  it.each([
    [1272, 11], // 1920 wide: room for eighteen, but the window holds eleven at most
    [792, 11], // 1440
    [632, 9], // 1280
    [376, 5], // 1024, both panels docked
    [60, 1], // no room at all: the open spread still shows
  ])('a %ipx row shows %i spreads', (nav, count) => {
    layOut({nav});
    render(<Live />);
    expect(spreads()).toHaveLength(count);
  });

  it('moves a narrow window on at its own last spread', () => {
    layOut({nav: 440}); // six spreads
    render(<Live />);
    fireEvent.click(screen.getByRole('button', {name: /^Spread 6 of 40/}));
    expect(spreads()[0]).toMatch(/^Spread 6 of 40/);
    expect(spreads()[5]).toMatch(/^Spread 11 of 40/);
  });

  it("opens a narrow window on the spread on show, even near a short binder's end", () => {
    layOut({nav: 160}); // two spreads
    render(<BinderSpreadMap pockets={POCKETS.slice(0, filling(9))} current={2} onGo={() => {}} />);
    expect(spreads()).toEqual([expect.stringMatching(/^Spread 3 of 9/), expect.stringMatching(/^Spread 4 of 9/)]);
  });

  it('keeps the open spread in view when the row narrows', () => {
    const row = {nav: 1272};
    layOut(row);
    render(<Live />);
    fireEvent.click(screen.getByRole('button', {name: /^Spread 10 of 40/}));
    row.nav = 440;
    act(() => resized.forEach((tell) => tell()));
    expect(spreads()).toHaveLength(6);
    expect(spreads()[5]).toMatch(/^Spread 10 of 40/);
    expect(screen.getByRole('button', {name: /^Spread 10 of 40/})).toHaveAttribute('aria-current', 'true');
  });
});

describe('BinderSpreadMap, set by set', () => {
  it("names each spread's set and its place in it, and both sets where one ends and the next begins", () => {
    // Set A fills nine spreads, the first beside the cover, and the tenth's left page;
    // Set B starts on its right page.
    const sets = [
      {start: 0, label: 'Set A'},
      {start: 9 * 24, label: 'Set B'},
    ];
    render(<BinderSpreadMap pockets={POCKETS} current={0} onGo={() => {}} sets={sets} />);
    expect(spreads()[0]).toBe('Set A, spread 1 of 10: nothing missing');
    expect(spreads()[9]).toBe('Set A, spread 10 of 10, then Set B, spread 1 of 31: nothing missing');
    expect(spreads()[10]).toBe('Set B, spread 2 of 31: nothing missing');
  });
});

describe('BinderSpreadMap, for a promo set (#805)', () => {
  /** The fill of each cell of the spread with this name, in pocket order. */
  const fills = (name: RegExp) =>
    [...screen.getByRole('button', {name}).querySelectorAll<HTMLElement>('span[aria-hidden] > span')].map(
      (cell) => cell.style.background,
    );

  it("draws a waiting promo's scan as a greyed card, which no one can hold yet, so it is never missing", () => {
    const pockets: Pocket[] = [
      {owned: true, inks: ['Amber']},
      {owned: false, inks: [], open: true},
      {owned: false, inks: [], open: true, scan: true},
    ];
    render(<BinderSpreadMap pockets={pockets} current={0} onGo={() => {}} />);
    // Past the front cover's twelve cells, the right page's: the pockets.
    const [held, open, scan] = fills(/^Spread 1 of 1: nothing missing$/).slice(12);
    expect(held).not.toBe('');
    expect(open).toBe('');
    expect(scan).not.toBe('');
  });
});

describe('BinderSpreadMap covers (owner, 2026-10-18)', () => {
  /** The tint of each page of the spread with this name, left then right. */
  const pageTints = (name: RegExp) =>
    [...screen.getByRole('button', {name}).querySelectorAll<HTMLElement>('span[aria-hidden]')].map(
      (page) => page.style.background,
    );

  it('draws the front cover on the first spread and the back cover past the last card, as the binder does', () => {
    // Twenty pockets: twelve beside the cover, then the last eight on the second spread's left page.
    render(<BinderSpreadMap pockets={POCKETS.slice(0, 20)} current={0} onGo={() => {}} />);
    const [frontCover, firstCards] = pageTints(/^Spread 1 of 2/);
    const [lastCards, backCover] = pageTints(/^Spread 2 of 2/);
    expect(frontCover).toBe(backCover);
    expect(firstCards).toBe(lastCards);
    expect(frontCover).not.toBe(firstCards);
  });

  it('keeps the loading map, which holds no pockets yet, a front cover beside a page', () => {
    render(<BinderSpreadMap pockets={[]} current={0} onGo={() => {}} />);
    const [frontCover, page] = pageTints(/^Spread 1 of 1/);
    expect(frontCover).not.toBe(page);
  });
});

/** The first mini spread's right page, where its cards start beside the front cover, and that page's first cell. */
function firstCell() {
  const page = screen.getByRole('button', {name: /^Spread 1 of 1/}).lastElementChild as HTMLElement;
  return {page, cell: page.firstElementChild as HTMLElement};
}

/**
 * A fresh copy of the map, where CSS can round or cannot. Whether it can is read once, at
 * module load, so each case stubs `CSS.supports` and imports its own, whatever jsdom reports.
 */
async function loadMap(canRound: boolean) {
  vi.stubGlobal('CSS', {supports: () => canRound});
  vi.resetModules();
  return (await import('../BinderSpreadMap')).BinderSpreadMap;
}

describe('BinderSpreadMap, cells', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sizes each cell in whole pixels against its page, where CSS can round', async () => {
    const Rounded = await loadMap(true);
    render(<Rounded pockets={POCKETS.slice(0, filling(1))} current={0} onGo={() => {}} />);
    const {page, cell} = firstCell();
    expect(page.style.containerType).toBe('inline-size');
    expect(cell.style.width).toMatch(/^round\(down, /);
    expect(cell.style.height).toMatch(/^round\(/);
  });

  it("keeps each cell a card's shape where CSS cannot round", async () => {
    const Unrounded = await loadMap(false);
    render(<Unrounded pockets={POCKETS.slice(0, filling(1))} current={0} onGo={() => {}} />);
    const {page, cell} = firstCell();
    expect(page.style.containerType).toBe('');
    expect(cell.style.width).toBe('');
    expect(cell.style.aspectRatio).toMatch(/^0\.75\b/);
  });
});
