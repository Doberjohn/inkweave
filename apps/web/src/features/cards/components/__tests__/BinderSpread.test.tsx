import {describe, it, expect, vi, afterEach} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {BinderSpread} from '../BinderSpread';
import {TURN_MS} from '../PageTurn';

/**
 * The page turn (#942): every change of view draws a turning sheet over the pages, built from
 * copies of them. How it looks and moves, and the grab, are measured in a real browser
 * (`collection-page-turn.spec.ts`); jsdom has no layout to turn or drag across.
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
