import {Component, Suspense, type ReactNode} from 'react';
import {act, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {lazyWithRetry, PageLoadError, RELOAD_GRACE_MS} from '../lazyWithRetry';
import {reloadForStaleChunk} from '../staleChunkReload';

// Unmocked return: false, the guard refusing on a page that never asked to reload.
vi.mock('../staleChunkReload', () => ({reloadForStaleChunk: vi.fn(() => false)}));

function Greeting({name}: {name: string}) {
  return <p>hello {name}</p>;
}

let caught: unknown;

class Boundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  componentDidCatch(error: Error) {
    caught = error;
  }
  render() {
    return this.state.error ? <p>failed: {this.state.error.message}</p> : this.props.children;
  }
}

function renderLazy(importFn: () => Promise<{Greeting: typeof Greeting}>) {
  const Lazy = lazyWithRetry(importFn, 'Greeting');
  render(
    <Boundary>
      <Suspense fallback={<p>loading</p>}>
        <Lazy name="Elsa" />
      </Suspense>
    </Boundary>,
  );
}

describe('lazyWithRetry', () => {
  afterEach(() => {
    vi.mocked(reloadForStaleChunk).mockClear().mockReturnValue(false);
    vi.useRealTimers();
    caught = undefined;
  });

  it('renders the named export with its props once the import resolves', async () => {
    renderLazy(() => Promise.resolve({Greeting}));

    expect(await screen.findByText('hello Elsa')).toBeInTheDocument();
  });

  it('retries a failed import instead of failing on the first miss', async () => {
    const importFn = vi
      .fn<() => Promise<{Greeting: typeof Greeting}>>()
      .mockRejectedValueOnce(new Error('chunk 404'))
      .mockResolvedValue({Greeting});
    renderLazy(importFn);

    expect(await screen.findByText('hello Elsa')).toBeInTheDocument();
    expect(importFn).toHaveBeenCalledTimes(2);
    expect(reloadForStaleChunk).not.toHaveBeenCalled();
  });

  // In a production build main.tsx cancels Vite's preload error, so a chunk that failed to
  // download resolves its import to undefined instead of rejecting (INKWEAVE-12).
  it('treats an import that resolves empty as a failed one', async () => {
    const importFn = vi
      .fn<() => Promise<{Greeting: typeof Greeting}>>()
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValue({Greeting});
    renderLazy(importFn);

    expect(await screen.findByText('hello Elsa')).toBeInTheDocument();
    expect(importFn).toHaveBeenCalledTimes(2);
  });

  it('keeps the loading state while the page reloads for a stale chunk', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    vi.mocked(reloadForStaleChunk).mockReturnValue(true);
    const importFn = vi.fn(() => Promise.resolve(undefined as never));
    renderLazy(importFn);

    await act(() => vi.advanceTimersByTimeAsync(RELOAD_GRACE_MS / 2));

    expect(importFn).toHaveBeenCalledTimes(3); // the first try plus 2 retries
    expect(reloadForStaleChunk).toHaveBeenCalledTimes(1);
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
  });

  it('gives up with PageLoadError when the reload never replaces the page', async () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    vi.mocked(reloadForStaleChunk).mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLazy(() => Promise.reject(new Error('chunk 404')));

    await act(() => vi.advanceTimersByTimeAsync(RELOAD_GRACE_MS));

    expect(screen.getByText("failed: This page couldn't load")).toBeInTheDocument();
  });

  it('throws PageLoadError at once, with the last failure as its cause, when the guard refuses a reload', async () => {
    const importFn = vi.fn(() => Promise.reject(new Error('chunk 404')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLazy(importFn);

    expect(await screen.findByText("failed: This page couldn't load")).toBeInTheDocument();
    expect(importFn).toHaveBeenCalledTimes(3);
    expect(reloadForStaleChunk).toHaveBeenCalledTimes(1);
    expect(caught).toBeInstanceOf(PageLoadError);
    expect((caught as PageLoadError).cause).toEqual(new Error('chunk 404'));
  });

  // A React.lazy whose import has already resolved still suspends once: the prerendered page
  // would give way to the route's fallback for a frame (#915).
  it('renders a preloaded page at once, never its fallback', async () => {
    const importFn = vi.fn(() => Promise.resolve({Greeting}));
    const Lazy = lazyWithRetry(importFn, 'Greeting');
    await Lazy.preload();

    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy name="Elsa" />
      </Suspense>,
    );

    expect(screen.getByText('hello Elsa')).toBeInTheDocument();
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('shares one import between preload() and a render that starts before it resolves', async () => {
    const importFn = vi.fn(() => Promise.resolve({Greeting}));
    const Lazy = lazyWithRetry(importFn, 'Greeting');
    const preloaded = Lazy.preload();
    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy name="Elsa" />
      </Suspense>,
    );

    await act(() => preloaded);

    expect(screen.getByText('hello Elsa')).toBeInTheDocument();
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});
