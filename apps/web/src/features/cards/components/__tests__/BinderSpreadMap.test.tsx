import {useState} from 'react';
import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {act, render, screen, fireEvent} from '@testing-library/react';
import {BinderSpreadMap, type Pocket} from '../BinderSpreadMap';

/** Forty spreads, every pocket held. */
const POCKETS: Pocket[] = Array.from({length: 40 * 24}, (): Pocket => ({owned: true, inks: ['Amber']}));

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
    // start would clamp the move and hide where it lands (#790).
    render(<Live />);
    fireEvent.click(screen.getByRole('button', {name: /^Spread 11 of 40/}));
    fireEvent.click(screen.getByRole('button', {name: /^Spread 21 of 40/}));
    fireEvent.click(screen.getByRole('button', {name: 'Previous spread'}));
    expect(spreads()[0]).toMatch(/^Spread 10 of 40/);
    expect(spreads()[10]).toMatch(/^Spread 20 of 40/);
    expect(screen.getByRole('button', {name: /^Spread 20 of 40/})).toHaveAttribute('aria-current', 'true');
  });

  it('keeps a short binder whole, with no window to move', () => {
    render(<BinderSpreadMap pockets={POCKETS.slice(0, 9 * 24)} current={8} onGo={() => {}} />);
    expect(spreads()).toHaveLength(9);
  });
});

/**
 * jsdom lays nothing out, so the row and its buttons get widths: the row `row.nav` px, and
 * Previous and Next 95 and 71px, as they measure at 1920. Every way of reading a width
 * agrees, so these tests don't depend on which one the map reads.
 */
function layOut(row: {nav: number}) {
  const widthOf = (el: Element) => {
    if (el.tagName === 'NAV') return row.nav;
    const label = el.getAttribute('aria-label');
    if (label === 'Previous spread') return 95;
    return label === 'Next spread' ? 71 : 0;
  };
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

  // Room between the buttons is the row less 95 + 71 and two 12px gaps; each spread
  // needs 66px and 4px after it: (room + 4) / 70, rounded down, from 1 to 11.
  it.each([
    [1272, 11], // 1920 wide: room for fifteen, but the window holds eleven at most
    [792, 8], // 1440
    [632, 6], // 1280
    [376, 2], // 1024, both panels docked
    [200, 1], // no room at all: the open spread still shows
  ])('a %ipx row shows %i spreads', (nav, count) => {
    layOut({nav});
    render(<Live />);
    expect(spreads()).toHaveLength(count);
  });

  it('moves a narrow window on at its own last spread', () => {
    layOut({nav: 632});
    render(<Live />);
    fireEvent.click(screen.getByRole('button', {name: /^Spread 6 of 40/}));
    expect(spreads()[0]).toMatch(/^Spread 6 of 40/);
    expect(spreads()[5]).toMatch(/^Spread 11 of 40/);
  });

  it("opens a narrow window on the spread on show, even near a short binder's end", () => {
    layOut({nav: 376});
    render(<BinderSpreadMap pockets={POCKETS.slice(0, 9 * 24)} current={2} onGo={() => {}} />);
    expect(spreads()).toEqual([expect.stringMatching(/^Spread 3 of 9/), expect.stringMatching(/^Spread 4 of 9/)]);
  });

  it('keeps the open spread in view when the row narrows', () => {
    const row = {nav: 1272};
    layOut(row);
    render(<Live />);
    fireEvent.click(screen.getByRole('button', {name: /^Spread 10 of 40/}));
    row.nav = 632;
    act(() => resized.forEach((tell) => tell()));
    expect(spreads()).toHaveLength(6);
    expect(spreads()[5]).toMatch(/^Spread 10 of 40/);
    expect(screen.getByRole('button', {name: /^Spread 10 of 40/})).toHaveAttribute('aria-current', 'true');
  });
});

describe('BinderSpreadMap, set by set', () => {
  it("names each spread's set and its place in it, and both sets where one ends and the next begins", () => {
    // Set A fills nine spreads and half the tenth, where Set B starts.
    const sets = [
      {start: 0, label: 'Set A'},
      {start: 9 * 24 + 12, label: 'Set B'},
    ];
    render(<BinderSpreadMap pockets={POCKETS} current={0} onGo={() => {}} sets={sets} />);
    expect(spreads()[0]).toBe('Set A, spread 1 of 10: nothing missing');
    expect(spreads()[9]).toBe('Set A, spread 10 of 10, then Set B, spread 1 of 31: nothing missing');
    expect(spreads()[10]).toBe('Set B, spread 2 of 31: nothing missing');
  });
});

/** The first mini spread's left page, and that page's first cell. */
function firstCell() {
  const page = screen.getByRole('button', {name: /^Spread 1 of 1/}).firstElementChild as HTMLElement;
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
    render(<Rounded pockets={POCKETS.slice(0, 24)} current={0} onGo={() => {}} />);
    const {page, cell} = firstCell();
    expect(page.style.containerType).toBe('inline-size');
    expect(cell.style.width).toMatch(/^round\(down, /);
    expect(cell.style.height).toMatch(/^round\(/);
  });

  it("keeps each cell a card's shape where CSS cannot round", async () => {
    const Unrounded = await loadMap(false);
    render(<Unrounded pockets={POCKETS.slice(0, 24)} current={0} onGo={() => {}} />);
    const {page, cell} = firstCell();
    expect(page.style.containerType).toBe('');
    expect(cell.style.width).toBe('');
    expect(cell.style.aspectRatio).toMatch(/^0\.75\b/);
  });
});
