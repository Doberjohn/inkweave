import {renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {useScrollToTopOnRouteChange} from '../useScrollToTopOnRouteChange';

describe('useScrollToTopOnRouteChange', () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the visitor's place on the first render, which a held prerendered page let them scroll (#915)", () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    renderHook(() => useScrollToTopOnRouteChange('/'), {reactStrictMode: true});

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('shows each new route from its top', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const {rerender} = renderHook(({pathname}) => useScrollToTopOnRouteChange(pathname), {
      initialProps: {pathname: '/'},
    });

    rerender({pathname: '/browse'});
    rerender({pathname: '/browse'});
    rerender({pathname: '/'});

    expect(scrollTo.mock.calls).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
