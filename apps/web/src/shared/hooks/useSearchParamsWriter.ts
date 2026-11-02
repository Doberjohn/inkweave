import {useLocation, useSearchParams, type Location, type NavigateOptions} from 'react-router-dom';

/**
 * Edits `next` in place, or returns the params to write instead. `base` is what `next` started
 * as, for a change that compares the two (`useFilterParams` counts the filters a write turns on).
 */
export type ParamsChange = (next: URLSearchParams, base: URLSearchParams) => URLSearchParams | void;

/**
 * The last write over each location, shared by every writer on the page. The router hands out a
 * new location object whenever the URL commits (a write's, Back, a link, even back to an entry
 * seen before), so an entry here stops matching the moment its write, or anything else, lands.
 */
const lastWrites = new WeakMap<Location, string>();

/**
 * useSearchParams with a write that starts from the newest params. React Router builds a
 * functional update's `prev` from the render its setter came from, and until a write's render
 * commits (a transition can hold it back), a second click runs the old render's handlers. So a
 * write remembers what it wrote over the committed location, and the next write over that same
 * location starts from it, whichever hook makes it: Browse's filters and its binder's params can
 * both write before a render and keep both.
 */
export function useSearchParamsWriter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const write = (change: ParamsChange, options: NavigateOptions = {replace: true}) => {
    const base = new URLSearchParams(lastWrites.get(location) ?? searchParams);
    const params = new URLSearchParams(base);
    const next = change(params, base) ?? params;
    lastWrites.set(location, next.toString());
    setSearchParams(next, options);
  };
  return [searchParams, write] as const;
}
