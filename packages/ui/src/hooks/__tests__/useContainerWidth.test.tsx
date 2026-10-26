import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {screen, waitFor} from '@testing-library/react';
import {useLayoutEffect, useRef} from 'react';
import {flushSync} from 'react-dom';
import {createRoot, type Root} from 'react-dom/client';
import {useContainerWidth} from '../useContainerWidth';

/** A box that shows the width the hook measured. */
function Box() {
  const ref = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(ref);
  return (
    <div ref={ref} data-testid="box">
      {width}
    </div>
  );
}

/** Whether the box was observed by the end of the commit that mounted it: a parent's layout effect runs then. */
let observedInCommit = false;
function Page() {
  useLayoutEffect(() => {
    observedInCommit = report !== undefined;
  }, []);
  return <Box />;
}

/** jsdom has no ResizeObserver: this one hands the test a way to report a width, once observing. */
let report: ((width: number) => void) | undefined;
class TestResizeObserver {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    report = (width) =>
      this.callback(
        [{target, contentRect: {width}} as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
  }
  unobserve() {}
  disconnect() {}
}

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  report = undefined;
  observedInCommit = false;
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
  // As in the browser, where no act flushes an update: what renders at once is what paints.
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', false);
  container = document.body.appendChild(document.createElement('div'));
  root = createRoot(container);
  flushSync(() => root.render(<Page />));
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.unstubAllGlobals();
});

const shown = () => screen.getByTestId('box').textContent;

describe('useContainerWidth (owner, 2026-10-26: counts drawn full size for a frame)', () => {
  it('observes from the commit that mounts it, before the browser lays it out', () => {
    // A passive effect may start observing only after the paint, a frame late.
    expect(observedInCommit).toBe(true);
  });

  it('renders its first width as the observer reports it, before the paint', () => {
    report!(90);
    expect(shown()).toBe('90');
  });

  it('ignores a report of no width, from an element not laid out', () => {
    report!(0);
    expect(shown()).toBe('0');
  });

  it("renders a later width, a resize's, too", async () => {
    report!(90);
    report!(120);
    await waitFor(() => expect(shown()).toBe('120'));
  });
});
