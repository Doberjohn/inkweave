import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render} from '@testing-library/react';
import {RenderProfiler} from '../RenderProfiler';

// Holds each report's callback, as onSentryReady does while Sentry hasn't loaded.
const queued = vi.hoisted(() => [] as ((sentry: unknown) => void)[]);
vi.mock('../../lib/sentry', () => ({
  onSentryReady: (callback: (sentry: unknown) => void) => queued.push(callback),
}));

/** Blocks for longer than the 16 ms frame budget, so every commit counts as a slow render. */
function burnPastFrameBudget() {
  const end = performance.now() + 20;
  while (performance.now() < end) {
    // Busy-wait: the Profiler measures real render time.
  }
}

function Slow({n}: {n: number}) {
  burnPastFrameBudget();
  return <span>{n}</span>;
}

describe('RenderProfiler', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_SENTRY_DSN', 'http://public@127.0.0.1:9/1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('holds at most 50 slow-render reports for Sentry, freeing a slot as each one runs', () => {
    const profiled = (n: number) => (
      <RenderProfiler id="SlowList">
        <Slow n={n} />
      </RenderProfiler>
    );
    const {rerender} = render(profiled(0));
    for (let n = 1; n <= 55; n++) rerender(profiled(n));
    expect(queued).toHaveLength(50);

    queued[0]({startSpan: vi.fn()});
    rerender(profiled(56));
    expect(queued).toHaveLength(51);
  });
});
