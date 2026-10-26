import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render} from '@testing-library/react';
import {CopiesStripe, type StripePart} from '../CopiesStripe';

/** jsdom has no ResizeObserver: these hand the test a way to report a width to each observer, once observing. */
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

const PARTS: StripePart[] = [{label: 'normal', count: 2, tone: 'default', onChange: () => {}}];

/** The row the stripe zooms: the element whose inline style carries the zoom. */
const zoomedRow = (container: HTMLElement) => container.querySelector<HTMLElement>('[style*="zoom"]')!;

/** Reports `width` to every observer, as the browser's step before the paint does, and nothing more. */
const reportWidth = (width: number) => reports.forEach((report) => report(width));

describe("CopiesStripe's size before its first paint (owner, 2026-10-26: counts drawn full size for a frame)", () => {
  beforeEach(() => {
    reports = [];
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("puts a pocket's zoom on its row as the observer reports its width, with no render between", () => {
    const {container} = render(<CopiesStripe parts={PARTS} open={false} />);
    reportWidth(80);
    expect(zoomedRow(container).style.zoom).toBe('0.5');
  });

  it("leaves the card window's stripe to its render, since its zoom moves the window's contents", () => {
    const {container} = render(<CopiesStripe parts={PARTS} open={false} fit="bar" />);
    reportWidth(80);
    expect(zoomedRow(container).style.zoom).toBe('1');
  });
});
