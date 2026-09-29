import {Component, Suspense, type ReactNode} from 'react';
import {render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {lazyWithRetry} from '../lazyWithRetry';
import {reloadForStaleChunk} from '../staleChunkReload';

vi.mock('../staleChunkReload', () => ({reloadForStaleChunk: vi.fn()}));

function Greeting({name}: {name: string}) {
  return <p>hello {name}</p>;
}

class Boundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) {
    return {error};
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
    vi.mocked(reloadForStaleChunk).mockClear();
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

  it('reloads for a stale chunk once every retry fails, and surfaces the error', async () => {
    const importFn = vi.fn(() => Promise.reject(new Error('chunk 404')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLazy(importFn);

    expect(await screen.findByText('failed: chunk 404')).toBeInTheDocument();
    expect(importFn).toHaveBeenCalledTimes(3); // the first try plus 2 retries
    expect(reloadForStaleChunk).toHaveBeenCalledTimes(1);
  });
});
