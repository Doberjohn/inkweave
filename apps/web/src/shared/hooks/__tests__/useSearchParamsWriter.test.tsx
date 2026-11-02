import {describe, it, expect} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {MemoryRouter, useLocation, useNavigate} from 'react-router-dom';
import type {ReactNode} from 'react';
import {useSearchParamsWriter} from '../useSearchParamsWriter';

const routerAt = (entries: string[]) =>
  function Router({children}: {children: ReactNode}) {
    return <MemoryRouter initialEntries={entries}>{children}</MemoryRouter>;
  };

/** The writer at `entries`' last URL, beside the location and a navigate. */
function renderWriter(entries: string[]) {
  return renderHook(
    () => {
      const [, write] = useSearchParamsWriter();
      return {write, location: useLocation(), navigate: useNavigate()};
    },
    {wrapper: routerAt(entries)},
  );
}

describe('useSearchParamsWriter', () => {
  it('lands two writes made before a render', () => {
    const {result} = renderWriter(['/browse']);
    act(() => {
      result.current.write((next) => next.set('ink', 'Amber'));
      result.current.write((next) => next.set('cost', '3'));
    });
    expect(result.current.location.search).toBe('?ink=Amber&cost=3');
  });

  it('starts a write after a render from the committed URL', () => {
    const {result} = renderWriter(['/browse?ink=Amber']);
    act(() => result.current.write((next) => next.set('cost', '3')));
    expect(result.current.location.search).toBe('?ink=Amber&cost=3');
    act(() => result.current.write((next) => next.delete('ink')));
    expect(result.current.location.search).toBe('?cost=3');
  });

  it('writes the params a change returns in place of its own', () => {
    const {result} = renderWriter(['/browse?ink=Amber']);
    act(() => result.current.write(() => new URLSearchParams('type=Song')));
    expect(result.current.location.search).toBe('?type=Song');
  });

  it('hands a change the params it started from', () => {
    const {result} = renderWriter(['/browse?ink=Amber']);
    let started = '';
    act(() => {
      result.current.write((next) => next.set('cost', '3'));
      result.current.write((next, base) => {
        started = base.toString();
        next.delete('ink');
      });
    });
    expect(started).toBe('ink=Amber&cost=3');
  });

  it('lands writes two hooks make before a render', () => {
    const {result} = renderHook(
      () => {
        const [, filters] = useSearchParamsWriter();
        const [, binder] = useSearchParamsWriter();
        return {filters, binder, location: useLocation()};
      },
      {wrapper: routerAt(['/browse?binder=9'])},
    );
    act(() => {
      result.current.binder((next) => next.set('owned', 'missing'));
      result.current.filters((next) => next.set('ink', 'Amber'));
    });
    expect(result.current.location.search).toBe('?binder=9&owned=missing&ink=Amber');
  });

  it.each([
    {made: 'replaced', entries: ['/browse?ink=Ruby', '/browse?ink=Amber'], replace: true},
    {made: 'pushed', entries: ['/browse?ink=Ruby'], replace: false},
  ])('starts from the URL Back reached after a write that $made', ({entries, replace}) => {
    const {result} = renderWriter(entries);
    act(() => result.current.write((next) => next.set('cost', '3'), {replace}));
    act(() => {
      void result.current.navigate(-1);
    });
    expect(result.current.location.search).toBe('?ink=Ruby');
    act(() => result.current.write((next) => next.set('type', 'Song')));
    expect(result.current.location.search).toBe('?ink=Ruby&type=Song');
  });
});
