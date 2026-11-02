import {useRef} from 'react';
import {useLocation, useSearchParams, type NavigateOptions} from 'react-router-dom';

/**
 * Edits `next` in place, or returns the params to write instead. `base` is what `next` started
 * as, for a change that compares the two (`useFilterParams` counts the filters a write turns on).
 */
export type ParamsChange = (next: URLSearchParams, base: URLSearchParams) => URLSearchParams | void;

/**
 * useSearchParams with a write that starts from the newest params. React Router builds a
 * functional update's `prev` from the render its setter came from, and until a write's render
 * commits (a transition can hold it back), a second click runs the old render's handlers. So a
 * write remembers what it wrote and the location it wrote over: while that location is still
 * the committed one, the next write starts from what was written. Any commit since (this
 * write's, Back, a link) gives the location a new key, and the committed params lead again.
 * Each call of the hook remembers only its own writes, so two hooks writing in one tick can
 * still lose one: keep each user action to one writer.
 */
export function useSearchParamsWriter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {key} = useLocation();
  const last = useRef<{over: string; search: string} | null>(null);
  const write = (change: ParamsChange, options: NavigateOptions = {replace: true}) => {
    const base = new URLSearchParams(last.current?.over === key ? last.current.search : searchParams);
    const params = new URLSearchParams(base);
    const next = change(params, base) ?? params;
    last.current = {over: key, search: next.toString()};
    setSearchParams(next, options);
  };
  return [searchParams, write] as const;
}
