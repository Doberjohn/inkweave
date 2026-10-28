import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {FriendsBadge} from './FriendsBadge';

/** jsdom has no ResizeObserver: this hands the test a way to report the pocket's width, once observing. */
let reports: ((width: number) => void)[];
class TestResizeObserver {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    reports.push((width) =>
      this.callback([{target, contentRect: {width}} as unknown as ResizeObserverEntry], this as unknown as ResizeObserver),
    );
  }
  unobserve() {}
  disconnect() {}
}

const badge = (props: Partial<Parameters<typeof FriendsBadge>[0]> = {}) => (
  <FriendsBadge count={11} label="11 friends have it" gold={false} onPress={vi.fn()} {...props} />
);

describe('FriendsBadge (#1055)', () => {
  beforeEach(() => {
    reports = [];
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is a button named in words, showing the count, out of the Tab order', () => {
    render(badge());
    const button = screen.getByRole('button', {name: '11 friends have it'});
    expect(button).toHaveAttribute('tabindex', '-1');
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button.querySelector('[aria-hidden="true"]:not(svg)')).toHaveTextContent(/^11$/);
  });

  it('never lifts the binder page from under a press', () => {
    render(badge());
    expect(screen.getByRole('button')).toHaveAttribute('data-no-grab');
  });

  it('opens what it names, keeping the focus where it was', () => {
    const onPress = vi.fn();
    render(badge({onPress}));
    const button = screen.getByRole('button');
    // A mouse press that isn't prevented would focus it.
    expect(fireEvent.mouseDown(button)).toBe(false);
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is dark, or brushed gold when every copy on offer is a foil', () => {
    const view = render(badge());
    expect(screen.getByRole('button').style.backgroundImage).not.toContain('linear-gradient');
    view.rerender(badge({gold: true}));
    expect(screen.getByRole('button').style.backgroundImage).toContain('linear-gradient');
  });

  it("takes a smaller pocket's zoom before it paints, and never grows past a 130px pocket's", () => {
    render(badge());
    reports.forEach((report) => report(65));
    expect(screen.getByRole('button').style.zoom).toBe('0.5');
    reports = [];
    render(badge({label: 'wide'}));
    reports.forEach((report) => report(260));
    expect(screen.getByRole('button', {name: 'wide'}).style.zoom).toBe('1');
  });

  it('hands its zoom to the touch ring, which binder.css sizes by it so the zoom never shrinks it', () => {
    render(badge());
    act(() => reports.forEach((report) => report(65)));
    expect(screen.getByRole('button').style.getPropertyValue('--badge-zoom')).toBe('0.5');
  });
});
