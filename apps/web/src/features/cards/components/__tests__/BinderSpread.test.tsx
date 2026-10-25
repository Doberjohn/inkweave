import {describe, it, expect, vi, afterEach} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {touchMoveKept} from '../../../../shared/test-utils';
import {BinderSpread} from '../BinderSpread';
import {TURN_MS} from '../PageTurn';

/**
 * The page turn (#942): every change of view draws a turning sheet over the pages, built from
 * copies of them. How it looks and moves, and the grab, are measured in a real browser
 * (`collection-page-turn.spec.ts`); jsdom has no layout to turn or drag across, so here a grab
 * only shows whether it keeps its finger's touch.
 */

/** Slot n holds card n + 1, focusable as `CardTile` is, and marked for the #790 keys. */
const slot = (index: number, tabIndex: number) =>
  index < 0 ? null : (
    <button type="button" data-roving-item tabIndex={tabIndex}>
      {`Card ${index + 1}`}
    </button>
  );

/** A spread mid-binder: its view at `start`, cards 13 to 36 by default. */
function spread(props: Partial<Parameters<typeof BinderSpread>[0]> = {}) {
  return (
    <BinderSpread
      start={12}
      renderSlot={slot}
      onPrev={vi.fn()}
      onNext={vi.fn()}
      canPrev
      canNext
      cardCount={96}
      {...props}
    />
  );
}

/** A real card: the copies in a turning sheet are hidden from assistive tech, so no role query finds them. */
const card = (n: number) => screen.getByRole('button', {name: `Card ${n}`});
const sheets = () => document.querySelectorAll('.binder-turn');
const firstCardIn = (selector: string) => document.querySelector(`.binder-turn ${selector} button`)?.textContent;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('BinderSpread page turn (#942)', () => {
  it('turns a sheet over the pages when the view changes, hidden, inert and out of the Tab order', () => {
    const view = render(spread());
    expect(sheets()).toHaveLength(0);

    view.rerender(spread({start: 36}));
    expect(sheets()).toHaveLength(1);
    const [sheet] = sheets();
    expect(sheet).toHaveAttribute('aria-hidden', 'true');
    expect(sheet).toHaveAttribute('inert');
    expect(document.querySelector('.binder-board')).toHaveClass('binder-turning');
    // Forward: the right page it lifts (25 to 36) and the next spread's left page it lands as.
    expect(firstCardIn('.binder-leaf-face:not(.binder-leaf-back)')).toBe('Card 25');
    expect(firstCardIn('.binder-leaf-back')).toBe('Card 37');
    const copies = [...sheet.querySelectorAll('button')];
    expect(copies.length).toBeGreaterThan(0);
    expect(copies.every((copy) => copy.tabIndex === -1)).toBe(true);
    // The view itself changed at once.
    expect(card(37)).toHaveAttribute('tabindex', '0');
  });

  it('changes the view at once under reduced motion, with no sheet', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({matches: query.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn()})),
    );
    const view = render(spread());
    view.rerender(spread({start: 36}));
    expect(sheets()).toHaveLength(0);
    expect(document.querySelector('.binder-board')).not.toHaveClass('binder-turning');
    expect(card(37)).toBeInTheDocument();
  });

  it('replaces a running turn with the next, lifted from where the first was going', () => {
    const view = render(spread());
    view.rerender(spread({start: 36}));
    view.rerender(spread({start: 60}));
    expect(sheets()).toHaveLength(1);
    // From spread 36: its right page (49 to 60) lifts, never the first turn's (25 to 36).
    expect(firstCardIn('.binder-leaf-face:not(.binder-leaf-back)')).toBe('Card 49');
    expect(firstCardIn('.binder-turn-flat')).toBe('Card 37');
  });

  it('turns nothing when the binder crosses the phone width', () => {
    const view = render(spread());
    view.rerender(spread({start: 24, single: true}));
    expect(sheets()).toHaveLength(0);
  });

  it('takes the sheet away once it lands, and not for an art fade inside it', () => {
    const view = render(spread());
    view.rerender(spread({start: 36}));
    const leaf = document.querySelector('.binder-leaf')!;
    const transitionEnd = (propertyName: string) =>
      Object.assign(new Event('transitionend', {bubbles: true}), {propertyName});

    // A copy's art fading in ends a transition of its own, which bubbles up through the sheet.
    act(() => {
      leaf.querySelector('button')!.dispatchEvent(transitionEnd('opacity'));
    });
    expect(sheets()).toHaveLength(1);
    act(() => {
      leaf.dispatchEvent(transitionEnd('transform'));
    });
    expect(sheets()).toHaveLength(0);
    expect(document.querySelector('.binder-board')).not.toHaveClass('binder-turning');
  });

  it('ends a turn whose transitionend never comes, as in a hidden tab', () => {
    vi.useFakeTimers();
    const view = render(spread());
    view.rerender(spread({start: 36}));
    act(() => vi.advanceTimersByTime(TURN_MS));
    expect(sheets()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(200));
    expect(sheets()).toHaveLength(0);
  });

  it("keeps the arrow keys and End on the real cards while a sheet's copies are drawn", async () => {
    // Without `cardCount` the tiles say how many cards there are (`cardsAt`), and the copies are
    // tiles too: the right page holds four cards, 49 to 52.
    const fewer = (index: number, tabIndex: number) => (index < 52 ? slot(index, tabIndex) : null);
    const user = userEvent.setup();
    const view = render(spread({renderSlot: fewer, cardCount: undefined}));
    view.rerender(spread({start: 36, renderSlot: fewer, cardCount: undefined}));
    expect(sheets()).toHaveLength(1);

    act(() => card(40).focus());
    await user.keyboard('{ArrowRight}');
    expect(card(49)).toHaveFocus();
    await user.keyboard('{End}');
    expect(card(52)).toHaveFocus();
  });

  it("hands the focus to the new view's first card when the view changes under a focused one", () => {
    const view = render(spread());
    act(() => card(15).focus());
    view.rerender(spread({start: 36}));
    expect(card(37)).toHaveFocus();
  });
});

// An iPhone scrolls the page as a finger holding a page drifts down, and the scroll's
// pointercancel dropped the page (#963): a page in hand keeps its finger's touch.
describe('BinderSpread page in hand (#963)', () => {
  const page = (name: string) => screen.getByRole('group', {name});

  /** A finger's pointer event on `el`, `dx` across and `dy` down from where it presses. */
  const finger = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', el: Element, dx = 0, dy = 0) =>
    fireEvent[type](el, {pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 300 + dx, clientY: 200 + dy});

  /** Presses a finger on the page named `name`. jsdom has no pointer capture, which a lift takes. */
  function press(name: string) {
    document.querySelector<HTMLElement>('.binder-board')!.setPointerCapture = vi.fn();
    finger('pointerDown', page(name));
    return page(name);
  }

  it("keeps a finger's touch from the page's scroll while it holds a page, and only then", () => {
    render(spread());
    const right = press('Right page');
    expect(touchMoveKept(right), 'pressed').toBe(false);

    finger('pointerMove', right, -20, 6);
    expect(touchMoveKept(right), 'in hand, drifting down').toBe(true);
    finger('pointerUp', right, -20, 6);
    expect(touchMoveKept(right), 'let go').toBe(false);
  });

  it("leaves a finger's touch to the scroll when it goes down first, or the way its page doesn't turn", () => {
    render(spread());
    const right = press('Right page');
    finger('pointerMove', right, 2, 20);
    expect(touchMoveKept(right), 'down first').toBe(false);
    finger('pointerUp', right, 2, 20);

    const left = press('Left page');
    finger('pointerMove', left, -20);
    expect(touchMoveKept(left), 'the left page, leftward').toBe(false);
  });

  /** A listener that can keep a touchmove from the scroll. React's own, at its root, are passive. */
  const holdsTouch = ([type, , options]: Parameters<EventTarget['addEventListener']>) =>
    type === 'touchmove' && typeof options === 'object' && options.passive === false;

  // A listener that can hold a touch makes a scroll that starts on the binder wait for it (PR #965).
  it('listens for the touch only while a page can turn', () => {
    const listen = vi.spyOn(EventTarget.prototype, 'addEventListener');
    const holds = () => listen.mock.calls.filter(holdsTouch).length;
    try {
      const view = render(spread({canPrev: false, canNext: false}));
      expect(holds(), 'no page can turn').toBe(0);
      view.rerender(spread());
      expect(holds(), 'a page can turn').toBe(1);
    } finally {
      listen.mockRestore();
    }
  });

  // The new view's board never hears the pointerup that would end the press (PR #965).
  it('lets the touch go once a change of view swaps the page in hand out', () => {
    const view = render(spread());
    finger('pointerMove', press('Right page'), -20);

    view.rerender(spread({single: true}));

    expect(touchMoveKept(page('Page'))).toBe(false);
  });
});
